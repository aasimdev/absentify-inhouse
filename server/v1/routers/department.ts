import { ApprovalProcess, DepartmentManagerType, Prisma } from '@prisma/client';
import { Guid } from 'guid-typescript';
import { z } from 'zod';
import { departmentRouter } from '~/server/api/routers/department';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';

export const departmentPublicApiRouter = createTRPCRouter({
  getDepartments: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/departments',
        protect: true,
        tags: ['Departments'],
        summary: 'Get all departments',
        description: 'Get all departments'
      }
    })
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          approval_process: z.nativeEnum(ApprovalProcess),
          maximum_absent: z.number().nullable(),
          members: z.array(
            z.object({
              id: z.string(),
              name: z.string().nullable(),
              email: z.string().nullable(),
              custom_id: z.string().nullable(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          )
        })
      )
    )
    .query(async ({ ctx }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const departments = await ctx.prisma.department.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          approval_process: true,
          maximum_absent: true,
          members: {
            select: {
              manager_type: true,
              member: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  custom_id: true
                }
              }
            }
          }
        }
      });

      let z = departments.map((d) => {
        let members = d.members?.map((m) => {
          let mem = m.member;

          return {
            ...mem,
            manager_type: m.manager_type
          };
        });
        if (!members) members = [];

        let retDep = { ...d, members };
        return retDep;
      });
      return z;
    }),
  getDepartmentByid: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/departments/{id}',
        protect: true,
        tags: ['Departments'],
        summary: 'Read a department by id',
        description: 'Read a department by id'
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
          name: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          approval_process: z.nativeEnum(ApprovalProcess),
          maximum_absent: z.number().nullable(),
          members: z.array(
            z.object({
              id: z.string(),
              name: z.string().nullable(),
              email: z.string().nullable(),
              custom_id: z.string().nullable(),
              manager_type: z.nativeEnum(DepartmentManagerType)
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const department = await ctx.prisma.department.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, id: input.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          approval_process: true,
          maximum_absent: true,
          members: {
            select: {
              manager_type: true,
              member: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  custom_id: true
                }
              }
            }
          }
        }
      });
      let members = department?.members?.map((m) => {
        let mem = m.member;

        return {
          ...mem,
          manager_type: m.manager_type
        };
      });
      if (!members) members = [];
      if (!department) return null;
      let retDep = { ...department, members };
      return retDep;
    }),
  createDepartment: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/departments',
        protect: true,
        tags: ['Departments'],
        summary: 'Create a department',
        description: 'Create a department'
      }
    })
    .input(
      z.object({
        name: z.string(),
        default_allowance: z.number(),
        maximum_absent: z.number(),
        approval_process: z.nativeEnum(ApprovalProcess),
        manager_member: z.array(
          z.object({
            member_id: z.string(),
            predecessor_manager_id: z.string().nullable()
          })
        ),
        default_department_allowances: z.array(z.object({
          id: z.string(),
          value: z.number(),
        }))
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (input.manager_member.length == 0) throw new Error('no manager found');
      if (input.manager_member.filter((x) => x.member_id == null).length > 0)
        throw new Error("all member id's must be set");
      if (input.manager_member.filter((x) => x.member_id == '').length > 0)
        throw new Error("all member id's must be set");

      //Check member ids exist
      let memberIds = input.manager_member.map((x) => x.member_id);
      let members = await ctx.prisma.member.findMany({
        where: {
          id: {
            in: memberIds
          }
        },
        select: {
          id: true
        }
      });
      if (members.length != memberIds.length) throw new Error("one or more members don't exist");

      const caller = departmentRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.add({
        data: {
          approval_process: input.approval_process,
          maximum_absent: input.maximum_absent,
          name: input.name,
          workspace_id: ctx.current_member?.workspace_id,
          manager_member: input.manager_member,
          default_department_allowances: input.default_department_allowances,
        }
      });
      if (!retVal) throw new Error('no department created');
      return retVal.id;
    }),
  updateDepartment: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/departments/{id}',
        protect: true,
        tags: ['Departments'],
        summary: 'Update a department',
        description: 'Update a department'
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        maximum_absent: z.number().optional(),
        approval_process: z.nativeEnum(ApprovalProcess).optional(),
        manager_member: z
          .array(
            z.object({
              member_id: z.string(),
              predecessor_manager_id: z.string().nullable()
            })
          )
          .optional(),
          default_department_allowances: z.array(z.object({
            id: z.string(),
            value: z.number(),
          }))
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      // Check whether manager_member exists and is valid
      if (input.manager_member && input.manager_member.length == 0) throw new Error('no manager found');
      if (input.manager_member && input.manager_member.some((x) => x.member_id == null || x.member_id == ''))
        throw new Error("all member id's must be set");

      // Check whether members exist if manager_member was transferred
      if (input.manager_member) {
        let memberIds = input.manager_member.map((x) => x.member_id);
        let members = await ctx.prisma.member.findMany({
          where: {
            id: { in: memberIds }
          },
          select: { id: true }
        });
        if (members.length != memberIds.length) throw new Error("one or more members don't exist");
      }

      type UpdateDataType = {
        workspace_id: string; // Machen Sie workspace_id zu einem erforderlichen String
        name?: string;
        default_allowance?: number;
        maximum_absent?: number;
        approval_process?: ApprovalProcess;
        manager_member?: {
          member_id: string;
          predecessor_manager_id: string | null;
        }[];
        default_department_allowances: {
          id: string;
          value: number;
        }[];
      };

      // Creating a data object for updating with the partial type
      let updateData: UpdateDataType = {
        workspace_id: ctx.current_member.workspace_id,
        default_department_allowances: input.default_department_allowances,
      };

      // Add fields to updateData if they are present in the input
      if (input.name !== undefined) updateData.name = input.name;
      if (input.maximum_absent !== undefined) updateData.maximum_absent = input.maximum_absent;
      if (input.approval_process !== undefined) updateData.approval_process = input.approval_process;
      if (input.manager_member !== undefined) updateData.manager_member = input.manager_member;

      const caller = departmentRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      let ret = await caller.edit({
        id: input.id,
        data: updateData
      });

      return ret.id;
    }),
  DeleteDepartmentById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/departments/{id}',
        protect: true,
        tags: ['Departments'],
        summary: 'Delete a department',
        description: 'Delete a department'
      }
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.null())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const caller = departmentRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      await caller.delete({ id: input.id });

      return null;
    })
});