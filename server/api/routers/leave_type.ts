import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { LeaveUnit, OutlookShowAs, Prisma, RequestStatus, SyncEnabled } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { inngest } from '~/inngest/inngest_client';
import axios from 'axios';
import { getMicrosoftCalendarAccessToken } from '~/lib/getMicrosoftAccessToken';
import { defaultWorkspaceSelect } from './workspace';
import { hasValidSubscription } from '~/lib/subscriptionHelper';
import { prisma } from '~/server/db';
import { isDayUnit, isHourUnit } from '~/lib/DateHelper';
export const iconList = [
  'NoIcon',
  'Umbrella',
  'Anchor',
  'Archive',
  'Award',
  'Briefcase',
  'Calendar',
  'Cast',
  'Clock',
  'Coffee',
  'Compass',
  'Battery',
  'Emoji',
  'Gift',
  'Frown',
  'Image',
  'Sun',
  'Zap',
  'Home',
  'Users'
] as const;

/**
 * Default selector for leaveType.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultLeaveTypeSelect = Prisma.validator<Prisma.LeaveTypeSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  color: true,
  icon: true,
  take_from_allowance: true,
  needs_approval: true,
  maximum_absent: true,
  deleted: true,
  deleted_at: true,
  deleted_by_member_id: true,
  workspace_id: true,
  privacy_hide_leavetype: true,
  outlook_synchronization_show_as: true,
  outlook_synchronization_subject: true,
  position: true,
  reason_mandatory: true,
  reason_hint_text: true,
  allowance_type_id: true,
  sync_option: true,
  sync_to_outlook_as_dynamics_365_tracked: true,
  leave_unit: true,
  ignore_public_holidays: true,
  ignore_schedule: true,
  allowance_type: {
    select: { name: true, id: true }
  }
});

export const leaveTypeRouter = createTRPCRouter({
  // create
  add: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }),
        color: z.string(),
        icon: z.string(),
        take_from_allowance: z.boolean(),
        needs_approval: z.boolean(),
        maximum_absent: z.boolean(),
        leave_unit: z.nativeEnum(LeaveUnit),
        ignore_public_holidays: z.boolean(),
        ignore_schedule: z.boolean(),
        privacy_hide_leavetype: z.boolean(),
        outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs),
        outlook_synchronization_subject: z
          .string()
          .max(255, { message: 'Must be 255 or fewer characters long' })
          .nullable(),
        position: z.number(),
        reason_mandatory: z.boolean(),
        reason_hint_text: z.string().nullable(),
        allowance_type_id: z.string().nullable().optional(),
        sync_to_outlook_as_dynamics_365_tracked: z.boolean().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add leaveType'
        });
      }
      if (!input.outlook_synchronization_show_as) {
        input.outlook_synchronization_show_as = 'oof';
      }

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      let allowanceType;
      if (isHourUnit(input.leave_unit)) {
        const hasSubscription = hasValidSubscription(workspace.subscriptions);
        if (!hasSubscription) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('You_need_to_upgrade_your_subscription_to_access_this_feature')
          });
        }
      }

      if (input.allowance_type_id) {
        allowanceType = await ctx.prisma.allowanceType.findFirst({
          where: { workspace_id: ctx.current_member.workspace_id, id: input.allowance_type_id },
          select: { id: true, allowance_unit: true }
        });
      }
      if (!allowanceType) {
        allowanceType = await ctx.prisma.allowanceType.findFirst({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true, allowance_unit: true }
        });

        if (!allowanceType) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No default allowance type found'
          });
        }
      }

      if (input.take_from_allowance) {
        input.allowance_type_id = allowanceType.id;

        if (allowanceType.allowance_unit == 'days') {
          if (isHourUnit(input.leave_unit)) input.leave_unit = 'days';
        } else {
          if (isDayUnit(input.leave_unit)) input.leave_unit = 'hours';
        }
      } else {
        input.allowance_type_id = null;
      }

      const leaveType = await ctx.prisma.leaveType.create({
        data: { ...input, workspace_id: ctx.current_member.workspace_id },
        select: defaultLeaveTypeSelect
      });
      return leaveType;
    }),
  // read
  all: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    return ctx.prisma.leaveType.findMany({
      select: defaultLeaveTypeSelect,
      where: { workspace_id: ctx.current_member.workspace_id, deleted: false },
      orderBy: [
        {
          position: 'asc'
        },
        {
          name: 'asc'
        }
      ]
    });
  }),

  byId: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const leaveType = await ctx.prisma.leaveType.findFirst({
        where: { id, workspace_id: ctx.current_member.workspace_id },
        select: defaultLeaveTypeSelect
      });

      if (!leaveType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('leaveType_non_existent') + id
        });
      }
      return leaveType;
    }),
  isDynamics365CategoryAvailable: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: { microsoft_calendars_read_write: true }
    });

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('workspace_non_existent')
      });
    }
    if (workspace.microsoft_calendars_read_write != 'ACTIVATED') {
      return false;
    }
    if (!ctx.current_member.microsoft_user_id) {
      return false;
    }
    if (!ctx.current_member.microsoft_tenantId) {
      return false;
    }
    const access_token = await getMicrosoftCalendarAccessToken(ctx.current_member.microsoft_tenantId);
    const categories = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${ctx.current_member.microsoft_user_id}/outlook/masterCategories`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    if (categories.status != 200) {
      return false;
    }
    const categoriesData = categories.data.value;
    console.log(categoriesData);
    if (categoriesData.find((category: any) => category.id == '2d5d7f9e-44a2-4629-b7e6-2533db0aae02')) {
      return true;
    }
    return false;
  }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }).optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          take_from_allowance: z.boolean().optional(),
          needs_approval: z.boolean().optional(),
          maximum_absent: z.boolean().optional(),
          deleted: z.boolean().optional(),
          deleted_at: z.date().nullable().optional(),
          deleted_by_member_id: z.string().nullable().optional(),
          leave_unit: z.nativeEnum(LeaveUnit).optional(),
          ignore_public_holidays: z.boolean().optional(),
          ignore_schedule: z.boolean().optional(),
          privacy_hide_leavetype: z.boolean().optional(),
          outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs).optional(),
          outlook_synchronization_subject: z
            .string()
            .max(255, { message: 'Must be 255 or fewer characters long' })
            .nullable()
            .optional(),
          position: z.number().optional(),
          reason_mandatory: z.boolean().optional(),
          reason_hint_text: z.string().nullable().optional(),
          allowance_type_id: z.string().nullable().optional(),
          sync_option: z.nativeEnum(SyncEnabled).optional(),
          sync_to_outlook_as_dynamics_365_tracked: z.boolean().optional()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const count = await ctx.prisma.leaveType.count({
        where: { workspace_id: ctx.current_member.workspace_id, deleted: false }
      });

      if (count == 1) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('minOneLeaveType')
        });
      }

      if (data.deleted) {
        let requestsCount = await ctx.prisma.requestDetail.count({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            leave_type_id: id,
            OR: [{ status: 'APPROVED' }, { status: 'PENDING' }]
          }
        });
        if (requestsCount == 0) {
          await prisma.leaveType.delete({
            where: { id }
          });
          return null;
        }
      }

      const [workspace, oldData] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: defaultWorkspaceSelect
        }),
        ctx.prisma.leaveType.findUnique({
          where: { id: id },
          select: {
            leave_unit: true,
            workspace_id: true,
            take_from_allowance: true,
            allowance_type_id: true,
            ignore_schedule: true,
            ignore_public_holidays: true,
            allowance_type: { select: { allowance_unit: true } }
          }
        })
      ]);

      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (!oldData) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (ctx.current_member.workspace_id != oldData.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('muss_be_admin_to_edit_leaveType')
        });
      }

      if (isHourUnit(data.leave_unit)) {
        const hasSubscription = hasValidSubscription(workspace.subscriptions);

        if (!hasSubscription) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('You_need_to_upgrade_your_subscription_to_access_this_feature')
          });
        }
      }

      if (isDayUnit(oldData.leave_unit) && isHourUnit(input.data.leave_unit)) {
        let requestsCount = await ctx.prisma.request.findMany({
          where: { workspace_id: ctx.current_member.workspace_id, details: { leave_type_id: id } },
          select: { id: true, details: { select: { status: true } } }
        });
        if (requestsCount.length > 0) {
          if (
            requestsCount.every(
              (x) =>
                x.details &&
                (x.details.status === RequestStatus.CANCELED || x.details.status === RequestStatus.DECLINED)
            )
          ) {
            const batchSize = 250;
            for (let i = 0; i < requestsCount.length; i += batchSize) {
              const batch = requestsCount.slice(i, i + batchSize);
              await ctx.prisma.request.deleteMany({
                where: { id: { in: batch.map((x) => x.id) } }
              });
            }
          } else {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: ctx.t('leave_unit_change_restriction_days_half_days_to_minutes_hours')
            });
          }
        }
      } else if (isHourUnit(oldData.leave_unit) && isDayUnit(input.data.leave_unit)) {
        let requestsCount = await ctx.prisma.request.findMany({
          where: { workspace_id: ctx.current_member.workspace_id, details: { leave_type_id: id } },
          select: { id: true, details: { select: { status: true } } }
        });

        if (requestsCount.length > 0) {
          if (
            requestsCount.every(
              (x) =>
                x.details &&
                (x.details.status === RequestStatus.CANCELED || x.details.status === RequestStatus.DECLINED)
            )
          ) {
            const batchSize = 250;
            for (let i = 0; i < requestsCount.length; i += batchSize) {
              const batch = requestsCount.slice(i, i + batchSize);
              await ctx.prisma.request.deleteMany({
                where: { id: { in: batch.map((x) => x.id) } }
              });
            }
          } else {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: ctx.t('leave_unit_change_restriction_minutes_hours_to_days_half_days')
            });
          }
        }
      }

      if (!data.outlook_synchronization_show_as) {
        data.outlook_synchronization_show_as = 'oof';
      }

      if (data.take_from_allowance) {
        let allowanceType;
        if (data.allowance_type_id) {
          allowanceType = await ctx.prisma.allowanceType.findFirst({
            where: { workspace_id: ctx.current_member.workspace_id, id: data.allowance_type_id },
            select: { id: true, allowance_unit: true }
          });
        }
        if (!allowanceType) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No allowance type found'
          });
        }
        data.allowance_type_id = allowanceType.id;
        if (allowanceType.allowance_unit == 'days') {
          if (isHourUnit(data.leave_unit)) data.leave_unit = 'days';
        } else {
          if (isDayUnit(data.leave_unit)) data.leave_unit = 'hours';
        }
      } else {
        data.allowance_type_id = null;
        data.ignore_public_holidays = false;
        data.ignore_schedule = false;
      }

      const leaveType = await ctx.prisma.leaveType.update({
        where: { id },
        data,
        select: defaultLeaveTypeSelect
      });

      if (
        oldData.take_from_allowance != data.take_from_allowance ||
        oldData.allowance_type_id != data.allowance_type_id ||
        oldData.leave_unit != data.leave_unit ||
        oldData.ignore_public_holidays != data.ignore_public_holidays ||
        oldData.ignore_schedule != data.ignore_schedule
      ) {
        await inngest.send({
          // The event name
          name: 'workspace/update.member.allowance',
          // The event's data
          data: {
            workspaceId: ctx.current_member.workspace_id
          }
        });
      }

      return leaveType;
    }),
  changeOrder: protectedProcedure
    .input(
      z.object({
        ids: z.string().array()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ids } = input;

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const updates = [];
      for (let i = 0; i < ids.length; i++) {
        updates.push(
          ctx.prisma.leaveType.update({
            where: { id: ids[i] },
            select: { id: true },
            data: { position: i }
          })
        );
      }

      await ctx.prisma.$transaction(updates);

      return null;
    })
});
