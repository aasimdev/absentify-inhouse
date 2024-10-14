import { type PrismaClient } from '@prisma/client';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { getFiscalYearStartAndEndDatesUTC, calcRequestDuration } from './requestUtilities';
import { addDays, addYears } from 'date-fns';
import { isDayUnit } from './DateHelper';

export async function updateMemberAllowances(prisma: PrismaClient, workspace_id: string, member_id: string) {
  await generateMissingAllowances(prisma, workspace_id, member_id);
  let workspace = await prisma.workspace.findUnique({
    where: { id: workspace_id },
    select: {
      id: true,
      fiscal_year_start_month: true,
      leave_types: {
        select: {
          id: true,
          take_from_allowance: true,
          allowance_type_id: true,
          leave_unit: true,
          ignore_schedule: true,
          ignore_public_holidays: true,
          allowance_type: {
            select: { ignore_allowance_limit: true }
          }
        }
      },
      allowance_types: { select: { id: true, max_carry_forward: true, carry_forward_deadline: true } },
      schedule: { select: defaultWorkspaceScheduleSelect },
      member_schedules: {
        select: defaultMemberScheduleSelect,
        where: { member_id: member_id },
        orderBy: { from: 'desc' }
      },
      members: {
        where: { id: member_id },
        select: {
          public_holiday_id: true
        }
      },
      member_allowances: {
        select: {
          id: true,
          member_id: true,
          year: true,
          allowance: true,
          brought_forward: true,
          overwrite_brought_forward: true,
          taken: true,
          remaining: true,
          compensatory_time_off: true,
          allowance_type_id: true
        },
        where: { member_id: member_id },
        orderBy: [{ allowance_type_id: 'asc' }, { year: 'asc' }]
      },
      public_holiday_days: {
        select: {
          id: true,
          date: true,
          duration: true,
          public_holiday_id: true
        },
        orderBy: { date: 'asc' }
      }
    }
  });
  if (!workspace) throw new Error('workspace not found');
  if (!workspace.members[0]) throw new Error('member not found');

  const requests = await prisma.request.findMany({
    where: {
      workspace_id: workspace_id,
      requester_member_id: member_id,
      details: { AND: [{ NOT: { status: 'CANCELED' } }, { NOT: { status: 'DECLINED' } }] }
    },
    select: {
      details: {
        select: {
          id: true,
          leave_type_id: true,
          workday_absence_duration: true
        }
      },
      id: true,
      start: true,
      end: true,
      start_at: true,
      end_at: true,
      leave_unit: true,
      requester_member_id: true,
      requester_member: {
        select: {
          public_holiday_id: true
        }
      }
    },
    orderBy: { start: 'asc' }
  });

  const leaveTypeStats: {
    year: number;
    leave_type_id: string;
    value: number;
    take_from_allowance: boolean;
    allowance_type_id: string | null;
  }[] = [];

  const member_schedules = workspace.member_schedules.filter((ms) => ms.member_id === member_id);
  const member_public_holiday_days = workspace.public_holiday_days.filter(
    (ph) => ph.public_holiday_id === workspace.members[0]?.public_holiday_id
  );

  for (let i1 = 0; i1 < requests.length; i1++) {
    const request = requests[i1];
    if (!request) continue;
    if (!request.details) continue;
    if (!workspace.schedule) continue;
    const leave_type = workspace.leave_types.find((lt) => lt.id === request.details?.leave_type_id);
    if (!leave_type) continue;

    const d = calcRequestDuration({
      start: request.start,
      end: request.end,
      start_at: request.start_at,
      end_at: request.end_at,
      workspaceSchedule: workspace.schedule,
      memberSchedules: member_schedules,
      memberPublicHolidayDays: member_public_holiday_days,
      leaveType: leave_type,
      memberAllowances: workspace.member_allowances,
      workspace: workspace,
      requester_member_id: request.requester_member_id
    });

    for (let iii = 0; iii < d.per_year.length; iii++) {
      const y = d.per_year[iii];
      if (!y) continue;

      let duration = y.workday_duration_in_minutes;
      if (isDayUnit(request.leave_unit)) {
        duration = y.workday_duration_in_days;
      }

      const leaveTypeStat = leaveTypeStats.find((x) => x.year === y.fiscal_year && x.leave_type_id === leave_type.id);

      if (leaveTypeStat) {
        leaveTypeStat.value += duration;
      } else {
        leaveTypeStats.push({
          leave_type_id: leave_type.id,
          value: duration,
          year: y.fiscal_year,
          take_from_allowance: leave_type.take_from_allowance,
          allowance_type_id: leave_type.allowance_type_id
        });
      }
    }
  }

  const allowance_types: string[] = [];
  for (let i = 0; i < workspace.member_allowances.length; i++) {
    const member_allowance = workspace.member_allowances[i];
    if (!member_allowance) continue;
    if (allowance_types.find((x) => x == member_allowance.allowance_type_id)) continue;
    allowance_types.push(member_allowance.allowance_type_id);
  }

  for (let i77 = 0; i77 < allowance_types.length; i77++) {
    const allowance_type_id = allowance_types[i77];
    if (!allowance_type_id) continue;
    const member_allowances = workspace.member_allowances.filter((ma) => ma.allowance_type_id === allowance_type_id);
    if (member_allowances.length == 0) continue;
    if (!member_allowances[0]) continue;
    let last_remaining = 0;
    for (let i88 = 0; i88 < member_allowances.length; i88++) {
      const member_allowance = member_allowances[i88];
      if (!member_allowance) continue;
      const leaveTypeStatsByYear = leaveTypeStats.filter(
        (x) =>
          x.year === member_allowance.year &&
          (x.allowance_type_id == null || x.allowance_type_id == member_allowance.allowance_type_id)
      );
      if (!leaveTypeStatsByYear) continue;
      const take_from_allowanceSum = leaveTypeStatsByYear.reduce(
        (acc, x) => acc + (x.take_from_allowance ? x.value : 0),
        0
      );
      let stats: any = {};
      for (let iiiiii = 0; iiiiii < leaveTypeStatsByYear.length; iiiiii++) {
        const element = leaveTypeStatsByYear[iiiiii];
        if (!element) continue;
        if (!stats[element.leave_type_id]) {
          stats[element.leave_type_id] = {
            amount: 0
          };
        }
        stats[element.leave_type_id].amount += element.value;
      }
      const allowance_type = workspace.allowance_types.find((lt) => lt.id === member_allowance.allowance_type_id);
      const max_carry_forward = allowance_type?.max_carry_forward ?? 0;
      let brought_forward = max_carry_forward <= last_remaining ? max_carry_forward : last_remaining;
      /* 
      if (allowance_type?.carry_forward_deadline) {
        const carry_forward_deadline = new Date(allowance_type.carry_forward_deadline);
        carry_forward_deadline.setFullYear(member_allowance.year);
      
      
      } */

      let expiration = max_carry_forward <= last_remaining ? last_remaining - max_carry_forward : 0;
      if (member_allowances[0].year == member_allowance.year) {
        brought_forward = member_allowances[0].brought_forward;
      }
      if (member_allowance.overwrite_brought_forward) {
        if (member_allowance.brought_forward == brought_forward) {
          member_allowance.overwrite_brought_forward = false;
        } else {
          brought_forward = member_allowance.brought_forward;
        }
      }
      const remaining =
        member_allowance.allowance + brought_forward + member_allowance.compensatory_time_off - take_from_allowanceSum;
      last_remaining = remaining;
      await prisma.memberAllowance.update({
        where: { id: member_allowance.id },
        data: {
          overwrite_brought_forward: member_allowance.overwrite_brought_forward,
          taken: take_from_allowanceSum,
          remaining: remaining,
          brought_forward: brought_forward,
          expiration,
          leave_types_stats: stats,
          start: new Date(Date.UTC(member_allowance.year, workspace.fiscal_year_start_month, 1)),
          end: addDays(addYears(new Date(Date.UTC(member_allowance.year, workspace.fiscal_year_start_month, 1)), 1), -1)
        },
        select: { id: true }
      });
    }
  }
}

export async function generateMissingAllowances(prisma: PrismaClient, workspace_id: string, member_id: string) {
  const [
    workspace,
    a1,
    allWorksapce_allowance_types,
    member_allowances,
    first_workspace_request,
    last_worspace_request
  ] = await prisma.$transaction([
    prisma.workspace.findUnique({
      where: { id: workspace_id },
      select: {
        fiscal_year_start_month: true,
        allowance_types: { select: { id: true, max_carry_forward: true } }
      }
    }),

    prisma.memberAllowance.findFirst({
      where: {
        workspace_id: workspace_id
      },
      orderBy: {
        year: 'asc'
      },
      select: {
        year: true
      }
    }),
    prisma.allowanceType.findMany({
      where: {
        workspace_id: workspace_id
      },
      select: {
        id: true
      }
    }),
    prisma.memberAllowance.findMany({
      where: {
        workspace_id: workspace_id,
        member_id: member_id
      },
      orderBy: {
        year: 'asc'
      },
      select: {
        id: true,
        member_id: true,
        year: true,
        allowance: true,
        brought_forward: true,
        taken: true,
        remaining: true,
        compensatory_time_off: true,
        allowance_type_id: true,
        overwrite_brought_forward: true
      }
    }),
    prisma.request.findFirst({
      where: {
        workspace_id: workspace_id
      },
      orderBy: {
        start: 'asc'
      },
      select: {
        year: true
      }
    }),
    prisma.request.findFirst({
      where: {
        workspace_id: workspace_id
      },
      orderBy: {
        end: 'desc'
      },
      select: {
        year: true
      }
    })
  ]);
  if (!workspace) throw new Error('workspace not found');

  let oldestYear = a1 ? a1.year : new Date().getFullYear();

  if (first_workspace_request?.year && first_workspace_request.year < oldestYear) {
    oldestYear = first_workspace_request.year;
  }
  if (new Date(oldestYear, workspace.fiscal_year_start_month, 1) > new Date()) {
    oldestYear = oldestYear - 1;
  }
  let newestYear = new Date().getFullYear() + 1;
  if (last_worspace_request?.year && last_worspace_request.year > newestYear) {
    newestYear = last_worspace_request.year;
  }
  for (let index = 0; index < allWorksapce_allowance_types.length; index++) {
    const allowance_type = allWorksapce_allowance_types[index];
    if (!allowance_type) continue;

    const all_member_allowance = member_allowances.filter((ma) => ma.allowance_type_id === allowance_type.id);

    if (
      all_member_allowance[0] &&
      all_member_allowance[0].brought_forward > 0 &&
      !all_member_allowance[0].overwrite_brought_forward
    ) {
      await prisma.memberAllowance.update({
        where: { id: all_member_allowance[0].id },
        data: {
          overwrite_brought_forward: true
        },
        select: { id: true }
      });
    }

    const sortedAllowances = member_allowances
      .filter((ma) => ma.allowance_type_id === allowance_type.id)
      .sort((a, b) => a.year - b.year);

    const firstExistingYear =
      sortedAllowances.length > 0 ? (sortedAllowances[0] ? sortedAllowances[0].year : newestYear + 1) : newestYear + 1;

    for (let year = oldestYear; year <= newestYear; year++) {
      const existingAllowance = sortedAllowances.find((ma) => ma.year === year);

      if (!existingAllowance) {
        const fiscalDates = getFiscalYearStartAndEndDatesUTC(workspace.fiscal_year_start_month, year);

        let newAllowance;
        if (year < firstExistingYear) {
          // Für Jahre vor dem ersten existierenden Eintrag setzen wir alles auf 0
          newAllowance = {
            allowance: 0,
            brought_forward: 0,
            compensatory_time_off: 0,
            taken: 0,
            remaining: 0
          };
        } else {
          // Für Jahre nach dem ersten existierenden Eintrag übernehmen wir die Werte vom Vorjahr
          const previousYear = sortedAllowances.find((ma) => ma.year === year - 1);
          const max_carry_forward =
            workspace.allowance_types.find((at) => at.id === allowance_type.id)?.max_carry_forward ?? 0;
          const brought_forward = previousYear ? Math.min(previousYear.remaining, max_carry_forward) : 0;

          newAllowance = {
            allowance: previousYear ? previousYear.allowance : 0,
            brought_forward,
            compensatory_time_off: 0,
            taken: 0,
            remaining: (previousYear ? previousYear.allowance : 0) + brought_forward
          };
        }

        await prisma.memberAllowance.create({
          data: {
            ...newAllowance,
            year,
            member_id,
            workspace_id: workspace_id,
            leave_types_stats: {},
            start: fiscalDates.firstDayOfYear,
            end: fiscalDates.lastDayOfYear,
            allowance_type_id: allowance_type.id
          },
          select: {
            id: true,
            member_id: true,
            year: true,
            allowance: true,
            brought_forward: true,
            taken: true,
            remaining: true,
            compensatory_time_off: true,
            allowance_type_id: true,
            overwrite_brought_forward: true
          }
        });
      }
    }
  }
  return await prisma.memberAllowance.findMany({
    where: {
      workspace_id: workspace_id,
      member_id: member_id
    },
    orderBy: {
      year: 'asc'
    },
    select: {
      id: true,
      member_id: true,
      year: true,
      allowance: true,
      brought_forward: true,
      taken: true,
      remaining: true,
      compensatory_time_off: true,
      allowance_type_id: true
    }
  });
}

export async function updateMemberRequestDetailsDurations(
  prisma: PrismaClient,
  workspace_id: string,
  member_id: string
) {
  let workspace = await prisma.workspace.findUnique({
    where: { id: workspace_id },
    select: {
      id: true,
      fiscal_year_start_month: true,
      leave_types: {
        select: {
          id: true,
          take_from_allowance: true,
          allowance_type_id: true
        }
      },
      members: { select: { public_holiday_id: true }, where: { id: member_id } },
      allowance_types: { select: { id: true, max_carry_forward: true } },
      schedule: { select: defaultWorkspaceScheduleSelect },
      member_schedules: {
        select: defaultMemberScheduleSelect,
        where: {
          member_id: member_id
        },
        orderBy: { from: 'desc' }
      },
      member_allowances: {
        select: {
          id: true,
          member_id: true,
          year: true,
          allowance: true,
          brought_forward: true,
          overwrite_brought_forward: true,
          taken: true,
          remaining: true,
          compensatory_time_off: true,
          allowance_type_id: true
        },
        where: {
          member_id: member_id
        },
        orderBy: { year: 'asc' }
      },
      public_holiday_days: {
        select: {
          id: true,
          date: true,
          duration: true,
          public_holiday_id: true
        },
        orderBy: { date: 'asc' }
      }
    }
  });
  if (!workspace) return;

  let requests = await prisma.request.findMany({
    where: {
      workspace_id: workspace_id,
      requester_member_id: member_id
    },
    select: {
      details: {
        select: {
          id: true,
          leave_type_id: true,
          workday_absence_duration: true,
          duration: true,
          leave_type: {
            select: {
              leave_unit: true,
              take_from_allowance: true,
              ignore_schedule: true,
              ignore_public_holidays: true,
              allowance_type_id: true,
              allowance_type: {
                select: { ignore_allowance_limit: true }
              }
            }
          }
        }
      },
      id: true,
      start: true,
      end: true,
      start_at: true,
      end_at: true,
      leave_unit: true,
      requester_member_id: true,
      requester_member: {
        select: {
          public_holiday_id: true
        }
      }
    },
    orderBy: { start: 'asc' }
  });

  let updateRequestBatches = [];

  for (let i3 = 0; i3 < requests.length; i3++) {
    const request = requests[i3];
    if (!request) continue;
    if (!request.details) continue;
    if (!workspace.schedule) continue;

    let member_schedules = workspace.member_schedules.filter((ms) => ms.member_id === request.requester_member_id);
    if (!member_schedules) continue;
    const d = calcRequestDuration({
      start: request.start,
      end: request.end,
      start_at: request.start_at,
      end_at: request.end_at,
      workspaceSchedule: workspace.schedule,
      memberSchedules: member_schedules,
      memberPublicHolidayDays: workspace.public_holiday_days.filter(
        (x) => x.public_holiday_id == workspace.members[0]?.public_holiday_id
      ),
      leaveType: request.details.leave_type,
      memberAllowances: workspace.member_allowances.filter((ma) => ma.member_id === request.requester_member_id),
      workspace: workspace,
      requester_member_id: request.requester_member_id
    });
    let workday_absence_duration = d.total.workday_duration_in_minutes;
    if (isDayUnit(request.leave_unit)) {
      workday_absence_duration = d.total.workday_duration_in_days;
    }

    if (
      workday_absence_duration != request.details.workday_absence_duration ||
      request.details.duration != d.total.duration
    ) {
      updateRequestBatches.push(
        prisma.requestDetail.update({
          where: { id: request.details.id },
          data: { workday_absence_duration: workday_absence_duration, duration: d.total.duration },
          select: { id: true }
        })
      );
    }
  }

  const MAX_BATCH_SIZE = 50;
  for (let i = 0; i < updateRequestBatches.length; i += MAX_BATCH_SIZE) {
    const batch = updateRequestBatches.slice(i, i + MAX_BATCH_SIZE);
    await prisma.$transaction(batch);
  }
}
