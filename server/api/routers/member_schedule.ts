import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { TRPCError } from '@trpc/server';
import { formatTime } from '~/lib/DateHelper';
import { inngest } from '~/inngest/inngest_client';
/**
 * Default selector for memberSchedule.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultMemberScheduleSelect = Prisma.validator<Prisma.MemberScheduleSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  member_id: true,
  workspace_id: true,
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
  sunday_deduct_fullday: true
});

export type defaultMemberScheduleSelectOutput = Prisma.MemberScheduleGetPayload<{
  select: typeof defaultMemberScheduleSelect;
}>;

function setDate(date: Date) {
  let d = formatTime(date);
  if (!d) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  return new Date(Date.UTC(1970, 1, 1, parseInt(d.split(':')[0] as string), parseInt(d.split(':')[1] as string), 0));
}

export const memberScheduleRouter = createTRPCRouter({
  //create
  add: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        member_id: z.string(),
        workspace_id: z.string(),
        from: z.date(),
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
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add memberSchedule'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add memberSchedule'
        });
      }

      input.from = new Date(Date.UTC(input.from.getFullYear(), input.from.getMonth(), input.from.getDate(), 0, 0, 0));

      input.monday_am_start = setDate(input.monday_am_start);
      input.monday_am_end = setDate(input.monday_am_end);
      input.monday_pm_start = setDate(input.monday_pm_start);
      input.monday_pm_end = setDate(input.monday_pm_end);
      input.tuesday_am_start = setDate(input.tuesday_am_start);
      input.tuesday_am_end = setDate(input.tuesday_am_end);
      input.tuesday_pm_start = setDate(input.tuesday_pm_start);
      input.tuesday_pm_end = setDate(input.tuesday_pm_end);
      input.wednesday_am_start = setDate(input.wednesday_am_start);
      input.wednesday_am_end = setDate(input.wednesday_am_end);
      input.wednesday_pm_start = setDate(input.wednesday_pm_start);
      input.wednesday_pm_end = setDate(input.wednesday_pm_end);
      input.thursday_am_start = setDate(input.thursday_am_start);
      input.thursday_am_end = setDate(input.thursday_am_end);
      input.thursday_pm_start = setDate(input.thursday_pm_start);
      input.thursday_pm_end = setDate(input.thursday_pm_end);
      input.friday_am_start = setDate(input.friday_am_start);
      input.friday_am_end = setDate(input.friday_am_end);
      input.friday_pm_start = setDate(input.friday_pm_start);
      input.friday_pm_end = setDate(input.friday_pm_end);
      input.saturday_am_start = setDate(input.saturday_am_start);
      input.saturday_am_end = setDate(input.saturday_am_end);
      input.saturday_pm_start = setDate(input.saturday_pm_start);
      input.saturday_pm_end = setDate(input.saturday_pm_end);
      input.sunday_am_start = setDate(input.sunday_am_start);
      input.sunday_am_end = setDate(input.sunday_am_end);
      input.sunday_pm_start = setDate(input.sunday_pm_start);
      input.sunday_pm_end = setDate(input.sunday_pm_end);

      if (input.monday_am_enabled && input.monday_pm_enabled) {
        input.monday_deduct_fullday = false;
      }

      if (input.tuesday_am_enabled && input.tuesday_pm_enabled) {
        input.tuesday_deduct_fullday = false;
      }

      if (input.wednesday_am_enabled && input.wednesday_pm_enabled) {
        input.wednesday_deduct_fullday = false;
      }

      if (input.thursday_am_enabled && input.thursday_pm_enabled) {
        input.thursday_deduct_fullday = false;
      }

      if (input.friday_am_enabled && input.friday_pm_enabled) {
        input.friday_deduct_fullday = false;
      }

      if (input.saturday_am_enabled && input.saturday_pm_enabled) {
        input.saturday_deduct_fullday = false;
      }

      if (input.sunday_am_enabled && input.sunday_pm_enabled) {
        input.sunday_deduct_fullday = false;
      }

      if (input.monday_am_enabled == false && input.monday_pm_enabled == false) {
        input.monday_deduct_fullday = false;
      }

      if (input.tuesday_am_enabled == false && input.tuesday_pm_enabled == false) {
        input.tuesday_deduct_fullday = false;
      }

      if (input.wednesday_am_enabled == false && input.wednesday_pm_enabled == false) {
        input.wednesday_deduct_fullday = false;
      }

      if (input.thursday_am_enabled == false && input.thursday_pm_enabled == false) {
        input.thursday_deduct_fullday = false;
      }

      if (input.friday_am_enabled == false && input.friday_pm_enabled == false) {
        input.friday_deduct_fullday = false;
      }

      if (input.saturday_am_enabled == false && input.saturday_pm_enabled == false) {
        input.saturday_deduct_fullday = false;
      }

      if (input.sunday_am_enabled == false && input.sunday_pm_enabled == false) {
        input.sunday_deduct_fullday = false;
      }

      const memberSchedule = await ctx.prisma.memberSchedule.create({
        data: input,
        select: defaultMemberScheduleSelect
      });

      await inngest.send({
        // The event name
        name: 'member/update.member.allowance',
        // The event's data
        data: {
          workspaceId: memberSchedule.workspace_id,
          memberId: memberSchedule.member_id
        }
      });

      return memberSchedule;
    }),
  // update
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          member_id: z.string(),
          workspace_id: z.string(),
          from: z.date(),
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
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      data.from = new Date(Date.UTC(data.from.getFullYear(), data.from.getMonth(), data.from.getDate(), 0, 0, 0));
      data.monday_am_start = setDate(data.monday_am_start);
      data.monday_am_end = setDate(data.monday_am_end);
      data.monday_pm_start = setDate(data.monday_pm_start);
      data.monday_pm_end = setDate(data.monday_pm_end);
      data.tuesday_am_start = setDate(data.tuesday_am_start);
      data.tuesday_am_end = setDate(data.tuesday_am_end);
      data.tuesday_pm_start = setDate(data.tuesday_pm_start);
      data.tuesday_pm_end = setDate(data.tuesday_pm_end);
      data.wednesday_am_start = setDate(data.wednesday_am_start);
      data.wednesday_am_end = setDate(data.wednesday_am_end);
      data.wednesday_pm_start = setDate(data.wednesday_pm_start);
      data.wednesday_pm_end = setDate(data.wednesday_pm_end);
      data.thursday_am_start = setDate(data.thursday_am_start);
      data.thursday_am_end = setDate(data.thursday_am_end);
      data.thursday_pm_start = setDate(data.thursday_pm_start);
      data.thursday_pm_end = setDate(data.thursday_pm_end);
      data.friday_am_start = setDate(data.friday_am_start);
      data.friday_am_end = setDate(data.friday_am_end);
      data.friday_pm_start = setDate(data.friday_pm_start);
      data.friday_pm_end = setDate(data.friday_pm_end);
      data.saturday_am_start = setDate(data.saturday_am_start);
      data.saturday_am_end = setDate(data.saturday_am_end);
      data.saturday_pm_start = setDate(data.saturday_pm_start);
      data.saturday_pm_end = setDate(data.saturday_pm_end);
      data.sunday_am_start = setDate(data.sunday_am_start);
      data.sunday_am_end = setDate(data.sunday_am_end);
      data.sunday_pm_start = setDate(data.sunday_pm_start);
      data.sunday_pm_end = setDate(data.sunday_pm_end);

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
      const memberSchedule = await ctx.prisma.memberSchedule.update({
        where: { id },
        data,
        select: defaultMemberScheduleSelect
      });

      await inngest.send({
        // The event name
        name: 'member/update.member.allowance',
        // The event's data
        data: {
          workspaceId: memberSchedule.workspace_id,
          memberId: memberSchedule.member_id
        }
      });

      return memberSchedule;
    }),
  // delete
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
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const memberSchedule = await ctx.prisma.memberSchedule.findUnique({
        where: { id },
        select: { workspace_id: true, member_id: true }
      });
      if (memberSchedule?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      await ctx.prisma.memberSchedule.delete({ where: { id: id } });

      await inngest.send({
        // The event name
        name: 'member/update.member.allowance',
        // The event's data
        data: {
          workspaceId: memberSchedule.workspace_id,
          memberId: memberSchedule.member_id
        }
      });

      return {
        id
      };
    })
});
