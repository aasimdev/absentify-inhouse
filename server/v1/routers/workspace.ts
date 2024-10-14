import { Display, DisplayNameFormat, TimeFormat } from '@prisma/client';
import { z } from 'zod';
import { workspaceRouter } from '~/server/api/routers/workspace';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';

export const workspacesPublicApiRouter = createTRPCRouter({
  getCurrentWorkspace: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/workspace',
        protect: true,
        tags: ['Workspace'],
        summary: 'Get current workspace settings',
        description: 'Get current workspace settings'
      }
    })
    .input(z.object({}))
    .output(
      z.object({
        id: z.string(),
        createdAt: z.date(),
        global_date_format: z.string(),
        global_language: z.string(),
        global_time_format: z.nativeEnum(TimeFormat),
        global_timezone: z.string(),
        global_week_start: z.string(),
        global_name_format: z.nativeEnum(DisplayNameFormat),
        name: z.string(),
        updatedAt: z.date(),
        privacy_show_calendarview: z.boolean(),
        privacy_show_otherdepartments: z.boolean(),
        privacy_show_absences_in_past: z.boolean(),
        fiscal_year_start_month: z.number().min(0).max(11)
      })
    )
    .query(async ({ ctx }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const workspace = await ctx.prisma.workspace.findUnique({
        select: {
          id: true,
          createdAt: true,
          global_date_format: true,
          global_language: true,
          global_time_format: true,
          global_timezone: true,
          global_week_start: true,
          global_name_format: true,
          name: true,
          updatedAt: true,
          privacy_show_calendarview: true,
          privacy_show_otherdepartments: true,
          privacy_show_absences_in_past: true,
          fiscal_year_start_month: true
        },
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) throw new Error('no workspace found');

      return workspace;
    }),
  updateSettings: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/workspace',
        protect: true,
        tags: ['Workspace'],
        summary: 'Update the workspace settings',
        description: 'Update the workspace settings'
      }
    })
    .input(
      z.object({
        name: z.string().max(255, { message: 'Must be 255 or fewer characters long' }).optional(),
        global_date_format: z.string().optional(),
        global_language: z.string().optional(),
        global_time_format: z.nativeEnum(TimeFormat).optional(),
        global_timezone: z.string().optional(),
        global_week_start: z.string().optional(),
        global_name_format: z.nativeEnum(DisplayNameFormat).optional(),
        global_display_calendar_weeks: z.boolean().optional(),
        privacy_show_calendarview: z.boolean().optional(),
        privacy_show_otherdepartments: z.boolean().optional(),
        privacy_show_absences_in_past: z.boolean().optional(),
        display_logo: z.nativeEnum(Display).optional(),
        allow_manager_past_request_cancellation: z.boolean().optional(),
        fiscal_year_start_month: z.number().min(0).max(11).optional()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const w = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: {
          microsoft_calendars_read_write: true,
          microsoft_groups_read_write_all: true,
          microsoft_mailboxSettings_read_write: true,
          microsoft_users_read_all: true,
          ai_bot_enabled: true
        }
      });
      if (!w) throw new Error('no workspace found');

      const caller = workspaceRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.edit({
        id: ctx.current_member.workspace_id,
        data: {
          global_date_format: input.global_date_format,
          global_language: input.global_language,
          global_time_format: input.global_time_format,
          global_timezone: input.global_timezone,
          global_week_start: input.global_week_start,
          global_name_format: input.global_name_format,
          global_display_calendar_weeks: input.global_display_calendar_weeks,
          name: input.name,
          privacy_show_calendarview: input.privacy_show_calendarview,
          privacy_show_otherdepartments: input.privacy_show_otherdepartments,
          privacy_show_absences_in_past: input.privacy_show_absences_in_past,
          display_logo: input.display_logo,
          allow_manager_past_request_cancellation: input.allow_manager_past_request_cancellation,
          fiscal_year_start_month: input.fiscal_year_start_month,
          microsoft_calendars_read_write: w.microsoft_calendars_read_write,
          microsoft_groups_read_write_all: w.microsoft_groups_read_write_all,
          microsoft_mailboxSettings_read_write: w.microsoft_mailboxSettings_read_write,
          microsoft_users_read_all: w.microsoft_users_read_all,
          ai_bot_enabled: w.ai_bot_enabled
        }
      });

      return retVal.id;
    })
});
