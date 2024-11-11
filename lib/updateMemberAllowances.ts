import { EndAt, LeaveUnit, PublicHolidayDuration, StartAt, type PrismaClient } from '@prisma/client';
import { getFiscalYearStartAndEndDatesUTC, calcRequestDuration } from './requestUtilities';
import { addDays, addYears } from 'date-fns';
import { isDayUnit } from './DateHelper';

export type workspaceSelect = {
  id: string;
  fiscal_year_start_month: number;
  schedule: {
    id: string;
    workspace_id: string;
    createdAt: Date;
    updatedAt: Date;
    monday_am_start: Date;
    monday_am_end: Date;
    monday_pm_start: Date;
    monday_pm_end: Date;
    monday_am_enabled: boolean;
    monday_pm_enabled: boolean;
    monday_deduct_fullday: boolean;
    tuesday_am_start: Date;
    tuesday_am_end: Date;
    tuesday_pm_start: Date;
    tuesday_pm_end: Date;
    tuesday_am_enabled: boolean;
    tuesday_pm_enabled: boolean;
    tuesday_deduct_fullday: boolean;
    wednesday_am_start: Date;
    wednesday_am_end: Date;
    wednesday_pm_start: Date;
    wednesday_pm_end: Date;
    wednesday_am_enabled: boolean;
    wednesday_pm_enabled: boolean;
    wednesday_deduct_fullday: boolean;
    thursday_am_start: Date;
    thursday_am_end: Date;
    thursday_pm_start: Date;
    thursday_pm_end: Date;
    thursday_am_enabled: boolean;
    thursday_pm_enabled: boolean;
    thursday_deduct_fullday: boolean;
    friday_am_start: Date;
    friday_am_end: Date;
    friday_pm_start: Date;
    friday_pm_end: Date;
    friday_am_enabled: boolean;
    friday_pm_enabled: boolean;
    friday_deduct_fullday: boolean;
    saturday_am_start: Date;
    saturday_am_end: Date;
    saturday_pm_start: Date;
    saturday_pm_end: Date;
    saturday_am_enabled: boolean;
    saturday_pm_enabled: boolean;
    saturday_deduct_fullday: boolean;
    sunday_am_start: Date;
    sunday_am_end: Date;
    sunday_pm_start: Date;
    sunday_pm_end: Date;
    sunday_am_enabled: boolean;
    sunday_pm_enabled: boolean;
    sunday_deduct_fullday: boolean;
  } | null;
  member_schedules: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    from: Date | null;
    member_id: string;
    workspace_id: string;
    monday_am_start: Date;
    monday_am_end: Date;
    monday_pm_start: Date;
    monday_pm_end: Date;
    monday_am_enabled: boolean;
    monday_pm_enabled: boolean;
    monday_deduct_fullday: boolean;
    tuesday_am_start: Date;
    tuesday_am_end: Date;
    tuesday_pm_start: Date;
    tuesday_pm_end: Date;
    tuesday_am_enabled: boolean;
    tuesday_pm_enabled: boolean;
    tuesday_deduct_fullday: boolean;
    wednesday_am_start: Date;
    wednesday_am_end: Date;
    wednesday_pm_start: Date;
    wednesday_pm_end: Date;
    wednesday_am_enabled: boolean;
    wednesday_pm_enabled: boolean;
    wednesday_deduct_fullday: boolean;
    thursday_am_start: Date;
    thursday_am_end: Date;
    thursday_pm_start: Date;
    thursday_pm_end: Date;
    thursday_am_enabled: boolean;
    thursday_pm_enabled: boolean;
    thursday_deduct_fullday: boolean;
    friday_am_start: Date;
    friday_am_end: Date;
    friday_pm_start: Date;
    friday_pm_end: Date;
    friday_am_enabled: boolean;
    friday_pm_enabled: boolean;
    friday_deduct_fullday: boolean;
    saturday_am_start: Date;
    saturday_am_end: Date;
    saturday_pm_start: Date;
    saturday_pm_end: Date;
    saturday_am_enabled: boolean;
    saturday_pm_enabled: boolean;
    saturday_deduct_fullday: boolean;
    sunday_am_start: Date;
    sunday_am_end: Date;
    sunday_pm_start: Date;
    sunday_pm_end: Date;
    sunday_am_enabled: boolean;
    sunday_pm_enabled: boolean;
    sunday_deduct_fullday: boolean;
  }[];
  leave_types: {
    id: string;
    leave_unit: LeaveUnit;
    take_from_allowance: boolean;
    ignore_schedule: boolean;
    ignore_public_holidays: boolean;
    allowance_type_id: string | null;
    allowance_type: {
      ignore_allowance_limit: boolean;
      carry_forward_months_after_fiscal_year: number;
      max_carry_forward: number;
    } | null;
  }[];
  member_allowances: {
    id: string;
    member_id: string;
    year: number;
    remaining: number;
    allowance_type_id: string;
    brought_forward: number;
    compensatory_time_off: number;
    overwrite_brought_forward: boolean;
    allowance: number;
  }[];
  public_holiday_days: { date: Date; duration: PublicHolidayDuration; public_holiday_id: string }[];
  members: { id: string; public_holiday_id: string }[];
  allowance_types: {
    id: string;
    max_carry_forward: number;
    carry_forward_months_after_fiscal_year: number;
  }[];
};

async function fetchWorkspace(prisma: PrismaClient, workspace_id: string, member_id: string) {
  const w = await prisma.workspace.findUnique({
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
            select: {
              ignore_allowance_limit: true,
              carry_forward_months_after_fiscal_year: true,
              max_carry_forward: true
            }
          }
        }
      },
      allowance_types: {
        select: {
          id: true,
          max_carry_forward: true,
          carry_forward_months_after_fiscal_year: true
        }
      },
      schedule: {
        select: {
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
        }
      },
      member_schedules: {
        select: {
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
        },
        where: { member_id: member_id },
        orderBy: { from: 'desc' }
      },
      members: {
        where: { id: member_id },
        select: {
          id: true,
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
  if (!w) {
    throw new Error('Workspace not found');
  }

  let member = w.members.find((x) => x.id == member_id);
  if (!member) {
    throw new Error('Member not found');
  }
  w.public_holiday_days = w.public_holiday_days.filter((Y) => Y.public_holiday_id == member.public_holiday_id);

  return w;
}
export async function updateMemberAllowances(prisma: PrismaClient, workspace_id: string, member_id: string) {
  await generateMissingAllowances(prisma, workspace_id, member_id);

  // Fetch workspace data
  const workspace = await fetchWorkspace(prisma, workspace_id, member_id);
  if (!workspace) throw new Error('Workspace not found');
  if (!workspace.members[0]) throw new Error('Member not found');

  // Fetch requests
  const requests = await prisma.request.findMany({
    where: {
      workspace_id: workspace_id,
      requester_member_id: member_id,
      details: {
        AND: [{ NOT: { status: 'CANCELED' } }, { NOT: { status: 'DECLINED' } }]
      }
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
          id: true,
          public_holiday_id: true
        }
      }
    },
    orderBy: { start: 'asc' }
  });

  // Calculate member allowances
  const updatedMemberAllowances = calculateMemberAllowances(workspace, member_id, requests);

  // Save updated allowances to the database as a Prisma transaction
  await prisma.$transaction(
    updatedMemberAllowances.map((memberAllowance) =>
      prisma.memberAllowance.update({
        where: { id: memberAllowance.id },
        data: {
          overwrite_brought_forward: memberAllowance.overwrite_brought_forward,
          taken: memberAllowance.taken,
          remaining: memberAllowance.remaining,
          brought_forward: memberAllowance.brought_forward,
          expiration: memberAllowance.expiration,
          leave_types_stats: memberAllowance.leave_types_stats,
          start: memberAllowance.start,
          end: memberAllowance.end
        },
        select: { id: true }
      })
    )
  );
}

// Calculation function
export function hasEnoughAllowanceForRequest(
  workspace: workspaceSelect,
  member_id: string,
  leaveType: {
    id: string;
    leave_unit: LeaveUnit;
    allowance_type_id: string | null;
    allowance_type: {
      ignore_allowance_limit: boolean;
    } | null;
  },
  requests: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
    leave_unit: LeaveUnit;
    details: { leave_type_id: string } | null;
  }[],
  new_request: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
  }
) {
  if (leaveType.allowance_type && leaveType.allowance_type.ignore_allowance_limit) return true;

  // Add the new request to the list
  requests.push({
    start: new_request.start,
    end: new_request.end,
    start_at: new_request.start_at,
    end_at: new_request.end_at,
    leave_unit: leaveType.leave_unit,
    details: { leave_type_id: leaveType.id }
  });

  // Perform the calculation
  const updatedMemberAllowances = calculateMemberAllowances(workspace, member_id, requests);
  const lowAllowance = updatedMemberAllowances
    .filter((y) => y.allowance_type_id == leaveType.allowance_type_id)
    .find((y) => y.remaining < 0);
  return lowAllowance ? false : true;
}

export async function isAllowanceSufficient(
  prisma: PrismaClient,
  workspace_id: string,
  new_request: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
    leave_type_id: string;
    requester_member_id: string;
  }
) {
  await generateMissingAllowances(prisma, workspace_id, new_request.requester_member_id);

  // Fetch data
  const workspace = await fetchWorkspace(prisma, workspace_id, new_request.requester_member_id);
  if (!workspace) throw new Error('Workspace not found');

  // Extract leaveType and member
  const leaveType = workspace.leave_types.find((x) => x.id == new_request.leave_type_id);
  if (!leaveType) throw new Error('Leave type not found');

  const member = workspace.members.find((x) => x.id == new_request.requester_member_id);
  if (!member) throw new Error('Member not found');

  const requests = await prisma.request.findMany({
    where: {
      workspace_id: workspace_id,
      requester_member_id: new_request.requester_member_id,
      details: {
        AND: [{ NOT: { status: 'CANCELED' } }, { NOT: { status: 'DECLINED' } }]
      }
    },
    select: {
      details: {
        select: {
          leave_type_id: true
        }
      },
      start: true,
      end: true,
      start_at: true,
      end_at: true,
      leave_unit: true,
      requester_member_id: true,
      requester_member: {
        select: {
          id: true,
          public_holiday_id: true
        }
      }
    },
    orderBy: { start: 'asc' }
  });

  // Perform calculation
  return hasEnoughAllowanceForRequest(workspace, new_request.requester_member_id, leaveType, requests, new_request);
}

// Function to calculate allowances without saving
export function calculateMemberAllowances(
  workspace: workspaceSelect,
  requester_member_id: string,
  requests: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
    leave_unit: LeaveUnit;
    details: { leave_type_id: string } | null;
  }[]
) {
  const leaveTypeStats: {
    year: number;
    leave_type_id: string;
    value: number;
    carry_forward_period_duration: number;
    take_from_allowance: boolean;
    allowance_type_id: string | null;
  }[] = [];

  for (const request of requests) {
    if (!request?.details || !workspace.schedule) continue;

    const leave_type = workspace.leave_types.find((lt: any) => lt.id === request.details?.leave_type_id);
    if (!leave_type) continue;

    const durationData = calcRequestDuration({
      start: request.start,
      end: request.end,
      start_at: request.start_at,
      end_at: request.end_at,
      workspace: workspace,
      requester_member_id: requester_member_id,
      leaveType: leave_type,
      memberSchedules: workspace.member_schedules,
      memberPublicHolidayDays: workspace.public_holiday_days,
      workspaceSchedule: workspace.schedule
    });
    if (!durationData) continue;

    for (const yearData of durationData.per_year) {
      if (!yearData) continue;

      let duration = yearData.workday_duration_in_minutes;
      let carryForwardDuration = yearData.carry_over_minutes_used_in_period;
      if (isDayUnit(request.leave_unit)) {
        duration = yearData.workday_duration_in_days;
        carryForwardDuration = yearData.carry_over_days_used_in_period;
      }

      const leaveTypeStat = leaveTypeStats.find(
        (x) => x.year === yearData.fiscal_year && x.leave_type_id === leave_type.id
      );

      if (leaveTypeStat) {
        leaveTypeStat.value += duration;
        leaveTypeStat.carry_forward_period_duration += carryForwardDuration;
      } else {
        leaveTypeStats.push({
          leave_type_id: leave_type.id,
          value: duration,
          year: yearData.fiscal_year,
          take_from_allowance: leave_type.take_from_allowance,
          allowance_type_id: leave_type.allowance_type_id,
          carry_forward_period_duration: carryForwardDuration
        });
      }
    }
  }

  const allowanceTypes = Array.from(new Set(workspace.member_allowances.map((ma: any) => ma.allowance_type_id)));

  const updatedMemberAllowances = [];

  for (const allowance_type_id of allowanceTypes) {
    if (!allowance_type_id) continue;

    const member_allowances = workspace.member_allowances.filter((ma) => ma.allowance_type_id === allowance_type_id);
    if (member_allowances.length === 0) continue;
    if (!member_allowances[0]) continue;
    let last_remaining = 0;
    for (const member_allowance of member_allowances) {
      const leaveTypeStatsByYear = leaveTypeStats.filter(
        (x) =>
          x.year === member_allowance.year &&
          (x.allowance_type_id == null || x.allowance_type_id === member_allowance.allowance_type_id)
      );
      if (!leaveTypeStatsByYear) continue;
      const take_from_allowanceSum = leaveTypeStatsByYear.reduce(
        (acc, x) => acc + (x.take_from_allowance ? x.value : 0),
        0
      );
      const carry_forward_period_duration_sum = leaveTypeStatsByYear.reduce(
        (acc, x) => acc + x.carry_forward_period_duration,
        0
      );

      const stats: Record<string, { amount: number }> = {};
      for (const stat of leaveTypeStatsByYear) {
        if (!stats[stat.leave_type_id]) {
          stats[stat.leave_type_id] = { amount: 0 };
        }
        let x = stats[stat.leave_type_id];
        if (!x) continue;
        x.amount += stat.value;
      }
      const allowance_type = workspace.allowance_types.find((lt) => lt.id === member_allowance.allowance_type_id);
      const max_carry_forward = allowance_type?.max_carry_forward ?? 0;
      let brought_forward = max_carry_forward <= last_remaining ? max_carry_forward : last_remaining;
      if (allowance_type && allowance_type.carry_forward_months_after_fiscal_year > 0) {
        // Carryover period exists
        const total_allowed = max_carry_forward + carry_forward_period_duration_sum;
        if (last_remaining <= total_allowed) {
          //All remaining vacation can be used
          brought_forward = last_remaining;
        } else {
          //Days expire
          brought_forward = total_allowed;
        }
      } else {
        // No carryover period
        brought_forward = Math.min(last_remaining, max_carry_forward);
      }

      if (member_allowances[0].year === member_allowance.year) {
        brought_forward = member_allowances[0].brought_forward;
      }
      if (member_allowance.overwrite_brought_forward) {
        if (member_allowance.brought_forward === brought_forward) {
          member_allowance.overwrite_brought_forward = false;
        } else {
          brought_forward = member_allowance.brought_forward;
        }
      }
      let expiration = last_remaining - brought_forward;
      if (expiration < 0) expiration = 0;

      const remaining =
        member_allowance.allowance + brought_forward + member_allowance.compensatory_time_off - take_from_allowanceSum;
      last_remaining = remaining;

      updatedMemberAllowances.push({
        id: member_allowance.id,
        overwrite_brought_forward: member_allowance.overwrite_brought_forward,
        taken: take_from_allowanceSum,
        remaining: remaining,
        brought_forward: brought_forward,
        expiration,
        leave_types_stats: stats,
        start: new Date(Date.UTC(member_allowance.year, workspace.fiscal_year_start_month, 1)),
        end: addDays(addYears(new Date(Date.UTC(member_allowance.year, workspace.fiscal_year_start_month, 1)), 1), -1),
        allowance_type_id: member_allowance.allowance_type_id
      });
    }
  }

  return updatedMemberAllowances;
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
  const workspace = await fetchWorkspace(prisma, workspace_id, member_id);
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
                select: {
                  ignore_allowance_limit: true,
                  carry_forward_months_after_fiscal_year: true,
                  max_carry_forward: true
                }
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
          id: true,
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
