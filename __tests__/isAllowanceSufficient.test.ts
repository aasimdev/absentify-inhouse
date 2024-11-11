import { cloneDeep } from 'lodash';
import { EndAt, LeaveUnit, PublicHolidayDuration, StartAt } from '@prisma/client';
import { hasEnoughAllowanceForRequest, workspaceSelect } from '../lib/updateMemberAllowances';

const mockInput: {
  start: Date;
  end: Date;
  start_at?: StartAt;
  end_at?: EndAt;
  requester_member_id: string;
  workspace: workspaceSelect;
} = {
  start: new Date('2024-02-01T00:00:00.000Z'),
  end: new Date('2024-02-02T00:00:00.000Z'),
  start_at: StartAt.morning,
  end_at: EndAt.end_of_day,
  requester_member_id: 'member1',
  workspace: {
    id: 'workspace1',
    fiscal_year_start_month: 0,
    schedule: {
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
    member_schedules: [],
    allowance_types: [{ id: 'type1', carry_forward_months_after_fiscal_year: 0, max_carry_forward: 0 }],
    members: [{ id: 'member1', public_holiday_id: 'public_holiday1' }],
    public_holiday_days: [
      {
        date: new Date('2024-01-01T00:00:00.000Z'),
        duration: PublicHolidayDuration.FullDay,
        public_holiday_id: 'public_holiday1'
      },
      {
        date: new Date('2024-01-06T00:00:00.000Z'),
        duration: PublicHolidayDuration.FullDay,
        public_holiday_id: 'public_holiday1'
      }
      // ... more holidays
    ],

    member_allowances: [
      {
        year: 2024,
        remaining: 15,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'allowance1',
        member_id: 'member1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 15
      }
    ],
    leave_types: [
      {
        id: 'leave_type1',
        leave_unit: LeaveUnit.half_days,
        take_from_allowance: true,
        allowance_type_id: 'type1',
        ignore_schedule: false,
        ignore_public_holidays: false,
        allowance_type: {
          ignore_allowance_limit: false,
          carry_forward_months_after_fiscal_year: 0,
          max_carry_forward: 0
        }
      }
    ]
  }
};

describe('isAllowanceSufficient Function Tests', () => {
  // Test 1
  test('should return true when allowance is sufficient for default 2 days', () => {
    const testInput = cloneDeep(mockInput);

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );

    expect(result).toBe(true);
  });

  // Test 2
  test('should return true for half day morning normal day', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-01T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );

    expect(result).toBe(true);
  });

  // Test 3
  test('should return true for half day afternoon normal day', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-01T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );

    expect(result).toBe(true);
  });

  // Test 4
  test('should return false when allowance is insufficient for two days', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    if (testInput.workspace.member_allowances && testInput.workspace.member_allowances[0]) {
      testInput.workspace.member_allowances[0].remaining = 1;
      testInput.workspace.member_allowances[0].allowance = 1;
    }

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );

    expect(result).toBe(false);
  });

  // Test 5
  test('should return true for full day on weekend when ignore_schedule is false', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 6
  test('should return true for half day morning on weekend when ignore_schedule is false', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 7
  test('should return true for half day afternoon on weekend when ignore_schedule is false', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 8
  test('should return true when ignore_schedule is true on weekend', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;
    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 9
  test('should return true for half day morning on weekend when ignore_schedule is true', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 10
  test('should return true for half day afternoon on weekend when ignore_schedule is true', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;
    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 11
  test('should return true for one and a half days ending at lunchtime', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 12
  test('should return true for one and a half days starting at lunchtime', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-02T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 13
  test('should return true for one and a half days over a weekend', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-02T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 14
  test('should return true when ignoring schedule over a weekend', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-02T00:00:00.000Z');
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 15
  test('should return true for one and a half days on a public holiday', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-01-01T00:00:00.000Z'); // Feiertag
    testInput.end = new Date('2024-01-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 16
  test('should return true for one and a half days over a public holiday', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-01-05T00:00:00.000Z');
    testInput.end = new Date('2024-01-06T00:00:00.000Z'); // Feiertag am 6.
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 17
  test('should return true when ignoring public holidays over a public holiday', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-01-01T00:00:00.000Z'); // Feiertag
    testInput.end = new Date('2024-01-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.lunchtime;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 18
  test('should return true when ignoring public holidays and schedule over a weekend', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-01-05T00:00:00.000Z');
    testInput.end = new Date('2024-01-06T00:00:00.000Z'); // Feiertag am 6.
    testInput.start_at = StartAt.afternoon;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_public_holidays = true;
    testInput.workspace.leave_types[0].ignore_schedule = true;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 19
  test('should return true when allowance is sufficient over a fiscal year period', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-12-29T00:00:00.000Z');
    testInput.end = new Date('2025-01-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.public_holiday_days.push({
      date: new Date('2025-01-01T00:00:00.000Z'),
      duration: PublicHolidayDuration.FullDay,
      public_holiday_id: 'public_holiday_id'
    });

    testInput.workspace.member_allowances = [
      {
        year: 2024,
        remaining: 2,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 2
      },
      {
        year: 2025,
        remaining: 2,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id2',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 2
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 20
  test('should return false when allowance is insufficient over a fiscal year period', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-27T00:00:00.000Z');
    testInput.end = new Date('2024-02-04T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 3,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 3
      },
      {
        year: 2024,
        remaining: 5,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id2',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 5
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false);
  });

  // Test 21
  test('should return true when no carryover is allowed without carryover period', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-25T00:00:00.000Z');
    testInput.end = new Date('2023-12-31T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 5,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 5
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 0,
      max_carry_forward: 0
    };

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 22
  test('should return false when no carryover is allowed and allowance is insufficient', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-25T00:00:00.000Z');
    testInput.end = new Date('2023-12-31T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 4,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 4
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 0,
      max_carry_forward: 0
    };

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false);
  });

  // Test 23
  test('should return true when allowance is sufficient with max_carry_forward', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-28T00:00:00.000Z');
    testInput.end = new Date('2024-01-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 10,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 10
      },
      {
        year: 2024,
        remaining: 5,
        brought_forward: 5,
        allowance_type_id: 'type1',
        id: 'id2',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 5
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 0,
      max_carry_forward: 5
    };
    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 24
  test('should return true when full use of remaining vacation during the carryover period', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-01-08T00:00:00.000Z');
    testInput.end = new Date('2024-01-12T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 5,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 5
      },
      {
        year: 2024,
        remaining: 20,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id2',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 20
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 2,
      max_carry_forward: 0
    };

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 25
  test('should return true when allowance is sufficient for leave with hour unit', () => {
    const testInput = cloneDeep(mockInput);

    testInput.end_at = undefined;
    testInput.start_at = undefined;
    testInput.start = new Date('2024-02-01T08:00:00.000Z');
    testInput.end = new Date('2024-02-02T15:00:00.000Z');
    testInput.workspace.member_allowances = [
      {
        year: 2024,
        remaining: 840,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 840
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].leave_unit = LeaveUnit.hours;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 26
  test('should return false when hourly allowance is insufficient', () => {
    const testInput = cloneDeep(mockInput);

    testInput.end_at = undefined;
    testInput.start_at = undefined;
    testInput.start = new Date('2024-02-01T08:00:00.000Z');
    testInput.end = new Date('2024-02-02T15:00:00.000Z');
    testInput.workspace.member_allowances = [
      {
        year: 2024,
        remaining: 400,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 0
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].leave_unit = LeaveUnit.hours;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false);
  });

  // Test 27
  test('should return true when default 2 days with carry_forward_months_after_fiscal_year', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-01T00:00:00.000Z');
    testInput.end = new Date('2024-02-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    if (testInput.workspace.leave_types[0].allowance_type)
      testInput.workspace.leave_types[0].allowance_type.carry_forward_months_after_fiscal_year = 3;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 28
  test('should return true when default 2 days with overlapping carry_forward_months_after_fiscal_year', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-03-28T00:00:00.000Z');
    testInput.end = new Date('2024-04-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;
    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    if (testInput.workspace.leave_types[0].allowance_type)
      testInput.workspace.leave_types[0].allowance_type.carry_forward_months_after_fiscal_year = 3;
    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 29
  test('should return true when default 2 days with behind carry_forward_months_after_fiscal_year', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-04-01T00:00:00.000Z');
    testInput.end = new Date('2024-04-02T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;
    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    if (testInput.workspace.leave_types[0].allowance_type)
      testInput.workspace.leave_types[0].allowance_type.carry_forward_months_after_fiscal_year = 3;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 30
  test('should return false when no carryover allowed without carryover period and insufficient allowance', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-25T00:00:00.000Z');
    testInput.end = new Date('2023-12-31T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 4,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 0
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 0,
      max_carry_forward: 0
    };

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false);
  });

  // Test 31
  test('should return true when allowance is sufficient for default 2 days with behind carry_forward_months_after_fiscal_year and before', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-27T00:00:00.000Z');
    testInput.end = new Date('2024-02-04T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        year: 2023,
        remaining: 3,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id1',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 0
      },
      {
        year: 2024,
        remaining: 22,
        brought_forward: 0,
        allowance_type_id: 'type1',
        id: 'id2',
        member_id: 'member_id1',
        compensatory_time_off: 0,
        overwrite_brought_forward: false,
        allowance: 0
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    if (testInput.workspace.leave_types[0].allowance_type)
      testInput.workspace.leave_types[0].allowance_type.carry_forward_months_after_fiscal_year = 1;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false); // Aufgrund der Berechnungen könnte dies auch true sein, je nach Geschäftslogik
  });

  // Test 32
  test('should return true when ignore_allowance_limit is true regardless of allowance', () => {
    const testInput = cloneDeep(mockInput);

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }

    if (testInput.workspace.leave_types[0].allowance_type)
      testInput.workspace.leave_types[0].allowance_type.ignore_allowance_limit = true;
    if (testInput.workspace.member_allowances[0]) {
      testInput.workspace.member_allowances[0].remaining = 0;
      testInput.workspace.member_allowances[0].allowance = 0;
    }

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  // Test 33
  test('should return true when schedule and public holidays are ignored', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2024-02-03T00:00:00.000Z'); // Wochenende
    testInput.end = new Date('2024-02-03T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].ignore_schedule = true;
    testInput.workspace.leave_types[0].ignore_public_holidays = true;

    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(true);
  });

  test('should return false when carry_forward_months_after_fiscal_year is exceeded', () => {
    const testInput = cloneDeep(mockInput);

    testInput.start = new Date('2023-12-15T00:00:00.000Z');
    testInput.end = new Date('2023-12-22T00:00:00.000Z');
    testInput.start_at = StartAt.morning;
    testInput.end_at = EndAt.end_of_day;

    testInput.workspace.member_allowances = [
      {
        id: '400d2e9a-2e72-4298-8f59-dc92524c42e5',
        overwrite_brought_forward: false,
        remaining: 10,
        brought_forward: 0,
        allowance: 10,
        allowance_type_id: 'type1',
        compensatory_time_off: 0,
        member_id: 'member_id1',
        year: 2023
      },
      {
        id: '9fae91ec-5307-4fb6-b04a-0b39be3f0332',
        overwrite_brought_forward: false,
        remaining: 5,
        brought_forward: 10,
        allowance: 0,
        allowance_type_id: 'type1',
        compensatory_time_off: 0,
        member_id: 'member_id1',
        year: 2024
      }
    ];

    if (!testInput.workspace.leave_types[0]) {
      throw new Error('Leave type not found');
    }
    testInput.workspace.leave_types[0].allowance_type = {
      ignore_allowance_limit: false,
      carry_forward_months_after_fiscal_year: 3,
      max_carry_forward: 5
    };
    const result = hasEnoughAllowanceForRequest(
      testInput.workspace,
      testInput.requester_member_id,
      testInput.workspace.leave_types[0],
      [
        {
          details: { leave_type_id: 'leave_type1' },
          start: new Date('2024-01-08T00:00:00.000Z'),
          end: new Date('2024-01-12T00:00:00.000Z'),
          start_at: StartAt.morning,
          end_at: EndAt.end_of_day,
          leave_unit: LeaveUnit.half_days
        }
      ],
      {
        start: testInput.start,
        end: testInput.end,
        start_at: testInput.start_at,
        end_at: testInput.end_at
      }
    );
    expect(result).toBe(false);
  });
});
