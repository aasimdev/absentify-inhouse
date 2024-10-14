import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, WebhookSource } from '@prisma/client';
import { defaultWorkspaceSelect } from './workspace';
import { hasBusinessSubscription, hasBusinessV1Subscription, hasEnterpriseSubscription } from 'lib/subscriptionHelper';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { inngest } from '~/inngest/inngest_client';
/**
 * Default selector for WebhookSetting.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultWebhookSettingSelect = Prisma.validator<Prisma.WebhookSettingSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  workspace_id: true,
  url: true,
  source: true,
  event: true
});

const defaultWebhookHistorySelect = Prisma.validator<Prisma.WebhookHistorySelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  workspace_id: true,
  status: true,
  webhook_setting: { select: { event: true } },
  webhookHistoryAttempts: {
    select: {
      response_data: true,
      request_data: true,
      createdAt: true,
      url: true
    }
  }
});

export const webhookSelect = Prisma.validator<Prisma.WebhookHistorySelect>()({
  id: true,
  workspace_id: true,
  webhook_setting: { select: { url: true, source: true, id: true } },
  status: true,
  request: {
    select: {
      id: true,
      request_creator_member: {
        select: { email: true, name: true, id: true, custom_id: true }
      },
      createdAt: true,
      updatedAt: true,
      start: true,
      start_at: true,
      end: true,
      end_at: true,
      leave_unit: true,
      year: true,
      details: {
        select: {
          workday_absence_duration: true,
          status: true,
          // approved_date: true,
          cancel_reason: true,
          canceld_date: true,
          //  declined_date: true,
          //   decline_reason: true,
          // deducted: true,
          reason: true,
          //   approver_member: { select: { email: true, name: true, id: true, custom_id: true } },
          approval_process: true,
          duration: true,
          request_approvers: {
            select: {
              uuid: true,
              status: true,
              status_changed_by_member: {
                select: { email: true, name: true, id: true, custom_id: true }
              },
              status_change_date: true,
              predecessor_request_member_approver_id: true,
              reason: true
            }
          },
          requester_member: {
            select: {
              email: true,
              name: true,
              id: true,
              custom_id: true,
              allowances: {
                select: {
                  allowance: true,
                  brought_forward: true,
                  compensatory_time_off: true,
                  remaining: true,
                  taken: true,
                  year: true
                }
              }
            }
          },
          canceld_by_member: {
            select: { email: true, name: true, id: true, custom_id: true }
          },
          //    declined_by_member: { select: { email: true, name: true, id: true, custom_id: true } },
          leave_type: {
            select: {
              id: true,
              name: true,
              take_from_allowance: true,
              leave_unit: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true } }
            }
          }
        }
      }
    }
  },
  webhookHistoryAttempts: { select: { id: true } }
});
export type WebhookHistorySelect = Prisma.WebhookHistoryGetPayload<{
  select: typeof webhookSelect;
}>;

export const webhookSettingRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        source: z.nativeEnum(WebhookSource),
        event: z.array(z.enum(['request_created', 'request_status_changed'])),
        workspace_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add WebhookSetting'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add WebhookSetting'
        });
      }

      const [workspace, existingWebhookSettings] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: input.workspace_id },
          select: defaultWorkspaceSelect
        }),
        ctx.prisma.webhookSetting.findMany({
          where: { workspace_id: input.workspace_id },
          select: { id: true }
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
      let hasBusinessPlan = hasBusinessSubscription(workspace.subscriptions);
      if (!hasEnterprisePlan && !hasBusinessV1Plan && !hasBusinessPlan) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You need to have a higher plan to add a webhook.'
        });
      }

      if (hasBusinessV1Plan && existingWebhookSettings.length == 3) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'It is not possible to specify more than 3 urls, delete another one beforehand.'
        });
      }

      if (hasBusinessPlan && existingWebhookSettings.length == 3) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'It is not possible to specify more than 3 urls, delete another one beforehand.'
        });
      }

      const WebhookSetting = await ctx.prisma.webhookSetting.create({
        data: {
          url: input.url,
          source: input.source,
          event: input.event.join(';'),
          workspace_id: input.workspace_id
        },
        select: defaultWebhookSettingSelect
      });
      return WebhookSetting;
    }),
  all: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    return await ctx.prisma.webhookSetting.findMany({
      where: { workspace_id: ctx.current_member.workspace_id },
      select: defaultWebhookSettingSelect,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }),
  'history.all': protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    return await ctx.prisma.webhookHistory.findMany({
      select: defaultWebhookHistorySelect
    });
  }),
  infiniteHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.number().nullish() // <-- "cursor" needs to exist, but can be any type
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const { cursor } = input;
      const items = await ctx.prisma.webhookHistory.findMany({
        take: limit + 1, // get an extra item at the end which we'll use as next cursor
        where: { workspace_id: ctx.current_member.workspace_id },
        select: defaultWebhookHistorySelect,
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
          url: z.string(),
          event: z.array(z.enum(['request_created', 'request_status_changed']))
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
      const WebhookSetting = await ctx.prisma.webhookSetting.findUnique({
        where: { id },
        select: { workspace_id: true }
      });
      if (WebhookSetting?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const eWebhookSetting = await ctx.prisma.webhookSetting.update({
        where: { id },
        data: { url: data.url, event: data.event.join(';') },
        select: defaultWebhookSettingSelect
      });
      return eWebhookSetting;
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
      const WebhookSetting = await ctx.prisma.webhookSetting.findUnique({
        where: { id },
        select: { workspace_id: true }
      });
      if (WebhookSetting?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      await ctx.prisma.webhookSetting.delete({ where: { id: id } });
      return {
        id
      };
    }),
  retry: protectedProcedure
    .input(
      z.object({
        id: z.number()
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
      const webhookHistory = await ctx.prisma.webhookHistory.findUnique({
        where: { id },
        select: webhookSelect
      });
      if (webhookHistory?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      await inngest.send({
        name: 'process.webhook',
        data: { id: webhookHistory.id }
      });

      return {
        id
      };
    })
});
