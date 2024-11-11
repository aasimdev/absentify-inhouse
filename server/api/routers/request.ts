import { z } from 'zod';
import Redis from 'ioredis';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  Prisma,
  RequestStatus,
  type RequestDetail,
  OutOfOfficeMessageStatus,
  WebhookHistoryStatus,
  type PrismaClient,
  ApprovalProcess,
  RequestApproverStatus,
  SyncStatus,
  EndAt,
  StartAt,
  AllowanceUnit,
  LeaveUnit
} from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import {
  findRangeOverlap,
  calcRequestDuration,
  countMaxRequestsOnSameDayInRange,
  CheckCurrentUserHasPermissionToCreateRequest,
  CurrentUserIsDepartmentManagerOfMember,
  getFiscalYear,
  setRequestStartEndTimesBasedOnScheduleOnDate,
  getDayStartAndEndTimeFromschedule,
  findscheduleOnDate
} from 'lib/requestUtilities';
import { generateMissingAllowances, isAllowanceSufficient, updateMemberAllowances } from '~/lib/updateMemberAllowances';
import { defaultMemberScheduleSelect } from './member_schedule';
import { type Translate } from 'next-translate';
import {
  convertLocalDateToUTC,
  dateFromDatabaseIgnoreTimezone,
  getDates,
  isDayUnit,
  isHourUnit
} from '~/lib/DateHelper';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { defaultWorkspaceScheduleSelect } from './workspace_schedule';
import { inngest } from '~/inngest/inngest_client';
import { prisma } from '~/server/db';
import { defaultDepartmentSelect } from './department';
import { cloneDeep } from 'lodash';
import { BodyParams, TimeghostService } from '~/lib/timeghostService';
import { chunkArray, errorText } from '~/lib/createRequestSyncLogTimeghostEntries';

const redis = new Redis(process.env.REDIS_URL + '');

/**
 * Default selector for request.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultRequestSelect = Prisma.validator<Prisma.RequestSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  start: true,
  end: true,
  start_at: true,
  end_at: true,
  leave_unit: true,
  requester_member_id: true,
  request_creator_member: {
    select: { id: true, name: true }
  },
  workspace_id: true,
  year: true,
  details: {
    select: {
      id: true,
      status: true,
      workday_absence_duration: true,
      leave_type: {
        select: {
          name: true,
          icon: true,
          color: true,
          id: true,
          take_from_allowance: true,
          privacy_hide_leavetype: true,
          needs_approval: true,
          leave_unit: true,
          ignore_schedule: true,
          ignore_public_holidays: true,
          allowance_type_id: true,
          allowance_type: {
            select: {
              name: true,
              id: true,
              ignore_allowance_limit: true,
              carry_forward_months_after_fiscal_year: true,
              max_carry_forward: true
            }
          },
          outlook_synchronization_show_as: true
        }
      },
      reason: true,
      approval_process: true,
      request_approvers: {
        select: {
          approver_member_id: true,
          status: true,
          predecessor_request_member_approver_id: true,
          reason: true,
          status_change_date: true,
          status_changed_by_member_id: true,
          uuid: true,
          reminderDate: true
        }
      }
    }
  },
  requester_member: {
    select: {
      id: true,
      approval_process: true,
      public_holiday_id: true,
      departments: {
        select: {
          department_id: true,
          department: {
            select: {
              id: true,
              name: true,
              members: {
                select: { member_id: true, manager_type: true },
                where: { manager_type: { not: 'Member' } }
              }
            }
          }
        }
      }
    }
  }
});

export type defaultRequestSelectOutput = Prisma.RequestGetPayload<{
  select: typeof defaultRequestSelect;
}>;

function sortApprovers(
  approver: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    isAdmin?: boolean;
  }[]
) {
  const items: string[] = [];
  const approvers: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    isAdmin?: boolean;
  }[] = [];
  const first = approver.find((y) => y.predecessor_request_member_approver_id == null);
  if (first) {
    items.push(first.approver_member_id + '');
    approvers.push(first);
  }

  while (true) {
    const next = approver.find((y) => y.predecessor_request_member_approver_id == items[items.length - 1]);
    if (next) {
      // Überprüfe, ob der Genehmigende bereits in der Liste 'approvers' existiert
      if (approvers.includes(next)) {
        console.warn('Zyklischer Verweis gefunden, Schleife wird unterbrochen.');
        break;
      }
      if (next.approver_member_id) items.push(next.approver_member_id + '');
      approvers.push(next);
    } else {
      // Wenn kein nächster Genehmigender gefunden wird, beende die Schleife
      break;
    }
  }

  return approvers;
}

export const requestRouter = createTRPCRouter({
  allOfUserByDay: protectedProcedure
    .input(
      z.object({
        start: z.date(),
        end: z.date(),
        requester_member_id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      /**
       * For pagination you can have a look at this docs site
       * @link https://trpc.io/docs/useInfiniteQuery
       */
      let [workspace, requests, departments, memberSchedules] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: {
            privacy_show_otherdepartments: true,
            privacy_show_absences_in_past: true,
            schedule: { select: defaultWorkspaceScheduleSelect }
          }
        }),
        ctx.prisma.request.findMany({
          select: defaultRequestSelect,
          where: {
            workspace_id: ctx.current_member.workspace_id,
            OR: [
              { AND: [{ start: { gte: startOfDay(input.start) } }, { start: { lte: endOfDay(input.end) } }] },
              { AND: [{ end: { gte: startOfDay(input.start) } }, { end: { lte: endOfDay(input.end) } }] },
              { AND: [{ start: { lt: startOfDay(input.start) } }, { end: { gt: endOfDay(input.end) } }] }
            ],
            requester_member_id: input.requester_member_id
          },
          orderBy: [
            {
              start: 'asc'
            }
          ]
        }),
        ctx.prisma.department.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: {
            id: true,
            members: { select: { member_id: true, manager_type: true } }
          }
        }),
        ctx.prisma.memberSchedule.findMany({
          where: { member_id: input.requester_member_id },
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
          message: 'No workspace schedule found'
        });
      }
      if (!workspace.privacy_show_otherdepartments && !ctx.current_member.is_admin) {
        //check current user is in same department as requester
        const currentUserDepartments = departments
          .filter((departament) => departament.members.find((member) => member.member_id == ctx.current_member.id))
          .map((dep) => dep.id);
        const requester_member_departments = departments
          .filter((departament) => departament.members.find((member) => member.member_id == input.requester_member_id))
          .map((dep) => dep.id);
        if (!currentUserDepartments.find((departmanet) => requester_member_departments.includes(departmanet))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You are not in the same department as the requester'
          });
        }
      }
      if (!workspace.privacy_show_absences_in_past) {
        requests = requests.filter((rr) => {
          if (
            ctx.current_member.is_admin ||
            rr.details?.request_approvers.find((x) => x.approver_member_id == ctx.current_member.id) ||
            rr.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => rr.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return rr;
          } else {
            return rr.end >= convertLocalDateToUTC(addDays(new Date(), -1));
          }
        });
      }

      requests = requests
        .filter((r) => r.details?.status == RequestStatus.APPROVED || r.details?.status == RequestStatus.PENDING)
        .map((r) => {
          if (r.details && !r.details.leave_type.privacy_hide_leavetype) {
            return r;
          }
          if (
            ctx.current_member.is_admin ||
            r.details?.request_approvers.find((x) => x.approver_member_id == ctx.current_member.id) ||
            r.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => r.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return r;
          }

          r.details = null;

          return r;
        });

      let requetsPerDay = [];

      for (let index = 0; index < requests.length; index++) {
        const request = requests[index];
        if (!request) continue;

        const days = getDates(request.start, request.end);
        for (let i2 = 0; i2 < days.length; i2++) {
          const day = days[i2];
          if (!day) continue;
          const newR = cloneDeep(request);
          setRequestStartEndTimesBasedOnScheduleOnDate(newR, day, memberSchedules, workspace.schedule);

          requetsPerDay.push(newR);
        }
      }
      return requetsPerDay;
    }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      /**
       * For pagination you can have a look at this docs site
       * @link https://trpc.io/docs/useInfiniteQuery
       */

      const [workspace, request, departments] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { privacy_show_otherdepartments: true, privacy_show_absences_in_past: true }
        }),
        ctx.prisma.request.findUnique({
          select: defaultRequestSelect,
          where: {
            id: input.id
          }
        }),
        ctx.prisma.department.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: {
            id: true,
            members: { select: { member_id: true, manager_type: true } }
          }
        })
      ]);
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace found'
        });
      }
      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No request found'
        });
      }
      let requests = [request];

      if (!workspace.privacy_show_otherdepartments && !ctx.current_member.is_admin) {
        //check current user is in same department as requester
        const currentUserDepartments = departments
          .filter((departament) => departament.members.find((member) => member.member_id == ctx.current_member.id))
          .map((dep) => dep.id);
        const requester_member_departments = departments
          .filter((departament) =>
            departament.members.find((member) => member.member_id == request.requester_member_id)
          )
          .map((dep) => dep.id);
        if (!currentUserDepartments.find((departmanet) => requester_member_departments.includes(departmanet))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You are not in the same department as the requester'
          });
        }
      }
      if (!workspace.privacy_show_absences_in_past) {
        requests = requests.filter((rr) => {
          if (
            ctx.current_member.is_admin ||
            rr.details?.request_approvers.find((x) => x.approver_member_id == ctx.current_member.id) ||
            rr.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => rr.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return rr;
          } else {
            return rr.end >= convertLocalDateToUTC(addDays(new Date(), -1));
          }
        });
      }

      requests = requests
        .filter((r) => r.details?.status == RequestStatus.APPROVED || r.details?.status == RequestStatus.PENDING)
        .map((r) => {
          if (r.details && !r.details.leave_type.privacy_hide_leavetype) {
            return r;
          }
          if (
            ctx.current_member.is_admin ||
            r.details?.request_approvers.find((x) => x.approver_member_id == ctx.current_member.id) ||
            r.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => r.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return r;
          }

          r.details = null;

          return r;
        });

      return requests[0];
    }),

  allOfUsersByDay: protectedProcedure
    .input(
      z.object({
        start: z.date(),
        end: z.date(),
        department_ids: z.array(z.string()).nullable()
      })
    )
    .query(async ({ ctx, input }) => {
      /**
       * For pagination you can have a look at this docs site
       * @link https://trpc.io/docs/useInfiniteQuery
       */
      let whereClausel: Prisma.RequestWhereInput = {
        workspace_id: ctx.current_member.workspace_id,
        OR: [
          { AND: [{ start: { gte: startOfDay(input.start) } }, { start: { lte: addDays(input.end, 1) } }] },
          { AND: [{ end: { gte: startOfDay(input.start) } }, { end: { lte: addDays(input.end, 1) } }] },
          { AND: [{ start: { lt: startOfDay(input.start) } }, { end: { gt: addDays(input.end, 1) } }] }
        ]
      };

      if (input.department_ids && input.department_ids.length > 0) {
        let allMemberIds = await ctx.prisma.memberDepartment.findMany({
          where: { department_id: { in: input.department_ids } },
          select: { member_id: true },
          distinct: ['member_id']
        });
        whereClausel = {
          workspace_id: ctx.current_member.workspace_id,
          OR: [
            { AND: [{ start: { gte: startOfDay(input.start) } }, { start: { lte: addDays(input.end, 1) } }] },
            { AND: [{ end: { gte: startOfDay(input.start) } }, { end: { lte: addDays(input.end, 1) } }] },
            { AND: [{ start: { lt: startOfDay(input.start) } }, { end: { gt: addDays(input.end, 1) } }] }
          ],
          requester_member_id: { in: allMemberIds.map((x) => x.member_id) }
        };
      }

      let [workspace, requests, departments, memberSchedule] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: {
            privacy_show_otherdepartments: true,
            privacy_show_absences_in_past: true,
            schedule: { select: defaultWorkspaceScheduleSelect }
          }
        }),
        ctx.prisma.request.findMany({
          select: defaultRequestSelect,
          where: whereClausel,
          orderBy: [
            {
              start: 'asc'
            }
          ]
        }),
        ctx.prisma.department.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: {
            id: true,
            members: {
              select: {
                member_id: true,
                manager_type: true
              }
            }
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

      if (workspace.privacy_show_otherdepartments || ctx.current_member.is_admin) {
      } else {
        //check current user is in same department as requester
        const currentUserDepartments = departments
          .filter((x) => x.members.find((y) => y.member_id == ctx.current_member.id))
          .map((x) => x.id);

        requests = requests.filter((r) =>
          departments
            .filter((x) => x.members.find((y) => y.member_id == r.requester_member_id))
            .map((x) => x.id)
            .some((x) => currentUserDepartments.includes(x))
        );
      }

      if (!workspace.privacy_show_absences_in_past) {
        requests = requests.filter((rr) => {
          if (
            ctx.current_member.is_admin ||
            rr.details?.request_approvers.find((x) => x.approver_member_id == ctx.current_member.id) ||
            rr.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => rr.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return rr;
          } else {
            return rr.end >= convertLocalDateToUTC(addDays(new Date(), -1));
          }
        });
      }

      requests = requests
        .filter((r) => r.details?.status == RequestStatus.APPROVED || r.details?.status == RequestStatus.PENDING)
        .map((r) => {
          if (r.details && !r.details.leave_type.privacy_hide_leavetype) {
            return r;
          }
          if (
            ctx.current_member.is_admin ||
            r.details?.request_approvers.find((zz) => zz.approver_member_id == ctx.current_member.id) ||
            r.requester_member_id == ctx.current_member.id ||
            departments
              .filter((d) => r.requester_member.departments.find((z) => z.department_id == d.id))
              .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
          ) {
            return r;
          }

          r.details = null;

          return r;
        });
      let requetsPerDay = [];

      for (let index = 0; index < requests.length; index++) {
        const request = requests[index];
        if (!request) continue;
        const memberSchedules = memberSchedule.filter((y) => y.member_id == request.requester_member_id);
        const days = getDates(request.start, request.end);
        for (let i2 = 0; i2 < days.length; i2++) {
          const day = days[i2];
          if (!day) continue;
          const newR = cloneDeep(request);

          setRequestStartEndTimesBasedOnScheduleOnDate(newR, day, memberSchedules, workspace.schedule);

          requetsPerDay.push(newR);
        }
      }
      return requetsPerDay;
    }),
  toApprove: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */

    let [workspace, details, departments] = await ctx.prisma.$transaction([
      ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: { privacy_show_otherdepartments: true, privacy_show_absences_in_past: true }
      }),
      ctx.prisma.requestDetail.findMany({
        select: { request: { select: defaultRequestSelect } },
        where: {
          workspace_id: ctx.current_member.workspace_id,
          status: RequestStatus.PENDING
        }
      }),
      ctx.prisma.department.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: {
          id: true,
          members: { select: { member_id: true, manager_type: true } }
        }
      })
    ]);
    const detailsRequestArray = details.map((detail) => detail.request);
    let requests = detailsRequestArray.flat();

    if (!workspace) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('no-workspace-found')
      });
    }
    if (!ctx.current_member.is_admin) {
      requests = requests.filter((x) =>
        x.details?.request_approvers.find((zz) => zz.approver_member_id == ctx.current_member.id)
      );
    }

    if (workspace.privacy_show_otherdepartments || ctx.current_member.is_admin) {
    } else {
      //check current user is in same department as requester or is manager of department
      const currentUserDepartments = departments
        .filter((x) => x.members.find((y) => y.member_id == ctx.current_member.id))
        .map((x) => x.id);

      requests = requests.filter((r) =>
        departments
          .filter((x) => x.members.find((y) => y.member_id == r.requester_member_id))
          .map((x) => x.id)
          .some((x) => currentUserDepartments.includes(x))
      );
    }

    let toApprove = [];

    for (let index = 0; index < requests.length; index++) {
      const request = requests[index];
      if (request && request.details?.request_approvers) {
        const sortedApprovers = sortApprovers(request.details.request_approvers);
        for (let i2 = 0; i2 < sortedApprovers.length; i2++) {
          const approver = sortedApprovers[i2];
          if (approver) {
            if (approver.status !== 'PENDING') continue;
            if (ctx.current_member.is_admin || approver.approver_member_id == ctx.current_member.id) {
              if (
                request.requester_member.approval_process == 'Parallel_all_have_to_agree' ||
                request.requester_member.approval_process == 'Parallel_one_has_to_agree'
              ) {
                toApprove.push({ request, approver });
              } else {
                if (approver.predecessor_request_member_approver_id == null) {
                  toApprove.push({ request, approver });
                } else if (
                  sortedApprovers.find((x) => x.approver_member_id == approver.predecessor_request_member_approver_id)
                    ?.status == 'APPROVED' ||
                  sortedApprovers.find((x) => x.approver_member_id == approver.predecessor_request_member_approver_id)
                    ?.status == 'DECLINED'
                ) {
                  toApprove.push({ request, approver });
                }
              }
            }
          }
        }
      }
    }
    toApprove = toApprove.map((r) => {
      if (r.request.details && r.request.details.request_approvers) r.request.details.request_approvers = [];

      if (r.request.details && !r.request.details.leave_type.privacy_hide_leavetype) {
        return r;
      }
      if (
        ctx.current_member.is_admin ||
        r.approver.approver_member_id == ctx.current_member.id ||
        r.request.requester_member_id == ctx.current_member.id ||
        departments
          .filter((d) => r.request.requester_member.departments.find((z) => z.department_id == d.id))
          .find((x) => x.members.find((y) => y.member_id == ctx.current_member.id && y.manager_type != 'Member'))
      ) {
        return r;
      }

      r.request.details = null;

      return r;
    });

    return toApprove;
  }),
  getInsights: protectedProcedure
    .input(
      z.object({
        department_id: z.string().nullable(),
        start: z.date(),
        end: z.date(),
        leave_unit: z.nativeEnum(AllowanceUnit)
      })
    )
    .query(async ({ ctx, input }) => {
      let [
        workspaceSchedule,
        user_is_manager_in_departments,
        all_department_ids,
        memberSchedules,
        public_holiday_days,
        members,
        workspace
      ] = await ctx.prisma.$transaction([
        ctx.prisma.workspaceSchedule.findUnique({
          where: { workspace_id: ctx.current_member.workspace_id },

          select: defaultWorkspaceScheduleSelect
        }),
        ctx.prisma.memberDepartment.findMany({
          where: { member_id: ctx.current_member.id, manager_type: 'Manager' },
          select: { department_id: true, department: { select: { members: { select: { member_id: true } } } } }
        }),
        ctx.prisma.department.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true, members: { select: { member_id: true } } }
        }),
        ctx.prisma.memberSchedule.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: defaultMemberScheduleSelect,
          orderBy: { from: 'desc' }
        }),
        ctx.prisma.publicHolidayDay.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: {
            id: true,
            date: true,
            duration: true,
            public_holiday_id: true
          },
          orderBy: { date: 'asc' }
        }),
        ctx.prisma.member.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true, public_holiday_id: true }
        }),
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { id: true, fiscal_year_start_month: true }
        })
      ]);

      if (ctx.current_member.is_admin) {
        user_is_manager_in_departments = all_department_ids.map((x) => ({ department_id: x.id, department: x }));
      }

      let departmentIds = user_is_manager_in_departments;
      if (input.department_id) {
        departmentIds = user_is_manager_in_departments.filter((x) => x.department_id == input.department_id);
      }

      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace found'
        });
      }

      if (departmentIds.length == 0) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No department found'
        });
      }
      if (!workspaceSchedule) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace schedule found'
        });
      }

      let requests = await ctx.prisma.request.findMany({
        where: {
          workspace_id: ctx.current_member.workspace_id,
          OR: [
            { AND: [{ start: { gte: input.start } }, { start: { lte: addDays(input.end, 1) } }] },
            { AND: [{ end: { gte: input.start } }, { end: { lte: addDays(input.end, 1) } }] },
            { AND: [{ start: { lt: input.start } }, { end: { gt: addDays(input.end, 1) } }] }
          ],
          requester_member_id: {
            in: departmentIds.map((x) => x.department.members.map((y) => y.member_id)).flat(2)
          }
        },
        orderBy: { start: 'asc' },
        select: defaultRequestSelect
      });

      let reqPerDay = [];
      for (let i1 = 0; i1 < departmentIds.length; i1++) {
        const department = departmentIds[i1];
        if (!department) continue;
        for (let index = 0; index < requests.length; index++) {
          const request = requests[index];
          if (!request) continue;
          if (!request.details) continue;
          if (input.leave_unit == 'days' && isHourUnit(request.leave_unit)) continue;

          if (input.leave_unit == 'hours' && isDayUnit(request.leave_unit)) continue;
          if (request.details.status == 'APPROVED' || request.details.status == 'PENDING') {
            if (department.department.members.find((x) => x.member_id == request.requester_member_id)) {
              const member_schedules = memberSchedules.filter((y) => y.member_id == request.requester_member_id);
              const request_member = members.find((Y) => Y.id == request.requester_member.id);
              if (!request_member) continue;
              let member_public_holiday_days = public_holiday_days.filter(
                (phd) => phd.public_holiday_id === request_member.public_holiday_id
              );
              const days = getDates(request.start, request.end);
              for (let i2 = 0; i2 < days.length; i2++) {
                const day = days[i2];
                if (!day) continue;
                if (day >= input.start && day <= input.end) {
                  const newR = cloneDeep(request);

                  setRequestStartEndTimesBasedOnScheduleOnDate(newR, day, member_schedules, workspaceSchedule);

                  const d = calcRequestDuration({
                    start: newR.start,
                    end: newR.end,
                    start_at: newR.start_at,
                    end_at: newR.end_at,
                    workspaceSchedule: workspaceSchedule,
                    memberSchedules: member_schedules,
                    memberPublicHolidayDays: member_public_holiday_days,
                    leaveType: request.details.leave_type,
                    requester_member_id: request.requester_member_id,
                    workspace
                  });
                  reqPerDay.push({
                    requester_member_id: request.requester_member_id,
                    date: day,
                    month: day.toLocaleString(ctx.current_member.language, { month: 'long' }),
                    duration:
                      input.leave_unit == 'days'
                        ? d.total.workday_duration_in_days
                        : d.total.workday_duration_in_minutes,
                    leave_type: request.details?.leave_type,
                    status: request.details?.status,
                    weekday: day.toLocaleString(ctx.current_member.language, { weekday: 'long' })
                  });
                }
              }
            }
          }
        }
      }

      return reqPerDay;
    }),
  getSyncDetailsForRequest: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(({ ctx, input }) => {
      if (!ctx.session.user.impersonate) return;
      return ctx.prisma.requestSyncLog.findMany({
        where: { request_id: input.id },
        select: {
          calendar_event_id: true,
          sync_status: true,
          calendar_id: true,
          calendar_microsoft_tenant_id: true,
          calendar_microsoft_user_id: true,
          calendar_sync_setting: {
            select: {
              name: true,
              calendar_sync_type: true
            }
          },
          createdAt: true,
          sync_type: true,
          email: true,
          error: true,
          timeghost_sync_setting: {
            select: {
              name: true
            }
          }
        }
      });
    }),
  calcRequestDuration: protectedProcedure
    .input(
      z.object({
        requester_member_id: z.string(),
        requester_member_public_holiday_id: z.string(),
        leave_type_id: z.string(),
        duration: z.object({
          start: z.date(),
          end: z.date(),
          start_at: z.nativeEnum(StartAt).optional(),
          end_at: z.nativeEnum(EndAt).optional()
        })
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: { fiscal_year_start_month: true, id: true }
      });
      if (!workspace) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      const [workspaceschedule, member_schedules, public_holiday_days, member_allowances, leave_type] =
        await ctx.prisma.$transaction([
          ctx.prisma.workspaceSchedule.findUnique({
            where: { workspace_id: ctx.current_member?.workspace_id }
          }),
          ctx.prisma.memberSchedule.findMany({
            select: defaultMemberScheduleSelect,
            where: { member_id: input.requester_member_id },
            orderBy: { from: 'desc' }
          }),
          ctx.prisma.publicHolidayDay.findMany({
            where: {
              workspace_id: ctx.current_member?.workspace_id,
              public_holiday_id: input.requester_member_public_holiday_id
            },
            select: {
              id: true,

              date: true,

              duration: true,
              public_holiday_id: true
            },
            orderBy: { date: 'asc' }
          }),
          ctx.prisma.memberAllowance.findMany({
            select: { remaining: true, year: true, allowance_type_id: true, allowance: true, brought_forward: true },
            where: {
              member_id: input.requester_member_id
            }
          }),
          ctx.prisma.leaveType.findUnique({
            select: {
              take_from_allowance: true,
              allowance_type_id: true,
              leave_unit: true,
              ignore_schedule: true,
              ignore_public_holidays: true,
              allowance_type: {
                select: {
                  ignore_allowance_limit: true,
                  carry_forward_months_after_fiscal_year: true,
                  max_carry_forward: true
                }
              }
            },
            where: { id: input.leave_type_id }
          })
        ]);

      if (!workspaceschedule) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace schedule found'
        });
      }

      if (!public_holiday_days) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No public holiday days found'
        });
      }
      if (!leave_type) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No leave type found'
        });
      }

      if (!leave_type.take_from_allowance) {
        return null;
      }
      if (!leave_type.allowance_type_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No allowance type found'
        });
      }

      const duration = calcRequestDuration({
        start: input.duration.start,
        end: input.duration.end,
        start_at: input.duration.start_at,
        end_at: input.duration.end_at,
        workspaceSchedule: workspaceschedule,
        memberSchedules: member_schedules,
        memberPublicHolidayDays: public_holiday_days.filter(
          (x) => x.public_holiday_id == input.requester_member_public_holiday_id
        ),
        leaveType: leave_type,
        requester_member_id: input.requester_member_id,
        workspace: workspace
      });
      return {
        duration,
        isAllowanceSufficient: await isAllowanceSufficient(ctx.prisma, ctx.current_member.workspace_id, {
          start: input.duration.start,
          end: input.duration.end,
          start_at: input.duration.start_at,
          end_at: input.duration.end_at,
          leave_type_id: input.leave_type_id,
          requester_member_id: input.requester_member_id
        })
      };
    }),
  findRangeOverlap: protectedProcedure
    .input(
      z.object({
        requester_member_id: z.string(),
        start: z.date(),
        end: z.date(),
        start_at: z.nativeEnum(StartAt).optional(),
        end_at: z.nativeEnum(EndAt).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user_requests, memberSchedules, workspaceSchedule] = await ctx.prisma.$transaction([
        ctx.prisma.request.findMany({
          where: {
            workspace_id: ctx.current_member?.workspace_id,
            requester_member_id: input.requester_member_id,
            OR: [
              {
                AND: [
                  { start: { gte: startOfDay(dateFromDatabaseIgnoreTimezone(input.start)) } },
                  { start: { lte: addDays(startOfDay(dateFromDatabaseIgnoreTimezone(input.end)), 1) } }
                ]
              },
              {
                AND: [
                  { end: { gte: startOfDay(dateFromDatabaseIgnoreTimezone(input.start)) } },
                  { end: { lte: addDays(startOfDay(dateFromDatabaseIgnoreTimezone(input.end)), 1) } }
                ]
              },
              {
                AND: [
                  { start: { lt: startOfDay(dateFromDatabaseIgnoreTimezone(input.start)) } },
                  { end: { gt: addDays(startOfDay(dateFromDatabaseIgnoreTimezone(input.end)), 1) } }
                ]
              }
            ]
          },
          select: defaultRequestSelect
        }),
        ctx.prisma.memberSchedule.findMany({
          where: { member_id: input.requester_member_id },
          select: defaultMemberScheduleSelect,
          orderBy: { from: 'desc' }
        }),

        ctx.prisma.workspaceSchedule.findUnique({
          where: { workspace_id: ctx.current_member?.workspace_id },
          select: defaultWorkspaceScheduleSelect
        })
      ]);

      if (!user_requests) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No requests found'
        });
      }
      if (!workspaceSchedule) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No workspace schedule found'
        });
      }

      const overlap = findRangeOverlap(
        input.start,
        input.start_at,
        input.end,
        input.end_at,
        user_requests.filter(
          (x) => x.details?.status != RequestStatus.DECLINED && x.details?.status != RequestStatus.CANCELED
        ),
        memberSchedules,
        workspaceSchedule
      );
      return { overlap };
    }),
  add: protectedProcedure
    .input(
      z.object({
        requester_member_id: z.string(),
        start: z.date(),
        end: z.date(),
        leave_type_id: z.string(),
        start_at: z.nativeEnum(StartAt).optional(),
        end_at: z.nativeEnum(EndAt).optional(),
        reason: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.start > input.end) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('start-date-cant-be-after-end-date')
        });
      }

      let [
        workspaceschedule,
        member_schedules,
        requester_member,
        workspace,
        leave_type,
        user_requests,
        departments,
        members,
        memberMailboxSetting,
        webhookSettings
      ] = await ctx.prisma.$transaction([
        ctx.prisma.workspaceSchedule.findUnique({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: defaultWorkspaceScheduleSelect
        }),
        ctx.prisma.memberSchedule.findMany({
          select: defaultMemberScheduleSelect,
          where: { member_id: input.requester_member_id },
          orderBy: { from: 'desc' }
        }),
        ctx.prisma.member.findUnique({
          where: { id: input.requester_member_id },
          select: {
            public_holiday_id: true,
            workspace_id: true,
            approval_process: true,
            id: true,
            departments: {
              select: {
                department_id: true,
                department: {
                  select: {
                    members: {
                      select: { member_id: true, manager_type: true },
                      where: { manager_type: { not: 'Member' } }
                    }
                  }
                }
              }
            },
            allowance_type_configurtaions: {
              select: {
                allowance_type_id: true,
                disabled: true
              }
            },
            name: true,
            email: true,
            microsoft_tenantId: true,
            microsoft_user_id: true
          }
        }),
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member?.workspace_id },
          select: {
            global_timezone: true,
            id: true,
            microsoft_users_read_all: true,
            fiscal_year_start_month: true,
            calendarSyncSettings: {
              select: {
                id: true,
                deleted: true,
                calendarSyncSettingDepartments: {
                  select: { department_id: true }
                },
                calendarSyncSettingLeaveTypes: {
                  select: { leave_type_id: true }
                }
              }
            },
            schedule: { select: defaultWorkspaceScheduleSelect },
            company_logo_url: true,
            company_logo_ratio_square: true,
            timeghost_sync_settings: {
              select: {
                id: true,
                deleted: true,
                timeghost_workspace_id: true,
                timeghostSyncSettingDepartments: {
                  select: { department_id: true }
                },
                timeghostSyncSettingLeaveTypes: {
                  select: { leave_type_id: true }
                }
              }
            }
          }
        }),
        ctx.prisma.leaveType.findUnique({
          where: {
            id: input.leave_type_id
          },
          select: {
            id: true,
            allowance_type_id: true,
            maximum_absent: true,
            needs_approval: true,
            take_from_allowance: true,
            name: true,
            reason_mandatory: true,
            leave_unit: true,
            ignore_schedule: true,
            ignore_public_holidays: true,
            allowance_type: {
              select: {
                ignore_allowance_limit: true,
                carry_forward_months_after_fiscal_year: true,
                max_carry_forward: true
              }
            }
          }
        }),
        ctx.prisma.request.findMany({
          where: {
            workspace_id: ctx.current_member?.workspace_id,
            requester_member_id: input.requester_member_id,
            OR: [
              { AND: [{ start: { gte: input.start } }, { start: { lte: addDays(input.end, 1) } }] },
              { AND: [{ end: { gte: input.start } }, { end: { lte: addDays(input.end, 1) } }] },
              { AND: [{ start: { lt: input.start } }, { end: { gt: addDays(input.end, 1) } }] }
            ]
          },
          select: defaultRequestSelect
        }),

        ctx.prisma.department.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id
          },
          select: {
            id: true,
            maximum_absent: true,
            name: true,
            members: { select: { member_id: true } }
          }
        }),
        ctx.prisma.member.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            status: { not: 'ARCHIVED' }
          },
          select: {
            id: true,
            departments: { select: { department: { select: { id: true } } } }
          }
        }),
        ctx.prisma.memberMailboxSettings.findFirst({
          select: { id: true, member_id: true },
          where: {
            member_id: input.requester_member_id,
            leave_type_id: input.leave_type_id
          }
        }),
        ctx.prisma.webhookSetting.findMany({
          select: { id: true, event: true },
          where: { workspace_id: ctx.current_member.workspace_id }
        })
      ]);

      if (!requester_member) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('items_not_found')
        });
      }
      if (!ctx.current_member) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User not found'
        });
      }

      if (!workspace) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('items_not_found')
        });
      }
      if (leave_type?.reason_mandatory && (!input.reason || input.reason.trim().length === 0)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('reason_mandatory_error')
        });
      }
      if (!workspaceschedule || !member_schedules || !workspace) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('items_not_found')
        });
      }

      if (!leave_type) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('items_not_found')
        });
      }

      if (
        leave_type.allowance_type_id &&
        requester_member.allowance_type_configurtaions.find(
          (x) => x.allowance_type_id === leave_type?.allowance_type_id
        )?.disabled
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('leave_type_disabled')
        });
      }

      if (isDayUnit(leave_type.leave_unit)) {
        input.start = new Date(
          Date.UTC(input.start.getUTCFullYear(), input.start.getUTCMonth(), input.start.getUTCDate(), 0, 0, 0, 0)
        );
        input.end = new Date(
          Date.UTC(input.end.getUTCFullYear(), input.end.getUTCMonth(), input.end.getUTCDate(), 0, 0, 0, 0)
        );
      }

      const isWithinAllowedFiscalYear = (date: Date, startMonth: number, isAdmin: boolean) => {
        const fiscalYear = getFiscalYear(date, startMonth);
        const currentFiscalYear = getFiscalYear(new Date(), startMonth);
        if (isAdmin) {
          return fiscalYear >= currentFiscalYear - 1 && fiscalYear <= currentFiscalYear + 1;
        } else {
          return fiscalYear >= currentFiscalYear && fiscalYear <= currentFiscalYear + 1;
        }
      };

      if (!isWithinAllowedFiscalYear(input.start, workspace.fiscal_year_start_month, ctx.current_member.is_admin)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.current_member.is_admin
            ? ctx.t('admins-can-only-create-requests-for-last-current-and-next-year')
            : ctx.t('Start_must_be_in_current_year_or_future')
        });
      }

      if (!CheckCurrentUserHasPermissionToCreateRequest(ctx.current_member, requester_member)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('Only_admins_or_managers_can_add_requests_for_other_users')
        });
      }
      await generateMissingAllowances(prisma, workspace.id, input.requester_member_id);
      let [public_holiday_days, member_allowances] = await ctx.prisma.$transaction([
        ctx.prisma.publicHolidayDay.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            public_holiday_id: requester_member.public_holiday_id
          },
          select: {
            id: true,
            date: true,
            duration: true,
            public_holiday_id: true
          },
          orderBy: { date: 'asc' }
        }),
        ctx.prisma.memberAllowance.findMany({
          where: {
            member_id: input.requester_member_id,
            year: getFiscalYear(input.start, workspace.fiscal_year_start_month)
          },
          select: {
            id: true,
            remaining: true,
            taken: true,
            allowance: true,
            brought_forward: true,
            compensatory_time_off: true,
            year: true,
            allowance_type_id: true
          }
        })
      ]);
      if (!public_holiday_days) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('items_not_found')
        });
      }

      if (
        user_requests &&
        findRangeOverlap(
          input.start,
          input.start_at,
          input.end,
          input.end_at,
          user_requests.filter(
            (x) => x.details?.status != RequestStatus.DECLINED && x.details?.status != RequestStatus.CANCELED
          ),
          member_schedules,
          workspaceschedule
        )
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('Overlap_with_another_request')
        });
      }
      const requester_member_ids = getRequestsOfUsersInSameDepartment(members, requester_member.id);
      if (requester_member_ids) {
        const requestsOfUsersInSameDepartments = await ctx.prisma.request.findMany({
          select: defaultRequestSelect,
          where: {
            workspace_id: ctx.current_member.workspace_id,
            OR: [
              { AND: [{ start: { gte: input.start } }, { start: { lte: addDays(input.end, 1) } }] },
              { AND: [{ end: { gte: input.start } }, { end: { lte: addDays(input.end, 1) } }] },
              { AND: [{ start: { lt: input.start } }, { end: { gt: addDays(input.end, 1) } }] }
            ],
            requester_member_id: { in: requester_member_ids }
          },
          orderBy: [
            {
              start: 'asc'
            }
          ]
        });

        const memberSchedules = await prisma.memberSchedule.findMany({
          where: { member_id: { in: requester_member_ids } },
          select: defaultMemberScheduleSelect,
          orderBy: { from: 'desc' }
        });

        const departmentsMaximumAbsentReached = [];
        const departmentIdsOfRequester = requester_member.departments.map((x) => x.department_id);
        const allDepartments = departments.filter((x) => departmentIdsOfRequester.includes(x.id));

        for (let index = 0; index < allDepartments.length; index++) {
          const department = allDepartments[index];
          if (department) {
            if (
              leave_type.maximum_absent &&
              department.maximum_absent &&
              department.maximum_absent != -1 &&
              countMaxRequestsOnSameDayInRange(
                input.start,
                input.start_at,
                input.end,
                input.end_at,
                requestsOfUsersInSameDepartments.filter((x) =>
                  department.members.find((y) => y.member_id == x.requester_member_id)
                ),
                workspaceschedule,
                memberSchedules,
                input.requester_member_id
              ) >= department.maximum_absent
            ) {
              departmentsMaximumAbsentReached.push(department);
            }
          }
        }

        if (departmentsMaximumAbsentReached.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('max_absence_reached') + ' ' + departmentsMaximumAbsentReached.map((x) => x.name).join(', ')
          });
        }
      }
      const d = calcRequestDuration({
        start: input.start,
        end: input.end,
        start_at: input.start_at,
        end_at: input.end_at,
        workspaceSchedule: workspaceschedule,
        memberSchedules: member_schedules,
        memberPublicHolidayDays: public_holiday_days,
        leaveType: leave_type,
        requester_member_id: input.requester_member_id,
        workspace
      });

      const allowanceSufficient = isAllowanceSufficient(ctx.prisma, ctx.current_member.workspace_id, {
        start: input.start,
        end: input.end,
        start_at: input.start_at,
        end_at: input.end_at,
        leave_type_id: input.leave_type_id,
        requester_member_id: input.requester_member_id
      });

      if (leave_type.take_from_allowance && !allowanceSufficient) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('Not_enough_remaining_days_on_contingent')
        });
      }

      let workday_absence_duration = d.total.workday_duration_in_minutes;
      if (isDayUnit(leave_type.leave_unit)) {
        workday_absence_duration = d.total.workday_duration_in_days;
      }
      let approver_member_ids: {
        member_id: string;
        status: RequestApproverStatus;
        predecessor_request_member_approver_id: string | null;
      }[] = [];

      const approvers = await ctx.prisma.memberApprover.findMany({
        where: { member_id: requester_member.id },
        select: {
          approver_member_id: true,
          predecessor_approver_member_approver_id: true
        }
      });
      approver_member_ids = approvers
        .filter((x) => x.approver_member_id)
        .map((x) => ({
          member_id: x.approver_member_id,
          status: 'PENDING',
          predecessor_request_member_approver_id: x.predecessor_approver_member_approver_id
        })) as {
        member_id: string;
        status: RequestApproverStatus;
        predecessor_request_member_approver_id: string | null;
      }[];

      if (!leave_type.needs_approval) {
        approver_member_ids = [
          {
            member_id: ctx.current_member.id,
            status: 'APPROVED',
            predecessor_request_member_approver_id: null
          }
        ];
      }

      if (approver_member_ids.length == 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('no_approver_set')
        });
      }

      let approver_members = [];

      approver_members = await ctx.prisma.member.findMany({
        where: {
          id: { in: approver_member_ids.map((x) => x.member_id) }
        },
        select: {
          id: true,
          email: true,
          name: true,
          language: true,
          microsoft_tenantId: true,
          microsoft_user_id: true,
          date_format: true
        }
      });

      if (approver_members.length == 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('internal_server_error')
        });
      }

      if (
        approver_member_ids.length >= 1 &&
        approver_member_ids.find((y) => y.predecessor_request_member_approver_id == null)?.member_id ==
          requester_member.id
      ) {
        const x = approver_member_ids.find((y) => y.predecessor_request_member_approver_id == null);
        if (x) x.status = 'APPROVED';
      }
      const findApp = approver_member_ids.find((approver) => approver.member_id === requester_member.id);
      if (
        (requester_member.approval_process === 'Parallel_all_have_to_agree' ||
          requester_member.approval_process === 'Parallel_one_has_to_agree') &&
        findApp
      ) {
        findApp.status = 'APPROVED';
      }
      if (
        requester_member.approval_process == 'Linear_one_has_to_agree' &&
        approver_member_ids.find((y) => y.predecessor_request_member_approver_id == null)?.status == 'APPROVED'
      ) {
        for (let index = 0; index < approver_member_ids.length; index++) {
          const approver = approver_member_ids[index];
          if (approver)
            if (approver.predecessor_request_member_approver_id == null) approver.status = 'APPROVED';
            else approver.status = 'APPROVED_BY_ANOTHER_MANAGER';
        }
      } else if (
        requester_member.approval_process == 'Parallel_one_has_to_agree' &&
        (approver_member_ids.find((x) => x.status == 'APPROVED') ||
          approver_member_ids.find((y) => y.member_id == ctx.current_member.id))
      ) {
        for (let index = 0; index < approver_member_ids.length; index++) {
          const approver = approver_member_ids[index];
          if (approver)
            if (approver.member_id == ctx.current_member.id) approver.status = 'APPROVED';
            else if (approver.status !== 'APPROVED') approver.status = 'APPROVED_BY_ANOTHER_MANAGER';
        }
      }

      const status: RequestStatus = approver_member_ids.find((x) => x.status == 'PENDING') ? 'PENDING' : 'APPROVED';

      let request;
      let details: {
        id: string;
        requester_member: {
          id: string;
          name: string | null;
          email: string | null;
          date_format: string;
          microsoft_tenantId: string | null;
          microsoft_user_id: string | null;
          language: string;
          departments: { department_id: string | null }[];
        } | null;
        leave_type: { id: string; leave_unit: LeaveUnit };
      } | null = null;
      try {
        details = await ctx.prisma.requestDetail.create({
          data: {
            leave_type_id: input.leave_type_id,
            reason: input.reason,
            status: status,
            requester_member_id: input.requester_member_id,
            workspace_id: ctx.current_member?.workspace_id,
            workday_absence_duration: workday_absence_duration,
            duration: d.total.duration,
            approval_process: requester_member.approval_process
          },
          select: {
            id: true,
            requester_member: {
              select: {
                id: true,
                name: true,
                microsoft_tenantId: true,
                microsoft_user_id: true,
                language: true,
                date_format: true,
                email: true,
                departments: { select: { department_id: true } }
              }
            },
            leave_type: { select: { id: true, leave_unit: true } }
          }
        });
        if (details && details.id)
          await ctx.prisma.requestApprover.createMany({
            data: approver_member_ids.map((x) => {
              return {
                status: x.status,
                workspace_id: ctx.current_member.workspace_id,
                approver_member_id: x.member_id,
                //@ts-ignore
                request_details_id: details.id,
                status_change_date:
                  x.status == 'APPROVED' || x.status == 'APPROVED_BY_ANOTHER_MANAGER' ? new Date() : null,
                status_changed_by_member_id:
                  x.status == 'APPROVED' || x.status == 'APPROVED_BY_ANOTHER_MANAGER' ? ctx.current_member.id : null,
                predecessor_request_member_approver_id: x.predecessor_request_member_approver_id
              };
            })
          });
      } catch (requestDetail_error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('internal_server_error')
        });
      }

      if (input.start_at == undefined) {
        const schedule = findscheduleOnDate(input.start, workspaceschedule, member_schedules);
        const firstDaySchedule = getDayStartAndEndTimeFromschedule(input.start, 'afternoon', 'end_of_day', schedule);
        if (input.start < firstDaySchedule.start) {
          input.start_at = 'morning';
        } else {
          input.start_at = 'afternoon';
        }
      }
      if (input.end_at == undefined) {
        const schedule = findscheduleOnDate(input.end, workspaceschedule, member_schedules);
        const daySchedule = getDayStartAndEndTimeFromschedule(input.end, 'afternoon', 'end_of_day', schedule);
        if (input.end < daySchedule.start) {
          input.end_at = 'lunchtime';
        } else {
          input.end_at = 'end_of_day';
        }
      }

      try {
        request = await ctx.prisma.request.create({
          data: {
            createdBy_member_id: ctx.current_member.id,
            end: input.end,
            end_at: input.end_at,
            requester_member_id: input.requester_member_id,
            start: input.start,
            start_at: input.start_at,
            workspace_id: ctx.current_member?.workspace_id,
            updatedAt: new Date(),
            year: input.start.getFullYear(),
            request_details_id: details.id,
            leave_unit: leave_type.leave_unit,
            out_of_office_message_status: memberMailboxSetting?.id
              ? OutOfOfficeMessageStatus.MustBeConfigured
              : OutOfOfficeMessageStatus.None
          },
          select: defaultRequestSelect
        });

        await updateMemberAllowances(ctx.prisma, workspace.id, request.requester_member.id);
      } catch (request_error) {
        await ctx.prisma.requestDetail.delete({ where: { id: details.id } });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('internal_server_error')
        });
      }

      await createRequestSyncLogEntries(workspace, details, ctx.prisma, request);
      await createRequestSyncLogEntriesForTg(workspace, details, ctx.prisma, request);
      const filteredWebhooks = webhookSettings.filter((x) => x.event.includes('request_created'));
      if (filteredWebhooks.length > 0) {
        const updates = [];
        for (let index = 0; index < filteredWebhooks.length; index++) {
          const webhookSetting = filteredWebhooks[index];
          if (webhookSetting)
            updates.push(
              ctx.prisma.webhookHistory.create({
                data: {
                  workspace_id: workspace.id,
                  request_id: request.id,
                  webhook_setting_id: webhookSetting.id,
                  status: WebhookHistoryStatus.PENDING
                }
              })
            );
        }

        const results = await ctx.prisma.$transaction(updates);
        const webhookHistoryIds: number[] = [];
        for (const result of results) {
          // Check if result is a webhookHistory entry
          if (
            result &&
            typeof result === 'object' &&
            'id' in result &&
            typeof result.id === 'number' &&
            'webhook_setting_id' in result
          ) {
            webhookHistoryIds.push(result.id);
          }
        }
        if (webhookHistoryIds.length > 0)
          await inngest.send(
            webhookHistoryIds.map((id) => ({
              name: 'process.webhook',
              data: { id }
            }))
          );
      }
      if (request.details?.status === 'APPROVED') {
        await inngest.send({
          name: 'request/notifications.notify_approvers',
          data: {
            created_by: ctx.current_member,
            request_id: request.id,
            approval_process: request.details.approval_process,
            approved: true,
            decline_reason: ''
          }
        });
      }
      if (ctx.current_member.id !== input.requester_member_id && details.requester_member) {
        await inngest.send({
          name: 'request/notifications.created_by_another_user',
          data: {
            created_by: ctx.session.user,

            request_id: request.id
          } as {
            request_id: string;
            created_by: { name: string; email: string | null };
          }
        });
      }
      if (
        leave_type.needs_approval &&
        approver_member_ids.length > 0 &&
        approver_member_ids.find((x) => x.status == 'PENDING')
      ) {
        await inngest.send({
          name: 'request/notifications.approval_requests',
          data: {
            request_id: request.id,
            _ctx: {
              user: {
                email: ctx.session.user.email,
                name: ctx.current_member.name
              }
            }
          }
        });
      }
      //if the user has a mailbox setting, we need to check if there are any requests that are already started today and set the out of office message status to must be configured
      if (memberMailboxSetting?.id) {
        await updateOutOfOfficeStatus(request.requester_member_id, ctx.current_member.workspace_id);
      }

      return request;
    }),
  sendReminderMailToApproverRequest: protectedProcedure
    .input(
      z.object({
        request_id: z.string(),
        member_id: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      //@ts-ignore
      let z = ctx;
      await inngest.send({
        name: 'request/notifications.send_reminder',
        data: {
          member_id: input.member_id,
          request_id: input.request_id
        }
      });
    }),
  cancelRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          cancel_reason: z.string().nullable()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      let redisId = await redis.get(id);
      if (!redisId) {
        await redis.set(id, id, 'EX', 5);
      } else {
        while (redisId) {
          await new Promise((r) => setTimeout(r, 500));
          redisId = await redis.get(id);
        }
      }

      const [request, webhook_settings, workspace] = await ctx.prisma.$transaction([
        ctx.prisma.request.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            start: true,
            out_of_office_message_status: true,
            end: true,
            start_at: true,
            end_at: true,
            requester_member: {
              select: {
                id: true,
                email: true,
                name: true,
                microsoft_tenantId: true,
                microsoft_user_id: true,
                language: true,
                date_format: true,
                departments: {
                  select: {
                    department: {
                      select: {
                        members: {
                          select: { member_id: true, manager_type: true },
                          where: { manager_type: { not: 'Member' } }
                        }
                      }
                    }
                  }
                }
              }
            },
            details: {
              select: {
                workday_absence_duration: true,
                approval_process: true,
                id: true,
                status: true,
                request_approvers: {
                  select: {
                    uuid: true,
                    status: true,
                    predecessor_request_member_approver_id: true,
                    approver_member_id: true,
                    approver_member: {
                      select: {
                        language: true,
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  }
                },
                leave_type: {
                  select: { take_from_allowance: true, name: true }
                }
              }
            }
          }
        }),
        ctx.prisma.webhookSetting.findMany({
          where: {
            workspace_id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            event: true
          }
        }),
        ctx.prisma.workspace.findUnique({
          where: {
            id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            company_logo_ratio_square: true,
            company_logo_url: true,
            allow_manager_past_request_cancellation: true,
            fiscal_year_start_month: true
          }
        })
      ]);
      if (!request) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }

      if (!workspace) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (!request.details) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (request.details.status == 'CANCELED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('request-already-canceled')
        });
      }
      if (request.details.status == 'DECLINED') {
        redis.del(id);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('you-cant-cancel-a-declined-request')
        });
      }
      if (!ctx.current_member) {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('user-not-found')
        });
      }

      const isManager = request.requester_member.departments.find((x) =>
        x.department?.members.find((x) => x.member_id == ctx.current_member.id && x.manager_type == 'Manager')
      );
      const allowedManagers = isManager ? (workspace?.allow_manager_past_request_cancellation ? true : false) : true;

      if (!ctx.current_member.is_admin && request.start < new Date() && !isManager && !allowedManagers) {
        redis.del(id);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t(
            'you-cant-cancel-a-request-that-has-already-started-only-admins-or-allowed-managers-can-do-that'
          )
        });
      }
      if (
        !ctx.current_member.is_admin &&
        ctx.current_member.id != request.requester_member.id &&
        !CurrentUserIsDepartmentManagerOfMember(ctx.current_member, request.requester_member)
      ) {
        redis.del(id);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('you-dont-have-permission-to-cancel-this-request')
        });
      }

      if (!data.cancel_reason) {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('cancel_reason-is-required')
        });
      }
      if (data.cancel_reason.trim() == '') {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('cancel_reason-is-required')
        });
      }

      const updates = [];
      if (request.out_of_office_message_status == OutOfOfficeMessageStatus.Configured) {
        updates.push(
          ctx.prisma.request.update({
            where: { id: request.id },
            select: { id: true },
            data: {
              out_of_office_message_status: OutOfOfficeMessageStatus.MustBeRemoved
            }
          })
        );
      } else if (request.out_of_office_message_status != OutOfOfficeMessageStatus.None) {
        updates.push(
          ctx.prisma.request.update({
            where: { id: request.id },
            select: { id: true },
            data: {
              out_of_office_message_status: OutOfOfficeMessageStatus.None
            }
          })
        );
      }

      let foundCanceler = false;

      for (let index = 0; index < request.details.request_approvers.length; index++) {
        const approver = request.details.request_approvers[index];
        if (approver)
          if (approver.approver_member_id == ctx.current_member.id) {
            foundCanceler = true;
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'CANCELED',
                  reason: data.cancel_reason,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          } else {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'CANCELED_BY_ANOTHER_MANAGER',
                  reason: null,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          }
      }
      if (!foundCanceler) {
        const sorted = sortApprovers(request.details.request_approvers);
        const last = sorted[sorted.length - 1];
        if (last)
          updates.push(
            ctx.prisma.requestApprover.create({
              data: {
                status: 'CANCELED',
                reason: data.cancel_reason,
                status_change_date: new Date(),
                status_changed_by_member_id: ctx.current_member.id,
                workspace_id: ctx.current_member.workspace_id,
                request_details_id: request.details.id,
                approver_member_id: ctx.current_member.id,
                predecessor_request_member_approver_id: last.approver_member_id
              }
            })
          );
      }

      updates.push(
        ctx.prisma.requestDetail.update({
          where: { id: request.details.id },
          data: {
            status: 'CANCELED',
            cancel_reason: data.cancel_reason
          }
        })
      );

      const filteredWebhooks = webhook_settings.filter((x) => x.event.includes('request_status_changed'));
      if (filteredWebhooks.length > 0) {
        for (let index = 0; index < filteredWebhooks.length; index++) {
          const webhookSetting = filteredWebhooks[index];
          if (webhookSetting)
            updates.push(
              ctx.prisma.webhookHistory.create({
                data: {
                  workspace_id: ctx.current_member?.workspace_id + '',
                  request_id: request.id,
                  webhook_setting_id: webhookSetting.id,
                  status: WebhookHistoryStatus.PENDING
                }
              })
            );
        }
      }
      const results = await ctx.prisma.$transaction(updates);
      const webhookHistoryIds: number[] = [];
      for (const result of results) {
        // Check if result is a webhookHistory entry
        if (
          result &&
          typeof result === 'object' &&
          'id' in result &&
          typeof result.id === 'number' &&
          'webhook_setting_id' in result
        ) {
          webhookHistoryIds.push(result.id);
        }
      }
      if (webhookHistoryIds.length > 0)
        await inngest.send(
          webhookHistoryIds.map((id) => ({
            name: 'process.webhook',
            data: { id }
          }))
        );
      redis.del(id);

      let calendar_sync_setting_logs = await prisma.requestSyncLog.findMany({
        where: { request_id: request.id, timeghost_sync_setting_id: null },
        select: { id: true, request_id: true }
      });
      if (calendar_sync_setting_logs.length > 0) {
        await inngest.send({
          // The event name
          name: 'request/delete_calendar_entry',
          // The event's data
          data: {
            request_id: request.id
          }
        });
      }
      let timeghost_sync_setting_logs = await prisma.requestSyncLog.findMany({
        where: {
          request_id: request.id,
          OR: [
            {
              sync_status: SyncStatus.Synced,
              error: null // Case 1: sync_status is Synced and error is not defined
            },
            {
              sync_status: SyncStatus.NotSynced,
              error: 'Pending: Waiting for approval' // Case 2: sync_status is NotSynced and error is 'Pending: Waiting for approval'
            }
          ],
          timeghost_sync_setting_id: { not: null }
        },
        select: { id: true, request_id: true }
      });
      if (timeghost_sync_setting_logs.length > 0) {
        await inngest.send(
          timeghost_sync_setting_logs.map((log, i) => {
            if (i == 0) {
              return {
                name: 'request/delete_timeghost_time_entries',
                data: {
                  sync_log_id: log.id,
                  first_event: true
                }
              };
            } else {
              return {
                name: 'request/delete_timeghost_time_entries',
                data: {
                  sync_log_id: log.id,
                  first_event: false
                }
              };
            }
          })
        );
      }
      await updateMemberAllowances(ctx.prisma, workspace.id, request.requester_member.id);

      if (ctx.current_member.id == request.requester_member.id && input.data.cancel_reason) {
        await inngest.send({
          name: 'request/notifications.canceled_by_user',
          data: {
            request_id: request.id,
            currentUser: ctx.session.user
          } as {
            request_id: string;
            currentUser: { email?: string | null | undefined };
          }
        });
      }
      if (ctx.current_member.id !== request.requester_member.id && input.data.cancel_reason) {
        await inngest.send({
          name: 'request/notifications.canceled_by_someone',
          data: {
            request_id: request.id,
            currentUser: ctx.session.user
          } as {
            request_id: string;
            currentUser: { email?: string | null | undefined; name?: string | null | undefined };
          }
        });
      }

      await updateOutOfOfficeStatus(request.requester_member.id, ctx.current_member.workspace_id);
    }),
  declineRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          approver_uuid: z.string(),
          approver_id: z.string(),
          decline_reason: z.string().nullable()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;

      if (!data.decline_reason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('decline-reason-is-required')
        });
      }
      if (data.decline_reason.trim() == '') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('decline-reason-is-required')
        });
      }

      let redisId = await redis.get(id);
      if (!redisId) {
        await redis.set(id, id, 'EX', 5);
      } else {
        while (redisId) {
          await new Promise((r) => setTimeout(r, 500));
          redisId = await redis.get(id);
        }
      }

      const [request, webhook_settings, workspace] = await ctx.prisma.$transaction([
        ctx.prisma.request.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            start: true,
            out_of_office_message_status: true,
            end: true,
            start_at: true,
            end_at: true,
            requester_member: {
              select: {
                id: true,
                email: true,
                name: true,
                microsoft_tenantId: true,
                microsoft_user_id: true,
                language: true,
                date_format: true,
                departments: {
                  select: {
                    department_id: true,
                    department: {
                      select: {
                        members: {
                          select: { member_id: true, manager_type: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            details: {
              select: {
                workday_absence_duration: true,
                approval_process: true,
                id: true,
                status: true,
                request_approvers: {
                  select: {
                    uuid: true,
                    status: true,
                    predecessor_request_member_approver_id: true,
                    approver_member_id: true,
                    approver_member: {
                      select: {
                        language: true,
                        id: true,
                        name: true,
                        email: true,
                        is_admin: true
                      }
                    }
                  }
                },
                leave_type: {
                  select: { take_from_allowance: true, name: true }
                }
              }
            }
          }
        }),
        ctx.prisma.webhookSetting.findMany({
          where: {
            workspace_id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            event: true
          }
        }),
        ctx.prisma.workspace.findUnique({
          where: {
            id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            company_logo_ratio_square: true,
            company_logo_url: true,
            fiscal_year_start_month: true
          }
        })
      ]);

      if (!request) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }

      if (!workspace) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (request.details?.status == 'CANCELED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (request.details?.status == 'APPROVED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('request-is-already-approved')
        });
      }
      if (request.details?.status == 'DECLINED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('request-is-already-declined')
        });
      }
      if (!ctx.current_member) {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('user_not_found')
        });
      }

      if (!request.details) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      const departmanets = await ctx.prisma.department.findMany({
        where: { workspace_id: workspace.id },
        select: defaultDepartmentSelect
      });

      if (
        !ctx.current_member.is_admin &&
        !request.details?.request_approvers.find((y) => y.approver_member_id == ctx.current_member.id) &&
        !CurrentUserIsDepartmentManagerOfMember(ctx.current_member, request.requester_member)
      ) {
        redis.del(id);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('you-are-not-allowed-to-decline-this-request')
        });
      }
      const updates = [];

      if (request.out_of_office_message_status == OutOfOfficeMessageStatus.Configured) {
        updates.push(
          ctx.prisma.request.update({
            where: { id: request.id },
            select: { id: true },
            data: {
              out_of_office_message_status: OutOfOfficeMessageStatus.MustBeRemoved
            }
          })
        );
      } else if (request.out_of_office_message_status != OutOfOfficeMessageStatus.None) {
        updates.push(
          ctx.prisma.request.update({
            where: { id: request.id },
            select: { id: true },
            data: {
              out_of_office_message_status: OutOfOfficeMessageStatus.None
            }
          })
        );
      }

      let detailStatus = calcNewRequestStatus(
        { status: 'DECLINED' },
        request,
        ctx.t,
        ctx.current_member.is_admin,
        input.data.approver_uuid
      );
      const approvers = request.details.request_approvers;
      const approver = request.details.request_approvers.find((app) => app.uuid === input.data.approver_uuid);
      if (approver) {
        const depsMems = request.requester_member.departments.flatMap((department) => department.department?.members);
        const isManager = depsMems.find(
          (member) => member.member_id == ctx.current_member.id && member.manager_type == 'Manager'
        );
        if (
          request.details.approval_process === ApprovalProcess.Parallel_all_have_to_agree ||
          request.details.approval_process === ApprovalProcess.Linear_all_have_to_agree ||
          request.details.approval_process === ApprovalProcess.Parallel_one_has_to_agree
        ) {
          if (approver.approver_member_id === ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'DECLINED',
                  reason: data.decline_reason,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
            approvers.forEach((approver) => {
              if (
                approver.approver_member_id !== ctx.current_member.id &&
                approver.status !== RequestApproverStatus.APPROVED &&
                approver.status !== RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'DECLINED_BY_ANOTHER_MANAGER',
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
            });
          } else if (approver.approver_member_id !== ctx.current_member.id && ctx.current_member.is_admin) {
            approvers.forEach((approver) => {
              if (
                approver.approver_member_id === ctx.current_member.id &&
                approver.status !== RequestApproverStatus.APPROVED &&
                approver.status !== RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'DECLINED',
                      reason: data.decline_reason,
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
              if (
                approver.approver_member_id !== ctx.current_member.id &&
                approver.status !== RequestApproverStatus.APPROVED &&
                approver.status !== RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'DECLINED_BY_ANOTHER_MANAGER',
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
            });
          } else if (approver.approver_member_id !== ctx.current_member.id && isManager) {
            const filterDeps = departmanets.filter((dep) => {
              const manager = dep.members.find(
                (mem) => mem.member_id === ctx.current_member.id && mem.manager_type === 'Manager'
              );
              return manager;
            });
            const approverDepsMems = filterDeps?.flatMap((department) => department.members);

            const isManagerOfCurrent = approver.approver_member_id
              ? approverDepsMems?.map((mem) => mem.member_id).includes(approver.approver_member_id)
              : null;
            if (!approver.approver_member?.is_admin && isManagerOfCurrent) {
              approvers.forEach((approver) => {
                if (
                  approver.approver_member_id === ctx.current_member.id &&
                  approver.status !== RequestApproverStatus.APPROVED &&
                  approver.status !== RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER
                ) {
                  updates.push(
                    ctx.prisma.requestApprover.update({
                      where: { uuid: approver.uuid },
                      data: {
                        status: 'DECLINED',
                        reason: data.decline_reason,
                        status_change_date: new Date(),
                        status_changed_by_member_id: ctx.current_member.id
                      }
                    })
                  );
                }
                if (
                  approver.approver_member_id !== ctx.current_member.id &&
                  approver.status !== RequestApproverStatus.APPROVED &&
                  approver.status !== RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER
                ) {
                  updates.push(
                    ctx.prisma.requestApprover.update({
                      where: { uuid: approver.uuid },
                      data: {
                        status: 'DECLINED_BY_ANOTHER_MANAGER',
                        status_change_date: new Date(),
                        status_changed_by_member_id: ctx.current_member.id
                      }
                    })
                  );
                }
              });
            } else {
              detailStatus = 'PENDING';
            }
          }
        } else if (request.details.approval_process === ApprovalProcess.Linear_one_has_to_agree) {
          if (approver.approver_member_id === ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'DECLINED',
                  reason: data.decline_reason,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          } else if (ctx.current_member.is_admin && approver.approver_member_id !== ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'DECLINED_BY_ANOTHER_MANAGER',
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          } else if (isManager) {
            const filterDeps = departmanets.filter((dep) => {
              const manager = dep.members.find(
                (mem) => mem.member_id === ctx.current_member.id && mem.manager_type === 'Manager'
              );
              return manager;
            });
            const approverDepsMems = filterDeps?.flatMap((department) => department.members);

            const isManagerOfCurrent = approver.approver_member_id
              ? approverDepsMems?.map((mem) => mem.member_id).includes(approver.approver_member_id)
              : null;
            if (!approver.approver_member?.is_admin && isManagerOfCurrent) {
              updates.push(
                ctx.prisma.requestApprover.update({
                  where: { uuid: approver.uuid },
                  data: {
                    status: 'DECLINED_BY_ANOTHER_MANAGER',
                    status_change_date: new Date(),
                    status_changed_by_member_id: ctx.current_member.id
                  }
                })
              );
            } else {
              detailStatus = 'PENDING';
            }
          }
        }
      }
      updates.push(
        ctx.prisma.requestDetail.update({
          where: { id: request.details.id },
          data: { status: detailStatus },
          select: { id: true }
        })
      );

      const filteredWebhooks = webhook_settings.filter((x) => x.event.includes('request_status_changed'));
      if (filteredWebhooks.length > 0) {
        for (let index = 0; index < filteredWebhooks.length; index++) {
          const webhookSetting = filteredWebhooks[index];
          if (webhookSetting)
            updates.push(
              ctx.prisma.webhookHistory.create({
                data: {
                  workspace_id: ctx.current_member?.workspace_id + '',
                  request_id: request.id,
                  webhook_setting_id: webhookSetting.id,
                  status: WebhookHistoryStatus.PENDING
                }
              })
            );
        }
      }
      const results = await ctx.prisma.$transaction(updates);
      const webhookHistoryIds: number[] = [];
      for (const result of results) {
        // Check if result is a webhookHistory entry
        if (
          result &&
          typeof result === 'object' &&
          'id' in result &&
          typeof result.id === 'number' &&
          'webhook_setting_id' in result
        ) {
          webhookHistoryIds.push(result.id);
        }
      }
      if (webhookHistoryIds.length > 0)
        await inngest.send(
          webhookHistoryIds.map((id) => ({
            name: 'process.webhook',
            data: { id }
          }))
        );
      redis.del(id);

      if (detailStatus == 'DECLINED') {
        await inngest.send({
          // The event name
          name: 'request/delete_calendar_entry',
          // The event's data
          data: {
            request_id: request.id
          }
        });

        await updateMemberAllowances(ctx.prisma, ctx.current_member.workspace_id, request.requester_member.id);
      }

      let timeghost_sync_setting_logs = await prisma.requestSyncLog.findMany({
        where: {
          request_id: request.id,
          OR: [
            {
              sync_status: SyncStatus.Synced,
              error: null // Case 1: sync_status is Synced and error is not defined
            },
            {
              sync_status: SyncStatus.NotSynced,
              error: 'Pending: Waiting for approval' // Case 2: sync_status is NotSynced and error is 'Pending: Waiting for approval'
            }
          ],
          timeghost_sync_setting_id: { not: null }
        },
        select: { id: true, request_id: true }
      });
      if (timeghost_sync_setting_logs.length > 0) {
        await inngest.send(
          timeghost_sync_setting_logs.map((log, i) => {
            if (i == 0) {
              return {
                name: 'request/delete_timeghost_time_entries',
                data: {
                  sync_log_id: log.id,
                  first_event: true
                }
              };
            } else {
              return {
                name: 'request/delete_timeghost_time_entries',
                data: {
                  sync_log_id: log.id,
                  first_event: false
                }
              };
            }
          })
        );
      }

      if (detailStatus == 'DECLINED' && request.details) {
        await inngest.send({
          name: 'request/notifications.declined',
          data: {
            created_by: ctx.session.user,
            request_id: request.id,
            decline_reason: data.decline_reason
          }
        });
        await inngest.send({
          name: 'request/notifications.notify_approvers',
          data: {
            created_by: ctx.current_member,
            request_id: request.id,
            approval_process: request.details.approval_process,
            approved: false,
            decline_reason: data.decline_reason
          }
        });
      } else if (detailStatus == 'PENDING') {
        if (
          request.details.approval_process != 'Parallel_all_have_to_agree' &&
          request.details.approval_process != 'Parallel_one_has_to_agree'
        ) {
          await inngest.send({
            name: 'request/notifications.approval_requests',
            data: {
              request_id: request.id,
              _ctx: {
                user: {
                  email: ctx.session.user.email,
                  name: ctx.current_member.name
                }
              }
            }
          });
        }
        await inngest.send({
          name: 'request/notifications.update_requester',
          data: {
            request_id: request.id,
            updated_by:
              data.approver_id !== ctx.current_member.id
                ? {
                    name: ctx.current_member.name,
                    email: ctx.current_member.email,
                    original_approver_id: data.approver_id
                  }
                : null
          } as {
            request_id: string;
            updated_by: {
              name: string;
              email: string;
              original_approver_id: string;
            } | null;
          }
        });
        if (data.approver_id !== ctx.current_member.id) {
          await inngest.send({
            name: 'request/notifications.updated_by_another_user',
            data: {
              request_id: request.id,
              approver_id: data.approver_id,
              updated_by: {
                id: ctx.current_member.id,
                name: ctx.current_member.name,
                email: ctx.current_member.email,
                status: 'DECLINED'
              }
            } as {
              request_id: string;
              approver_id: string;
              updated_by: {
                id: string;
                name: string;
                email: string;
                status: string;
              };
            }
          });
        }
      }

      await updateOutOfOfficeStatus(request.requester_member.id, ctx.current_member.workspace_id);
    }),
  approveRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          approver_uuid: z.string(),
          approver_id: z.string()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      let redisId = await redis.get(id);
      if (!redisId) {
        await redis.set(id, id, 'EX', 5);
      } else {
        while (redisId) {
          await new Promise((r) => setTimeout(r, 500));
          redisId = await redis.get(id);
        }
      }
      const [request, webhook_settings, workspace, departmanets] = await ctx.prisma.$transaction([
        ctx.prisma.request.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            start: true,
            out_of_office_message_status: true,
            end: true,
            start_at: true,
            end_at: true,
            requester_member: {
              select: {
                id: true,
                email: true,
                name: true,
                microsoft_tenantId: true,
                microsoft_user_id: true,
                language: true,
                date_format: true,
                departments: {
                  select: {
                    department_id: true,
                    department: {
                      select: {
                        members: {
                          select: { member_id: true, manager_type: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            details: {
              select: {
                id: true,
                status: true,
                approval_process: true,
                workday_absence_duration: true,
                request_approvers: {
                  select: {
                    uuid: true,
                    status: true,
                    predecessor_request_member_approver_id: true,
                    approver_member_id: true,
                    approver_member: {
                      select: {
                        is_admin: true,
                        language: true,
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  }
                },
                leave_type: {
                  select: { id: true, take_from_allowance: true, name: true, sync_option: true }
                }
              }
            }
          }
        }),
        ctx.prisma.webhookSetting.findMany({
          where: {
            workspace_id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            event: true
          }
        }),
        ctx.prisma.workspace.findUnique({
          where: {
            id: ctx.current_member?.workspace_id
          },
          select: {
            id: true,
            company_logo_ratio_square: true,
            company_logo_url: true
          }
        }),
        ctx.prisma.department.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: defaultDepartmentSelect
        })
      ]);
      if (!request) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }

      if (!workspace) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (request.details?.status == 'CANCELED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }
      if (request.details?.status == 'APPROVED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('request-is-already-approved')
        });
      }
      if (request.details?.status == 'DECLINED') {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('request-is-already-declined')
        });
      }
      if (!ctx.current_member) {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('user_not_found')
        });
      }

      if (!request.details) {
        redis.del(id);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ctx.t('internal_server_error')
        });
      }

      if (
        !ctx.current_member.is_admin &&
        !request.details?.request_approvers.find((y) => y.approver_member_id == ctx.current_member.id) &&
        !CurrentUserIsDepartmentManagerOfMember(ctx.current_member, request.requester_member)
      ) {
        redis.del(id);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('you-dont-have-permission-to-approve-this-request')
        });
      }

      let detailStatus = calcNewRequestStatus(
        { status: 'APPROVED' },
        request,
        ctx.t,
        ctx.current_member.is_admin,
        input.data.approver_uuid
      );
      const updates = [];
      const prepareApp = request.details.request_approvers.map((app) => ({
        ...app,
        isAdmin: app.approver_member?.is_admin
      }));
      const approvers = sortApprovers(prepareApp);
      const approver = approvers.find((app) => app.uuid === input.data.approver_uuid);

      if (approver) {
        const depsMems = request.requester_member.departments.flatMap((department) => department.department?.members);
        const isManager = depsMems.find(
          (member) => member.member_id == ctx.current_member.id && member.manager_type == 'Manager'
        );
        if (
          request.details.approval_process === ApprovalProcess.Parallel_all_have_to_agree ||
          request.details.approval_process === ApprovalProcess.Linear_all_have_to_agree
        ) {
          if (approver.approver_member_id === ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'APPROVED',
                  reason: null,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          } else if (ctx.current_member.is_admin && approver.approver_member_id !== ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'APPROVED_BY_ANOTHER_MANAGER',
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
          } else if (isManager) {
            const filterDeps = departmanets.filter((dep) => {
              const manager = dep.members.find(
                (mem) => mem.member_id === ctx.current_member.id && mem.manager_type === 'Manager'
              );
              return manager;
            });
            const approverDepsMems = filterDeps?.flatMap((department) => department.members);

            const isManagerOfCurrent = approver.approver_member_id
              ? approverDepsMems?.map((mem) => mem.member_id).includes(approver.approver_member_id)
              : null;
            if (approver?.status === 'APPROVED' && !approver.isAdmin && isManagerOfCurrent) {
              updates.push(
                ctx.prisma.requestApprover.update({
                  where: { uuid: approver.uuid },
                  data: {
                    status: 'APPROVED_BY_ANOTHER_MANAGER',
                    status_change_date: new Date(),
                    status_changed_by_member_id: ctx.current_member.id
                  }
                })
              );
            } else {
              detailStatus = 'PENDING';
            }
          }
        } else if (
          request.details.approval_process === ApprovalProcess.Parallel_one_has_to_agree ||
          request.details.approval_process === ApprovalProcess.Linear_one_has_to_agree
        ) {
          if (approver.approver_member_id === ctx.current_member.id) {
            updates.push(
              ctx.prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: {
                  status: 'APPROVED',
                  reason: null,
                  status_change_date: new Date(),
                  status_changed_by_member_id: ctx.current_member.id
                }
              })
            );
            approvers.forEach((approver) => {
              if (
                approver.approver_member_id !== ctx.current_member.id &&
                approver.status !== RequestApproverStatus.DECLINED &&
                approver.status !== RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'APPROVED_BY_ANOTHER_MANAGER',
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
            });
          } else if (approver.approver_member_id !== ctx.current_member.id && ctx.current_member.is_admin) {
            approvers.forEach((approver) => {
              if (
                approver.approver_member_id === ctx.current_member.id &&
                approver.status !== RequestApproverStatus.DECLINED &&
                approver.status !== RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'APPROVED',
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
              if (
                approver.approver_member_id !== ctx.current_member.id &&
                approver.status !== RequestApproverStatus.DECLINED &&
                approver.status !== RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER
              ) {
                updates.push(
                  ctx.prisma.requestApprover.update({
                    where: { uuid: approver.uuid },
                    data: {
                      status: 'APPROVED_BY_ANOTHER_MANAGER',
                      status_change_date: new Date(),
                      status_changed_by_member_id: ctx.current_member.id
                    }
                  })
                );
              }
            });
          } else if (approver.approver_member_id !== ctx.current_member.id && isManager) {
            const filterDeps = departmanets.filter((dep) => {
              const manager = dep.members.find(
                (mem) => mem.member_id === ctx.current_member.id && mem.manager_type === 'Manager'
              );
              return manager;
            });
            const approverDepsMems = filterDeps?.flatMap((department) => department.members);

            const isManagerOfCurrent = approver.approver_member_id
              ? approverDepsMems?.map((mem) => mem.member_id).includes(approver.approver_member_id)
              : null;
            if (!approver.isAdmin && isManagerOfCurrent) {
              approvers.forEach((approver) => {
                if (
                  approver.approver_member_id === ctx.current_member.id &&
                  approver.status !== RequestApproverStatus.DECLINED &&
                  approver.status !== RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER
                ) {
                  updates.push(
                    ctx.prisma.requestApprover.update({
                      where: { uuid: approver.uuid },
                      data: {
                        status: 'APPROVED',
                        status_change_date: new Date(),
                        status_changed_by_member_id: ctx.current_member.id
                      }
                    })
                  );
                }
                if (
                  approver.approver_member_id !== ctx.current_member.id &&
                  approver.status !== RequestApproverStatus.DECLINED &&
                  approver.status !== RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER
                ) {
                  updates.push(
                    ctx.prisma.requestApprover.update({
                      where: { uuid: approver.uuid },
                      data: {
                        status: 'APPROVED_BY_ANOTHER_MANAGER',
                        status_change_date: new Date(),
                        status_changed_by_member_id: ctx.current_member.id
                      }
                    })
                  );
                }
              });
            } else {
              detailStatus === 'PENDING';
            }
          }
        }
      }
      updates.push(
        ctx.prisma.requestDetail.update({
          where: { id: request.details.id },
          data: { status: detailStatus },
          select: { id: true }
        })
      );
      const filteredWebhooks = webhook_settings.filter((x) => x.event.includes('request_status_changed'));
      if (filteredWebhooks.length > 0) {
        for (let index = 0; index < filteredWebhooks.length; index++) {
          const webhookSetting = filteredWebhooks[index];
          if (webhookSetting)
            updates.push(
              ctx.prisma.webhookHistory.create({
                data: {
                  workspace_id: ctx.current_member?.workspace_id + '',
                  request_id: request.id,
                  webhook_setting_id: webhookSetting.id,
                  status: WebhookHistoryStatus.PENDING
                }
              })
            );
        }
      }

      const results = await ctx.prisma.$transaction(updates);
      const webhookHistoryIds: number[] = [];
      for (const result of results) {
        // Check if result is a webhookHistory entry
        if (
          result &&
          typeof result === 'object' &&
          'id' in result &&
          typeof result.id === 'number' &&
          'webhook_setting_id' in result
        ) {
          webhookHistoryIds.push(result.id);
        }
      }
      if (webhookHistoryIds.length > 0)
        await inngest.send(
          webhookHistoryIds.map((id) => ({
            name: 'process.webhook',
            data: { id }
          }))
        );
      redis.del(id);

      if (detailStatus == 'APPROVED' && request.details) {
        await inngest.send({
          // The event name
          name: 'request/update_calendar_entry',
          // The event's data
          data: {
            request_id: request.id,
            microsoft_tenant_id: request.requester_member.microsoft_tenantId ?? 'empty'
          }
        });

        await inngest.send({
          name: 'request/notifications.approved',
          data: {
            created_by: ctx.session.user,
            request_id: request.id
          }
        });
        await inngest.send({
          name: 'request/notifications.notify_approvers',
          data: {
            created_by: ctx.current_member,
            request_id: request.id,
            approval_process: request.details.approval_process,
            approved: true,
            decline_reason: ''
          }
        });
      } else if (detailStatus == 'PENDING') {
        if (
          request.details.approval_process != 'Parallel_all_have_to_agree' &&
          request.details.approval_process != 'Parallel_one_has_to_agree'
        ) {
          await inngest.send({
            name: 'request/notifications.approval_requests',
            data: {
              request_id: request.id,
              _ctx: {
                user: {
                  email: ctx.session.user.email,
                  name: ctx.current_member.name
                }
              }
            }
          });
        }
        await inngest.send({
          name: 'request/notifications.update_requester',
          data: {
            request_id: request.id,
            updated_by:
              data.approver_id !== ctx.current_member.id
                ? {
                    name: ctx.current_member.name,
                    email: ctx.current_member.email,
                    original_approver_id: data.approver_id
                  }
                : null
          } as {
            request_id: string;
            updated_by: {
              name: string;
              email: string;
              original_approver_id: string;
            } | null;
          }
        });
        if (data.approver_id !== ctx.current_member.id) {
          await inngest.send({
            name: 'request/notifications.updated_by_another_user',
            data: {
              request_id: request.id,
              approver_id: data.approver_id,
              updated_by: {
                id: ctx.current_member.id,
                name: ctx.current_member.name,
                email: ctx.current_member.email,
                status: 'APPROVED'
              }
            } as {
              request_id: string;
              approver_id: string;
              updated_by: {
                id: string;
                name: string;
                email: string;
                status: string;
              };
            }
          });
        }
      }
      if (detailStatus === 'APPROVED') {
        let logs = await prisma.requestSyncLog.findMany({
          where: {
            request_id: request.id,
            sync_status: SyncStatus.NotSynced,
            error: 'Pending: Waiting for approval',
            timeghost_sync_setting_id: { not: null }
          },
          select: { id: true, request_id: true, timeghost_sync_setting_id: true }
        });

        if (logs.length > 0) {
          const events = logs.map((log, index) => ({
            name: 'request/create_timeghost_time_entries' as 'request/create_timeghost_time_entries',
            data: {
              request_id: log.request_id,
              sync_log_id: log.id,
              timeghost_sync_setting_id: log.timeghost_sync_setting_id,
              for_update: false,
              first_event: index === 0
            }
          }));

          await inngest.send(events);
        }
      }

      await updateOutOfOfficeStatus(request.requester_member.id, ctx.current_member.workspace_id);
    }),
  revoke_out_of_office_note_status: protectedProcedure
    .input(
      z.object({
        workspace_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('internal_server_error')
        });
      }

      if (ctx.current_member?.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('internal_server_error')
        });
      }
      await ctx.prisma.$transaction([
        ctx.prisma.memberMailboxSettings.deleteMany({
          where: { workspace_id: input.workspace_id }
        }),
        ctx.prisma.request.updateMany({
          where: {
            workspace_id: input.workspace_id,
            out_of_office_message_status: 'MustBeConfigured'
          },
          data: { out_of_office_message_status: 'None' }
        })
      ]);
    })
});

const getRequestsOfUsersInSameDepartment = (
  members: {
    id: string;
    departments: { department: { id: string } | null }[];
  }[],
  requester_member_id: string
) => {
  const requestMember = members.find((x) => x.id == requester_member_id);
  if (!requestMember) return;

  const departmentIdsOfRequester = requestMember.departments.map((x) => x.department?.id);

  const usersOfSameDepartments: string[] = [];
  for (let index = 0; index < members.length; index++) {
    const member = members[index];
    for (let i2 = 0; i2 < departmentIdsOfRequester.length; i2++) {
      const depID = departmentIdsOfRequester[i2];
      if (member && member.departments.find((x) => x.department?.id == depID)) {
        if (!usersOfSameDepartments.find((x) => x == member.id)) {
          usersOfSameDepartments.push(member.id);
        }
      }
    }
  }

  return usersOfSameDepartments;
};

async function createRequestSyncLogEntries(
  workspace: {
    calendarSyncSettings: {
      id: string;
      deleted: boolean;
      calendarSyncSettingDepartments: { department_id: string }[];
      calendarSyncSettingLeaveTypes: { leave_type_id: string }[];
    }[];
    id: string;
    global_timezone: string;
  },
  details: {
    id: string;
    requester_member: {
      microsoft_tenantId: string | null;
      microsoft_user_id: string | null;
      departments: { department_id: string | null }[];
    } | null;
    leave_type: { id: string | null };
  },
  prisma: PrismaClient,
  request: { id: string }
) {
  try {
    const requestSyncLogCreate: Prisma.RequestSyncLogCreateManyInput[] = [];
    for (let i2 = 0; i2 < workspace.calendarSyncSettings.length; i2++) {
      const sharedCalSettings = workspace.calendarSyncSettings[i2];
      if (sharedCalSettings && sharedCalSettings.deleted == false && details.requester_member) {
        const inDepartment = details.requester_member.departments.find((department) =>
          sharedCalSettings.calendarSyncSettingDepartments.some(
            (syncDepartment) => syncDepartment.department_id === department.department_id
          )
        );

        let hasLeaveType = sharedCalSettings.calendarSyncSettingLeaveTypes.some(
          (x) => x.leave_type_id == details.leave_type?.id
        );

        if (inDepartment && hasLeaveType) {
          requestSyncLogCreate.push({
            workspace_id: workspace.id,
            request_id: request.id,
            calendar_sync_setting_id: sharedCalSettings.id,
            sync_status: SyncStatus.NotSynced
          });
        }
      }
    }

    requestSyncLogCreate.push({
      workspace_id: workspace.id,
      request_id: request.id,
      calendar_microsoft_user_id: details.requester_member?.microsoft_user_id,
      calendar_microsoft_tenant_id: details.requester_member?.microsoft_tenantId,
      sync_status: SyncStatus.NotSynced
    });
    await prisma.requestSyncLog.createMany({ data: requestSyncLogCreate });

    let logs = await prisma.requestSyncLog.findMany({
      where: { request_id: request.id, sync_status: SyncStatus.NotSynced },
      select: { id: true, request_id: true, calendar_sync_setting_id: true, calendar_microsoft_user_id: true }
    });
    if (logs.length > 0) {
      await inngest.send(
        logs.map((x) => {
          return {
            // The event name
            name: 'request/create_calendar_entry',
            // The event's data
            data: {
              request_id: x.request_id,
              sync_id: x.id,
              calendar_sync_setting_id: x.calendar_sync_setting_id,
              microsoft_tenant_id: x.calendar_microsoft_user_id + ''
            }
          };
        })
      );
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

async function createRequestSyncLogEntriesForTg(
  workspace: {
    id: string;
    global_timezone: string;
    timeghost_sync_settings: {
      id: string;
      deleted: boolean;
      timeghost_workspace_id: string;
      timeghostSyncSettingDepartments: { department_id: string }[];
      timeghostSyncSettingLeaveTypes: { leave_type_id: string }[];
    }[];
  },
  details: {
    id: string;
    requester_member: {
      microsoft_tenantId: string | null;
      microsoft_user_id: string | null;
      departments: { department_id: string | null }[];
    } | null;
    leave_type: { id: string | null };
  },
  prisma: PrismaClient,
  request: { id: string }
) {
  try {
    const requestSyncLogCreate: Prisma.RequestSyncLogCreateManyInput[] = [];
    for (const timeghost_sync_setting of workspace.timeghost_sync_settings) {
      if (timeghost_sync_setting && !timeghost_sync_setting.deleted) {
        const isLeaveType = timeghost_sync_setting.timeghostSyncSettingLeaveTypes.find(
          (x) => x.leave_type_id === details.leave_type?.id
        );
        const inDepartment = details.requester_member?.departments.find((x) =>
          timeghost_sync_setting.timeghostSyncSettingDepartments.find((y) => y.department_id === x.department_id)
        );

        if (inDepartment && isLeaveType) {
          const requestFromDb = await prisma.request.findUnique({
            where: { id: request.id },
            select: {
              id: true,
              start: true,
              end: true,
              start_at: true,
              end_at: true,
              leave_unit: true,
              details: {
                select: {
                  status: true,
                  requester_member: {
                    select: { microsoft_user_id: true, timezone: true, schedules: true }
                  }
                }
              },
              workspace_id: true
            }
          });

          if (requestFromDb) {
            const requester_member = requestFromDb.details?.requester_member;
            if (requester_member?.schedules) {
              const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
                where: { workspace_id: requestFromDb.workspace_id }
              });

              if (requester_member.microsoft_user_id && workspaceSchedule && requester_member.schedules) {
                const input: BodyParams = {
                  request: requestFromDb,
                  timeEntries: [],
                  timeghost_user_id: requester_member.microsoft_user_id,
                  timeghost_workspace_id: timeghost_sync_setting.timeghost_workspace_id,
                  memberSchedules: requester_member.schedules,
                  workspaceSchedule
                };

                if (requester_member.timezone && requestFromDb.details?.status) {
                  // Set time entries to Timeghost format
                  TimeghostService.setBody(input, requester_member.timezone);

                  for (const timeEntry of input.timeEntries) {
                    requestSyncLogCreate.push({
                      workspace_id: workspace.id,
                      request_id: request.id,
                      sync_type: 'timeghost',
                      error: errorText(requestFromDb.start, requestFromDb.details.status),
                      timeghost_sync_setting_id: timeghost_sync_setting.id,
                      sync_status: SyncStatus.NotSynced,
                      timeghost_time_entry: JSON.stringify(timeEntry)
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    if (requestSyncLogCreate.length > 0) {
      const chunkSize = 1000; // Define chunk size
      const chunks = chunkArray(requestSyncLogCreate, chunkSize);

      // Process chunks
      for (const chunk of chunks) {
        try {
          await prisma.requestSyncLog.createMany({ data: chunk });
        } catch (error) {
          console.error('Error inserting chunk:', error);
          Sentry.captureException(error); // Capture error with Sentry
        }
      }

      // Fetch logs for event creation
      const logs = await prisma.requestSyncLog.findMany({
        where: {
          request_id: request.id,
          sync_status: SyncStatus.NotSynced,
          timeghost_sync_setting_id: { not: null },
          request: { details: { status: 'APPROVED' } }
        },
        select: { id: true, request_id: true, timeghost_sync_setting_id: true }
      });

      if (logs.length > 0) {
        const events = logs.map((log, index) => ({
          name: 'request/create_timeghost_time_entries' as 'request/create_timeghost_time_entries',
          data: {
            request_id: log.request_id,
            sync_log_id: log.id,
            timeghost_sync_setting_id: log.timeghost_sync_setting_id,
            for_update: false,
            first_event: index === 0
          }
        }));

        await inngest.send(events);
      }
    }
  } catch (error) {
    console.error('Error in createRequestSyncLogEntriesForTg:', error);
    Sentry.captureException(error); // Capture error with Sentry
  }
}
function calcNewRequestStatus(
  dataToSave: Partial<RequestDetail>,
  request: {
    details: {
      approval_process: ApprovalProcess;
      request_approvers: {
        status: RequestApproverStatus;
        approver_member: {
          language: string;
          id: string;
          name: string | null;
          email: string | null;
        } | null;
        approver_member_id: string | null;
        predecessor_request_member_approver_id: string | null;
        uuid: string;
      }[];
    } | null;
  },
  t: Translate,
  current_user_is_admin: boolean,
  approver_uuid: string
): RequestStatus {
  if (!request.details) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: t('internal_server_error')
    });
  }
  if (dataToSave.status == 'CANCELED') {
    return 'CANCELED';
  }
  if (request.details.approval_process == 'Parallel_one_has_to_agree' && dataToSave.status == 'APPROVED') {
    return 'APPROVED';
  }
  const sortedApprovers = sortApprovers(request.details?.request_approvers);

  const currentApprover = sortedApprovers.find((approver) => approver.uuid == approver_uuid);
  if (!currentApprover) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: t('Only_admins_or_department_manager_and_the_approver_can_change_the_status')
    });
  }
  if (dataToSave.status == undefined) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: t('status-is-required')
    });
  }
  currentApprover.status = dataToSave.status;

  if (request.details.approval_process == 'Linear_one_has_to_agree' && dataToSave.status == 'APPROVED') {
    if (currentApprover?.predecessor_request_member_approver_id == null) {
      return 'APPROVED';
    }

    if (!sortedApprovers.find((y) => y.approver_member_id == currentApprover?.predecessor_request_member_approver_id)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'No approver may be skipped in the linear process'
      });
    }
    if (
      sortedApprovers.find((y) => y.approver_member_id == currentApprover?.predecessor_request_member_approver_id)
        ?.status == 'PENDING'
    ) {
      if (!current_user_is_admin)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No approver may be skipped in the linear process'
        });
    }
    return 'APPROVED';
  }
  if (request.details.approval_process == 'Linear_all_have_to_agree' && dataToSave.status == 'APPROVED') {
    if (currentApprover?.predecessor_request_member_approver_id == null && sortedApprovers.length > 1) {
      return 'PENDING';
    }
    if (currentApprover?.predecessor_request_member_approver_id == null && sortedApprovers.length == 1) {
      return 'APPROVED';
    }
    if (!sortedApprovers.find((y) => y.approver_member_id == currentApprover?.predecessor_request_member_approver_id)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'No approver may be skipped in the linear process'
      });
    }
    if (
      sortedApprovers.find((y) => y.approver_member_id == currentApprover?.predecessor_request_member_approver_id)
        ?.status == 'PENDING'
    ) {
      if (!current_user_is_admin)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No approver may be skipped in the linear process'
        });
    }
    if (!sortedApprovers.find((y) => y.status == 'PENDING')) {
      return 'APPROVED';
    }
    return 'PENDING';
  }
  if (request.details.approval_process == 'Parallel_all_have_to_agree' && dataToSave.status == 'APPROVED') {
    if (!sortedApprovers.find((y) => y.status == 'PENDING')) {
      return 'APPROVED';
    }
    return 'PENDING';
  }
  if (request.details.approval_process == 'Linear_one_has_to_agree' && dataToSave.status == 'DECLINED') {
    if (!sortedApprovers.find((y) => y.status == 'PENDING')) {
      return 'DECLINED';
    } else 'PENDING';
  }
  if (request.details.approval_process == 'Parallel_one_has_to_agree' && dataToSave.status == 'DECLINED') {
    return 'DECLINED';
  }
  if (request.details.approval_process == 'Linear_all_have_to_agree' && dataToSave.status == 'DECLINED') {
    return 'DECLINED';
  }
  if (request.details.approval_process == 'Parallel_all_have_to_agree' && dataToSave.status == 'DECLINED') {
    return 'DECLINED';
  }

  return 'PENDING';
}
// Define a helper function to update out_of_office_message_status
async function updateOutOfOfficeStatus(requester_member_id: string, workspace_id: string) {
  const today = new Date();
  today.setDate(today.getDate());
  today.setUTCHours(0, 0, 0, 0);
  await prisma.request.updateMany({
    where: {
      workspace_id,
      requester_member_id,
      start: { lte: today },
      end: { gte: today },
      out_of_office_message_status: OutOfOfficeMessageStatus.Configured
    },
    data: { out_of_office_message_status: OutOfOfficeMessageStatus.MustBeConfigured }
  });
}
