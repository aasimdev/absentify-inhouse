import { AllowanceUnit, LeaveUnit, OutlookShowAs, SyncEnabled } from '@prisma/client';
import { z } from 'zod';
import { leaveTypeRouter } from '~/server/api/routers/leave_type';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';
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

export const leaveTypesPublicApiRouter = createTRPCRouter({
  getLeaveTypes: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/leave_types',
        protect: true,
        tags: ['Leave types'],
        summary: 'Get all leave types',
        description: 'Get all leave types'
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
          color: z.string(),
          icon: z.string(),
          needs_approval: z.boolean(),
          deleted: z.boolean(),
          deleted_at: z.date().nullable(),
          deleted_by: z
            .object({
              id: z.string(),
              name: z.string().nullable(),
              email: z.string().nullable()
            })
            .nullable(),
          maximum_absent: z.boolean(),
          leave_unit: z.nativeEnum(LeaveUnit),
          position: z.number(),
          take_from_allowance: z.boolean(),
          privacy_hide_leavetype: z.boolean(),
          outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs),
          outlook_synchronization_subject: z.string().nullable(),
          allowance_type: z
            .object({
              id: z.string(),
              name: z.string(),
              ignore_allowance_limit: z.boolean(),
              allowance_unit: z.nativeEnum(AllowanceUnit)
            })
            .nullable()
        })
      )
    )
    .query(async ({ ctx }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          color: true,
          icon: true,
          needs_approval: true,
          deleted: true,
          deleted_at: true,
          deleted_by: { select: { id: true, name: true, email: true } },
          maximum_absent: true,
          leave_unit: true,
          position: true,
          take_from_allowance: true,
          privacy_hide_leavetype: true,
          outlook_synchronization_show_as: true,
          outlook_synchronization_subject: true,
          allowance_type: {
            select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
          }
        }
      });

      return leaveTypes;
    }),
  getLeaveTypeById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/leave_types/{id}',
        protect: true,
        tags: ['Leave types'],
        summary: 'Read a leave type by id',
        description: 'Read a leave type by id'
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
          color: z.string(),
          icon: z.string(),
          needs_approval: z.boolean(),
          deleted: z.boolean(),
          deleted_at: z.date().nullable(),
          deleted_by: z
            .object({
              id: z.string(),
              name: z.string().nullable(),
              email: z.string().nullable()
            })
            .nullable(),
          maximum_absent: z.boolean(),
          leave_unit: z.nativeEnum(LeaveUnit),
          position: z.number(),
          take_from_allowance: z.boolean(),
          privacy_hide_leavetype: z.boolean(),
          outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs),
          outlook_synchronization_subject: z.string().nullable(),
          allowance_type: z
            .object({
              id: z.string(),
              name: z.string(),
              ignore_allowance_limit: z.boolean(),
              allowance_unit: z.nativeEnum(AllowanceUnit)
            })
            .nullable()
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const leavetype = await ctx.prisma.leaveType.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, id: input.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          color: true,
          icon: true,
          needs_approval: true,
          deleted: true,
          deleted_at: true,
          deleted_by: { select: { id: true, name: true, email: true } },
          maximum_absent: true,
          leave_unit: true,
          position: true,
          take_from_allowance: true,
          privacy_hide_leavetype: true,
          outlook_synchronization_show_as: true,
          outlook_synchronization_subject: true,
          allowance_type: {
            select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
          }
        }
      });
      return leavetype;
    }),
  createLeaveType: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/leave_types',
        protect: true,
        tags: ['Leave types'],
        summary: 'Create a leave type',
        description: 'Create a leave type'
      }
    })
    .input(
      z.object({
        name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }),
        color: z.string(),
        needs_approval: z.boolean(),
        maximum_absent: z.boolean(),
        leave_unit: z.nativeEnum(LeaveUnit),
        position: z.number(),
        take_from_allowance: z.boolean(),
        privacy_hide_leavetype: z.boolean(),
        outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs),
        outlook_synchronization_subject: z.string().nullable(),
        icon: z.enum(iconList),
        reason_mandatory: z.boolean(),
        reason_hint_text: z.string().nullable(),
        allowance_type_id: z.string().nullable(),
        ignore_schedule: z.boolean(),
        ignore_public_holidays: z.boolean()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      if (!input.reason_mandatory) input.reason_hint_text = null;

      const caller = leaveTypeRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.add({
        name: input.name,
        color: input.color,
        needs_approval: input.needs_approval,
        maximum_absent: input.maximum_absent,
        leave_unit: input.leave_unit,
        position: input.position,
        take_from_allowance: input.take_from_allowance,
        privacy_hide_leavetype: input.privacy_hide_leavetype,
        outlook_synchronization_show_as: input.outlook_synchronization_show_as,
        outlook_synchronization_subject: input.outlook_synchronization_subject,
        icon: 'NoIcon',
        reason_mandatory: input.reason_mandatory,
        reason_hint_text: input.reason_hint_text,
        allowance_type_id: input.allowance_type_id,
        ignore_schedule: input.ignore_schedule,
        ignore_public_holidays: input.ignore_public_holidays
      });
      return retVal.id;
    }),
  updateLeaveType: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/leave_types/{id}',
        protect: true,
        tags: ['Leave types'],
        summary: 'Update a leave type',
        description: 'Update a leave type'
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }).optional(),
        color: z.string().optional(),
        needs_approval: z.boolean().optional(),
        maximum_absent: z.boolean().optional(),
        leave_unit: z.nativeEnum(LeaveUnit).optional(),
        position: z.number().optional(),
        take_from_allowance: z.boolean().optional(),
        privacy_hide_leavetype: z.boolean().optional(),
        outlook_synchronization_show_as: z.nativeEnum(OutlookShowAs).optional(),
        outlook_synchronization_subject: z.string().nullable().optional(),
        icon: z.enum(iconList).optional(),
        reason_mandatory: z.boolean().optional(),
        reason_hint_text: z.string().nullable().optional(),
        allowance_type_id: z.string().nullable().optional(),
        sync_option: z.nativeEnum(SyncEnabled).optional()
      })
    )
    .output(z.string().uuid().nullable())
    .mutation(async ({ ctx, input }) => {
      if (!input.reason_mandatory) input.reason_hint_text = null;
      const caller = leaveTypeRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });

      const old_leave_type = await ctx.prisma.leaveType.findUnique({
        where: { id: input.id },
        select: { deleted: true, deleted_at: true, deleted_by_member_id: true }
      });
      if (!old_leave_type) throw new Error('leave type not found');

      const leaveType = await caller.edit({
        id: input.id,
        data: {
          name: input.name,
          color: input.color,
          needs_approval: input.needs_approval,
          maximum_absent: input.maximum_absent,
          leave_unit: input.leave_unit,
          position: input.position,
          take_from_allowance: input.take_from_allowance,
          privacy_hide_leavetype: input.privacy_hide_leavetype,
          outlook_synchronization_show_as: input.outlook_synchronization_show_as,
          outlook_synchronization_subject: input.outlook_synchronization_subject,
          icon: input.icon,
          deleted: old_leave_type.deleted,
          deleted_at: old_leave_type.deleted_at,
          deleted_by_member_id: old_leave_type.deleted_by_member_id,
          reason_mandatory: input.reason_mandatory,
          reason_hint_text: input.reason_hint_text,
          allowance_type_id: input.allowance_type_id,
          sync_option: input.sync_option
        }
      });
      return leaveType?.id ?? null;
    }),
  DeleteLeaveTypeById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/leave_types/{id}',
        protect: true,
        tags: ['Leave types'],
        summary: 'Delete a leave type',
        description: 'Delete a leave type'
      }
    })
    .input(
      z.object({
        id: z.string().uuid(),
        deleted: z.boolean(),
        deleted_by_member_id: z.string().uuid()
      })
    )
    .output(z.null())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const old_leave_type = await ctx.prisma.leaveType.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          icon: true,
          color: true,
          name: true,
          needs_approval: true,
          maximum_absent: true,
          position: true,
          leave_unit: true,
          take_from_allowance: true,
          privacy_hide_leavetype: true,
          outlook_synchronization_show_as: true,
          outlook_synchronization_subject: true,
          reason_mandatory: true,
          reason_hint_text: true,
          allowance_type_id: true,
          sync_option: true
        }
      });
      if (!old_leave_type) throw new Error('leave type not found');

      const caller = leaveTypeRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      caller.edit({
        id: input.id,
        data: {
          deleted: input.deleted,
          deleted_at: new Date(),
          deleted_by_member_id: input.deleted_by_member_id,
          icon: old_leave_type.icon,
          color: old_leave_type.color,
          name: old_leave_type.name,
          needs_approval: old_leave_type.needs_approval,
          maximum_absent: old_leave_type.maximum_absent,
          leave_unit: old_leave_type.leave_unit,
          position: old_leave_type.position,
          take_from_allowance: old_leave_type.take_from_allowance,
          privacy_hide_leavetype: old_leave_type.privacy_hide_leavetype,
          outlook_synchronization_show_as: old_leave_type.outlook_synchronization_show_as,
          outlook_synchronization_subject: old_leave_type.outlook_synchronization_subject,
          reason_mandatory: old_leave_type.reason_mandatory,
          reason_hint_text: old_leave_type.reason_hint_text,
          allowance_type_id: old_leave_type.allowance_type_id,
          sync_option: old_leave_type.sync_option
        }
      });

      old_leave_type;
      return null;
    })
});
