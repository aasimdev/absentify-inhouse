import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { AllowanceUnit, Prisma } from '@prisma/client';
import { inngest } from '~/inngest/inngest_client';
import {
  hasBusinessSubscription,
  hasBusinessV1Subscription,
  hasEnterpriseSubscription,
  hasSmalTeamSubscription
} from '~/lib/subscriptionHelper';
import { defaultWorkspaceSelect } from './workspace';
import { addDays, addYears } from 'date-fns';

/**
 * Default selector for memberAllowance.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */

export const defaultAllwoanceTypeSelect = Prisma.validator<Prisma.AllowanceTypeSelect>()({
  id: true,
  workspace_id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  leave_types: { select: { id: true, name: true, deleted: true, color: true, icon: true } },
  //  active: true,
  //  allowance_policies: true,
  //member_allowance_policy_subscriptions: { select: { id: true, policy_start_date: true, policy_end_date: true } },
  //member_allowance_adjustments: true,
  allowance_unit: true,
  ignore_allowance_limit: true,
  max_carry_forward: true
});

export const allowanceRouter = createTRPCRouter({
  allTypes: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You have to be admin to get all allowance'
      });
    }

    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */

    return ctx.prisma.allowanceType.findMany({
      select: defaultAllwoanceTypeSelect,
      where: { workspace_id: ctx.current_member.workspace_id },
      orderBy: [{ name: 'desc' }]
    });
  }),
  addAllowanceType: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        data: z.object({
          ignore_allowance_limit: z.boolean(),
          name: z.string(),
          default_allowance_current_year: z.number(),
          default_allowance_next_year: z.number(),
          allowance_unit: z.nativeEnum(AllowanceUnit),
          max_carry_forward: z.number()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const [workspace, members, countExistingAllowanceTypes] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: defaultWorkspaceSelect
        }),
        ctx.prisma.member.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true }
        }),
        ctx.prisma.allowanceType.count({
          where: { workspace_id: ctx.current_member.workspace_id }
        })
      ]);

      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const hasEnterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      const hasBusinessV1Plan = hasBusinessV1Subscription(workspace.subscriptions);
      const hasBusinessPlan = hasBusinessSubscription(workspace.subscriptions);
      const hasSmalTeamPlan = hasSmalTeamSubscription(workspace.subscriptions);
      if (!hasEnterprisePlan && !hasBusinessV1Plan && !hasBusinessPlan && !hasSmalTeamPlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('You_need_to_upgrade_your_subscription_to_access_this_feature')
        });
      }

      if (hasSmalTeamPlan && countExistingAllowanceTypes >= 2) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('AllowanceType_max_reached')
        });
      }

      if (hasBusinessV1Plan && countExistingAllowanceTypes >= 4) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('AllowanceType_max_reached')
        });
      }

      if (hasBusinessPlan && countExistingAllowanceTypes >= 4) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('AllowanceType_max_reached')
        });
      }

      const allowanceType = await ctx.prisma.allowanceType.create({
        data: {
          workspace_id: ctx.current_member.workspace_id,
          active: true,
          allowance_unit: data.allowance_unit,
          ignore_allowance_limit: data.ignore_allowance_limit,
          name: data.name,
          max_carry_forward: data.max_carry_forward
        },
        select: defaultAllwoanceTypeSelect
      });

      if (!allowanceType) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('error_allowance_type_not_created')
        });
      }
      if (!workspace) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('error_workspace_not_found')
        });
      }
      const carryForward =
        allowanceType.max_carry_forward < input.data.default_allowance_current_year
          ? allowanceType.max_carry_forward
          : input.data.default_allowance_current_year;

      const [a1, a2] = await ctx.prisma.$transaction([
        ctx.prisma.memberAllowance.findFirst({
          where: {
            workspace_id: ctx.current_member.workspace_id
          },
          orderBy: {
            year: 'asc'
          },
          select: {
            year: true
          }
        }),
        ctx.prisma.memberAllowance.findFirst({
          where: {
            workspace_id: ctx.current_member.workspace_id
          },
          orderBy: {
            year: 'desc'
          },
          select: {
            year: true
          }
        })
      ]);

      const oldestYear = a1 ? a1.year : new Date().getFullYear();
      const newestYear = a2 ? a2.year : new Date().getFullYear();

      let createAllowances = [];
      let currentYear = new Date().getFullYear();
      for (const member of members) {
        for (let i2 = oldestYear; i2 <= newestYear; i2++) {
          if (i2 === currentYear + 1) {
            createAllowances.push({
              allowance: input.data.default_allowance_next_year,
              year: i2,
              member_id: member.id,
              brought_forward: carryForward,
              compensatory_time_off: 0,
              remaining: input.data.default_allowance_next_year + carryForward,
              taken: 0,
              workspace_id: ctx.current_member.workspace_id,
              start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
              end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1),
              allowance_type_id: allowanceType.id
            });
          } else {
            if (i2 === currentYear) {
              createAllowances.push({
                allowance: input.data.default_allowance_current_year,
                year: i2,
                member_id: member.id,
                brought_forward: 0,
                compensatory_time_off: 0,
                remaining: input.data.default_allowance_current_year,
                taken: 0,
                workspace_id: ctx.current_member.workspace_id,
                start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
                end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1),
                allowance_type_id: allowanceType.id
              });
            } else {
              createAllowances.push({
                allowance: 0,
                year: i2,
                member_id: member.id,
                brought_forward: 0,
                compensatory_time_off: 0,
                remaining: 0,
                taken: 0,
                workspace_id: ctx.current_member.workspace_id,
                start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
                end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1),
                allowance_type_id: allowanceType.id
              });
            }
          }
        }
      }

      await ctx.prisma.memberAllowance.createMany({
        data: createAllowances
      });

      const memberAllowanceTypeConfigurtaions = [];

      for (const member of members) {
        memberAllowanceTypeConfigurtaions.push({
          member_id: member.id,
          allowance_type_id: allowanceType.id,
          default: false,
          workspace_id: ctx.current_member.workspace_id
        });
      }

      await ctx.prisma.memberAllowanceTypeConfigurtaion.createMany({
        data: memberAllowanceTypeConfigurtaions
      });

      return allowanceType;
    }),
  editAllowanceType: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          ignore_allowance_limit: z.boolean(),
          name: z.string(),
          //   allowance_unit: z.nativeEnum(AllowanceUnit),
          max_carry_forward: z.number()
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

      const [workspace, old_allowanceType] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: defaultWorkspaceSelect
        }),
        ctx.prisma.allowanceType.findUnique({
          where: { id },
          select: { id: true, workspace_id: true, allowance_unit: true }
        })
      ]);

      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (!old_allowanceType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          //todo create string
          message: ctx.t('error_allowance_type_not_found')
        });
      }
      if (old_allowanceType.workspace_id !== ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      await ctx.prisma.allowanceType.update({
        where: { id },
        data: {
          ignore_allowance_limit: data.ignore_allowance_limit,
          // allowance_unit: data.allowance_unit,
          name: data.name,
          max_carry_forward: data.max_carry_forward
        },
        select: defaultAllwoanceTypeSelect
      });
      //);

      /*     if (old_allowanceType.allowance_unit !== input.data.allowance_unit) {
        const member_allowances = await ctx.prisma.memberAllowance.findMany({
          where: { allowance_type_id: id },
          select: {
            id: true,
            allowance: true,
            remaining: true,
            brought_forward: true,
            compensatory_time_off: true,
            taken: true
          }
        });

        for (let index = 0; index < member_allowances.length; index++) {
          const member_allowance = member_allowances[index];
          if (!member_allowance) continue;

          const allowance =
            input.data.allowance_unit === AllowanceUnit.days
              ? member_allowance.allowance / 60
              : member_allowance.allowance * 60;
          const remaining =
            input.data.allowance_unit === AllowanceUnit.days
              ? member_allowance.remaining / 60
              : member_allowance.remaining * 60;
          const brought_forward =
            input.data.allowance_unit === AllowanceUnit.days
              ? member_allowance.brought_forward / 60
              : member_allowance.brought_forward * 60;
          const compensatory_time_off =
            input.data.allowance_unit === AllowanceUnit.days
              ? member_allowance.compensatory_time_off / 60
              : member_allowance.compensatory_time_off * 60;
          const taken =
            input.data.allowance_unit === AllowanceUnit.days
              ? member_allowance.taken / 60
              : member_allowance.taken * 60;

          updates.push(
            ctx.prisma.memberAllowance.update({
              where: { id: member_allowance.id },
              data: { allowance, remaining, brought_forward, compensatory_time_off, taken },
              select: { id: true }
            })
          );
        }
      } */

      /*    const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        await ctx.prisma.$transaction(batch);
        console.log(`Batch ${i / BATCH_SIZE + 1} erfolgreich ausgeführt`);
      } */
      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });

      return;
    }),
  deleteAllowanceType: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const allowanceTypes = await ctx.prisma.allowanceType.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true, workspace_id: true, _count: { select: { leave_types: true } } }
      });
      const allowanceType = allowanceTypes.find((at) => at.id === id);
      if (!allowanceType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('error_allowance_type_not_found')
        });
      }
      if (allowanceType.workspace_id !== ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (allowanceTypes.length == 1) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_cant_delete_the_last_allowance_type')
        });
      }

      if (allowanceType._count.leave_types > 0) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_cant_delete_allowance_type_with_leave_types')
        });
      }

      const count = await ctx.prisma.memberAllowanceTypeConfigurtaion.count({
        where: { allowance_type_id: id, default: true }
      });

      if (count > 0) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_cant_delete_allowance_type_with_default')
        });
      }

      await ctx.prisma.allowanceType.delete({
        where: { id }
      });

      return true;
    })
});
