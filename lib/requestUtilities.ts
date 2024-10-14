import {
  EndAt,
  StartAt,
  type DepartmentManagerType,
  type MemberSchedule,
  type WorkspaceSchedule,
  LeaveUnit,
  Prisma,
  type PublicHolidayDuration
} from '@prisma/client';
import { type RouterOutputs } from '~/utils/api';
import { dateFromDatabaseIgnoreTimezone, dateToIsoDate, getDates, isDayUnit, isHourUnit } from './DateHelper';
import { areIntervalsOverlapping, differenceInMinutes } from 'date-fns';
import { cloneDeep } from 'lodash';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { defaultWorkspaceScheduleSelectOutput } from '~/server/api/routers/workspace_schedule';
export const requestSyncLog_select = Prisma.validator<Prisma.RequestSyncLogSelect>()({
  id: true,
  email: true,
  sync_type: true,
  request_id: true,
  calendar_id: true,
  calendar_event_id: true,
  calendar_sync_setting_id: true,
  calendar_microsoft_tenant_id: true,
  calendar_microsoft_user_id: true,
  calendar_sync_setting: {
    select: {
      id: true,
      calendar_microsoft_user_id: true,
      calendar_microsoft_tenant_id: true,
      email: true,
      calendar_id: true,
      calendar_sync_type: true,
      calendarSyncSettingLeaveTypes: {
        select: { leave_type_id: true, sync_as_name: true }
      }
    }
  }
});

export type requestSyncLog_selectOutput = Prisma.RequestSyncLogGetPayload<{
  select: typeof requestSyncLog_select;
}>;

export function calcRequestDuration(input: {
  start: Date;
  end: Date;
  start_at?: StartAt;
  end_at?: EndAt;
  requester_member_id: string;
  workspaceSchedule: WorkspaceSchedule;
  memberSchedules: MemberSchedule[];
  memberAllowances: { year: number; remaining: number; allowance_type_id: string; brought_forward: number }[];
  memberPublicHolidayDays: { date: Date; duration: PublicHolidayDuration }[];
  leaveType: {
    leave_unit: LeaveUnit;
    take_from_allowance: boolean;
    ignore_schedule: boolean;
    ignore_public_holidays: boolean;
    allowance_type_id: string | null;
    allowance_type: {
      ignore_allowance_limit: boolean;
    } | null;
  };
  workspace: { id: string; fiscal_year_start_month: number };
}) {
  const memberAllowances = cloneDeep(input.memberAllowances);
  const splitDurationsByFiscalYearResult = splitDurationByFiscalYear(
    {
      end: input.end,
      start: input.start,
      end_at: input.end_at,
      start_at: input.start_at
    },
    input.workspace
  );

  const years: {
    fiscal_year: number;
    workday_duration_in_days: number;
    workday_duration_in_minutes: number;
    allowanceEnough: boolean;
    outside_of_schedule: boolean;
    duration: number;
  }[] = [];
  for (let index = 0; index < splitDurationsByFiscalYearResult.length; index++) {
    const duration = splitDurationsByFiscalYearResult[index];
    if (!duration) continue;

    let dur = calcRequestDurationPerFiscalYear({
      start: duration.start,
      end: duration.end,
      start_at: duration.start_at,
      end_at: duration.end_at,
      workspaceSchedule: input.workspaceSchedule,
      memberSchedules: input.memberSchedules,
      memberPublicHolidayDays: input.memberPublicHolidayDays,
      leaveType: input.leaveType
    });
    let yearData = years.find((x) => x.fiscal_year == duration.fiscalYear);
    if (yearData) {
      yearData.workday_duration_in_days = (yearData.workday_duration_in_days || 0) + dur.workday_days;
      yearData.workday_duration_in_minutes = (yearData.workday_duration_in_minutes || 0) + dur.workday_minutes;
    } else {
      years.push({
        fiscal_year: duration.fiscalYear,
        workday_duration_in_days: dur.workday_days,
        workday_duration_in_minutes: dur.workday_minutes,
        allowanceEnough: true,
        outside_of_schedule: dur.outSideOfSchedule,
        duration: dur.duration
      });
    }
  }
  //check if allowance is enough
  for (let i = 0; i < years.length; i++) {
    const entry = years[i];
    if (!entry) continue;

    let member_allowance = memberAllowances.find(
      (x) => x.year == entry.fiscal_year && input.leaveType.allowance_type_id == x.allowance_type_id
    );
    let member_allowance_next_year = memberAllowances.find(
      (x) => x.year == entry.fiscal_year + 1 && input.leaveType.allowance_type_id == x.allowance_type_id
    );
    let allowanceEnough = true;

    if (input.leaveType.allowance_type?.ignore_allowance_limit) {
      allowanceEnough = true;
    } else if (
      input.leaveType.take_from_allowance &&
      isDayUnit(input.leaveType.leave_unit) &&
      member_allowance &&
      member_allowance.remaining < entry.workday_duration_in_days
    ) {
      allowanceEnough = false;
    } else if (
      input.leaveType.take_from_allowance &&
      isHourUnit(input.leaveType.leave_unit) &&
      member_allowance &&
      member_allowance.remaining < entry.workday_duration_in_minutes
    ) {
      allowanceEnough = false;
    }
    if (member_allowance && member_allowance_next_year && member_allowance_next_year.brought_forward > 0) {
      const old_brought_forward_value = member_allowance_next_year.brought_forward + 0;
      member_allowance_next_year.brought_forward =
        member_allowance.remaining - entry.workday_duration_in_days <= 0
          ? 0
          : member_allowance.remaining - entry.workday_duration_in_days;
      if (old_brought_forward_value != member_allowance_next_year.brought_forward) {
        member_allowance_next_year.remaining = member_allowance_next_year.remaining - old_brought_forward_value;
      }
    }

    entry.allowanceEnough = allowanceEnough;
  }

  return {
    per_year: years,
    total: {
      workday_duration_in_days: years.reduce((prev, curr) => prev + curr.workday_duration_in_days, 0),
      workday_duration_in_minutes: years.reduce((prev, curr) => prev + curr.workday_duration_in_minutes, 0),
      allowanceEnough: years.every((x) => x.allowanceEnough),
      outside_of_schedule: years.some((x) => x.outside_of_schedule),
      duration: years.reduce((prev, curr) => prev + curr.duration, 0)
    }
  };
}
//must be internal function
function calcRequestDurationPerFiscalYear(input: {
  start: Date;
  end: Date;
  start_at?: StartAt;
  end_at?: EndAt;
  workspaceSchedule: WorkspaceSchedule;
  memberSchedules: MemberSchedule[];
  memberPublicHolidayDays: { date: Date; duration: PublicHolidayDuration }[];
  leaveType: {
    leave_unit: LeaveUnit;
    take_from_allowance: boolean;
    ignore_schedule: boolean;
    ignore_public_holidays: boolean;
    allowance_type_id: string | null;
    allowance_type: {
      ignore_allowance_limit: boolean;
    } | null;
  };
}) {
  const dates = getDates(input.start, input.end);
  //get minutes to work on date
  let minutesToWork = 0;
  let daysToWork = 0;
  let outSideOfSchedule = false;
  for (let index = 0; index < dates.length; index++) {
    let date = dates[index];
    if (!date) continue;
    const schedule = findscheduleOnDate(date, input.workspaceSchedule, input.memberSchedules);
    if (!schedule) continue;
    const workOnSchedule = getMinutesToWorkAtMorningAndAfternoonOnSchedule(
      date,
      schedule,
      input.leaveType.ignore_schedule
    );
    setStartAtAndEndAtIfUndefinied(index, workOnSchedule);
    //if date is public holiday add no minutes to work
    let { addAfternoon, addMorning } = checkPublicHoliday(date, input.leaveType.ignore_public_holidays);

    if (input.leaveType.ignore_schedule) {
      workOnSchedule.morning.work = true;
      workOnSchedule.afternoon.work = true;
    }

    workOnSchedule.morning.work = workOnSchedule.morning.work && addMorning;
    workOnSchedule.afternoon.work = workOnSchedule.afternoon.work && addAfternoon;

    const deductFulldaym = deductFullday(date, schedule);

    // On the first day only add afternoon, if started in the afternoon
    if (index === 0 && input.start_at === 'afternoon' && workOnSchedule.afternoon.work) {
      if (isHourUnit(input.leaveType.leave_unit)) {
        if (input.start > workOnSchedule.afternoon.end || input.end < workOnSchedule.afternoon.start) {
          minutesToWork += 0;
          outSideOfSchedule = true;
        } else {
          const diff = differenceInMinutes(
            input.end > workOnSchedule.afternoon.end ? workOnSchedule.afternoon.end : input.end,
            input.start < workOnSchedule.afternoon.start ? workOnSchedule.afternoon.start : input.start
          );
          minutesToWork += diff < 0 ? 0 : diff;
        }
      } else {
        minutesToWork += workOnSchedule.afternoon.diffInMinutes;
      }
      daysToWork += 0.5;
      if (deductFulldaym) {
        daysToWork += 0.5;
      }

      // On the first day only add morning if started in the morning and ends at lunchtime
    } else if (
      index === 0 &&
      dates.length === 1 &&
      input.start_at === 'morning' &&
      input.end_at === 'lunchtime' &&
      workOnSchedule.morning.work
    ) {
      if (isHourUnit(input.leaveType.leave_unit)) {
        if (input.end < workOnSchedule.morning.start || input.start > workOnSchedule.morning.end) {
          minutesToWork += 0;
          outSideOfSchedule = true;
        } else {
          const diff = differenceInMinutes(
            input.end > workOnSchedule.morning.end ? workOnSchedule.morning.end : input.end,
            input.start < workOnSchedule.morning.start ? workOnSchedule.morning.start : input.start
          );
          minutesToWork += diff < 0 ? 0 : diff;
        }
      } else {
        minutesToWork += workOnSchedule.morning.diffInMinutes;
      }

      daysToWork += 0.5;
      if (deductFulldaym) {
        daysToWork += 0.5;
      }
      // On the last day only add morning, if ends at lunchtime
    } else if (index === dates.length - 1 && input.end_at === 'lunchtime') {
      if (workOnSchedule.morning.work) {
        if (isHourUnit(input.leaveType.leave_unit)) {
          const diff = differenceInMinutes(
            input.end > workOnSchedule.morning.end ? workOnSchedule.morning.end : input.end,
            workOnSchedule.morning.start
          );
          minutesToWork += diff < 0 ? 0 : diff;
        } else {
          minutesToWork += workOnSchedule.morning.diffInMinutes;
        }
        daysToWork += 0.5;
        if (deductFulldaym) {
          daysToWork += 0.5;
        }
      }
    }
    // Add both morning and afternoon on all other days
    else {
      if (workOnSchedule.morning.work) {
        if (isHourUnit(input.leaveType.leave_unit) && index === 0) {
          if (input.end < workOnSchedule.morning.start || input.start > workOnSchedule.morning.end) {
            minutesToWork += 0;
            outSideOfSchedule = true;
          } else {
            const diff = differenceInMinutes(
              workOnSchedule.morning.end,
              input.start < workOnSchedule.morning.start ? workOnSchedule.morning.start : input.start
            );
            minutesToWork += diff < 0 ? 0 : diff;
          }
        } else {
          minutesToWork += workOnSchedule.morning.diffInMinutes;
        }
        daysToWork += 0.5;
        if (deductFulldaym) {
          daysToWork += 0.5;
        }
      }
      if (workOnSchedule.afternoon.work) {
        if (isHourUnit(input.leaveType.leave_unit) && index === dates.length - 1) {
          if (input.end < workOnSchedule.afternoon.start || input.start > workOnSchedule.afternoon.end) {
            minutesToWork += 0;
            outSideOfSchedule = true;
          } else {
            const diff = differenceInMinutes(
              input.end > workOnSchedule.afternoon.end ? workOnSchedule.afternoon.end : input.end,
              workOnSchedule.afternoon.start
            );
            minutesToWork += diff < 0 ? 0 : diff;
          }
        } else {
          minutesToWork += workOnSchedule.afternoon.diffInMinutes;
        }
        daysToWork += 0.5;
        if (deductFulldaym) {
          daysToWork += 0.5;
        }
      }
    }
  }

  let duration = dates.length;
  if (isDayUnit(input.leaveType.leave_unit)) {
    if (input.start_at == 'afternoon') {
      duration = dates.length - 0.5;
    }
    if (input.end_at == 'lunchtime') {
      duration = dates.length - 0.5;
    }
  } else if (isHourUnit(input.leaveType.leave_unit)) {
    duration = differenceInMinutes(input.end, input.start);
  }

  return { workday_days: daysToWork, workday_minutes: minutesToWork, outSideOfSchedule, duration };

  function setStartAtAndEndAtIfUndefinied(
    index: number,
    workOnSchedule: {
      morning: { start: Date; end: Date; diffInMinutes: number };
      afternoon: { start: Date; end: Date; diffInMinutes: number };
    }
  ) {
    if (index == 0 && !input.start_at) {
      if (input.end.getUTCHours() == 0 && input.end.getUTCMinutes() == 0) {
        input.end = new Date(Date.UTC(input.end.getFullYear(), input.end.getMonth(), input.end.getDate(), 23, 59, 59));
      }

      if (input.start < workOnSchedule.morning.end) {
        input.start_at = 'morning';
      } else if (input.start > workOnSchedule.morning.end) {
        input.start_at = 'afternoon';
      } else {
        input.start_at = 'afternoon';
      }
    }
    if (index === dates.length - 1 && !input.end_at) {
      if (input.end < workOnSchedule.afternoon.start) {
        input.end_at = 'lunchtime';
      } else if (input.end > workOnSchedule.afternoon.start) {
        input.end_at = 'end_of_day';
      } else {
        input.end_at = 'end_of_day';
      }
    }
  }

  function checkPublicHoliday(date: Date, ignore_public_holidays: boolean) {
    let addMorning = true;
    let addAfternoon = true;
    if (ignore_public_holidays) {
      return { addAfternoon, addMorning };
    }

    const publicHolidayDay = input.memberPublicHolidayDays.find((x) => {
      return dateToIsoDate(x.date).toDateString() == date.toDateString();
    });

    // Adjustment of working minutes due to public holidays
    if (publicHolidayDay) {
      if (publicHolidayDay.duration === 'FullDay') {
        addMorning = false;
        addAfternoon = false;
      } else if (publicHolidayDay.duration === 'Morning') {
        addMorning = false;
      } else if (publicHolidayDay.duration === 'Afternoon') {
        addAfternoon = false;
      }
    }
    return { addAfternoon, addMorning };
  }
}

export function countMaxRequestsOnSameDayInRange(
  start: Date,
  start_at: StartAt | undefined,
  end: Date,
  end_at: EndAt | undefined,
  requests: RouterOutputs['request']['allOfUsersByDay'][0][],
  workspaceSchedule: RouterOutputs['workspace_schedule']['edit'],
  memberSchedules: defaultMemberSelectOutput['schedules'],
  request_member_id: string
) {
  start = new Date(start);
  end = new Date(end);

  if (start_at && end_at) {
    if (start.toDateString() == end.toDateString()) {
      if (start_at == 'morning') {
        start.setUTCHours(0, 0, 0, 0);
      } else {
        start = getDayStartAndEndTimeFromschedule(
          start,
          start_at,
          end_at,
          findscheduleOnDate(
            start,
            workspaceSchedule,
            memberSchedules.filter((x) => x.member_id == request_member_id)
          )
        ).start;
      }
      if (end_at == 'end_of_day') {
        end.setUTCHours(23, 59, 59, 0);
      } else {
        end = getDayStartAndEndTimeFromschedule(
          end,
          start_at,
          end_at,
          findscheduleOnDate(
            end,
            workspaceSchedule,
            memberSchedules.filter((x) => x.member_id == request_member_id)
          )
        ).end;
      }
    } else {
      start = getDayStartAndEndTimeFromschedule(
        start,
        start_at,
        'end_of_day',
        findscheduleOnDate(
          start,
          workspaceSchedule,
          memberSchedules.filter((x) => x.member_id == request_member_id)
        )
      ).start;
      end = getDayStartAndEndTimeFromschedule(
        end,
        'morning',
        end_at,
        findscheduleOnDate(
          end,
          workspaceSchedule,
          memberSchedules.filter((x) => x.member_id == request_member_id)
        )
      ).end;
    }
  }

  let countOverlaps = 0;
  const overlapMemberIds: string[] = [];

  const dates = getDates(start, end);
  for (let index = 0; index < dates.length; index++) {
    for (let i2 = 0; i2 < requests.length; i2++) {
      const request = requests[i2];
      if (request && request.details?.status == 'CANCELED') continue;
      if (request && request.details?.status == 'DECLINED') continue;
      if (request && !overlapMemberIds.includes(request.requester_member_id)) {
        const r = cloneDeep(request);
        setRequestStartEndTimesBasedOnSchedule(
          r,
          memberSchedules.filter((x) => x.member_id == request.requester_member_id),
          workspaceSchedule
        );
        if (areIntervalsOverlapping({ start: r.start, end: r.end }, { start: start, end: end })) {
          countOverlaps++;
          overlapMemberIds.push(r.requester_member_id);
        }
      }
    }
  }
  return countOverlaps;
}
export function setScheduleFreeTimes(
  propsDate: Date,
  schedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current']
) {
  let itsFreeMorning = false;
  let itsFreeAfternoon = false;

  if (propsDate.getDay() == 0) {
    if (!schedule.sunday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.sunday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 1) {
    if (!schedule.monday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.monday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 2) {
    if (!schedule.tuesday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.tuesday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 3) {
    if (!schedule.wednesday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.wednesday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 4) {
    if (!schedule.thursday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.thursday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 5) {
    if (!schedule.friday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.friday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (propsDate.getDay() == 6) {
    if (!schedule.saturday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.saturday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  return { itsFreeMorning, itsFreeAfternoon };
}
export function getscheduleFreeTimes(date: Date, schedule: MemberSchedule | WorkspaceSchedule) {
  let itsFreeMorning = false;
  let itsFreeAfternoon = false;
  if (date.getDay() == 0) {
    if (!schedule.sunday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.sunday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 1) {
    if (!schedule.monday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.monday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 2) {
    if (!schedule.tuesday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.tuesday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 3) {
    if (!schedule.wednesday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.wednesday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 4) {
    if (!schedule.thursday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.thursday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 5) {
    if (!schedule.friday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.friday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  if (date.getDay() == 6) {
    if (!schedule.saturday_am_enabled) {
      itsFreeMorning = true;
    }
    if (!schedule.saturday_pm_enabled) {
      itsFreeAfternoon = true;
    }
    return { itsFreeMorning, itsFreeAfternoon };
  }

  return { itsFreeMorning, itsFreeAfternoon };
}
export function findRangeOverlap(
  start: Date,
  start_at: StartAt | undefined,
  end: Date,
  end_at: EndAt | undefined,
  requests: RouterOutputs['request']['allOfUsersByDay'],
  memberSchedules: defaultMemberSelectOutput['schedules'],
  workspaceSchedule: RouterOutputs['workspace_schedule']['edit']
) {
  if (!requests) return true;

  start = new Date(start);
  end = new Date(end);

  if (start_at && end_at) {
    if (start.toDateString() == end.toDateString()) {
      if (start_at == 'morning') {
        start.setUTCHours(0, 0, 0, 0);
      } else {
        start = getDayStartAndEndTimeFromschedule(
          start,
          start_at,
          end_at,
          findscheduleOnDate(start, workspaceSchedule, memberSchedules)
        ).start;
      }
      if (end_at == 'end_of_day') {
        end.setUTCHours(23, 59, 59, 0);
      } else {
        end = getDayStartAndEndTimeFromschedule(
          end,
          start_at,
          end_at,
          findscheduleOnDate(end, workspaceSchedule, memberSchedules)
        ).end;
      }
    } else {
      start = getDayStartAndEndTimeFromschedule(
        start,
        start_at,
        'end_of_day',
        findscheduleOnDate(start, workspaceSchedule, memberSchedules)
      ).start;
      end = getDayStartAndEndTimeFromschedule(
        end,
        'morning',
        end_at,
        findscheduleOnDate(end, workspaceSchedule, memberSchedules)
      ).end;
    }
  }
  for (let index = 0; index < requests.length; index++) {
    const request = requests[index];
    if (!request) continue;
    if (!request.details) continue;
    if (request.details.status == 'CANCELED') continue;
    if (request.details.status == 'DECLINED') continue;
    // if (request.year !== start.getFullYear()) continue;
    const r = cloneDeep(request);
    setRequestStartEndTimesBasedOnSchedule(r, memberSchedules, workspaceSchedule);
    if (areIntervalsOverlapping({ start: r.start, end: r.end }, { start: start, end: end })) {
      return true;
    }
  }
  return false;
}
export function setRequestStartEndTimesBasedOnScheduleOnDate(
  request: {
    start: Date;
    end: Date;
    start_at: StartAt;
    end_at: EndAt;
    leave_unit: LeaveUnit;
  },
  date: Date,
  memberSchedules: defaultMemberSelectOutput['schedules'],
  workspaceSchedule: defaultWorkspaceScheduleSelectOutput
) {
  const startMorning = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const endEndOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
  const rDateString = dateFromDatabaseIgnoreTimezone(date).toDateString();
  const rStartString = dateFromDatabaseIgnoreTimezone(request.start).toDateString();
  const rEndString = dateFromDatabaseIgnoreTimezone(request.end).toDateString();
  const schedule = findscheduleOnDate(date, workspaceSchedule, memberSchedules);
  if (isDayUnit(request.leave_unit)) {
    if (request.start.toDateString() == request.end.toDateString()) {
      const singleDaySchedule = getDayStartAndEndTimeFromschedule(
        request.start,
        request.start_at,
        request.end_at,
        schedule
      );
      request.start = request.start_at == 'morning' ? startMorning : singleDaySchedule.start;
      request.end = request.end_at == 'end_of_day' ? endEndOfDay : singleDaySchedule.end;
    } else {
      const startAt = rDateString == rStartString ? request.start_at : 'morning';
      const firstDaySchedule = getDayStartAndEndTimeFromschedule(date, startAt, 'end_of_day', schedule);
      const endAt = rDateString == rEndString ? request.end_at : 'end_of_day';
      const lastDaySchedule = getDayStartAndEndTimeFromschedule(date, 'morning', endAt, schedule);
      request.start = startAt == 'morning' ? startMorning : firstDaySchedule.start;
      request.end = endAt == 'end_of_day' ? endEndOfDay : lastDaySchedule.end;
    }
  } else {
    if (rStartString == rEndString) {
      return;
    }
    if (date.toDateString() !== rStartString) {
      request.start = startMorning;
    }
    if (rDateString !== rEndString) {
      request.end = endEndOfDay;
    }
  }
}

export function setRequestStartEndTimesBasedOnSchedule(
  request: {
    start: Date;
    end: Date;
    start_at: StartAt;
    end_at: EndAt;
    leave_unit: LeaveUnit;
  },
  memberSchedules: defaultMemberSelectOutput['schedules'],
  workspaceSchedule: RouterOutputs['workspace_schedule']['edit']
) {
  const startMorning = new Date(
    Date.UTC(request.start.getUTCFullYear(), request.start.getUTCMonth(), request.start.getUTCDate(), 0, 0, 0)
  );
  const endEndOfDay = new Date(
    Date.UTC(request.end.getUTCFullYear(), request.end.getUTCMonth(), request.end.getUTCDate(), 23, 59, 59)
  );

  if (isDayUnit(request.leave_unit)) {
    if (request.start.toDateString() == request.end.toDateString()) {
      const scheduleStartDate = findscheduleOnDate(request.start, workspaceSchedule, memberSchedules);
      const singleDaySchedule = getDayStartAndEndTimeFromschedule(
        request.start,
        request.start_at,
        request.end_at,
        scheduleStartDate
      );
      request.start = request.start_at == 'morning' ? startMorning : singleDaySchedule.start;
      request.end = request.end_at == 'end_of_day' ? endEndOfDay : singleDaySchedule.end;
    } else {
      const scheduleStartDate = getDayStartAndEndTimeFromschedule(
        request.start,
        request.start_at,
        'end_of_day',
        findscheduleOnDate(request.start, workspaceSchedule, memberSchedules)
      );

      const scheduleEndDate = getDayStartAndEndTimeFromschedule(
        request.end,
        'morning',
        request.end_at,
        findscheduleOnDate(request.end, workspaceSchedule, memberSchedules)
      );

      request.start = request.start_at == 'morning' ? startMorning : scheduleStartDate.start;
      request.end = request.end_at == 'end_of_day' ? endEndOfDay : scheduleEndDate.end;
    }
  }
}

export function getMinutesToWorkAtMorningAndAfternoonOnSchedule(
  date: Date,
  schedule: MemberSchedule | WorkspaceSchedule,
  ignore_schedule: boolean
) {
  schedule.sunday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.sunday_am_start.getUTCHours(),
      schedule.sunday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.sunday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.sunday_am_end.getUTCHours(),
      schedule.sunday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.sunday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.sunday_pm_start.getUTCHours(),
      schedule.sunday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.sunday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.sunday_pm_end.getUTCHours(),
      schedule.sunday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.monday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.monday_am_start.getUTCHours(),
      schedule.monday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.monday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.monday_am_end.getUTCHours(),
      schedule.monday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.monday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.monday_pm_start.getUTCHours(),
      schedule.monday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.monday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.monday_pm_end.getUTCHours(),
      schedule.monday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.tuesday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.tuesday_am_start.getUTCHours(),
      schedule.tuesday_am_start.getUTCMinutes(),
      0
    )
  );

  schedule.tuesday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.tuesday_am_end.getUTCHours(),
      schedule.tuesday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.tuesday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.tuesday_pm_start.getUTCHours(),
      schedule.tuesday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.tuesday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.tuesday_pm_end.getUTCHours(),
      schedule.tuesday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.wednesday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.wednesday_am_start.getUTCHours(),
      schedule.wednesday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.wednesday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.wednesday_am_end.getUTCHours(),
      schedule.wednesday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.wednesday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.wednesday_pm_start.getUTCHours(),
      schedule.wednesday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.wednesday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.wednesday_pm_end.getUTCHours(),
      schedule.wednesday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.thursday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.thursday_am_start.getUTCHours(),
      schedule.thursday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.thursday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.thursday_am_end.getUTCHours(),
      schedule.thursday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.thursday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.thursday_pm_start.getUTCHours(),
      schedule.thursday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.thursday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.thursday_pm_end.getUTCHours(),
      schedule.thursday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.friday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.friday_am_start.getUTCHours(),
      schedule.friday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.friday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.friday_am_end.getUTCHours(),
      schedule.friday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.friday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.friday_pm_start.getUTCHours(),
      schedule.friday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.friday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.friday_pm_end.getUTCHours(),
      schedule.friday_pm_end.getUTCMinutes(),
      0
    )
  );

  schedule.saturday_am_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.saturday_am_start.getUTCHours(),
      schedule.saturday_am_start.getUTCMinutes(),
      0
    )
  );
  schedule.saturday_am_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.saturday_am_end.getUTCHours(),
      schedule.saturday_am_end.getUTCMinutes(),
      0
    )
  );
  schedule.saturday_pm_start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.saturday_pm_start.getUTCHours(),
      schedule.saturday_pm_start.getUTCMinutes(),
      0
    )
  );
  schedule.saturday_pm_end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      schedule.saturday_pm_end.getUTCHours(),
      schedule.saturday_pm_end.getUTCMinutes(),
      0
    )
  );

  let morning: { start: Date; end: Date; diffInMinutes: number; work: boolean } = {
    start: new Date(),
    end: new Date(),
    diffInMinutes: 0,
    work: false
  };

  let afternoon: { start: Date; end: Date; diffInMinutes: number; work: boolean } = {
    start: new Date(),
    end: new Date(),
    diffInMinutes: 0,
    work: false
  };
  if (date.getDay() == 0) {
    if (schedule.sunday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.sunday_am_start,
        end: schedule.sunday_am_end,
        diffInMinutes: differenceInMinutes(schedule.sunday_am_end, schedule.sunday_am_start),
        work: true
      };
    }
    if (schedule.sunday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.sunday_pm_start,
        end: schedule.sunday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.sunday_pm_end, schedule.sunday_pm_start),
        work: true
      };
    }

    return { morning, afternoon };
  }

  if (date.getDay() == 1) {
    if (schedule.monday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.monday_am_start,
        end: schedule.monday_am_end,
        diffInMinutes: differenceInMinutes(schedule.monday_am_end, schedule.monday_am_start),
        work: true
      };
    }
    if (schedule.monday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.monday_pm_start,
        end: schedule.monday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.monday_pm_end, schedule.monday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  if (date.getDay() == 2) {
    if (schedule.tuesday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.tuesday_am_start,
        end: schedule.tuesday_am_end,
        diffInMinutes: differenceInMinutes(schedule.tuesday_am_end, schedule.tuesday_am_start),
        work: true
      };
    }
    if (schedule.tuesday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.tuesday_pm_start,
        end: schedule.tuesday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.tuesday_pm_end, schedule.tuesday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  if (date.getDay() == 3) {
    if (schedule.wednesday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.wednesday_am_start,
        end: schedule.wednesday_am_end,
        diffInMinutes: differenceInMinutes(schedule.wednesday_am_end, schedule.wednesday_am_start),
        work: true
      };
    }
    if (schedule.wednesday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.wednesday_pm_start,
        end: schedule.wednesday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.wednesday_pm_end, schedule.wednesday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  if (date.getDay() == 4) {
    if (schedule.thursday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.thursday_am_start,
        end: schedule.thursday_am_end,
        diffInMinutes: differenceInMinutes(schedule.thursday_am_end, schedule.thursday_am_start),
        work: true
      };
    }
    if (schedule.thursday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.thursday_pm_start,
        end: schedule.thursday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.thursday_pm_end, schedule.thursday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  if (date.getDay() == 5) {
    if (schedule.friday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.friday_am_start,
        end: schedule.friday_am_end,
        diffInMinutes: differenceInMinutes(schedule.friday_am_end, schedule.friday_am_start),
        work: true
      };
    }
    if (schedule.friday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.friday_pm_start,
        end: schedule.friday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.friday_pm_end, schedule.friday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  if (date.getDay() == 6) {
    if (schedule.saturday_am_enabled || ignore_schedule) {
      morning = {
        start: schedule.saturday_am_start,
        end: schedule.saturday_am_end,
        diffInMinutes: differenceInMinutes(schedule.saturday_am_end, schedule.saturday_am_start),
        work: true
      };
    }
    if (schedule.saturday_pm_enabled || ignore_schedule) {
      afternoon = {
        start: schedule.saturday_pm_start,
        end: schedule.saturday_pm_end,
        diffInMinutes: differenceInMinutes(schedule.saturday_pm_end, schedule.saturday_pm_start),
        work: true
      };
    }
    return { morning, afternoon };
  }

  return { morning, afternoon };
}
export function deductFullday(date: Date, schedule: MemberSchedule) {
  if (!schedule) return false;
  if (date.getDay() == 0) {
    return schedule.sunday_deduct_fullday;
  }

  if (date.getDay() == 1) {
    return schedule.monday_deduct_fullday;
  }

  if (date.getDay() == 2) {
    return schedule.tuesday_deduct_fullday;
  }

  if (date.getDay() == 3) {
    return schedule.wednesday_deduct_fullday;
  }

  if (date.getDay() == 4) {
    return schedule.thursday_deduct_fullday;
  }

  if (date.getDay() == 5) {
    return schedule.friday_deduct_fullday;
  }

  if (date.getDay() == 6) {
    return schedule.saturday_deduct_fullday;
  }
}
export function findscheduleOnDate(
  date: Date,
  workspaceSchedule: WorkspaceSchedule,
  memberSchedules: MemberSchedule[]
) {
  let schedule = memberSchedules.find((x) => {
    if (!x.from) return false;
    const from = dateToIsoDate(x.from);
    return from <= date;
  });
  if (!schedule) schedule = workspaceSchedule as MemberSchedule;
  return schedule;
}

export function getFiscalYear(date: Date, startMonth: number): number {
  let fiscalYear: number;

  if (date.getMonth() < startMonth) {
    // Wenn das Monat des Datums vor dem Startmonat liegt, gehört das Datum zum vorherigen Geschäftsjahr
    fiscalYear = date.getFullYear() - 1;
  } else {
    // Sonst gehört das Datum zum aktuellen Geschäftsjahr
    fiscalYear = date.getFullYear();
  }

  return fiscalYear;
}

export function getFiscalYearStartAndEndDates(startMonth: number, year: number) {
  const firstDayOfYear = new Date(year, startMonth, 1, 0, 0, 0);
  const lastDayOfYear = new Date(year + 1, startMonth, 0, 23, 59); // last day of previous month

  return {
    firstDayOfYear,
    lastDayOfYear
  };
}

export function getFiscalYearStartAndEndDatesUTC(startMonth: number, year: number) {
  const firstDayOfYear = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
  const lastDayOfYear = new Date(Date.UTC(year + 1, startMonth, 0, 23, 59)); // last day of previous month

  return {
    firstDayOfYear,
    lastDayOfYear
  };
}

export function getDayStartAndEndTimeFromschedule(
  date: Date,
  start_at: StartAt,
  end_at: EndAt,
  schedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current']
) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(0, 0, 0, 0);
  if (date.getDay() == 0) {
    if (start_at == 'morning') {
      start.setUTCHours(schedule.sunday_am_start.getUTCHours(), schedule.sunday_am_start.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      start.setUTCHours(schedule.sunday_pm_start.getUTCHours(), schedule.sunday_pm_start.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      end.setUTCHours(schedule.sunday_am_end.getUTCHours(), schedule.sunday_am_end.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      end.setUTCHours(schedule.sunday_pm_end.getUTCHours(), schedule.sunday_pm_end.getUTCMinutes(), 0);
    }

    return { start, end };
  }

  if (date.getDay() == 1) {
    if (start_at == 'morning') {
      const time = schedule.monday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.monday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.monday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.monday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }
    return { start, end };
  }

  if (date.getDay() == 2) {
    if (start_at == 'morning') {
      const time = schedule.tuesday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.tuesday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.tuesday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.tuesday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }
    return { start, end };
  }

  if (date.getDay() == 3) {
    if (start_at == 'morning') {
      const time = schedule.wednesday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.wednesday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.wednesday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.wednesday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    return { start, end };
  }

  if (date.getDay() == 4) {
    if (start_at == 'morning') {
      const time = schedule.thursday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.thursday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.thursday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.thursday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }
  }

  if (date.getDay() == 5) {
    if (start_at == 'morning') {
      const time = schedule.friday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.friday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.friday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.friday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    return { start, end };
  }

  if (date.getDay() == 6) {
    if (start_at == 'morning') {
      const time = schedule.saturday_am_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (start_at == 'afternoon') {
      const time = schedule.saturday_pm_start;
      start.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    if (end_at == 'lunchtime') {
      const time = schedule.saturday_am_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    } else if (end_at == 'end_of_day') {
      const time = schedule.saturday_pm_end;
      end.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0);
    }

    return { start, end };
  }

  return { start, end };
}
export function getDayStartAndEndTimeFromscheduleOnClient(
  date: Date,
  start_at: StartAt,
  end_at: EndAt,
  schedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current']
) {
  let start = new Date(date);
  let end = new Date(date);
  if (date.getDay() == 0) {
    if (start_at == 'morning') {
      start = new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          schedule.sunday_am_start.getUTCHours(),
          schedule.sunday_am_start.getUTCMinutes(),
          0
        )
      );
    } else if (start_at == 'afternoon') {
      start = new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          schedule.sunday_pm_start.getUTCHours(),
          schedule.sunday_pm_start.getUTCMinutes(),
          0
        )
      );
    }

    if (end_at == 'lunchtime') {
      end = new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          schedule.sunday_am_end.getUTCHours(),
          schedule.sunday_am_end.getUTCMinutes(),
          0
        )
      );
    } else if (end_at == 'end_of_day') {
      end = new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          schedule.sunday_pm_end.getUTCHours(),
          schedule.sunday_pm_end.getUTCMinutes(),
          0
        )
      );
    }

    return { start, end };
  }

  if (date.getDay() == 1) {
    if (start_at == 'morning') {
      const time = schedule.monday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.monday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.monday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.monday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }
    return { start, end };
  }

  if (date.getDay() == 2) {
    if (start_at == 'morning') {
      const time = schedule.tuesday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.tuesday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.tuesday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.tuesday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }
    return { start, end };
  }

  if (date.getDay() == 3) {
    if (start_at == 'morning') {
      const time = schedule.wednesday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.wednesday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.wednesday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.wednesday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    return { start, end };
  }

  if (date.getDay() == 4) {
    if (start_at == 'morning') {
      const time = schedule.thursday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.thursday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.thursday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.thursday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }
  }

  if (date.getDay() == 5) {
    if (start_at == 'morning') {
      const time = schedule.friday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.friday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.friday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.friday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    return { start, end };
  }

  if (date.getDay() == 6) {
    if (start_at == 'morning') {
      const time = schedule.saturday_am_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (start_at == 'afternoon') {
      const time = schedule.saturday_pm_start;
      start = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    if (end_at == 'lunchtime') {
      const time = schedule.saturday_am_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    } else if (end_at == 'end_of_day') {
      const time = schedule.saturday_pm_end;
      end = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time.getUTCHours(), time.getUTCMinutes(), 0)
      );
    }

    return { start, end };
  }

  return { start, end };
}
export function CheckCurrentUserHasPermissionToCreateRequest(
  current_member: { id: string; is_admin: boolean },
  requester_member: {
    id: string;
    departments: {
      department: {
        members: { member_id: string; manager_type: DepartmentManagerType }[];
      };
    }[];
  }
) {
  if (current_member.is_admin) {
    return true;
  }
  if (requester_member.id == current_member.id) {
    return true;
  }
  if (CurrentUserIsDepartmentManagerOfMember(current_member, requester_member)) {
    return true;
  }
  return false;
}

export function CurrentUserIsDepartmentManagerOfMember(
  current_member: { id: string; is_admin: boolean },
  requester_member: {
    id: string;
    departments: {
      department: {
        members: { member_id: string; manager_type: DepartmentManagerType }[];
      };
    }[];
  }
) {
  if (
    requester_member.departments.find((x) =>
      x.department?.members.find((x) => x.member_id == current_member.id && x.manager_type == 'Manager')
    )
  ) {
    return true;
  }
  return false;
}

// Helper function to limit the concurrency of promise execution
export function limitConcurrency(tasks: any[], limit: number) {
  const results: any[] = [];
  let currentlyExecuting = 0;
  let i = 0;

  return new Promise((resolve, reject) => {
    const executeTask = () => {
      if (i === tasks.length) {
        if (currentlyExecuting === 0) {
          resolve(results);
        }
        return;
      }
      currentlyExecuting++;
      const taskIndex = i;
      i++;

      tasks[taskIndex]()
        .then((result: any) => {
          results[taskIndex] = result;
          currentlyExecuting--;
          executeTask();
        })
        .catch(reject);
    };

    for (let j = 0; j < limit && j < tasks.length; j++) {
      executeTask();
    }
  });
}

export const uniqueByRequestId = (array: any[]) => {
  const seenRequestIds = new Set();
  return array.filter((item) => {
    if (seenRequestIds.has(item.request_id)) {
      return false; // Skip this item because the request_id was already seen.
    } else {
      seenRequestIds.add(item.request_id);
      return true; // Keep this item because it's the first time the request_id is seen.
    }
  });
};
function isSameDayCustom(date1: Date, date2: Date) {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

export function splitDurationByFiscalYear(
  duration: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
  },
  workspace: {
    fiscal_year_start_month: number;
  }
) {
  const { start, end, start_at, end_at } = duration;

  const ranges: {
    start: Date;
    end: Date;
    start_at?: StartAt;
    end_at?: EndAt;
    fiscalYear: number;
  }[] = [];

  let currentStart = new Date(start);
  let currentEnd = new Date(end);

  while (currentStart <= currentEnd) {
    let fiscalYearRange = getFiscalYearStartAndEndDatesUTC(
      workspace.fiscal_year_start_month,
      currentStart.getFullYear()
    );

    if (fiscalYearRange.firstDayOfYear > currentStart) {
      fiscalYearRange = getFiscalYearStartAndEndDatesUTC(
        workspace.fiscal_year_start_month,
        currentStart.getFullYear() - 1
      );
    }

    let fiscalYearEnd = fiscalYearRange.lastDayOfYear;

    if (currentStart <= fiscalYearEnd) {
      const rangeEnd = currentEnd <= fiscalYearEnd ? currentEnd : fiscalYearEnd;
      ranges.push({
        start: new Date(currentStart),
        end: new Date(rangeEnd),
        start_at: start_at === undefined ? undefined : isSameDayCustom(currentStart, start) ? start_at : 'morning',
        end_at: end_at === undefined ? undefined : isSameDayCustom(rangeEnd, end) ? end_at : 'end_of_day',
        fiscalYear: getFiscalYear(currentStart, workspace.fiscal_year_start_month)
      });

      // Keep the time here
      const newStart = new Date(fiscalYearEnd);
      newStart.setUTCHours(
        currentStart.getUTCHours(),
        currentStart.getUTCMinutes(),
        currentStart.getUTCSeconds(),
        currentStart.getUTCMilliseconds()
      );
      currentStart = newStart;
      currentStart.setUTCDate(currentStart.getUTCDate() + 1); // Move to the next day
    } else {
      break; // Exit loop if currentStart is beyond fiscal year end
    }
  }

  return ranges;
}
