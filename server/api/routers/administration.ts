import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { getPlanName } from 'helper/paddle_config';
import { createTRPCRouter, protectedDbAdminProcedure } from '../trpc';
import { subMonths } from 'date-fns';
import { SubscriptionStatus } from '@prisma/client';

export const administrationRouter = createTRPCRouter({
  changeSubscriptionToAnotherWorkspace: protectedDbAdminProcedure
    .input(
      z.object({
        to_workspace_id: z.string(),
        from_workspace_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const paddle = await ctx.prisma.subscription.count({
        where: { workspace_id: input.to_workspace_id, provider: 'paddle' }
      });

      if (paddle > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: ctx.t('workspace-already-has-a-paddle-subscription')
        });
      }
      const from_paddle = await ctx.prisma.subscription.findMany({
        where: { workspace_id: input.from_workspace_id, provider: 'paddle' },
        select: { subscription_id: true, workspace_id: true }
      });
      if (from_paddle.length == 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: ctx.t('workspace-does-not-have-a-paddle-subscription')
        });
      }

      for (let index = 0; index < from_paddle.length; index++) {
        const subscription = from_paddle[index];
        if (!subscription) continue;
        await axios.post(
          (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
            ? 'https://sandbox-vendors.paddle.com/api'
            : 'https://vendors.paddle.com/api') + '/2.0/subscription/users/update',
          {
            vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
            subscription_id: Number(subscription.subscription_id),
            passthrough: { workspace_id: subscription.workspace_id }
          }
        );
      }

      await ctx.prisma.subscription.deleteMany({
        where: { workspace_id: input.to_workspace_id }
      });

      await ctx.prisma.subscription.updateMany({
        where: { workspace_id: input.from_workspace_id },
        data: { workspace_id: input.to_workspace_id }
      });
    }),

  last50: protectedDbAdminProcedure.query(({ ctx }) => {
    return ctx.prisma.member.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        email: true,
        is_admin: true,
        has_cdn_image: true,
        microsoft_user_id: true,
        workspace: { select: { referrer: true } }
      },
      take: 50
    });
  }),

  active_workspaces: protectedDbAdminProcedure.query(async ({ ctx }) => {
    async function processInBatches(
      workspaces: {
        subscriptions: {
          status: SubscriptionStatus;
          subscription_plan_id: string;
        }[];
        id: string;
        createdAt: Date;
        name: string;
        referrer: string | null;
        members: {
          id: string;
          email: string | null;
        }[];
      }[],
      batchSize: number
    ) {
      const results = [];

      for (let i = 0; i < workspaces.length; i += batchSize) {
        const batch = workspaces.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (workspace) => {
            const [totalSignins, totalRequests] = await ctx.prisma.$transaction([
              ctx.prisma.signInLog.count({
                where: {
                  member: {
                    workspace_id: workspace.id
                  },
                  createdAt: {
                    gte: threeMonthsAgo,
                    lte: today
                  }
                }
              }),
              ctx.prisma.request.count({
                where: {
                  workspace_id: workspace.id,
                  createdAt: {
                    gte: threeMonthsAgo,
                    lte: today
                  }
                }
              })
            ]);

            const activityPerMember = (totalSignins + totalRequests) / workspace.members.length;

            return {
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              workspaceCreatedAt: workspace.createdAt,
              workspaceMembers: workspace.members,
              workspaceSubscriptions: workspace.subscriptions,
              workspaceReferer: workspace.referrer,
              totalSignins,
              totalRequests,
              totalMembers: workspace.members.length,
              activityPerMember
            };
          })
        );
        results.push(...batchResults);
      }

      return results;
    }

    const today = new Date();
    const threeMonthsAgo = subMonths(today, 1);
    const batchSize = 10;

    const top200Workspaces = await ctx.prisma.workspace.findMany({
      take: 150,
      orderBy: {
        members: {
          _count: 'desc'
        }
      },
      select: {
        name: true,
        createdAt: true,
        id: true,
        referrer: true,
        members: { select: { id: true, email: true } },
        subscriptions: {
          select: { status: true, subscription_plan_id: true },
          where: { OR: [{ provider: 'paddle' }, { provider: 'paddle_v2' }] }
        }
      }
    });

    const workspaceActivity = await processInBatches(top200Workspaces, batchSize);

    // Schritt 3: Min und Max Aktivität finden
    const minActivity = Math.min(...workspaceActivity.map((w) => w.activityPerMember));
    const maxActivity = Math.max(...workspaceActivity.map((w) => w.activityPerMember));
    const range = maxActivity - minActivity;

    // Schritt 4: Aktivitätslevel zuweisen
    const activityLevels = workspaceActivity.map((workspace) => {
      const level = Math.ceil((workspace.activityPerMember - minActivity) / (range / 10));
      return {
        ...workspace,
        activityLevel: level
      };
    });

    return activityLevels;
  }),
  allLast14Days: protectedDbAdminProcedure.query(async ({ ctx }) => {
    const [users, workspaces] = await ctx.prisma.$transaction([
      ctx.prisma.member.findMany({
        orderBy: [{ createdAt: 'asc' }],
        select: { createdAt: true },
        where: {
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        }
      }),
      ctx.prisma.workspace.findMany({
        orderBy: [{ createdAt: 'asc' }],
        select: { createdAt: true },
        where: {
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    return { users, workspaces };
  }),
  all_count: protectedDbAdminProcedure.query(({ ctx }) => {
    return ctx.prisma.member.count();
  }),

  findMemberByEmail: protectedDbAdminProcedure
    .input(
      z.object({
        email: z.string()
      })
    )
    .query(({ input, ctx }) => {
      if (input.email.length < 4) return [];
      return ctx.prisma.member.findMany({
        where: { email: { contains: input.email } },
        select: {
          name: true,
          id: true,
          email: true,
          has_cdn_image: true,
          microsoft_user_id: true
        }
      });
    }),
  getMemberById: protectedDbAdminProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(({ ctx, input }) => {
      return ctx.prisma.member.findUnique({
        where: { id: input.id },
        select: {
          name: true,
          email: true,
          is_admin: true,
          has_cdn_image: true,
          microsoft_user_id: true,
          language: true,
          has_approvers: {
            select: {
              approver_member: {
                select: { name: true, id: true, email: true }
              }
            }
          },
          status: true,
          id: true,
          is_approver_of: {
            select: {
              approver_member: {
                select: { name: true, id: true, email: true }
              }
            }
          },
          workspace: { select: { id: true, name: true } }
        }
      });
    }),
  getWorkspaceById: protectedDbAdminProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.workspace.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          referrer: true,
          microsoft_calendars_read_write: true,
          microsoft_groups_read_write_all: true,
          microsoft_mailboxSettings_read_write: true,
          microsoft_users_read_all: true,
          calendarSyncSettings: {
            select: { name: true, calendar_sync_type: true }
          },
          _count: {
            select: {
              leave_types: true,
              departments: true,
              members: true,
              webhookHistory: true,
              memberMailboxSettings: true,
              requests: true
            }
          },
          subscriptions: {
            select: {
              currency: true,
              quantity: true,
              provider: true,
              status: true,
              createdAt: true,
              modifier_id: true,
              unpaid: true,
              unit_price: true,
              subscription_id: true,
              subscription_plan_id: true,
              billing_cycle_interval: true
            }
          },
          members: {
            select: {
              name: true,
              id: true,
              is_admin: true,
              status: true,
              email: true,
              has_cdn_image: true,
              language: true,
              microsoft_user_id: true
            }
          },
          departments: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              members: {
                select: {
                  manager_type: true,
                  member: {
                    select: {
                      name: true,
                      id: true,
                      is_admin: true,
                      status: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    }),

  getPaidAdsStatitsik: protectedDbAdminProcedure.query(async ({ ctx }) => {
    const ads = await ctx.prisma.subscription.findMany({
      where: { status: 'active', workspace: { referrer: { startsWith: 'gads' } } },
      select: {
        subscription_plan_id: true,
        billing_cycle_interval: true,
        quantity: true,
        createdAt: true,
        workspace: {
          select: {
            referrer: true
          }
        }
      }
    });

    const soldProducts = ads.map((ad) => {
      const product = getPlanName(ad.subscription_plan_id);
      return {
        product,
        billingCycle: ad.billing_cycle_interval,
        quantity: ad.quantity,
        referrer: ad.workspace.referrer,
        createdAt: ad.createdAt
      };
    });

    const companiesRegisteredWithAds = await ctx.prisma.workspace.findMany({
      where: { referrer: { startsWith: 'gads-' } },
      select: {
        createdAt: true,
        referrer: true,
        members: { select: { id: true } }
      }
    });

    return { soldProducts, companiesRegisteredWithAds };
  })
});
