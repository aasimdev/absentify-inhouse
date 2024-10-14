import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, CalendarSyncSettingCalendarType, PrismaClient, SyncStatus } from '@prisma/client';
import { getMicrosoftCalendarAccessToken, getMicrosoftGroupsDelegatedAccessToken } from 'lib/getMicrosoftAccessToken';
import { decode } from 'jsonwebtoken';
import axios from 'axios';
import {
  hasBusinessSubscription,
  hasBusinessV1Subscription,
  hasEnterpriseSubscription,
  hasSmalTeamSubscription
} from 'lib/subscriptionHelper';
import { defaultWorkspaceSelect } from './workspace';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { inngest } from '~/inngest/inngest_client';

/**
 * Default selector for calendar_sync_setting.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultSharedCalendar_SettingSelect = Prisma.validator<Prisma.CalendarSyncSettingSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  description: true,
  calendar_sync_type: true,
  calendar_id: true,
  calendar_name: true,
  calendar_microsoft_user_id: true,
  calendar_microsoft_tenant_id: true,
  email: true,
  deleted: true,
  calendarSyncSettingLeaveTypes: {
    select: { sync_as_name: true, only_approved: true, leave_type: { select: { id: true } } }
  },
  calendarSyncSettingDepartments: {
    select: { department: { select: { id: true } } }
  }
});

export const calendarSyncSettingRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        workspace_id: z.string(),
        calendar_id: z.string().nullable(),
        calendar_name: z.string().nullable(),
        calendar_microsoft_user_id: z.string().nullable(),
        calendar_microsoft_tenant_id: z.string().nullable(),
        email: z.string().nullable(),
        calendar_sync_type: z.nativeEnum(CalendarSyncSettingCalendarType),
        department_ids: z.array(z.string()),
        leave_types: z.array(z.object({ id: z.string(), sync_as_name: z.string(), only_approved: z.boolean() })),
        token_member_id: z.string().nullable()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add calendarSyncSetting'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add calendarSyncSetting'
        });
      }

      const [workspace] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: input.workspace_id },
          select: defaultWorkspaceSelect
        })
      ]);
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add department'
        });
      }

      let hasEnterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);

      let hasBusinessV1Plan = hasBusinessV1Subscription(workspace.subscriptions);
      const hasBusinessPlan = hasBusinessSubscription(workspace.subscriptions);
      const hasSmalTeamPlan = hasSmalTeamSubscription(workspace.subscriptions);
      if (!hasBusinessV1Plan && !hasEnterprisePlan && !hasBusinessPlan && !hasSmalTeamPlan) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('calendar_sync-freeplan')
        });
      }
      if (hasBusinessV1Plan && !hasEnterprisePlan) {
        const calendarSyncSettings = await ctx.prisma.calendarSyncSetting.count({
          where: { workspace_id: input.workspace_id, deleted: false }
        });

        let currentSettingsCount = await ctx.prisma.subscription.count({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            subscription_plan_id: 'CALENDAR_SYNC_ADDON'
          }
        });
        currentSettingsCount = currentSettingsCount + 1;

        if (calendarSyncSettings >= currentSettingsCount) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('calendar_sync_free_reached-businessplan')
          });
        }
      }
      if (hasSmalTeamPlan && !hasEnterprisePlan) {
        const calendarSyncSettings = await ctx.prisma.calendarSyncSetting.count({
          where: { workspace_id: input.workspace_id, deleted: false }
        });
        if (calendarSyncSettings >= 1) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('calendar_sync_free_reached-smallteamplan')
          });
        }
      }
      if (hasBusinessPlan && !hasEnterprisePlan) {
        const calendarSyncSettings = await ctx.prisma.calendarSyncSetting.count({
          where: { workspace_id: input.workspace_id, deleted: false }
        });
        if (calendarSyncSettings >= 5) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('calendar_sync_free_reached-businessv2plan')
          });
        }
      }
      const calendar_sync_setting = await ctx.prisma.calendarSyncSetting.create({
        data: {
          name: input.name,
          description: input.description,
          workspace_id: input.workspace_id,
          calendar_id: input.calendar_id,
          calendar_name: input.calendar_name,
          calendar_microsoft_user_id: input.calendar_microsoft_user_id,
          calendar_microsoft_tenant_id: input.calendar_microsoft_tenant_id,
          email: input.email,
          calendar_sync_type: input.calendar_sync_type,
          token_member_id: input.token_member_id
        },
        select: { id: true, deleted: true, calendar_microsoft_tenant_id: true }
      });
      await ctx.prisma.$transaction([
        ctx.prisma.calendarSyncSettingDepartment.createMany({
          data: input.department_ids.map((department_id) => ({
            calendar_sync_setting_id: calendar_sync_setting.id,
            department_id
          }))
        }),
        ctx.prisma.calendarSyncSettingLeaveType.createMany({
          data: input.leave_types.map((leave_type) => ({
            calendar_sync_setting_id: calendar_sync_setting.id,
            leave_type_id: leave_type.id,
            sync_as_name: leave_type.sync_as_name,
            only_approved: leave_type.only_approved
          }))
        })
      ]);
      try {
        await CreateRequestSyncLogEntries(input, ctx.prisma, calendar_sync_setting);
      } catch (e) {
        await ctx.prisma.calendarSyncSetting.delete({ where: { id: calendar_sync_setting.id } });
        throw 'Error cerating request sync log entries';
      }

      return await ctx.prisma.calendarSyncSetting.findUnique({
        where: { id: calendar_sync_setting.id },
        select: defaultSharedCalendar_SettingSelect
      });
    }),
  all: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add calendarSyncSetting'
      });
    }

    return ctx.prisma.calendarSyncSetting.findMany({
      select: defaultSharedCalendar_SettingSelect,
      where: { workspace_id: ctx.current_member.workspace_id, deleted: false },
      orderBy: [
        {
          name: 'asc'
        }
      ]
    });
  }),
  microsoft_calendar: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add calendarSyncSetting'
      });
    }
    if (!ctx.current_member.microsoft_user_id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add calendarSyncSetting'
      });
    }
    let access_token = await getMicrosoftCalendarAccessToken(ctx.current_member.microsoft_tenantId);
    let t: any = decode(access_token);

    if (t.roles && t.roles.find((x: string) => x == 'Calendars.ReadWrite')) {
      let calendars: {
        id: string;
        name: string;
        isDefaultCalendar: boolean;
        canEdit: boolean;
        owner: {
          name: string;
          address: string;
        };
      }[] = [];
      let nextLink = `https://graph.microsoft.com/v1.0/users/${ctx.current_member.microsoft_user_id}/calendars?$select=id,name,canEdit,isDefaultCalendar,owner`;

      while (nextLink) {
        let res = await axios.get(nextLink, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });

        calendars = calendars.concat(res.data.value);

        // Check whether a nextLink exists and update it for the next request
        nextLink = res.data['@odata.nextLink'];
      }

      return calendars.filter((y) => y.canEdit && !y.isDefaultCalendar);
    }
    return [];
  }),
  infiniteHistory: protectedProcedure
    .input(
      z.object({
        calendar_sync_setting_id: z.string(),
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.number().nullish() // <-- "cursor" needs to exist, but can be any type
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const { cursor } = input;
      const items = await ctx.prisma.requestSyncLog.findMany({
        take: limit + 1, // get an extra item at the end which we'll use as next cursor
        where: { calendar_sync_setting_id: input.calendar_sync_setting_id },
        select: { id: true, sync_status: true, error: true, createdAt: true },
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc'
        }
      });
      let nextCursor: typeof cursor | null = null;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor
      };
    }),

  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string(),
          description: z.string(),
          workspace_id: z.string(),
          calendar_id: z.string().nullable(),
          calendar_name: z.string().nullable(),
          calendar_microsoft_user_id: z.string().nullable(),
          calendar_microsoft_tenant_id: z.string().nullable(),
          email: z.string().nullable(),
          department_ids: z.array(z.string()),
          leave_types: z.array(z.object({ id: z.string(), sync_as_name: z.string(), only_approved: z.boolean() })),
          calendar_sync_type: z.nativeEnum(CalendarSyncSettingCalendarType),
          token_member_id: z.string().nullable()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit calendarSyncSetting'
        });
      }

      const caller = calendarSyncSettingRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      await caller.delete({ id: input.id });
      await caller.add({
        name: input.data.name,
        description: input.data.description,
        workspace_id: input.data.workspace_id,
        calendar_id: input.data.calendar_id,
        calendar_name: input.data.calendar_name,
        calendar_microsoft_user_id: input.data.calendar_microsoft_user_id,
        calendar_microsoft_tenant_id: input.data.calendar_microsoft_tenant_id,
        email: input.data.email,
        calendar_sync_type: input.data.calendar_sync_type,
        token_member_id: input.data.token_member_id,
        department_ids: input.data.department_ids,
        leave_types: input.data.leave_types
      });
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const calendarSyncSetting = await ctx.prisma.calendarSyncSetting.findUnique({
        where: { id },
        select: {
          id: true,
          workspace_id: true
        }
      });
      if (calendarSyncSetting?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      await inngest.send({
        name: 'request/delete_shared_calendar_setting',
        data: { calendar_sync_setting_id: calendarSyncSetting.id }
      });
      await ctx.prisma.calendarSyncSetting.update({
        where: { id },
        data: { deleted: true }
      });

      return {
        id
      };
    }),
  microsoft_group_calendars: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add calendarSyncSetting'
      });
    }
    if (!ctx.current_member.microsoft_user_id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add calendarSyncSetting'
      });
    }
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: { microsoft_groups_read_write_all: true }
    });

    if (!workspace) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add soemthing'
      });
    }

    let access_token = '';
    try {
      access_token = await getMicrosoftGroupsDelegatedAccessToken(ctx.current_member.id, ctx.prisma);
    } catch (e) {
      return { groups: [], valid_token: false };
    }
    let t: any = decode(access_token);
    if (t.scp && t.scp.indexOf('Group.ReadWrite.All') > -1) {
      let groups: {
        id: string;
        displayName: string;
      }[] = [];
      let nextLink = `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,resourceBehaviorOptions`;

      while (nextLink) {
        let res = await axios.get(nextLink, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });
        groups = groups.concat(res.data.value);
        nextLink = res.data['@odata.nextLink'];
      }

      return { groups, valid_token: true };
    } else {
      return { groups: [], valid_token: false };
    }
  })
});

async function CreateRequestSyncLogEntries(
  input: {
    workspace_id: string;
    leave_types: { id: string; sync_as_name: string }[];
    department_ids: string[];
  },
  prisma: PrismaClient,
  calendar_sync_setting: { id: string; deleted: boolean; calendar_microsoft_tenant_id: string | null }
) {
  if (calendar_sync_setting.deleted) return;
  let requestSyncLogCreate: Prisma.RequestSyncLogCreateManyInput[] = [];
  const today = new Date();

  const requests = await prisma.request.findMany({
    where: {
      workspace_id: input.workspace_id,
      OR: [{ year: today.getFullYear() }, { year: today.getFullYear() + 1 }],
      details: {
        AND: [{ NOT: { status: 'CANCELED' } }, { NOT: { status: 'DECLINED' } }],
        leave_type_id: { in: input.leave_types.map((x) => x.id) },
        requester_member: { departments: { some: { department_id: { in: input.department_ids } } } }
      }
    },
    select: { id: true, start: true, details: { select: { status: true, leave_type_id: true } } }
  });

  for (let index = 0; index < requests.length; index++) {
    const request = requests[index];
    if (request) {
      requestSyncLogCreate.push({
        workspace_id: input.workspace_id,
        request_id: request.id,
        calendar_sync_setting_id: calendar_sync_setting.id,
        sync_status: SyncStatus.NotSynced,
        calendar_microsoft_tenant_id: calendar_sync_setting.calendar_microsoft_tenant_id
        //   sync_type:
      });
    }
  }
  if (requestSyncLogCreate.length > 0) {
    await prisma.requestSyncLog.createMany({ data: requestSyncLogCreate });
    let logs = await prisma.requestSyncLog.findMany({
      where: { calendar_sync_setting_id: calendar_sync_setting.id, sync_status: SyncStatus.NotSynced },
      select: { id: true, request_id: true, calendar_sync_setting_id: true, calendar_microsoft_tenant_id: true }
    });
    if (logs.length > 0)
      await inngest.send(
        logs.map((x) => {
          return {
            // The event name
            name: 'request/create_calendar_entry',
            // The event's data
            data: {
              request_id: x.request_id,
              sync_id: x.id,
              calendar_sync_setting_id: x.calendar_sync_setting_id,
              microsoft_tenant_id: x.calendar_microsoft_tenant_id + ''
            }
          };
        })
      );
  }
}
