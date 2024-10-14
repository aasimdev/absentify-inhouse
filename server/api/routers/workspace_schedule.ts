import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { inngest } from '~/inngest/inngest_client';

/**
 * Default selector for workspaceSchedule.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultWorkspaceScheduleSelect = Prisma.validator<Prisma.WorkspaceScheduleSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  workspace_id: true,
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
  sunday_deduct_fullday: true
});

export type defaultWorkspaceScheduleSelectOutput = Prisma.WorkspaceScheduleGetPayload<{
  select: typeof defaultWorkspaceScheduleSelect;
}>;

export const workspaceScheduleRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const workspaceSchedule = await ctx.prisma.workspaceSchedule.findUnique({
      where: { workspace_id: ctx.current_member.workspace_id },
      select: defaultWorkspaceScheduleSelect
    });
    if (!workspaceSchedule) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No workspaceSchedule`
      });
    }
    return workspaceSchedule;
  }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          workspace_id: z.string(),
          monday_am_start: z.date(),
          monday_am_end: z.date(),
          monday_pm_start: z.date(),
          monday_pm_end: z.date(),
          monday_am_enabled: z.boolean(),
          monday_pm_enabled: z.boolean(),
          monday_deduct_fullday: z.boolean(),
          tuesday_am_start: z.date(),
          tuesday_am_end: z.date(),
          tuesday_pm_start: z.date(),
          tuesday_pm_end: z.date(),
          tuesday_am_enabled: z.boolean(),
          tuesday_pm_enabled: z.boolean(),
          tuesday_deduct_fullday: z.boolean(),
          wednesday_am_start: z.date(),
          wednesday_am_end: z.date(),
          wednesday_pm_start: z.date(),
          wednesday_pm_end: z.date(),
          wednesday_am_enabled: z.boolean(),
          wednesday_pm_enabled: z.boolean(),
          wednesday_deduct_fullday: z.boolean(),
          thursday_am_start: z.date(),
          thursday_am_end: z.date(),
          thursday_pm_start: z.date(),
          thursday_pm_end: z.date(),
          thursday_am_enabled: z.boolean(),
          thursday_pm_enabled: z.boolean(),
          thursday_deduct_fullday: z.boolean(),
          friday_am_start: z.date(),
          friday_am_end: z.date(),
          friday_pm_start: z.date(),
          friday_pm_end: z.date(),
          friday_am_enabled: z.boolean(),
          friday_pm_enabled: z.boolean(),
          friday_deduct_fullday: z.boolean(),
          saturday_am_start: z.date(),
          saturday_am_end: z.date(),
          saturday_pm_start: z.date(),
          saturday_pm_end: z.date(),
          saturday_am_enabled: z.boolean(),
          saturday_pm_enabled: z.boolean(),
          saturday_deduct_fullday: z.boolean(),
          sunday_am_start: z.date(),
          sunday_am_end: z.date(),
          sunday_pm_start: z.date(),
          sunday_pm_end: z.date(),
          sunday_am_enabled: z.boolean(),
          sunday_pm_enabled: z.boolean(),
          sunday_deduct_fullday: z.boolean()
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
          message: 'You have to be admin to edit workspaceSchedule'
        });
      }
      if (data.monday_am_enabled && data.monday_pm_enabled) {
        data.monday_deduct_fullday = false;
      }

      if (data.tuesday_am_enabled && data.tuesday_pm_enabled) {
        data.tuesday_deduct_fullday = false;
      }

      if (data.wednesday_am_enabled && data.wednesday_pm_enabled) {
        data.wednesday_deduct_fullday = false;
      }

      if (data.thursday_am_enabled && data.thursday_pm_enabled) {
        data.thursday_deduct_fullday = false;
      }

      if (data.friday_am_enabled && data.friday_pm_enabled) {
        data.friday_deduct_fullday = false;
      }

      if (data.saturday_am_enabled && data.saturday_pm_enabled) {
        data.saturday_deduct_fullday = false;
      }

      if (data.sunday_am_enabled && data.sunday_pm_enabled) {
        data.sunday_deduct_fullday = false;
      }

      if (data.monday_am_enabled == false && data.monday_pm_enabled == false) {
        data.monday_deduct_fullday = false;
      }

      if (data.tuesday_am_enabled == false && data.tuesday_pm_enabled == false) {
        data.tuesday_deduct_fullday = false;
      }

      if (data.wednesday_am_enabled == false && data.wednesday_pm_enabled == false) {
        data.wednesday_deduct_fullday = false;
      }

      if (data.thursday_am_enabled == false && data.thursday_pm_enabled == false) {
        data.thursday_deduct_fullday = false;
      }

      if (data.friday_am_enabled == false && data.friday_pm_enabled == false) {
        data.friday_deduct_fullday = false;
      }

      if (data.saturday_am_enabled == false && data.saturday_pm_enabled == false) {
        data.saturday_deduct_fullday = false;
      }

      if (data.sunday_am_enabled == false && data.sunday_pm_enabled == false) {
        data.sunday_deduct_fullday = false;
      }
      const workspaceSchedule = await ctx.prisma.workspaceSchedule.update({
        where: { id },
        data,
        select: defaultWorkspaceScheduleSelect
      });

      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });

      return workspaceSchedule;
    })
});
