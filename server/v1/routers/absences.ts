import { AllowanceUnit, EndAt, LeaveUnit, Prisma, StartAt } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';
import { object, z } from 'zod';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';
import { requestsPublicApiRouter } from './request';

export const absencesPublicApiRouter = createTRPCRouter({
  getAbsencesPerDay: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/absences_per_day',
        protect: true,
        tags: ['Absences'],
        summary: 'Get all requests and public holiday per member per day',
        description: 'Get all requests and public holiday per member per day'
      }
    })
    .input(
      z.object({
        start: z.coerce.date(),
        end: z.coerce.date(),
        request_member_ids: z.string().optional(),
        department_ids: z.string().optional()
      })
    )
    .output(
      z.array(
        z
          .object({
            type: z.enum(['request', 'public_holiday']),
            member: object({
              id: z.string(),
              custom_id: z.string().nullable(),
              name: z.string().nullable(),
              email: z.string().nullable()
            }),
            date: z.date(),
            start_at: z.nativeEnum(StartAt).nullable(),
            end_at: z.nativeEnum(EndAt).nullable(),
            request: object({
              duration: z.number(),
              workday_absence_duration: z.number(),
              status: z.string().nullable(),
              take_from_allowance: z.boolean(),
              allowance_type: object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean(),
                allowance_unit: z.nativeEnum(AllowanceUnit)
              }).nullable(),
              leave_type: object({
                name: z.string(),
                id: z.string().nullable(),
                leave_unit: z.nativeEnum(LeaveUnit)
              }).nullable()
            }).nullable(),
            public_holiday_day: object({
              id: z.string(),
              duration: z.string(),
              names: z.array(
                z.object({
                  language: z.string(),
                  name: z.string()
                })
              )
            }).nullable()
          })
          .nullable()
      )
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const caller = requestsPublicApiRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(ctx.current_member.language, 'backend');
      const allRequests = await caller.getRequestsPerDay(input);

      let qu: Prisma.MemberWhereInput = { workspace_id: ctx.current_member.workspace_id };

      if (input.request_member_ids) {
        qu.id = { in: input.request_member_ids.split(';') };
      }

      if (input.department_ids) {
        const members = await ctx.prisma.memberDepartment.findMany({
          where: { department_id: { in: input.department_ids.split(';') } },
          select: { member_id: true }
        });

        qu.id = {
          in: [
            ...members.map((member) => member.member_id),
            ...(input.request_member_ids ? input.request_member_ids.split(';') : [])
          ]
        };
      }

      let [workspace, members] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: {
            privacy_show_otherdepartments: true,
            privacy_show_absences_in_past: true,
            public_holiday_days: {
              where: { date: { gte: input.start, lte: addDays(input.end, 1) } },
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                date: true,
                year: true,
                workspace_id: true,
                custom_value: true,
                public_holiday_id: true,
                duration: true,
                public_holiday_day_languages: {
                  select: {
                    language: true,
                    name: true
                  }
                },
                holiday_api: {
                  select: {
                    holiday_api_languages: {
                      select: {
                        language: true,
                        name: true
                      }
                    }
                  }
                }
              },
              orderBy: { date: 'asc' }
            }
          }
        }),
        ctx.prisma.member.findMany({
          where: qu,
          select: {
            id: true,
            custom_id: true,
            name: true,
            email: true,
            public_holiday_id: true
          }
        })
      ]);
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace found'
        });
      }

      let requests: ({
        type: 'request' | 'public_holiday';
        member: {
          id: string;
          custom_id: string | null;
          name: string | null;
          email: string | null;
        };
        date: Date;
        start_at: StartAt;
        end_at: EndAt;
        request: {
          duration: number;
          workday_absence_duration: number;
          leave_type: {
            name: string;
            id: string | null;
            leave_unit: LeaveUnit;
          } | null;
          status: string | null;
          take_from_allowance: boolean;
          allowance_type: {
            id: string;
            name: string;
            ignore_allowance_limit: boolean;
            allowance_unit: AllowanceUnit;
          } | null;
        } | null;
        public_holiday_day: {
          id: string;
          duration: string;
          names: {
            name: string;
            language: string;
          }[];
        } | null;
      } | null)[] = allRequests.map((request) => {
        if (!request) return null;

        const member = members.find((m) => m.id === request.requester_member?.id);
        if (!member) return null;
        return {
          type: 'request',
          member: {
            id: member.id,
            custom_id: member.custom_id,
            name: member.name,
            email: member.email
          },
          date: request.day,
          start_at: request.start_at,
          end_at: request.end_at,
          request: {
            duration: request.duration,
            workday_absence_duration: request.workday_absence_duration,
            leave_type: request.leave_type,
            status: request.status,
            take_from_allowance: request.take_from_allowance,
            allowance_type: request.allowance_type
          },
          public_holiday_day: null
        };
      });

      for (let i2 = 0; i2 < members.length; i2++) {
        const m = members[i2];
        if (!m) continue;
        let public_holiday_days = workspace.public_holiday_days.filter(
          (phd: { public_holiday_id: string }) => phd.public_holiday_id === m.public_holiday_id
        );

        for (let i = 0; i < public_holiday_days.length; i++) {
          const phd = public_holiday_days[i];
          if (!phd) continue;
          requests.push({
            type: 'public_holiday',
            member: {
              id: m.id,
              custom_id: m.custom_id,
              name: m.name,
              email: m.email
            },
            date: phd.date,
            start_at: phd.duration == 'FullDay' ? 'morning' : phd.duration == 'Morning' ? 'morning' : 'afternoon',
            end_at: phd.duration == 'FullDay' ? 'end_of_day' : phd.duration == 'Morning' ? 'lunchtime' : 'end_of_day',
            request: null,
            public_holiday_day: {
              id: phd.id,
              duration: phd.duration,
              names: phd.holiday_api?.holiday_api_languages ?? phd.public_holiday_day_languages
            }
          });
        }
      }
      const requestsWithoutNull = requests.filter((r) => r !== null) as {
        type: 'request' | 'public_holiday';
        member: {
          id: string;
          custom_id: string | null;
          name: string | null;
          email: string | null;
        };
        date: Date;
        start_at: StartAt;
        end_at: EndAt;
        request: {
          duration: number;
          workday_absence_duration: number;
          leave_type: {
            name: string;
            id: string | null;
            leave_unit: LeaveUnit;
          } | null;
          status: string | null;
          take_from_allowance: boolean;
          allowance_type: {
            id: string;
            name: string;
            ignore_allowance_limit: boolean;
            allowance_unit: AllowanceUnit;
          } | null;
        } | null;
        public_holiday_day: {
          id: string;
          duration: string;
          names: {
            name: string;
            language: string;
          }[];
        } | null;
      }[];

      requestsWithoutNull.sort(function (a, b) {
        return `${a.member.id}`.localeCompare(`${b.member.id}`) || a.date.getTime() - b.date.getTime();
      });
      return requestsWithoutNull.filter((r) => r.date >= input.start && r.date <= input.end);
    })
});
