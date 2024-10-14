import { ApprovalProcess, DepartmentManagerType, Status } from '@prisma/client';
import { boolean, z } from 'zod';
import { memberRouter } from '~/server/api/routers/member';
import { memberAllowanceRouter } from '~/server/api/routers/member_allowance';
import { memberScheduleRouter } from '~/server/api/routers/member_schedule';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';

export const membersPublicApiRouter = createTRPCRouter({
  getMembers: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/members',
        protect: true,
        tags: ['Members'],
        summary: 'Get all members',
        description: 'Get all members'
      }
    })
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.string(),
          custom_id: z.string().nullable(),
          name: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
          allowances: z.array(
            z.object({
              remaining: z.number(),
              brought_forward: z.number(),
              allowance: z.number(),
              taken: z.number(),
              year: z.number(),
              compensatory_time_off: z.number(),
              updatedAt: z.date(),
              createdAt: z.date(),
              id: z.string(),
              allowance_type: z.object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean()
              })
            })
          ),
          allowance_type_configurtaions: z.array(
            z.object({
              id: z.string(),
              allowance_type_id: z.string(),
              default: z.boolean(),
              disabled: z.boolean()
            })
          ),
          approval_process: z.nativeEnum(ApprovalProcess),
          status: z.nativeEnum(Status),
          birthday: z.date().nullable(),
          employment_start_date: z.date().nullable(),
          employment_end_date: z.date().nullable(),
          email: z.string().nullable(),
          departments: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          )
        })
      )
    )
    .query(async ({ ctx }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const departmentIdsOfUser = new Set(
        (
          await ctx.prisma.memberDepartment.findMany({
            where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
            select: { department_id: true }
          })
        ).map((department) => department.department_id)
      );
      const members = await ctx.prisma.member.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: {
          id: true,
          custom_id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          employment_start_date: true,
          employment_end_date: true,
          allowances: {
            select: {
              remaining: true,
              brought_forward: true,
              allowance: true,
              taken: true,
              leave_types_stats: true,
              year: true,
              compensatory_time_off: true,
              updatedAt: true,
              createdAt: true,
              id: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true } }
            }
          },
          allowance_type_configurtaions: {
            select: {
              id: true,
              allowance_type_id: true,
              default: true,
              disabled: true
            }
          },
          approval_process: true,
          status: true,
          birthday: true,

          email: true,
          departments: {
            select: {
              manager_type: true,
              department_id: true,
              department: { select: { name: true, id: true } }
            }
          },
          is_admin: true,
          has_approvers: {
            select: {
              member: { select: { id: true, name: true, email: true } }
            }
          }
        }
      });

      let mems = members.map((member) => {
        member.departments.forEach((y) => {
          if (!ctx.current_member.is_admin && !departmentIdsOfUser.has(y.department?.id)) {
            member.birthday ? member.birthday.setFullYear(0) : null;
          }
        });

        let x = {
          ...member,
          departments: member.departments.map((department) => {
            return {
              id: department.department_id,
              name: department.department.name,
              manager_type: department.manager_type
            };
          })
        };
        return x;
      });

      return mems;
    }),
  getMemberById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/members/{id}',
        protect: true,
        tags: ['Members'],
        summary: 'Read a member by id',
        description: 'Read a member by id'
      }
    })
    .input(
      z.object({
        id: z.string().uuid()
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          custom_id: z.string().nullable(),
          name: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
          allowances: z.array(
            z.object({
              remaining: z.number(),
              brought_forward: z.number(),
              allowance: z.number(),
              taken: z.number(),
              year: z.number(),
              compensatory_time_off: z.number(),
              updatedAt: z.date(),
              createdAt: z.date(),
              id: z.string(),
              allowance_type: z.object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean()
              })
            })
          ),
          allowance_type_configurtaions: z.array(
            z.object({
              id: z.string(),
              allowance_type_id: z.string(),
              default: z.boolean(),
              disabled: z.boolean()
            })
          ),
          approval_process: z.nativeEnum(ApprovalProcess),
          status: z.nativeEnum(Status),
          birthday: z.date().nullable(),
          employment_start_date: z.date().nullable(),
          employment_end_date: z.date().nullable(),
          email: z.string().nullable(),
          departments: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          ),
          schedules: z.array(
            z.object({
              id: z.string(),
              from: z.date().nullable(),
              monday_am_start: z.date(),
              monday_am_end: z.date(),
              monday_pm_start: z.date(),
              monday_pm_end: z.date(),
              monday_am_enabled: boolean(),
              monday_pm_enabled: boolean(),
              monday_deduct_fullday: boolean(),
              tuesday_am_start: z.date(),
              tuesday_am_end: z.date(),
              tuesday_pm_start: z.date(),
              tuesday_pm_end: z.date(),
              tuesday_am_enabled: boolean(),
              tuesday_pm_enabled: boolean(),
              tuesday_deduct_fullday: boolean(),
              wednesday_am_start: z.date(),
              wednesday_am_end: z.date(),
              wednesday_pm_start: z.date(),
              wednesday_pm_end: z.date(),
              wednesday_am_enabled: boolean(),
              wednesday_pm_enabled: boolean(),
              wednesday_deduct_fullday: boolean(),
              thursday_am_start: z.date(),
              thursday_am_end: z.date(),
              thursday_pm_start: z.date(),
              thursday_pm_end: z.date(),
              thursday_am_enabled: boolean(),
              thursday_pm_enabled: boolean(),
              thursday_deduct_fullday: boolean(),
              friday_am_start: z.date(),
              friday_am_end: z.date(),
              friday_pm_start: z.date(),
              friday_pm_end: z.date(),
              friday_am_enabled: boolean(),
              friday_pm_enabled: boolean(),
              friday_deduct_fullday: boolean(),
              saturday_am_start: z.date(),
              saturday_am_end: z.date(),
              saturday_pm_start: z.date(),
              saturday_pm_end: z.date(),
              saturday_am_enabled: boolean(),
              saturday_pm_enabled: boolean(),
              saturday_deduct_fullday: boolean(),
              sunday_am_start: z.date(),
              sunday_am_end: z.date(),
              sunday_pm_start: z.date(),
              sunday_pm_end: z.date(),
              sunday_am_enabled: boolean(),
              sunday_pm_enabled: boolean(),
              sunday_deduct_fullday: boolean(),
              updatedAt: z.date(),
              createdAt: z.date()
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const member = await ctx.prisma.member.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, id: input.id },
        select: {
          id: true,
          custom_id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          employment_start_date: true,
          employment_end_date: true,
          allowances: {
            select: {
              remaining: true,
              brought_forward: true,
              allowance: true,
              taken: true,
              leave_types_stats: true,
              year: true,
              compensatory_time_off: true,
              updatedAt: true,
              createdAt: true,
              id: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true } }
            }
          },
          allowance_type_configurtaions: {
            select: {
              id: true,
              allowance_type_id: true,
              default: true,
              disabled: true
            }
          },
          approval_process: true,
          status: true,
          birthday: true,
          email: true,
          departments: {
            select: {
              manager_type: true,
              department_id: true,
              department: { select: { name: true, id: true } }
            }
          },
          is_admin: true,
          has_approvers: {
            select: {
              member: { select: { id: true, name: true, email: true } }
            }
          },
          schedules: {
            select: {
              id: true,
              from: true,
              monday_am_start: true,
              monday_am_end: true,
              monday_pm_start: true,
              monday_pm_end: true,
              monday_am_enabled: true,
              monday_pm_enabled: true,
              monday_deduct_fullday: true,
              tuesday_am_start: true,
              tuesday_am_end: true,
              tuesday_pm_start: true,
              tuesday_pm_end: true,
              tuesday_am_enabled: true,
              tuesday_pm_enabled: true,
              tuesday_deduct_fullday: true,
              wednesday_am_start: true,
              wednesday_am_end: true,
              wednesday_pm_start: true,
              wednesday_pm_end: true,
              wednesday_am_enabled: true,
              wednesday_pm_enabled: true,
              wednesday_deduct_fullday: true,
              thursday_am_start: true,
              thursday_am_end: true,
              thursday_pm_start: true,
              thursday_pm_end: true,
              thursday_am_enabled: true,
              thursday_pm_enabled: true,
              thursday_deduct_fullday: true,
              friday_am_start: true,
              friday_am_end: true,
              friday_pm_start: true,
              friday_pm_end: true,
              friday_am_enabled: true,
              friday_pm_enabled: true,
              friday_deduct_fullday: true,
              saturday_am_start: true,
              saturday_am_end: true,
              saturday_pm_start: true,
              saturday_pm_end: true,
              saturday_am_enabled: true,
              saturday_pm_enabled: true,
              saturday_deduct_fullday: true,
              sunday_am_start: true,
              sunday_am_end: true,
              sunday_pm_start: true,
              sunday_pm_end: true,
              sunday_am_enabled: true,
              sunday_pm_enabled: true,
              sunday_deduct_fullday: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      if (!member) throw new Error('no member found');
      const departmentIdsOfUser = new Set(
        (
          await ctx.prisma.memberDepartment.findMany({
            where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
            select: { department_id: true }
          })
        ).map((department) => department.department_id)
      );

      member.departments.forEach((y) => {
        if (!ctx.current_member.is_admin && !departmentIdsOfUser.has(y.department?.id)) {
          member.birthday ? member.birthday.setFullYear(0) : null;
        }
      });

      let x = {
        ...member,
        departments: member.departments.map((department) => {
          return {
            id: department.department_id,
            name: department.department.name,
            manager_type: department.manager_type
          };
        })
      };
      return x;
    }),
  getMemberByMicrosoftId: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/members/microsoft/{microsoft_user_id}',
        protect: true,
        tags: ['Members'],
        summary: 'Read a member by Microsoft user id',
        description: 'Read a member Microsoft user id'
      }
    })
    .input(
      z.object({
        microsoft_user_id: z.string()
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          custom_id: z.string().nullable(),
          name: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
          allowances: z.array(
            z.object({
              remaining: z.number(),
              brought_forward: z.number(),
              allowance: z.number(),
              taken: z.number(),
              year: z.number(),
              compensatory_time_off: z.number(),
              updatedAt: z.date(),
              createdAt: z.date(),
              id: z.string(),
              allowance_type: z.object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean()
              })
            })
          ),
          allowance_type_configurtaions: z.array(
            z.object({
              id: z.string(),
              allowance_type_id: z.string(),
              default: z.boolean(),
              disabled: z.boolean()
            })
          ),
          approval_process: z.nativeEnum(ApprovalProcess),
          status: z.nativeEnum(Status),
          birthday: z.date().nullable(),
          employment_start_date: z.date().nullable(),
          employment_end_date: z.date().nullable(),
          email: z.string().nullable(),
          departments: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          ),
          schedules: z.array(
            z.object({
              id: z.string(),
              from: z.date().nullable(),
              monday_am_start: z.date(),
              monday_am_end: z.date(),
              monday_pm_start: z.date(),
              monday_pm_end: z.date(),
              monday_am_enabled: boolean(),
              monday_pm_enabled: boolean(),
              monday_deduct_fullday: boolean(),
              tuesday_am_start: z.date(),
              tuesday_am_end: z.date(),
              tuesday_pm_start: z.date(),
              tuesday_pm_end: z.date(),
              tuesday_am_enabled: boolean(),
              tuesday_pm_enabled: boolean(),
              tuesday_deduct_fullday: boolean(),
              wednesday_am_start: z.date(),
              wednesday_am_end: z.date(),
              wednesday_pm_start: z.date(),
              wednesday_pm_end: z.date(),
              wednesday_am_enabled: boolean(),
              wednesday_pm_enabled: boolean(),
              wednesday_deduct_fullday: boolean(),
              thursday_am_start: z.date(),
              thursday_am_end: z.date(),
              thursday_pm_start: z.date(),
              thursday_pm_end: z.date(),
              thursday_am_enabled: boolean(),
              thursday_pm_enabled: boolean(),
              thursday_deduct_fullday: boolean(),
              friday_am_start: z.date(),
              friday_am_end: z.date(),
              friday_pm_start: z.date(),
              friday_pm_end: z.date(),
              friday_am_enabled: boolean(),
              friday_pm_enabled: boolean(),
              friday_deduct_fullday: boolean(),
              saturday_am_start: z.date(),
              saturday_am_end: z.date(),
              saturday_pm_start: z.date(),
              saturday_pm_end: z.date(),
              saturday_am_enabled: boolean(),
              saturday_pm_enabled: boolean(),
              saturday_deduct_fullday: boolean(),
              sunday_am_start: z.date(),
              sunday_am_end: z.date(),
              sunday_pm_start: z.date(),
              sunday_pm_end: z.date(),
              sunday_am_enabled: boolean(),
              sunday_pm_enabled: boolean(),
              sunday_deduct_fullday: boolean(),
              updatedAt: z.date(),
              createdAt: z.date()
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const member = await ctx.prisma.member.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, microsoft_user_id: input.microsoft_user_id },
        select: {
          id: true,
          custom_id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          employment_start_date: true,
          employment_end_date: true,
          allowances: {
            select: {
              remaining: true,
              brought_forward: true,
              allowance: true,
              taken: true,
              leave_types_stats: true,
              year: true,
              compensatory_time_off: true,
              updatedAt: true,
              createdAt: true,
              id: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true } }
            }
          },
          allowance_type_configurtaions: {
            select: {
              id: true,
              allowance_type_id: true,
              default: true,
              disabled: true
            }
          },
          approval_process: true,
          status: true,
          birthday: true,
          email: true,
          departments: {
            select: {
              manager_type: true,
              department_id: true,
              department: { select: { name: true, id: true } }
            }
          },
          is_admin: true,
          has_approvers: {
            select: {
              member: { select: { id: true, name: true, email: true } }
            }
          },
          schedules: {
            select: {
              id: true,
              from: true,
              monday_am_start: true,
              monday_am_end: true,
              monday_pm_start: true,
              monday_pm_end: true,
              monday_am_enabled: true,
              monday_pm_enabled: true,
              monday_deduct_fullday: true,
              tuesday_am_start: true,
              tuesday_am_end: true,
              tuesday_pm_start: true,
              tuesday_pm_end: true,
              tuesday_am_enabled: true,
              tuesday_pm_enabled: true,
              tuesday_deduct_fullday: true,
              wednesday_am_start: true,
              wednesday_am_end: true,
              wednesday_pm_start: true,
              wednesday_pm_end: true,
              wednesday_am_enabled: true,
              wednesday_pm_enabled: true,
              wednesday_deduct_fullday: true,
              thursday_am_start: true,
              thursday_am_end: true,
              thursday_pm_start: true,
              thursday_pm_end: true,
              thursday_am_enabled: true,
              thursday_pm_enabled: true,
              thursday_deduct_fullday: true,
              friday_am_start: true,
              friday_am_end: true,
              friday_pm_start: true,
              friday_pm_end: true,
              friday_am_enabled: true,
              friday_pm_enabled: true,
              friday_deduct_fullday: true,
              saturday_am_start: true,
              saturday_am_end: true,
              saturday_pm_start: true,
              saturday_pm_end: true,
              saturday_am_enabled: true,
              saturday_pm_enabled: true,
              saturday_deduct_fullday: true,
              sunday_am_start: true,
              sunday_am_end: true,
              sunday_pm_start: true,
              sunday_pm_end: true,
              sunday_am_enabled: true,
              sunday_pm_enabled: true,
              sunday_deduct_fullday: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      if (!member) throw new Error('no member found');
      const departmentIdsOfUser = new Set(
        (
          await ctx.prisma.memberDepartment.findMany({
            where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
            select: { department_id: true }
          })
        ).map((department) => department.department_id)
      );

      member.departments.forEach((y) => {
        if (!ctx.current_member.is_admin && !departmentIdsOfUser.has(y.department?.id)) {
          member.birthday ? member.birthday.setFullYear(0) : null;
        }
      });

      let x = {
        ...member,
        departments: member.departments.map((department) => {
          return {
            id: department.department_id,
            name: department.department.name,
            manager_type: department.manager_type
          };
        })
      };
      return x;
    }),
  getMemberByEmail: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/members/email/{email}',
        protect: true,
        tags: ['Members'],
        summary: 'Read a member by email',
        description: 'Read a member email'
      }
    })
    .input(
      z.object({
        email: z.string()
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          custom_id: z.string().nullable(),
          name: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
          allowances: z.array(
            z.object({
              remaining: z.number(),
              brought_forward: z.number(),
              allowance: z.number(),
              taken: z.number(),
              year: z.number(),
              compensatory_time_off: z.number(),
              updatedAt: z.date(),
              createdAt: z.date(),
              id: z.string(),
              allowance_type: z.object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean()
              })
            })
          ),
          allowance_type_configurtaions: z.array(
            z.object({
              id: z.string(),
              allowance_type_id: z.string(),
              default: z.boolean(),
              disabled: z.boolean()
            })
          ),
          approval_process: z.nativeEnum(ApprovalProcess),
          status: z.nativeEnum(Status),
          birthday: z.date().nullable(),
          employment_start_date: z.date().nullable(),
          employment_end_date: z.date().nullable(),
          email: z.string().nullable(),
          departments: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          ),
          schedules: z.array(
            z.object({
              id: z.string(),
              from: z.date().nullable(),
              monday_am_start: z.date(),
              monday_am_end: z.date(),
              monday_pm_start: z.date(),
              monday_pm_end: z.date(),
              monday_am_enabled: boolean(),
              monday_pm_enabled: boolean(),
              monday_deduct_fullday: boolean(),
              tuesday_am_start: z.date(),
              tuesday_am_end: z.date(),
              tuesday_pm_start: z.date(),
              tuesday_pm_end: z.date(),
              tuesday_am_enabled: boolean(),
              tuesday_pm_enabled: boolean(),
              tuesday_deduct_fullday: boolean(),
              wednesday_am_start: z.date(),
              wednesday_am_end: z.date(),
              wednesday_pm_start: z.date(),
              wednesday_pm_end: z.date(),
              wednesday_am_enabled: boolean(),
              wednesday_pm_enabled: boolean(),
              wednesday_deduct_fullday: boolean(),
              thursday_am_start: z.date(),
              thursday_am_end: z.date(),
              thursday_pm_start: z.date(),
              thursday_pm_end: z.date(),
              thursday_am_enabled: boolean(),
              thursday_pm_enabled: boolean(),
              thursday_deduct_fullday: boolean(),
              friday_am_start: z.date(),
              friday_am_end: z.date(),
              friday_pm_start: z.date(),
              friday_pm_end: z.date(),
              friday_am_enabled: boolean(),
              friday_pm_enabled: boolean(),
              friday_deduct_fullday: boolean(),
              saturday_am_start: z.date(),
              saturday_am_end: z.date(),
              saturday_pm_start: z.date(),
              saturday_pm_end: z.date(),
              saturday_am_enabled: boolean(),
              saturday_pm_enabled: boolean(),
              saturday_deduct_fullday: boolean(),
              sunday_am_start: z.date(),
              sunday_am_end: z.date(),
              sunday_pm_start: z.date(),
              sunday_pm_end: z.date(),
              sunday_am_enabled: boolean(),
              sunday_pm_enabled: boolean(),
              sunday_deduct_fullday: boolean(),
              updatedAt: z.date(),
              createdAt: z.date()
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const member = await ctx.prisma.member.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, email: input.email },
        select: {
          id: true,
          custom_id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          employment_start_date: true,
          employment_end_date: true,
          allowances: {
            select: {
              remaining: true,
              brought_forward: true,
              allowance: true,
              taken: true,
              leave_types_stats: true,
              year: true,
              compensatory_time_off: true,
              updatedAt: true,
              createdAt: true,
              id: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true } }
            }
          },
          allowance_type_configurtaions: {
            select: {
              id: true,
              allowance_type_id: true,
              default: true,
              disabled: true
            }
          },
          approval_process: true,
          status: true,
          birthday: true,
          email: true,
          departments: {
            select: {
              manager_type: true,
              department_id: true,
              department: { select: { name: true, id: true } }
            }
          },
          is_admin: true,
          has_approvers: {
            select: {
              member: { select: { id: true, name: true, email: true } }
            }
          },
          schedules: {
            select: {
              id: true,
              from: true,
              monday_am_start: true,
              monday_am_end: true,
              monday_pm_start: true,
              monday_pm_end: true,
              monday_am_enabled: true,
              monday_pm_enabled: true,
              monday_deduct_fullday: true,
              tuesday_am_start: true,
              tuesday_am_end: true,
              tuesday_pm_start: true,
              tuesday_pm_end: true,
              tuesday_am_enabled: true,
              tuesday_pm_enabled: true,
              tuesday_deduct_fullday: true,
              wednesday_am_start: true,
              wednesday_am_end: true,
              wednesday_pm_start: true,
              wednesday_pm_end: true,
              wednesday_am_enabled: true,
              wednesday_pm_enabled: true,
              wednesday_deduct_fullday: true,
              thursday_am_start: true,
              thursday_am_end: true,
              thursday_pm_start: true,
              thursday_pm_end: true,
              thursday_am_enabled: true,
              thursday_pm_enabled: true,
              thursday_deduct_fullday: true,
              friday_am_start: true,
              friday_am_end: true,
              friday_pm_start: true,
              friday_pm_end: true,
              friday_am_enabled: true,
              friday_pm_enabled: true,
              friday_deduct_fullday: true,
              saturday_am_start: true,
              saturday_am_end: true,
              saturday_pm_start: true,
              saturday_pm_end: true,
              saturday_am_enabled: true,
              saturday_pm_enabled: true,
              saturday_deduct_fullday: true,
              sunday_am_start: true,
              sunday_am_end: true,
              sunday_pm_start: true,
              sunday_pm_end: true,
              sunday_am_enabled: true,
              sunday_pm_enabled: true,
              sunday_deduct_fullday: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      if (!member) throw new Error('no member found');
      const departmentIdsOfUser = new Set(
        (
          await ctx.prisma.memberDepartment.findMany({
            where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
            select: { department_id: true }
          })
        ).map((department) => department.department_id)
      );

      member.departments.forEach((y) => {
        if (!ctx.current_member.is_admin && !departmentIdsOfUser.has(y.department?.id)) {
          member.birthday ? member.birthday.setFullYear(0) : null;
        }
      });

      let x = {
        ...member,
        departments: member.departments.map((department) => {
          return {
            id: department.department_id,
            name: department.department.name,
            manager_type: department.manager_type
          };
        })
      };
      return x;
    }),
  getMemberByCustomId: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/members/custom_id/{custom_id}',
        protect: true,
        tags: ['Members'],
        summary: 'Read a member by custom_id',
        description: 'Read a member by custom_id'
      }
    })
    .input(
      z.object({
        custom_id: z.string()
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          custom_id: z.string().nullable(),
          name: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
          allowances: z.array(
            z.object({
              remaining: z.number(),
              brought_forward: z.number(),
              allowance: z.number(),
              taken: z.number(),
              year: z.number(),
              compensatory_time_off: z.number(),
              updatedAt: z.date(),
              createdAt: z.date(),
              id: z.string(),
              allowance_type: z.object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean()
              })
            })
          ),
          allowance_type_configurtaions: z.array(
            z.object({
              id: z.string(),
              allowance_type_id: z.string(),
              default: z.boolean(),
              disabled: z.boolean()
            })
          ),
          approval_process: z.nativeEnum(ApprovalProcess),
          status: z.nativeEnum(Status),
          birthday: z.date().nullable(),
          employment_start_date: z.date().nullable(),
          employment_end_date: z.date().nullable(),
          email: z.string().nullable(),
          departments: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          ),
          schedules: z.array(
            z.object({
              id: z.string(),
              from: z.date().nullable(),
              monday_am_start: z.date(),
              monday_am_end: z.date(),
              monday_pm_start: z.date(),
              monday_pm_end: z.date(),
              monday_am_enabled: boolean(),
              monday_pm_enabled: boolean(),
              monday_deduct_fullday: boolean(),
              tuesday_am_start: z.date(),
              tuesday_am_end: z.date(),
              tuesday_pm_start: z.date(),
              tuesday_pm_end: z.date(),
              tuesday_am_enabled: boolean(),
              tuesday_pm_enabled: boolean(),
              tuesday_deduct_fullday: boolean(),
              wednesday_am_start: z.date(),
              wednesday_am_end: z.date(),
              wednesday_pm_start: z.date(),
              wednesday_pm_end: z.date(),
              wednesday_am_enabled: boolean(),
              wednesday_pm_enabled: boolean(),
              wednesday_deduct_fullday: boolean(),
              thursday_am_start: z.date(),
              thursday_am_end: z.date(),
              thursday_pm_start: z.date(),
              thursday_pm_end: z.date(),
              thursday_am_enabled: boolean(),
              thursday_pm_enabled: boolean(),
              thursday_deduct_fullday: boolean(),
              friday_am_start: z.date(),
              friday_am_end: z.date(),
              friday_pm_start: z.date(),
              friday_pm_end: z.date(),
              friday_am_enabled: boolean(),
              friday_pm_enabled: boolean(),
              friday_deduct_fullday: boolean(),
              saturday_am_start: z.date(),
              saturday_am_end: z.date(),
              saturday_pm_start: z.date(),
              saturday_pm_end: z.date(),
              saturday_am_enabled: boolean(),
              saturday_pm_enabled: boolean(),
              saturday_deduct_fullday: boolean(),
              sunday_am_start: z.date(),
              sunday_am_end: z.date(),
              sunday_pm_start: z.date(),
              sunday_pm_end: z.date(),
              sunday_am_enabled: boolean(),
              sunday_pm_enabled: boolean(),
              sunday_deduct_fullday: boolean(),
              updatedAt: z.date(),
              createdAt: z.date()
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const member = await ctx.prisma.member.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, custom_id: input.custom_id },
        select: {
          id: true,
          custom_id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          employment_start_date: true,
          employment_end_date: true,
          allowances: {
            select: {
              remaining: true,
              brought_forward: true,
              allowance: true,
              taken: true,
              leave_types_stats: true,
              year: true,
              compensatory_time_off: true,
              updatedAt: true,
              createdAt: true,
              id: true,
              allowance_type: { select: { id: true, name: true, ignore_allowance_limit: true } }
            }
          },
          allowance_type_configurtaions: {
            select: {
              id: true,
              allowance_type_id: true,
              default: true,
              disabled: true
            }
          },
          approval_process: true,
          status: true,
          birthday: true,
          email: true,
          departments: {
            select: {
              manager_type: true,
              department_id: true,
              department: { select: { name: true, id: true } }
            }
          },
          is_admin: true,
          has_approvers: {
            select: {
              member: { select: { id: true, name: true, email: true } }
            }
          },
          schedules: {
            select: {
              id: true,
              from: true,
              monday_am_start: true,
              monday_am_end: true,
              monday_pm_start: true,
              monday_pm_end: true,
              monday_am_enabled: true,
              monday_pm_enabled: true,
              monday_deduct_fullday: true,
              tuesday_am_start: true,
              tuesday_am_end: true,
              tuesday_pm_start: true,
              tuesday_pm_end: true,
              tuesday_am_enabled: true,
              tuesday_pm_enabled: true,
              tuesday_deduct_fullday: true,
              wednesday_am_start: true,
              wednesday_am_end: true,
              wednesday_pm_start: true,
              wednesday_pm_end: true,
              wednesday_am_enabled: true,
              wednesday_pm_enabled: true,
              wednesday_deduct_fullday: true,
              thursday_am_start: true,
              thursday_am_end: true,
              thursday_pm_start: true,
              thursday_pm_end: true,
              thursday_am_enabled: true,
              thursday_pm_enabled: true,
              thursday_deduct_fullday: true,
              friday_am_start: true,
              friday_am_end: true,
              friday_pm_start: true,
              friday_pm_end: true,
              friday_am_enabled: true,
              friday_pm_enabled: true,
              friday_deduct_fullday: true,
              saturday_am_start: true,
              saturday_am_end: true,
              saturday_pm_start: true,
              saturday_pm_end: true,
              saturday_am_enabled: true,
              saturday_pm_enabled: true,
              saturday_deduct_fullday: true,
              sunday_am_start: true,
              sunday_am_end: true,
              sunday_pm_start: true,
              sunday_pm_end: true,
              sunday_am_enabled: true,
              sunday_pm_enabled: true,
              sunday_deduct_fullday: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      if (!member) throw new Error('no member found');
      const departmentIdsOfUser = new Set(
        (
          await ctx.prisma.memberDepartment.findMany({
            where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
            select: { department_id: true }
          })
        ).map((department) => department.department_id)
      );

      member.departments.forEach((y) => {
        if (!ctx.current_member.is_admin && !departmentIdsOfUser.has(y.department?.id)) {
          member.birthday ? member.birthday.setFullYear(0) : null;
        }
      });

      let x = {
        ...member,
        departments: member.departments.map((department) => {
          return {
            id: department.department_id,
            name: department.department.name,
            manager_type: department.manager_type
          };
        })
      };
      return x;
    }),
  inviteMember: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/members',
        protect: true,
        tags: ['Members'],
        summary: 'Invite a member',
        description: 'Invite a member'
      }
    })
    .input(
      z.object({
        name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }),
        email: z.string().email().nullable(),
        department_ids: z
          .array(z.object({ id: z.string().uuid() }))
          .max(1)
          .min(1),
        employment_start_date: z.coerce.date().nullable(),
        //    employment_end_date: z.coerce.date().nullable(),
        public_holiday_id: z.string(),
        annual_allowance_current_year: z.number(),
        annual_allowance_next_year: z.number(),
        birthday: z.coerce.date().nullable(),
        custom_id: z.string().nullable(),
        defaultAllowances: z.array(z.object({
          id: z.string(),
          current_year: z.number(),
          next_year: z.number(),
          default: z.boolean().optional(),
          disabled: z.boolean().optional(),
        })),
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const caller = memberRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });

      const member = await caller.invite({
        member_department_ids: input.department_ids.map((x) => x.id),
        status: input.email ? Status.INACTIVE : Status.ACTIVE,
        custom_id: input.custom_id,
        email: input.email,
        employment_start_date: input.employment_start_date,
        // employment_end_date: input.employment_end_date,
        name: input.name,
        public_holiday_id: input.public_holiday_id,
        defaultAllowances: input.defaultAllowances,
      });

      return member.id;
    }),
  updateMember: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/members/{id}',
        protect: true,
        tags: ['Members'],
        summary: 'Update a member',
        description: 'Update a member'
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        is_admin: z.boolean().optional(),
        department_ids: z
          .array(z.object({ id: z.string().uuid() }))
          .max(1)
          .min(1)
          .optional(),
        employment_start_date: z.coerce.date().nullable().optional(),
        employment_end_date: z.coerce.date().nullable().optional(),
        public_holiday_id: z.string().optional(),
        birthday: z.coerce.date().nullable().optional(),
        custom_id: z.string().nullable().optional(),
        status: z.nativeEnum(Status).optional()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const caller = memberRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.edit({
        id: input.id,
        data: {
          birthday: input.birthday,
          custom_id: input.custom_id,
          employment_start_date: input.employment_start_date,
          employment_end_date: input.employment_end_date,
          public_holiday_id: input.public_holiday_id,
          is_admin: input.is_admin,
          member_department_ids: input.department_ids != undefined ? input.department_ids.map((x) => x.id) : undefined,
          workspace_id: ctx.current_member.workspace_id,
          status: input.status
        }
      });
      return retVal.id;
    }),
  updateMemberAllowance: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/members/{id}/allowance/{allowance_type_id}/{year}',
        protect: true,
        tags: ['Members'],
        summary: "Update a member's allowance",
        description: "Update a member's allowance"
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        allowance_type_id: z.string().uuid(),
        year: z.number(),
        allowance: z.number(),
        compensatory_time_off: z.number()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      let currentAllowance = await ctx.prisma.memberAllowance.findFirst({
        where: { member_id: input.id, year: input.year, allowance_type_id: input.allowance_type_id },
        select: { id: true, taken: true, brought_forward: true }
      });
      if (!currentAllowance) throw new Error('no allowance found');

      const caller = memberAllowanceRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.edit({
        id: currentAllowance.id,
        data: {
          brought_forward: currentAllowance.brought_forward,
          compensatory_time_off: input.compensatory_time_off,
          allowance: input.allowance,
          member_id: input.id,
          workspace_id: ctx.current_member.workspace_id
        }
      });
      return retVal.id;
    }),
  addMemberSchedule: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/members/{id}/schedule',
        protect: true,
        tags: ['Members'],
        summary: "Add a member's schedule",
        description: "Add a member's schedule"
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        from: z.coerce.date(),
        monday_am_start: z.coerce.date(),
        monday_am_end: z.coerce.date(),
        monday_pm_start: z.coerce.date(),
        monday_pm_end: z.coerce.date(),
        monday_am_enabled: z.boolean(),
        monday_pm_enabled: z.boolean(),
        monday_deduct_fullday: z.boolean(),
        tuesday_am_start: z.coerce.date(),
        tuesday_am_end: z.coerce.date(),
        tuesday_pm_start: z.coerce.date(),
        tuesday_pm_end: z.coerce.date(),
        tuesday_am_enabled: z.boolean(),
        tuesday_pm_enabled: z.boolean(),
        tuesday_deduct_fullday: z.boolean(),
        wednesday_am_start: z.coerce.date(),
        wednesday_am_end: z.coerce.date(),
        wednesday_pm_start: z.coerce.date(),
        wednesday_pm_end: z.coerce.date(),
        wednesday_am_enabled: z.boolean(),
        wednesday_pm_enabled: z.boolean(),
        wednesday_deduct_fullday: z.boolean(),
        thursday_am_start: z.coerce.date(),
        thursday_am_end: z.coerce.date(),
        thursday_pm_start: z.coerce.date(),
        thursday_pm_end: z.coerce.date(),
        thursday_am_enabled: z.boolean(),
        thursday_pm_enabled: z.boolean(),
        thursday_deduct_fullday: z.boolean(),
        friday_am_start: z.coerce.date(),
        friday_am_end: z.coerce.date(),
        friday_pm_start: z.coerce.date(),
        friday_pm_end: z.coerce.date(),
        friday_am_enabled: z.boolean(),
        friday_pm_enabled: z.boolean(),
        friday_deduct_fullday: z.boolean(),
        saturday_am_start: z.coerce.date(),
        saturday_am_end: z.coerce.date(),
        saturday_pm_start: z.coerce.date(),
        saturday_pm_end: z.coerce.date(),
        saturday_am_enabled: z.boolean(),
        saturday_pm_enabled: z.boolean(),
        saturday_deduct_fullday: z.boolean(),
        sunday_am_start: z.coerce.date(),
        sunday_am_end: z.coerce.date(),
        sunday_pm_start: z.coerce.date(),
        sunday_pm_end: z.coerce.date(),
        sunday_am_enabled: z.boolean(),
        sunday_pm_enabled: z.boolean(),
        sunday_deduct_fullday: z.boolean()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const caller = memberScheduleRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.add({
        friday_am_enabled: input.friday_am_enabled,
        friday_am_end: input.friday_am_end,
        friday_am_start: input.friday_am_start,
        friday_deduct_fullday: input.friday_deduct_fullday,
        friday_pm_enabled: input.friday_pm_enabled,
        friday_pm_end: input.friday_pm_end,
        friday_pm_start: input.friday_pm_start,
        monday_am_enabled: input.monday_am_enabled,
        monday_am_end: input.monday_am_end,
        monday_am_start: input.monday_am_start,
        monday_deduct_fullday: input.monday_deduct_fullday,
        monday_pm_enabled: input.monday_pm_enabled,
        monday_pm_end: input.monday_pm_end,
        monday_pm_start: input.monday_pm_start,
        member_id: input.id,
        saturday_am_enabled: input.saturday_am_enabled,
        saturday_am_end: input.saturday_am_end,
        saturday_am_start: input.saturday_am_start,
        saturday_deduct_fullday: input.saturday_deduct_fullday,
        saturday_pm_enabled: input.saturday_pm_enabled,
        saturday_pm_end: input.saturday_pm_end,
        saturday_pm_start: input.saturday_pm_start,
        sunday_am_enabled: input.sunday_am_enabled,
        sunday_am_end: input.sunday_am_end,
        sunday_am_start: input.sunday_am_start,
        sunday_deduct_fullday: input.sunday_deduct_fullday,
        sunday_pm_enabled: input.sunday_pm_enabled,
        sunday_pm_end: input.sunday_pm_end,
        sunday_pm_start: input.sunday_pm_start,
        thursday_am_enabled: input.thursday_am_enabled,
        thursday_am_end: input.thursday_am_end,
        thursday_am_start: input.thursday_am_start,
        thursday_deduct_fullday: input.thursday_deduct_fullday,
        thursday_pm_enabled: input.thursday_pm_enabled,
        thursday_pm_end: input.thursday_pm_end,
        thursday_pm_start: input.thursday_pm_start,
        tuesday_am_enabled: input.tuesday_am_enabled,
        tuesday_am_end: input.tuesday_am_end,
        tuesday_am_start: input.tuesday_am_start,
        tuesday_deduct_fullday: input.tuesday_deduct_fullday,
        tuesday_pm_enabled: input.tuesday_pm_enabled,
        tuesday_pm_end: input.tuesday_pm_end,
        tuesday_pm_start: input.tuesday_pm_start,
        wednesday_am_enabled: input.wednesday_am_enabled,
        wednesday_am_end: input.wednesday_am_end,
        wednesday_am_start: input.wednesday_am_start,
        wednesday_deduct_fullday: input.wednesday_deduct_fullday,
        wednesday_pm_enabled: input.wednesday_pm_enabled,
        wednesday_pm_end: input.wednesday_pm_end,
        wednesday_pm_start: input.wednesday_pm_start,
        from: input.from,
        workspace_id: ctx.current_member.workspace_id
      });
      return retVal.id;
    }),
  updateMemberSchedule: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/members/{member_id}/schedule/{id}',
        protect: true,
        tags: ['Members'],
        summary: "Update a member's schedule",
        description: "Update a member's schedule"
      }
    })
    .input(
      z.object({
        member_id: z.string().uuid(),
        id: z.string().uuid(),
        from: z.coerce.date(),
        monday_am_start: z.coerce.date(),
        monday_am_end: z.coerce.date(),
        monday_pm_start: z.coerce.date(),
        monday_pm_end: z.coerce.date(),
        monday_am_enabled: z.boolean(),
        monday_pm_enabled: z.boolean(),
        monday_deduct_fullday: z.boolean(),
        tuesday_am_start: z.coerce.date(),
        tuesday_am_end: z.coerce.date(),
        tuesday_pm_start: z.coerce.date(),
        tuesday_pm_end: z.coerce.date(),
        tuesday_am_enabled: z.boolean(),
        tuesday_pm_enabled: z.boolean(),
        tuesday_deduct_fullday: z.boolean(),
        wednesday_am_start: z.coerce.date(),
        wednesday_am_end: z.coerce.date(),
        wednesday_pm_start: z.coerce.date(),
        wednesday_pm_end: z.coerce.date(),
        wednesday_am_enabled: z.boolean(),
        wednesday_pm_enabled: z.boolean(),
        wednesday_deduct_fullday: z.boolean(),
        thursday_am_start: z.coerce.date(),
        thursday_am_end: z.coerce.date(),
        thursday_pm_start: z.coerce.date(),
        thursday_pm_end: z.coerce.date(),
        thursday_am_enabled: z.boolean(),
        thursday_pm_enabled: z.boolean(),
        thursday_deduct_fullday: z.boolean(),
        friday_am_start: z.coerce.date(),
        friday_am_end: z.coerce.date(),
        friday_pm_start: z.coerce.date(),
        friday_pm_end: z.coerce.date(),
        friday_am_enabled: z.boolean(),
        friday_pm_enabled: z.boolean(),
        friday_deduct_fullday: z.boolean(),
        saturday_am_start: z.coerce.date(),
        saturday_am_end: z.coerce.date(),
        saturday_pm_start: z.coerce.date(),
        saturday_pm_end: z.coerce.date(),
        saturday_am_enabled: z.boolean(),
        saturday_pm_enabled: z.boolean(),
        saturday_deduct_fullday: z.boolean(),
        sunday_am_start: z.coerce.date(),
        sunday_am_end: z.coerce.date(),
        sunday_pm_start: z.coerce.date(),
        sunday_pm_end: z.coerce.date(),
        sunday_am_enabled: z.boolean(),
        sunday_pm_enabled: z.boolean(),
        sunday_deduct_fullday: z.boolean()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const caller = memberScheduleRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.edit({
        id: input.id,
        data: {
          friday_am_enabled: input.friday_am_enabled,
          friday_am_end: input.friday_am_end,
          friday_am_start: input.friday_am_start,
          friday_deduct_fullday: input.friday_deduct_fullday,
          friday_pm_enabled: input.friday_pm_enabled,
          friday_pm_end: input.friday_pm_end,
          friday_pm_start: input.friday_pm_start,
          monday_am_enabled: input.monday_am_enabled,
          monday_am_end: input.monday_am_end,
          monday_am_start: input.monday_am_start,
          monday_deduct_fullday: input.monday_deduct_fullday,
          monday_pm_enabled: input.monday_pm_enabled,
          monday_pm_end: input.monday_pm_end,
          monday_pm_start: input.monday_pm_start,
          member_id: input.member_id,
          saturday_am_enabled: input.saturday_am_enabled,
          saturday_am_end: input.saturday_am_end,
          saturday_am_start: input.saturday_am_start,
          saturday_deduct_fullday: input.saturday_deduct_fullday,
          saturday_pm_enabled: input.saturday_pm_enabled,
          saturday_pm_end: input.saturday_pm_end,
          saturday_pm_start: input.saturday_pm_start,
          sunday_am_enabled: input.sunday_am_enabled,
          sunday_am_end: input.sunday_am_end,
          sunday_am_start: input.sunday_am_start,
          sunday_deduct_fullday: input.sunday_deduct_fullday,
          sunday_pm_enabled: input.sunday_pm_enabled,
          sunday_pm_end: input.sunday_pm_end,
          sunday_pm_start: input.sunday_pm_start,
          thursday_am_enabled: input.thursday_am_enabled,
          thursday_am_end: input.thursday_am_end,
          thursday_am_start: input.thursday_am_start,
          thursday_deduct_fullday: input.thursday_deduct_fullday,
          thursday_pm_enabled: input.thursday_pm_enabled,
          thursday_pm_end: input.thursday_pm_end,
          thursday_pm_start: input.thursday_pm_start,
          tuesday_am_enabled: input.tuesday_am_enabled,
          tuesday_am_end: input.tuesday_am_end,
          tuesday_am_start: input.tuesday_am_start,
          tuesday_deduct_fullday: input.tuesday_deduct_fullday,
          tuesday_pm_enabled: input.tuesday_pm_enabled,
          tuesday_pm_end: input.tuesday_pm_end,
          tuesday_pm_start: input.tuesday_pm_start,
          wednesday_am_enabled: input.wednesday_am_enabled,
          wednesday_am_end: input.wednesday_am_end,
          wednesday_am_start: input.wednesday_am_start,
          wednesday_deduct_fullday: input.wednesday_deduct_fullday,
          wednesday_pm_enabled: input.wednesday_pm_enabled,
          wednesday_pm_end: input.wednesday_pm_end,
          wednesday_pm_start: input.wednesday_pm_start,
          from: input.from,
          workspace_id: ctx.current_member.workspace_id
        }
      });
      return retVal.id;
    })
});
