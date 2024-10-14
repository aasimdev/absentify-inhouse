import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ApprovalProcess, DepartmentManagerType, Prisma } from '@prisma/client';
import { summarizeSubscriptions } from 'lib/subscriptionHelper';
import { defaultWorkspaceSelect } from './workspace';
import { Guid } from 'guid-typescript';
import { createTRPCRouter, protectedProcedure } from '../trpc';

/**
 * Default selector for department.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultDepartmentSelect = Prisma.validator<Prisma.DepartmentSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  maximum_absent: true,
  workspace_id: true,
  approval_process: true,
  groupSyncSettings: true,
  members: {
    select: {
      member_id: true,
      id: true,
      manager_type: true,
      predecessor_manager_id: true,
      member: { select: { name: true, email: true, microsoft_user_id: true, has_cdn_image: true, status: true } }
    }
  },
  default_department_allowances: true
});

export const departmentRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        data: z.object({
          name: z.string(),
          maximum_absent: z.number().nullable(),
          workspace_id: z.string(),
          approval_process: z.nativeEnum(ApprovalProcess),
          manager_member: z.array(
            z.object({
              member_id: z.string(),
              predecessor_manager_id: z.string().nullable()
            })
          ),
          default_department_allowances: z.array(
            z.object({
              id: z.string(),
              value: z.number()
            })
          )
        })
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          name: z.string(),
          maximum_absent: z.number().nullable(),
          workspace_id: z.string(),
          approval_process: z.nativeEnum(ApprovalProcess),
          members: z.array(
            z.object({
              member_id: z.string(),
              id: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType),
              predecessor_manager_id: z.string().nullable(),
              member: z.object({ name: z.string().nullable() })
            })
          )
        })
        .nullable()
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you-have-to-be-admin-to-add-department')
        });
      }
      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you-have-to-be-admin-to-add-department')
        });
      }
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.data.workspace_id },
        select: defaultWorkspaceSelect
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you-have-to-be-admin-to-add-department')
        });
      }

      let subscrption = summarizeSubscriptions(workspace.subscriptions);

      const UNLIMITED_DEPARTMENTS_ADDON = subscrption.addons.unlimited_departments;

      if (!UNLIMITED_DEPARTMENTS_ADDON && !(subscrption.enterprise > 0)) {
        const departments = await ctx.prisma.department.count({
          where: { workspace_id: input.data.workspace_id }
        });

        let currentDepCount = subscrption.addons.departments;

        if (departments >= currentDepCount) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('departement_limit_reached')
          });
        }
      }

      if (!subscrption.addons.multi_manager && input.data.manager_member.length > 1 && !(subscrption.enterprise > 0)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('manager_addon_required')
        });
      }

      const { id: department_id } = await ctx.prisma.department.create({
        data: {
          maximum_absent: input.data.maximum_absent,
          name: input.data.name,
          workspace_id: ctx.current_member.workspace_id,
          approval_process: input.data.approval_process,
          default_department_allowances:
            input.data.default_department_allowances.length > 0
              ? JSON.stringify(input.data.default_department_allowances)
              : undefined
        },
        select: { id: true }
      });

      const newManagers: Prisma.MemberDepartmentCreateManyInput[] = [];

      for (let index = 0; index < input.data.manager_member.length; index++) {
        const manager_member = input.data.manager_member[index];
        if (manager_member)
          newManagers.push({
            id: Guid.create().toString(),
            workspace_id: ctx.current_member.workspace_id,
            department_id: department_id,
            member_id: manager_member.member_id,
            manager_type: 'Manager',
            predecessor_manager_id: manager_member.predecessor_manager_id
          });
      }

      await ctx.prisma.memberDepartment.createMany({
        data: newManagers
      });

      const department = await ctx.prisma.department.findUnique({
        where: { id: department_id },
        select: defaultDepartmentSelect
      });

      return department;
    }),
  all: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: { privacy_show_otherdepartments: true }
    });

    if (workspace?.privacy_show_otherdepartments || ctx.current_member.is_admin) {
      return ctx.prisma.department.findMany({
        select: defaultDepartmentSelect,
        where: { workspace_id: ctx.current_member.workspace_id },
        orderBy: [
          {
            name: 'asc'
          }
        ]
      });
    } else {
      const departmentIdsOfUser = await ctx.prisma.memberDepartment.findMany({
        where: { member_id: ctx.current_member.id },
        select: { department_id: true }
      });

      const allDepartmentIds = departmentIdsOfUser
        .map((department) => department.department_id)
        .filter((y) => y != null);
      return ctx.prisma.department.findMany({
        select: defaultDepartmentSelect,
        where: {
          workspace_id: ctx.current_member.workspace_id,
          id: { in: allDepartmentIds }
        },
        orderBy: [
          {
            name: 'asc'
          }
        ]
      });
    }
  }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const department = await ctx.prisma.department.findFirst({
        where: { id, workspace_id: ctx.current_member.workspace_id },
        select: defaultDepartmentSelect
      });
      if (!department) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No department with id '${id}'`
        });
      }
      return department;
    }),
  //update
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          maximum_absent: z.number().nullable().optional(),
          workspace_id: z.string(),
          approval_process: z.nativeEnum(ApprovalProcess).optional(),
          changed_by_webhook: z.boolean().optional(),
          manager_member: z
            .array(
              z.object({
                member_id: z.string(),
                predecessor_manager_id: z.string().nullable()
              })
            )
            .optional(),
          default_department_allowances: z
            .array(
              z.object({
                id: z.string(),
                value: z.number()
              })
            )
            .optional()
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
          message: 'You have to be admin to edit department'
        });
      }

      let manager = [];

      if (data.manager_member) {
        manager = await ctx.prisma.member.findMany({
          where: { id: { in: data.manager_member.map((x) => x.member_id) } },
          select: { email: true }
        });
        if (manager.find((x) => x.email == null)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_manager_email_missing')
          });
        }
        const workspace = await ctx.prisma.workspace.findUnique({
          where: { id: input.data.workspace_id },
          select: defaultWorkspaceSelect
        });
        if (!workspace) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('you-have-to-be-admin-to-add-department')
          });
        }

        const subscription = summarizeSubscriptions(workspace.subscriptions);

        if (!subscription.addons.multi_manager && data.manager_member.length > 1 && !(subscription.enterprise > 0)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('manager_addon_required')
          });
        }
        if (!subscription.addons.multi_manager && !(subscription.enterprise > 0)) {
          input.data.approval_process = ApprovalProcess.Linear_all_have_to_agree;
        }
        await ctx.prisma.memberDepartment.updateMany({
          where: { department_id: id, manager_type: { not: 'Member' } },
          data: { manager_type: 'Member' }
        });

        const updateArray = [];
        for (let index = 0; index < data.manager_member.length; index++) {
          const manager = data.manager_member[index];
          if (!manager) continue;
          updateArray.push(
            ctx.prisma.memberDepartment.upsert({
              where: {
                department_id_member_id: {
                  department_id: id,
                  member_id: manager.member_id
                }
              },
              create: {
                department_id: id,
                member_id: manager.member_id,
                manager_type: 'Manager',
                workspace_id: ctx.current_member.workspace_id,
                predecessor_manager_id: manager.predecessor_manager_id,
                changed_by_webhook: input.data.changed_by_webhook ?? false
              },
              update: {
                manager_type: 'Manager',
                predecessor_manager_id: manager.predecessor_manager_id,
                changed_by_webhook: input.data.changed_by_webhook ?? false
              }
            })
          );
        }

        const membersToUpdate = await ctx.prisma.member.findMany({
          where: { approver_config_department_id: id },
          select: { id: true }
        });

        for (let index = 0; index < membersToUpdate.length; index++) {
          const memberToUpdate = membersToUpdate[index];
          if (!memberToUpdate) continue;
          updateArray.push(
            ctx.prisma.memberApprover.deleteMany({
              where: { member_id: memberToUpdate.id }
            })
          );
          updateArray.push(
            ctx.prisma.memberApprover.createMany({
              data: data.manager_member
                .filter((value, index, self) => index === self.findIndex((t) => t.member_id === value.member_id))
                .map((x) => {
                  return {
                    approver_member_id: x.member_id,
                    member_id: memberToUpdate.id,
                    workspace_id: ctx.current_member.workspace_id,
                    predecessor_approver_member_approver_id: x.predecessor_manager_id,
                    changed_by_webhook: input.data.changed_by_webhook ?? false
                  };
                })
            })
          );
          updateArray.push(
            ctx.prisma.member.update({
              where: { id: memberToUpdate.id },
              data: { approval_process: input.data.approval_process }
            })
          );
        }

        await ctx.prisma.$transaction(updateArray);
      }
      interface DepartmentData {
        name?: string;
        maximum_absent?: number | null;
        default_allowance?: number;
        approval_process?: ApprovalProcess;
      }
      const departmentUpdateData: DepartmentData = {};

      if (data.name !== undefined) {
        departmentUpdateData.name = data.name;
      }
      if (data.maximum_absent !== undefined) {
        departmentUpdateData.maximum_absent = data.maximum_absent;
      }
      if (data.approval_process !== undefined) {
        departmentUpdateData.approval_process = data.approval_process;
      }

      const department = await ctx.prisma.department.update({
        where: { id },
        data: {
          maximum_absent: data.maximum_absent,
          name: data.name,
          approval_process: data.approval_process,
          default_department_allowances:
            data.default_department_allowances && data.default_department_allowances.length > 0
              ? JSON.stringify(data.default_department_allowances)
              : undefined
        },
        select: defaultDepartmentSelect
      });
      return department;
    }),
  //delete
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
      const department = await ctx.prisma.department.findUnique({
        where: { id },
        select: { workspace_id: true }
      });
      if (department?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const count = await ctx.prisma.department.count({
        where: { workspace_id: ctx.current_member.workspace_id }
      });

      if (count == 1) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_last_department')
        });
      }

      const [memDep, users_with_department_as_approver] = await ctx.prisma.$transaction([
        ctx.prisma.memberDepartment.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            department_id: id
          },
          select: {
            id: true,
            member: {
              select: {
                name: true,
                email: true,
                departments: { select: { id: true } }
              }
            }
          }
        }),
        ctx.prisma.member.findMany({
          where: { approver_config_department_id: id },
          select: { id: true, name: true }
        })
      ]);

      const membersWithOneDep = memDep.filter((x) => x.member.departments.length == 1);

      if (membersWithOneDep.length > 0) {
        if(membersWithOneDep.length === 1) {
          const m = memDep.find((x) => x.member.departments.length == 1)?.member;
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('error_department_has_insufficient_members', { member: m?.name ? m.name : (m?.email || '') })
          });
        } else {
          const members = memDep.filter((x) => x.member.departments.length == 1).map(mem => mem.member.name || (mem.member.email || ''));
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: ctx.t('error_department_has_insufficient_members_plural', { members: members.join(', ')}),
          });
        }
      }

      if (users_with_department_as_approver.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('error_department_has_approver', {
            members: users_with_department_as_approver.map((x) => x.name).join(', ')
          })
        });
      }

      await ctx.prisma.departmentGroupSyncSetting.deleteMany({
        where: {
          department_id: id
        }
      });

      await ctx.prisma.department.delete({ where: { id: id } });
      return {
        id
      };
    })
});
