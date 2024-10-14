import { z } from 'zod';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { Prisma, Status, SyncStatus, TimeghostAccesStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { defaultWorkspaceSelect } from './workspace';
import { TgUser, TimeghostService } from 'lib/timeghostService';
import CreateRequestSyncLogTimeghostEntries from '~/lib/createRequestSyncLogTimeghostEntries';
import { prisma } from '~/server/db';
import { truncate } from 'fs/promises';
import { inngest } from '~/inngest/inngest_client';

const defaultTimeghostSyncSettings = Prisma.validator<Prisma.TimeghostSyncSettingSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  workspace_id: true,
  name: true,
  description: true,
  deleted: true,
  timeghost_workspace_id: true,
  timeghost_api_access_token: true,
  invalid_apikey_notification_sent:true,
  timeghostSyncSettingLeaveTypes: {
    select: { leave_type: { select: { id: true } } }
  },
  timeghostSyncSettingDepartments: {
    select: { department: { select: { id: true } } }
  }
});

export const timeghostSyncSettingRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        workspace_id: z.string(),
        timeghost_workspace_id: z.string(),
        leave_type_ids: z.array(z.string()),
        department_ids: z.array(z.string()),
        syncPastAndFuture: z.boolean(),
        timeghost_api_access_token: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add timeghostSyncSetting'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add timeghostSyncSetting'
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
          message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
        });
      }

      const timeghost_sync_setting = await ctx.prisma.timeghostSyncSetting.create({
        data: {
          name: input.name,
          description: input.description,
          workspace_id: input.workspace_id,
          timeghost_workspace_id: input.timeghost_workspace_id,
          timeghost_api_access_token: input.timeghost_api_access_token
        },

        select: { id: true , deleted: true, timeghost_workspace_id: true}
      });
      await ctx.prisma.$transaction([
        ctx.prisma.timeghostSyncSettingDepartment.createMany({
          data: input.department_ids.map((department_id) => ({
            timeghost_sync_setting_id: timeghost_sync_setting.id,
            department_id
          }))
        }),

        ctx.prisma.timeghostSyncSettingLeaveType.createMany({
          data: input.leave_type_ids.map((leave_type_id) => ({
            timeghost_sync_setting_id: timeghost_sync_setting.id,
            leave_type_id
          }))
        })
      ]);
      await CreateRequestSyncLogTimeghostEntries(input, ctx.prisma, timeghost_sync_setting, input.syncPastAndFuture);
      return await ctx.prisma.timeghostSyncSetting.findUnique({
        where: { id: timeghost_sync_setting.id },
        select: defaultTimeghostSyncSettings
      });
    }),

  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          timeghost_api_access_token: z.string(),
          workspace_id: z.string()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit timeghostSyncSetting'
        });
      }

      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit timeghostSyncSetting'
        });
      }

      const timeghost_sync_setting = await ctx.prisma.timeghostSyncSetting.update({
        where: { id },
        data: {
          timeghost_api_access_token: data.timeghost_api_access_token
        },
        select: defaultTimeghostSyncSettings
      });
      await updateRequestSyncLogTimeghostEntries({id: timeghost_sync_setting.id,timeghost_api_access_token: timeghost_sync_setting.timeghost_api_access_token});

      return await ctx.prisma.timeghostSyncSetting.findUnique({
        where: { id: timeghost_sync_setting.id },
        select: defaultTimeghostSyncSettings
      });
    }),

  all: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to add timeghostSyncSetting'
      });
    }

    let timeghostSyncSettings = await ctx.prisma.timeghostSyncSetting.findMany({
      select: defaultTimeghostSyncSettings,
      where: { workspace_id: ctx.current_member.workspace_id },
      orderBy: [
        {
          name: 'asc'
        }
      ]
    });

    timeghostSyncSettings.forEach((timeghostSyncSetting) => {
      let apiKey = timeghostSyncSetting.timeghost_api_access_token;
      timeghostSyncSetting.timeghost_api_access_token =   apiKey.slice(0, 4) +  '*'.repeat(27);
    });
    return timeghostSyncSettings;
  }),
  isUserAdmin: protectedProcedure
    .input(
      z.object({
        timeghost_api_access_token: z.string()
      })
    )

    .mutation(async ({ input, ctx }) => {
      let timeghost_current_user: TgUser | null = null;
      const allAdmins = await prisma.member.findMany({
        where: {
          workspace_id: ctx.current_member.workspace_id,
          is_admin: true,
          status: Status.ACTIVE
        },
        select: { microsoft_user_id: true }
      });
      try {
        timeghost_current_user = await TimeghostService.getTimeghostUserByApiKey(input.timeghost_api_access_token);
      } catch (e) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t(
            'Error: Invalid API Key. Please ensure you have entered a correct API key with the required length..'
          )
        });
      }
      if (timeghost_current_user) {
        const tg_user_id = timeghost_current_user.userId;
        const isAdmin = allAdmins.find((admin) => admin.microsoft_user_id == tg_user_id) != undefined;

        const is_timeghost_admin_absentify_admin_too =
          isAdmin ||
          (ctx.current_member.is_admin && ctx.current_member.microsoft_user_id == timeghost_current_user.userId);

        if (
          !is_timeghost_admin_absentify_admin_too ||
          !timeghost_current_user.isUserAdmin ||
          !timeghost_current_user.userId
        ) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t(
              'Error: Invalid API Key. The provided API key does not have admin privileges. Please make sure to use a valid admin API key.'
            )
          });
        }

        return timeghost_current_user.userId;
      }
    }),
  workspaces: protectedProcedure
    .input(
      z.object({
        timeghost_api_access_token: z.string()
      })
    )

    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const workspaces = await TimeghostService.getAllWorkspaces(input.timeghost_api_access_token);

      return workspaces;
    }),
    workspaceById: protectedProcedure
    .input(
      z.object({
        timeghost_api_access_token: z.string(),
        workspace_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const workspace = await TimeghostService.getTimeghostWorkspaceById(input.workspace_id,input.timeghost_api_access_token);
      return workspace;
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        department_ids: z.array(z.string()),
        leave_type_ids: z.array(z.string()),
        deleteSyncInPast: z.boolean()
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
      const timeghostSyncSetting = await ctx.prisma.timeghostSyncSetting.findUnique({
        where: { id },
        select: {
          id: true,
          workspace_id: true
        }
      });
      if (timeghostSyncSetting?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
    
     

      await inngest.send({
        name: 'request/delete_timeghost_sync_setting',
        data: {
          timeghost_sync_setting_id: timeghostSyncSetting.id,
          deletePastSyncsInTg: input.deleteSyncInPast
        },
    })

    await ctx.prisma.timeghostSyncSetting.update({ where: { id: id },
      data: {deleted: true}});
    return {
      id
    };
     
    }),

  comegoStatus: protectedProcedure
    .input(
      z.object({
        timeghost_api_access_token: z.string(),
        workspace_id: z.string(),
      })
    )
    .mutation(async ({input, ctx }) => {
      const { timeghost_api_access_token, workspace_id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const is_comego_active = await TimeghostService.getWorkspaceComegoStatus(timeghost_api_access_token, workspace_id);
      if(typeof is_comego_active === "boolean") {
         return is_comego_active
      }
    })
});

 //update requestSyncLog and resync unsynced request due to timeghost_api_access_authenticated error (api key change)
export const updateRequestSyncLogTimeghostEntries = async (timeghost_sync_setting: { id: string;timeghost_api_access_token: string} ) => {
  //reset invalid_apikey_notification_sent if create or delete fails
  await prisma.timeghostSyncSetting.update({
    where: { id: timeghost_sync_setting.id },
    data: {
      invalid_apikey_notification_sent: false
    }
  });

  //recreate syncs after api key update
  const logsToSync = await prisma.requestSyncLog.findMany({
    where: {
      timeghost_sync_setting_id: timeghost_sync_setting.id, timeghost_api_access_authenticated: TimeghostAccesStatus.Error,sync_status: SyncStatus.Failed
    }
  });
  logsToSync.forEach((x,i) => {
    if (i == 0){
      inngest.send({
        name: 'request/update_timeghost_sync_setting',
        data: {
          request_id: x.request_id,
          sync_log_id: x.id,
          timeghost_sync_setting_id: timeghost_sync_setting.id,
          first_event: true
        }
      });
    } else {
      inngest.send({
        name: 'request/update_timeghost_sync_setting',
        data: {
          request_id: x.request_id,
          sync_log_id: x.id,
          timeghost_sync_setting_id: timeghost_sync_setting.id,
          first_event: false
        }
      });
    }
  });
  //redelete failed syncs deletion in tg  after api key update
  const logsToUnSync = await prisma.requestSyncLog.findMany({
    where: {
      timeghost_sync_setting_id: timeghost_sync_setting.id, sync_status: SyncStatus.MustBeDeleted
    }
  });

  if (logsToUnSync.length > 0) {
    await inngest.send(
      logsToUnSync.map((log,i) => {
        if(i == 0){
          return {
            name: 'request/delete_timeghost_time_entries',
            data: {
              sync_log_id: log.id,
              first_event: true
            }
          };
        } else {
          return {
            name: 'request/delete_timeghost_time_entries',
            data: {
              sync_log_id: log.id,
              first_event: false
            }
          };
        }
      })
    );
  } 
}
  