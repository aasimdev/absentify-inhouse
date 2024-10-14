import {
  AllowanceUnit,
  ApprovalProcess,
  EndAt,
  LeaveUnit,
  Prisma,
  RequestApproverStatus,
  RequestStatus,
  StartAt
} from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { addDays, format } from 'date-fns';
import { cloneDeep } from 'lodash';
import { z } from 'zod';
import { dateFromDatabaseIgnoreTimezone, getDates, isDayUnit } from '~/lib/DateHelper';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { setRequestStartEndTimesBasedOnScheduleOnDate } from '~/lib/requestUtilities';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { requestRouter } from '~/server/api/routers/request';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';

export const requestsPublicApiRouter = createTRPCRouter({
  getRequests: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/requests',
        protect: true,
        tags: ['Requests'],
        summary: 'Get all requests',
        description: 'Get all requests'
      }
    })
    .input(
      z.object({
        start: z.coerce.date(),
        end: z.coerce.date(),
        status: z.nativeEnum(RequestStatus).optional(),
        request_member_ids: z.string().optional(),
        department_ids: z.string().optional()
      })
    )
    .output(
      z.array(
        z
          .object({
            id: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            end: z.date(),
            start: z.date(),
            start_at: z.nativeEnum(StartAt),
            end_at: z.nativeEnum(EndAt),
            leave_unit: z.nativeEnum(LeaveUnit),
            request_creator_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),

            leave_type: z.object({
              name: z.string(),
              id: z.string(),
              leave_unit: z.nativeEnum(LeaveUnit)
            }),
            approval_process: z.nativeEnum(ApprovalProcess),
            cancel_reason: z.string().nullable(),
            canceld_by_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),
            requester_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),
            reason: z.string().nullable(),
            take_from_allowance: z.boolean(),
            allowance_type: z
              .object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean(),
                allowance_unit: z.nativeEnum(AllowanceUnit)
              })
              .nullable(),

            workday_absence_duration: z.number(),
            duration: z.number(),
            status: z.string(),
            canceld_date: z.date().nullable(),
            request_approvers: z.array(
              z.object({
                reason: z.string().nullable(),
                status: z.nativeEnum(RequestApproverStatus),
                status_changed_by_member: z
                  .object({
                    id: z.string(),
                    custom_id: z.string().nullable(),
                    name: z.string().nullable(),
                    email: z.string().nullable()
                  })
                  .nullable(),
                status_changed_date: z.date().nullable(),
                approver_member: z
                  .object({
                    id: z.string(),
                    custom_id: z.string().nullable(),
                    name: z.string().nullable(),
                    email: z.string().nullable()
                  })
                  .nullable()
              })
            )
          })
          .nullable()
      )
    )

    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      let queryFilter: Prisma.RequestWhereInput = {
        workspace_id: ctx.current_member.workspace_id,

        OR: [
          { AND: [{ start: { gte: input.start } }, { start: { lte: addDays(input.end, 1) } }] },
          { AND: [{ end: { gte: input.start } }, { end: { lte: addDays(input.end, 1) } }] },
          { AND: [{ start: { lt: input.start } }, { end: { gt: addDays(input.end, 1) } }] }
        ]
      };

      if (input.status) {
        queryFilter = {
          ...queryFilter,
          details: { status: input.status }
        };
      }

      if (input.request_member_ids) {
        queryFilter = {
          ...queryFilter,
          requester_member_id: {
            in: input.request_member_ids.split(';')
          }
        };
      }

      if (input.department_ids) {
        const members = await ctx.prisma.memberDepartment.findMany({
          where: { department_id: { in: input.department_ids.split(';') } },
          select: { member_id: true }
        });

        queryFilter = {
          ...queryFilter,
          requester_member_id: {
            in: [
              ...members.map((member) => member.member_id),
              ...(input.request_member_ids ? input.request_member_ids.split(';') : [])
            ]
          }
        };
      }

      const requests = await ctx.prisma.request.findMany({
        where: queryFilter,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          end: true,
          start: true,
          end_at: true,
          start_at: true,
          leave_unit: true,
          request_creator_member: { select: { id: true, custom_id: true, name: true, email: true } },
          details: {
            select: {
              workday_absence_duration: true,
              duration: true,
              leave_type: {
                select: {
                  take_from_allowance: true,
                  name: true,
                  id: true,
                  leave_unit: true,
                  allowance_type: {
                    select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
                  }
                }
              },
              approval_process: true,
              cancel_reason: true,
              canceld_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
              reason: true,
              status: true,
              canceld_date: true,
              request_approvers: {
                select: {
                  reason: true,
                  status: true,
                  status_changed_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  approver_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  predecessor_request_member_approver_id: true,
                  status_change_date: true
                }
              },
              requester_member: { select: { id: true, custom_id: true, name: true, email: true } }
            }
          }
        }
      });

      return requests.map((request) => {
        const details = request.details;
        if (!details) throw new Error('no details found');
        return {
          id: request.id,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          end: dateFromDatabaseIgnoreTimezone(request.end),
          start: dateFromDatabaseIgnoreTimezone(request.start),
          end_at: request.end_at == 'lunchtime' ? 'lunchtime' : 'end_of_day',
          start_at: request.start_at == 'morning' ? 'morning' : 'afternoon',
          leave_unit: request.leave_unit,
          request_creator_member: request.request_creator_member,
          leave_type: details.leave_type,
          approval_process: details.approval_process,
          cancel_reason: details.cancel_reason,
          canceld_by_member: details.canceld_by_member,
          requester_member: details.requester_member,
          take_from_allowance: details.leave_type.take_from_allowance,
          allowance_type: details.leave_type.allowance_type,
          reason: details.reason,
          status: details.status,
          canceld_date: details.canceld_date,
          workday_absence_duration: details.workday_absence_duration,
          duration: details.duration,
          request_approvers: details.request_approvers.map((x) => {
            return {
              reason: x.reason,
              status: x.status,
              status_changed_by_member: x.status_changed_by_member,
              status_changed_date: x.status_change_date,
              approver_member: x.approver_member
            };
          })
        };
      });
    }),
  getRequestsPerDay: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/requests_per_day',
        protect: true,
        tags: ['Requests'],
        summary: 'Get all requests per day',
        description: 'Get all requests per day'
      }
    })
    .input(
      z.object({
        start: z.coerce.date(),
        end: z.coerce.date(),
        status: z.nativeEnum(RequestStatus).optional(),
        request_member_ids: z.string().optional(),
        department_ids: z.string().optional()
      })
    )
    .output(
      z.array(
        z
          .object({
            id: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            end: z.date(),
            start: z.date(),
            start_at: z.nativeEnum(StartAt),
            end_at: z.nativeEnum(EndAt),
            leave_unit: z.nativeEnum(LeaveUnit),
            day: z.date(),
            month: z.string(),
            weekday: z.string(),
            fullday: z.string(),
            request_creator_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),

            leave_type: z.object({
              name: z.string(),
              id: z.string(),
              leave_unit: z.nativeEnum(LeaveUnit)
            }),
            approval_process: z.nativeEnum(ApprovalProcess),
            cancel_reason: z.string().nullable(),
            canceld_by_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),
            requester_member: z
              .object({
                id: z.string(),
                custom_id: z.string().nullable(),
                name: z.string().nullable(),
                email: z.string().nullable()
              })
              .nullable(),
            reason: z.string().nullable(),
            take_from_allowance: z.boolean(),
            allowance_type: z
              .object({
                id: z.string(),
                name: z.string(),
                ignore_allowance_limit: z.boolean(),
                allowance_unit: z.nativeEnum(AllowanceUnit)
              })
              .nullable(),

            workday_absence_duration: z.number(),
            duration: z.number(),
            status: z.string(),
            canceld_date: z.date().nullable(),
            request_approvers: z.array(
              z.object({
                reason: z.string().nullable(),
                status: z.nativeEnum(RequestApproverStatus),
                status_changed_by_member: z
                  .object({
                    id: z.string(),
                    custom_id: z.string().nullable(),
                    name: z.string().nullable(),
                    email: z.string().nullable()
                  })
                  .nullable(),
                status_changed_date: z.date().nullable(),
                approver_member: z
                  .object({
                    id: z.string(),
                    custom_id: z.string().nullable(),
                    name: z.string().nullable(),
                    email: z.string().nullable()
                  })
                  .nullable()
              })
            )
          })
          .nullable()
      )
    )

    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(ctx.current_member.language, 'backend');
      let queryFilter: Prisma.RequestWhereInput = {
        workspace_id: ctx.current_member.workspace_id,

        OR: [
          { AND: [{ start: { gte: input.start } }, { start: { lte: addDays(input.end, 1) } }] },
          { AND: [{ end: { gte: input.start } }, { end: { lte: addDays(input.end, 1) } }] },
          { AND: [{ start: { lt: input.start } }, { end: { gt: addDays(input.end, 1) } }] }
        ]
      };

      if (input.status) {
        queryFilter = {
          ...queryFilter,
          details: { status: input.status }
        };
      }

      if (input.request_member_ids) {
        queryFilter = {
          ...queryFilter,
          requester_member_id: {
            in: input.request_member_ids.split(';')
          }
        };
      }

      if (input.department_ids) {
        const members = await ctx.prisma.memberDepartment.findMany({
          where: { department_id: { in: input.department_ids.split(';') } },
          select: { member_id: true }
        });

        queryFilter = {
          ...queryFilter,
          requester_member_id: {
            in: [
              ...members.map((member) => member.member_id),
              ...(input.request_member_ids ? input.request_member_ids.split(';') : [])
            ]
          }
        };
      }

      let [workspace, memberSchedule] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: {
            privacy_show_otherdepartments: true,
            privacy_show_absences_in_past: true,
            schedule: { select: defaultWorkspaceScheduleSelect }
          }
        }),

        ctx.prisma.memberSchedule.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: defaultMemberScheduleSelect,
          orderBy: { from: 'desc' }
        })
      ]);
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace found'
        });
      }
      if (!workspace.schedule) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace found'
        });
      }
      const requests = await ctx.prisma.request.findMany({
        where: queryFilter,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          requester_member_id: true,
          end: true,
          start: true,
          end_at: true,
          start_at: true,
          leave_unit: true,
          request_creator_member: { select: { id: true, custom_id: true, name: true, email: true } },
          details: {
            select: {
              workday_absence_duration: true,
              duration: true,
              leave_type: {
                select: {
                  take_from_allowance: true,
                  name: true,
                  id: true,
                  leave_unit: true,
                  allowance_type: {
                    select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
                  }
                }
              },
              approval_process: true,
              cancel_reason: true,
              canceld_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
              reason: true,
              status: true,
              canceld_date: true,
              request_approvers: {
                select: {
                  reason: true,
                  status: true,
                  status_changed_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  approver_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  predecessor_request_member_approver_id: true,
                  status_change_date: true
                }
              },
              requester_member: { select: { id: true, custom_id: true, name: true, email: true } }
            }
          }
        }
      });
      let requetsPerDay = [];
      for (let i2 = 0; i2 < requests.length; i2++) {
        const request = requests[i2];
        if (request) {
          const details = request.details;
          if (!details) throw new Error('no details found');

          const dates = getDates(new Date(request.start), new Date(request.end));
          const memberSchedules = memberSchedule.filter((y) => y.member_id == request.requester_member_id);
          for (let i = 0; i < dates.length; i++) {
            const date = dates[i];

            if (date && date >= input.start && date <= input.end) {
              const newR = cloneDeep(request);
              setRequestStartEndTimesBasedOnScheduleOnDate(newR, date, memberSchedules, workspace.schedule);
              let fullday = t('Full_Day');
              if (isDayUnit(request.leave_unit)) {
                if (i == 0 && request.start_at == 'afternoon') {
                  fullday = t('Afternoon');
                }

                if (i == dates.length - 1 && request.end_at == 'lunchtime') {
                  fullday = t('Morning');
                }
              } else {
                fullday =
                  format(dateFromDatabaseIgnoreTimezone(newR.start), 'HH:mm') +
                  ' - ' +
                  format(dateFromDatabaseIgnoreTimezone(newR.end), 'HH:mm');
              }

              requetsPerDay.push({
                id: request.id,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt,
                day: date,
                month: date.toLocaleString(ctx.current_member.language, { month: 'long' }),
                fullday,
                weekday: date.toLocaleString(ctx.current_member.language, { weekday: 'long' }),
                end: newR.end,
                start: newR.start,
                end_at: newR.end_at,
                start_at: newR.start_at,
                leave_unit: request.leave_unit,
                request_creator_member: request.request_creator_member,
                leave_type: details.leave_type,
                approval_process: details.approval_process,
                cancel_reason: details.cancel_reason,
                canceld_by_member: details.canceld_by_member,
                requester_member: details.requester_member,
                take_from_allowance: details.leave_type.take_from_allowance,
                allowance_type: details.leave_type.allowance_type,
                reason: details.reason,
                status: details.status,
                canceld_date: details.canceld_date,
                workday_absence_duration: details.workday_absence_duration,
                duration: details.duration,
                request_approvers: details.request_approvers.map((x) => {
                  return {
                    reason: x.reason,
                    status: x.status,
                    status_changed_by_member: x.status_changed_by_member,
                    status_changed_date: x.status_change_date,
                    approver_member: x.approver_member
                  };
                })
              });
            }
          }
        }
      }
      return requetsPerDay;
    }),
  getRequestById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/requests/{id}',
        protect: true,
        tags: ['Requests'],
        summary: 'Read a request by id',
        description: 'Read a request by id'
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
          createdAt: z.date(),
          updatedAt: z.date(),
          end: z.date(),
          start: z.date(),
          start_at: z.nativeEnum(StartAt),
          end_at: z.nativeEnum(EndAt),
          leave_unit: z.nativeEnum(LeaveUnit),
          request_creator_member: z
            .object({
              id: z.string(),
              custom_id: z.string().nullable(),
              name: z.string().nullable(),
              email: z.string().nullable()
            })
            .nullable(),

          leave_type: z.object({
            name: z.string(),
            id: z.string(),
            leave_unit: z.nativeEnum(LeaveUnit)
          }),
          approval_process: z.nativeEnum(ApprovalProcess),
          cancel_reason: z.string().nullable(),
          canceld_by_member: z
            .object({
              id: z.string(),
              custom_id: z.string().nullable(),
              name: z.string().nullable(),
              email: z.string().nullable()
            })
            .nullable(),
          requester_member: z
            .object({
              id: z.string(),
              custom_id: z.string().nullable(),
              name: z.string().nullable(),
              email: z.string().nullable()
            })
            .nullable(),
          take_from_allowance: z.boolean(),
          allowance_type: z
            .object({
              id: z.string(),
              name: z.string(),
              ignore_allowance_limit: z.boolean(),
              allowance_unit: z.nativeEnum(AllowanceUnit)
            })
            .nullable(),
          reason: z.string().nullable(),
          workday_absence_duration: z.number(),
          duration: z.number(),
          status: z.string(),
          canceld_date: z.date().nullable(),
          request_approvers: z.array(
            z.object({
              reason: z.string().nullable(),
              status: z.nativeEnum(RequestApproverStatus),
              status_changed_by_member: z
                .object({
                  id: z.string(),
                  custom_id: z.string().nullable(),
                  name: z.string().nullable(),
                  email: z.string().nullable()
                })
                .nullable(),
              status_changed_date: z.date().nullable(),
              approver_member: z
                .object({
                  id: z.string(),
                  custom_id: z.string().nullable(),
                  name: z.string().nullable(),
                  email: z.string().nullable()
                })
                .nullable(),
              predecessor_request_member_approver_id: z.string().nullable()
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const request = await ctx.prisma.request.findUnique({
        where: {
          id: input.id
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          end: true,
          start: true,
          end_at: true,
          start_at: true,
          leave_unit: true,
          request_creator_member: { select: { id: true, custom_id: true, name: true, email: true } },
          details: {
            select: {
              workday_absence_duration: true,
              duration: true,
              leave_type: {
                select: {
                  take_from_allowance: true,
                  name: true,
                  id: true,
                  leave_unit: true,
                  allowance_type: {
                    select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
                  }
                }
              },
              approval_process: true,
              cancel_reason: true,
              canceld_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
              reason: true,
              status: true,
              canceld_date: true,
              request_approvers: {
                select: {
                  reason: true,
                  status: true,
                  status_changed_by_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  approver_member: { select: { id: true, custom_id: true, name: true, email: true } },
                  predecessor_request_member_approver_id: true,
                  status_change_date: true
                }
              },
              requester_member: { select: { id: true, custom_id: true, name: true, email: true } }
            }
          }
        }
      });
      if (!request) throw new Error('no request found');
      const details = request.details;
      if (!details) throw new Error('no details found');

      return {
        id: request.id,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        end: dateFromDatabaseIgnoreTimezone(request.end),
        start: dateFromDatabaseIgnoreTimezone(request.start),
        leave_unit: request.leave_unit,
        end_at: request.end_at == 'lunchtime' ? 'lunchtime' : 'end_of_day',
        start_at: request.start_at == 'morning' ? 'morning' : 'afternoon',
        request_creator_member: request.request_creator_member,
        leave_type: details.leave_type,
        approval_process: details.approval_process,
        cancel_reason: details.cancel_reason,
        canceld_by_member: details.canceld_by_member,
        requester_member: details.requester_member,
        take_from_allowance: details.leave_type.take_from_allowance,
        allowance_type: details.leave_type.allowance_type,
        reason: details.reason,
        status: details.status,
        canceld_date: details.canceld_date,
        workday_absence_duration: details.workday_absence_duration,
        duration: details.duration,
        request_approvers: details.request_approvers.map((x) => {
          return {
            reason: x.reason,
            status: x.status,
            status_changed_by_member: x.status_changed_by_member,
            status_changed_date: x.status_change_date,
            approver_member: x.approver_member,
            predecessor_request_member_approver_id: x.predecessor_request_member_approver_id
          };
        })
      };
    }),

  createRequest: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/requests',
        protect: true,
        tags: ['Requests'],
        summary: 'Create a request',
        description: 'Create a request'
      }
    })
    .input(
      z.object({
        end: z.coerce.date(),
        start: z.coerce.date(),
        start_at: z.nativeEnum(StartAt),
        end_at: z.nativeEnum(EndAt),
        leave_type_id: z.string().uuid(),
        reason: z.string(),
        requester_member_id: z.string().uuid()
      })
    )
    .output(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const caller = requestRouter.createCaller({
        prisma: ctx.prisma,
        session: ctx.session,
        current_member: ctx.current_member,
        req: ctx.req
      });
      const retVal = await caller.add({
        end: input.end,
        start: input.start,
        end_at: input.end_at,
        start_at: input.start_at,
        leave_type_id: input.leave_type_id,
        reason: input.reason,
        requester_member_id: input.requester_member_id
      });
      return retVal.id;
    })
});
