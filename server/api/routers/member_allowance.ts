import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { updateMemberAllowances } from '~/lib/updateMemberAllowances';
import { protectedProcedure, createTRPCRouter } from '../trpc';
/**
 * Default selector for memberAllowance.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultMemberAllowanceSelect = Prisma.validator<Prisma.MemberAllowanceSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  member_id: true,
  workspace_id: true,
  year: true,
  start: true,
  end: true,
  allowance: true,
  brought_forward: true,
  overwrite_brought_forward: true,
  compensatory_time_off: true,
  taken: true,
  remaining: true,
  leave_types_stats: true,
  expiration: true,
  allowance_type_id: true,
  allowance_type: {
    select: { name: true, id: true, allowance_unit: true, carry_forward_months_after_fiscal_year: true }
  }
});

export const memberAllowanceRouter = createTRPCRouter({
  byMember: protectedProcedure
    .input(
      z.object({
        member_id: z.string(),
        year: z.number().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const [current_user_is_department_manager, approvers, memberAllowanceTypeConfigurtaions] =
        await ctx.prisma.$transaction([
          ctx.prisma.memberDepartment.findMany({
            where: {
              member_id: ctx.current_member.id,
              manager_type: 'Manager'
            },
            select: {
              member_id: true,
              department_id: true
            }
          }),
          ctx.prisma.memberApprover.findMany({
            where: { member_id: input.member_id },
            select: {
              member: {
                select: { departments: { select: { department_id: true } } }
              },
              member_id: true,
              approver_member_id: true
            }
          }),
          ctx.prisma.memberAllowanceTypeConfigurtaion.findMany({
            where: { member_id: input.member_id },
            select: { allowance_type_id: true, disabled: true, default: true }
          })
        ]);

      if (
        input.member_id != ctx.current_member.id &&
        !currentUserCanSeeAllowance(ctx, approvers, current_user_is_department_manager)
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No permission to see this memberAllowance'
        });
      }

      /**
       * For pagination you can have a look at this docs site
       * @link https://trpc.io/docs/useInfiniteQuery
       */
      if (input.year)
        return ctx.prisma.memberAllowance.findMany({
          select: defaultMemberAllowanceSelect,
          where: {
            member_id: input.member_id,
            workspace_id: ctx.current_member.workspace_id,
            year: input.year
          },
          orderBy: [
            {
              year: 'asc'
            }
          ]
        });

      let retVal = await ctx.prisma.memberAllowance.findMany({
        select: defaultMemberAllowanceSelect,
        where: {
          member_id: input.member_id,
          workspace_id: ctx.current_member.workspace_id
        },
        orderBy: [
          {
            year: 'asc'
          }
        ]
      });

      retVal = retVal.filter((x) => {
        const config = memberAllowanceTypeConfigurtaions.find((y) => y.allowance_type_id == x.allowance_type_id);
        if (config?.disabled) return false;
        return true;
      });

      return retVal;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          member_id: z.string(),
          workspace_id: z.string(),
          allowance: z.number(),
          brought_forward: z.number(),
          compensatory_time_off: z.number()
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
      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit memberAllowance'
        });
      }

      const oldValues = await ctx.prisma.memberAllowance.findUnique({
        where: { id },
        select: { brought_forward: true, overwrite_brought_forward: true }
      });
      if (!oldValues) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member allowance not found'
        });
      }
      let overwrite_brought_forward = oldValues.overwrite_brought_forward;
      if (overwrite_brought_forward === false) {
        if (oldValues.brought_forward != data.brought_forward) {
          overwrite_brought_forward = true;
        }
      }

      const memberAllowance = await ctx.prisma.memberAllowance.update({
        where: { id },
        data: { ...data, overwrite_brought_forward: overwrite_brought_forward },
        select: defaultMemberAllowanceSelect
      });

      await updateMemberAllowances(ctx.prisma, ctx.current_member.workspace_id, memberAllowance.member_id);
      return memberAllowance;
    }),
  editMemberAllowanceConfiguration: protectedProcedure
    .input(
      z.object({
        allowance_type_id: z.string(),
        member_id: z.string(),
        data: z.object({
          default: z.boolean(),
          disabled: z.boolean()
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
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.member_id },
        select: { workspace_id: true }
      });

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found'
        });
      }

      if (ctx.current_member.workspace_id != member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit memberAllowance'
        });
      }

      await ctx.prisma.$transaction(async (prisma) => {
        const currentConfig = await prisma.memberAllowanceTypeConfigurtaion.findUnique({
          where: {
            member_id_allowance_type_id: { member_id: input.member_id, allowance_type_id: input.allowance_type_id }
          },
          select: { default: true, disabled: true }
        });

        // Setze diesen Eintrag als Standard, falls angefordert
        if (input.data.default) {
          // Setze alle anderen auf default = false
          await prisma.memberAllowanceTypeConfigurtaion.updateMany({
            where: {
              member_id: input.member_id,
              allowance_type_id: { not: input.allowance_type_id }
            },
            data: { default: false }
          });
        }

        // Behandle das Deaktivieren eines Standard-Eintrags
        if (input.data.disabled && currentConfig?.default) {
          const anotherActiveConfig = await prisma.memberAllowanceTypeConfigurtaion.findFirst({
            where: {
              member_id: input.member_id,
              allowance_type_id: { not: input.allowance_type_id },
              disabled: false
            }
          });

          if (anotherActiveConfig) {
            // Wenn ein anderer aktiver Eintrag gefunden wird, setze diesen als neuen Standard
            await prisma.memberAllowanceTypeConfigurtaion.update({
              where: { id: anotherActiveConfig.id },
              data: { default: true }
            });
            input.data.default = false;
          }
          // Wenn kein anderer aktivierter Eintrag gefunden wird, behalte den aktuellen Eintrag als Standard
        } else if (!input.data.default && currentConfig?.default && !input.data.disabled) {
          // Wenn der aktuelle Standard nicht deaktiviert wird und die Eingabe nicht als Standard markiert ist,
          // dann setze einen anderen aktiven Eintrag als Standard, falls verfügbar
          const anotherActiveConfig = await prisma.memberAllowanceTypeConfigurtaion.findFirst({
            where: {
              member_id: input.member_id,
              allowance_type_id: { not: input.allowance_type_id },
              disabled: false
            }
          });
          if (anotherActiveConfig) {
            await prisma.memberAllowanceTypeConfigurtaion.update({
              where: { id: anotherActiveConfig.id },
              data: { default: true }
            });
            input.data.default = false;
          } else {
            input.data.default = true;
          }
        } else if (!input.data.default) {
          const count = await prisma.memberAllowanceTypeConfigurtaion.count({
            where: {
              member_id: input.member_id,
              allowance_type_id: { not: input.allowance_type_id },
              disabled: false
            }
          });
          if (count == 0) {
            input.data.default = true;
          }
        }

        // Aktualisiere den aktuellen Eintrag mit den neuen Werten
        await prisma.memberAllowanceTypeConfigurtaion.update({
          where: {
            member_id_allowance_type_id: { member_id: input.member_id, allowance_type_id: input.allowance_type_id }
          },
          data: { disabled: input.data.disabled, default: input.data.default }
        });

        // Stelle sicher, dass mindestens ein Eintrag als Standard vorhanden ist
        const defaultExists = await prisma.memberAllowanceTypeConfigurtaion.count({
          where: {
            member_id: input.member_id,
            default: true
          }
        });

        if (defaultExists === 0) {
          // Es existiert kein Standard, also wähle einen geeigneten Eintrag als neuen Standard
          const potentialDefault = await prisma.memberAllowanceTypeConfigurtaion.findFirst({
            where: {
              member_id: input.member_id,
              disabled: false // Bevorzuge nicht deaktivierte Einträge
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          if (!potentialDefault) {
            // Wenn alle deaktiviert sind, wähle einfach den ersten deaktivierten Eintrag
            const firstDisabled = await prisma.memberAllowanceTypeConfigurtaion.findFirst({
              where: {
                member_id: input.member_id
              },
              orderBy: {
                createdAt: 'asc'
              }
            });
            if (firstDisabled) {
              await prisma.memberAllowanceTypeConfigurtaion.update({
                where: { id: firstDisabled.id },
                data: { default: true }
              });
            }
          } else {
            // Setze den gefundenen Eintrag als neuen Standard
            await prisma.memberAllowanceTypeConfigurtaion.update({
              where: { id: potentialDefault.id },
              data: { default: true }
            });
          }
        }
      });

      return;
    })
});

function currentUserCanSeeAllowance(
  ctx: { current_member: { is_admin: boolean; id: string } },
  approvers:
    | {
        member: {
          departments: {
            department_id: string;
          }[];
        };
        member_id: string;
        approver_member_id: string | null;
      }[]
    | null,
  department_manager: { department_id: string }[]
) {
  if (!approvers) return false;
  if (approvers.find((x) => x.approver_member_id == ctx.current_member.id)) return true;

  if (ctx.current_member.is_admin) {
    return true;
  }
  for (let i = 0; i < approvers.length; i++) {
    const approver = approvers[i];
    if (approver) {
      const isDepartmentmanger = approver.member.departments.some((department) =>
        department_manager.find((x) => x.department_id == department.department_id)
      );
      if (isDepartmentmanger) return true;
    }
  }

  return false;
}
