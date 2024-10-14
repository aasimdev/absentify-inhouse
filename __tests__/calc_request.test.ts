import { cloneDeep } from 'lodash';
import { calcRequestDuration } from '../lib/requestUtilities';
import { EndAt, LeaveUnit, MemberSchedule, PublicHolidayDuration, StartAt, WorkspaceSchedule } from '@prisma/client';

const mockInput: {
  start: Date;
  end: Date;
  start_at?: StartAt;
  end_at?: EndAt;
  requester_member_id: string;
  workspaceSchedule: WorkspaceSchedule;
  memberSchedules: MemberSchedule[];
  memberAllowances: {
    year: number;
    remaining: number;
    brought_forward: number;
    allowance_type_id: string;
  }[];
  memberPublicHolidayDays: {
    date: Date;
    duration: PublicHolidayDuration;
  }[];
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
  workspace: {
    id: string;
    fiscal_year_start_month: number;
  };
} = {
  start: new Date('2024-02-01T00:00:00.000Z'),
  end: new Date('2024-02-02T00:00:00.000Z'),
  start_at: StartAt.morning,
  end_at: EndAt.end_of_day,
  requester_member_id: 'member1',
  workspaceSchedule: {
    id: '5b0ea036-96d7-446a-8768-119e9a0c7b7f',
    createdAt: new Date('2024-08-05T15:42:23.751Z'),
    updatedAt: new Date('2024-08-05T15:42:23.751Z'),
    workspace_id: 'ecc5b0ac-1cfe-451d-86b4-e4c727c25462',
    monday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    monday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    monday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    monday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    monday_am_enabled: true,
    monday_pm_enabled: true,
    monday_deduct_fullday: false,
    tuesday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    tuesday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    tuesday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    tuesday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    tuesday_am_enabled: true,
    tuesday_pm_enabled: true,
    tuesday_deduct_fullday: false,
    wednesday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    wednesday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    wednesday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    wednesday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    wednesday_am_enabled: true,
    wednesday_pm_enabled: true,
    wednesday_deduct_fullday: false,
    thursday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    thursday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    thursday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    thursday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    thursday_am_enabled: true,
    thursday_pm_enabled: true,
    thursday_deduct_fullday: false,
    friday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    friday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    friday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    friday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    friday_am_enabled: true,
    friday_pm_enabled: true,
    friday_deduct_fullday: false,
    saturday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    saturday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    saturday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    saturday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    saturday_am_enabled: false,
    saturday_pm_enabled: false,
    saturday_deduct_fullday: false,
    sunday_am_start: new Date('1970-01-01T08:00:00.000Z'),
    sunday_am_end: new Date('1970-01-01T12:00:00.000Z'),
    sunday_pm_start: new Date('1970-01-01T13:00:00.000Z'),
    sunday_pm_end: new Date('1970-01-01T17:00:00.000Z'),
    sunday_am_enabled: false,
    sunday_pm_enabled: false,
    sunday_deduct_fullday: false
  },
  memberSchedules: [],
  memberPublicHolidayDays: [
    {
      date: new Date('2024-01-01T00:00:00.000Z'),
      duration: PublicHolidayDuration.FullDay
    },
    {
      date: new Date('2024-01-06T00:00:00.000Z'),
      duration: PublicHolidayDuration.FullDay
    }
    // ... more holidays
  ],
  memberAllowances: [{ year: 2024, remaining: 15, brought_forward: 0, allowance_type_id: 'type1' }],
  leaveType: {
    leave_unit: LeaveUnit.half_days,
    take_from_allowance: true,
    allowance_type_id: 'type1',
    ignore_schedule: false,
    ignore_public_holidays: false,
    allowance_type: { ignore_allowance_limit: false }
  },
  workspace: { id: 'workspace1', fiscal_year_start_month: 0 }
};

test('Default 2 days', () => {
  const testInput = cloneDeep(mockInput);

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 2,
        workday_duration_in_minutes: 960,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 2
      }
    ],
    total: {
      workday_duration_in_days: 2,
      workday_duration_in_minutes: 960,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 2
    }
  });
});

test('Half day morning normal day', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-01T00:00:00.000Z');
  testInput.end = new Date('2024-02-01T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});

test('Half day afternoon normal day', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-01T00:00:00.000Z');
  testInput.end = new Date('2024-02-01T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});
test('Two days not enough allwoance', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-01T00:00:00.000Z');
  testInput.end = new Date('2024-02-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.end_of_day;

  if (testInput.memberAllowances && testInput.memberAllowances[0]) {
    testInput.memberAllowances[0].remaining = 1;
  }

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 2,
        workday_duration_in_minutes: 960,
        allowanceEnough: false,
        outside_of_schedule: false,
        duration: 2
      }
    ],
    total: {
      workday_duration_in_days: 2,
      workday_duration_in_minutes: 960,
      allowanceEnough: false,
      outside_of_schedule: false,
      duration: 2
    }
  });
});
test('Fullday morning on weekend', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.end_of_day;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0,
        workday_duration_in_minutes: 0,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1
      }
    ],
    total: {
      workday_duration_in_days: 0,
      workday_duration_in_minutes: 0,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1
    }
  });
});
test('Half day morning on weekend', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0,
        workday_duration_in_minutes: 0,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0,
      workday_duration_in_minutes: 0,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});
test('Half day afternoon on weekend', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0,
        workday_duration_in_minutes: 0,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0,
      workday_duration_in_minutes: 0,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});

test('Fullday morning on weekend ignore schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_schedule = true;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1,
        workday_duration_in_minutes: 480,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1
      }
    ],
    total: {
      workday_duration_in_days: 1,
      workday_duration_in_minutes: 480,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1
    }
  });
});
test('Half day morning on weekend ignore schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;
  testInput.leaveType.ignore_schedule = true;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});
test('Half day afternoon on weekend ignore schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-03T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_schedule = true;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 0.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 0.5
    }
  });
});

test('One and a half days ending at lunchtime', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-01T00:00:00.000Z');
  testInput.end = new Date('2024-02-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days starting at lunchtime', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-01T00:00:00.000Z');
  testInput.end = new Date('2024-02-02T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a weekend', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-02T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.lunchtime;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a weekend ignore schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-02-02T00:00:00.000Z');
  testInput.end = new Date('2024-02-03T00:00:00.000Z');
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.lunchtime;
  testInput.leaveType.ignore_schedule = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1,
        workday_duration_in_minutes: 480,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1,
      workday_duration_in_minutes: 480,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days on a public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-01T00:00:00.000Z'); // public holiday
  testInput.end = new Date('2024-01-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-05T00:00:00.000Z');
  testInput.end = new Date('2024-01-06T00:00:00.000Z'); // public holiday on 6th
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days on a public holiday ignore public holiday and schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-01T00:00:00.000Z'); // public holiday
  testInput.end = new Date('2024-01-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;
  testInput.leaveType.ignore_public_holidays = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a public holiday on weekend ignore public holiday and schedule', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-05T00:00:00.000Z');
  testInput.end = new Date('2024-01-06T00:00:00.000Z'); // public holiday on 6th
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_public_holidays = true;
  testInput.leaveType.ignore_schedule = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a public holiday on weekend ignore public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-05T00:00:00.000Z');
  testInput.end = new Date('2024-01-06T00:00:00.000Z'); // public holiday on 6th
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_public_holidays = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a public holiday not on weekend ignore public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-01T00:00:00.000Z');
  testInput.end = new Date('2024-01-02T00:00:00.000Z'); // public holiday on 6th
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_public_holidays = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days on a public holiday ignore public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-01T00:00:00.000Z'); // public holiday
  testInput.end = new Date('2024-01-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.lunchtime;
  testInput.leaveType.ignore_public_holidays = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 1.5,
        workday_duration_in_minutes: 720,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 1.5,
      workday_duration_in_minutes: 720,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('One and a half days over a public holiday ignore public holiday', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-01-05T00:00:00.000Z');
  testInput.end = new Date('2024-01-06T00:00:00.000Z'); // public holiday on 6th
  testInput.start_at = StartAt.afternoon;
  testInput.end_at = EndAt.end_of_day;
  testInput.leaveType.ignore_public_holidays = true;
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 0.5,
        workday_duration_in_minutes: 240,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1.5
      }
    ],
    total: {
      workday_duration_in_days: 0.5,
      workday_duration_in_minutes: 240,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1.5
    }
  });
});

test('Check brought_forward logic over a fiscal year period', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-12-29T00:00:00.000Z');
  testInput.end = new Date('2025-01-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.end_of_day;

  testInput.memberPublicHolidayDays.push({
    date: new Date('2025-01-01T00:00:00.000Z'),
    duration: PublicHolidayDuration.FullDay
  });

  testInput.memberAllowances = [
    { year: 2024, remaining: 2, brought_forward: 0, allowance_type_id: 'type1' },
    { year: 2025, remaining: 2, brought_forward: 2, allowance_type_id: 'type1' }
  ];

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 2,
        workday_duration_in_minutes: 960,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 3
      },
      {
        fiscal_year: 2025,
        workday_duration_in_days: 1,
        workday_duration_in_minutes: 480,
        allowanceEnough: false,
        outside_of_schedule: false,
        duration: 2
      }
    ],
    total: {
      workday_duration_in_days: 3,
      workday_duration_in_minutes: 1440,
      allowanceEnough: false,
      outside_of_schedule: false,
      duration: 5
    }
  });
});
test('Check brought_forward logic over a fiscal year period with enough', () => {
  const testInput = cloneDeep(mockInput);

  testInput.start = new Date('2024-12-29T00:00:00.000Z');
  testInput.end = new Date('2025-01-02T00:00:00.000Z');
  testInput.start_at = StartAt.morning;
  testInput.end_at = EndAt.end_of_day;

  testInput.memberPublicHolidayDays.push({
    date: new Date('2025-01-01T00:00:00.000Z'),
    duration: PublicHolidayDuration.FullDay
  });

  testInput.memberAllowances = [
    { year: 2024, remaining: 2, brought_forward: 0, allowance_type_id: 'type1' },
    { year: 2025, remaining: 3, brought_forward: 2, allowance_type_id: 'type1' }
  ];

  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 2,
        workday_duration_in_minutes: 960,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 3
      },
      {
        fiscal_year: 2025,
        workday_duration_in_days: 1,
        workday_duration_in_minutes: 480,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 2
      }
    ],
    total: {
      workday_duration_in_days: 3,
      workday_duration_in_minutes: 1440,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 5
    }
  });
});
test('Default 2 days with hour unit', () => {
  const testInput = cloneDeep(mockInput);

  testInput.leaveType.leave_unit = LeaveUnit.hours;
  testInput.end_at = undefined;
  testInput.start_at = undefined;
  testInput.start = new Date('2024-02-01T08:00:00.000Z');
  testInput.end = new Date('2024-02-02T15:00:00.000Z');
  testInput.memberAllowances = [{ year: 2024, remaining: 840, brought_forward: 0, allowance_type_id: 'type1' }];
  const result = calcRequestDuration(testInput);

  expect(result).toEqual({
    per_year: [
      {
        fiscal_year: 2024,
        workday_duration_in_days: 2,
        workday_duration_in_minutes: 840,
        allowanceEnough: true,
        outside_of_schedule: false,
        duration: 1860
      }
    ],
    total: {
      workday_duration_in_days: 2,
      workday_duration_in_minutes: 840,
      allowanceEnough: true,
      outside_of_schedule: false,
      duration: 1860
    }
  });
});
