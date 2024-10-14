// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '~/server/db';
import { getIronSession } from 'iron-session';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import { hasValidSubscription } from '~/lib/subscriptionHelper';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { addDays, addMonths, addYears, format } from 'date-fns';
import { Workbook } from 'excel4node';
import {
  AllowanceUnit,
  ApprovalProcess,
  EndAt,
  LeaveUnit,
  Prisma,
  RequestApproverStatus,
  RequestStatus,
  StartAt,
  TimeFormat
} from '@prisma/client';
import { dateFromDatabaseIgnoreTimezone, getDates, isDayUnit } from '~/lib/DateHelper';
import { fillWorksheet } from '~/lib/excelHelper';
import { calcRequestDuration, setRequestStartEndTimesBasedOnScheduleOnDate } from '~/lib/requestUtilities';
import {
  defaultWorkspaceScheduleSelect,
  defaultWorkspaceScheduleSelectOutput
} from '~/server/api/routers/workspace_schedule';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { cloneDeep } from 'lodash';
import { Translate } from 'next-translate';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));
  let month: number | null = parseInt(req.query.month as string);
  const year = parseInt(req.query.year as string);
  if (isNaN(month)) {
    month = null;
  }

  let department_id = req.query.department_id ?? null;

  if (!session.user?.member_id) {
    res.status(401).json({ error: 'No access' });
    return;
  }

  let current_member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: {
      is_admin: true,
      workspace_id: true,
      language: true,
      date_format: true,
      time_format: true,
      long_datetime_format: true
    }
  });

  if (!current_member?.is_admin) {
    res.status(401).json({ error: 'error' });
    return;
  }
  const workspace_id = current_member.workspace_id;

  const workspace = await prisma.workspace.findUnique({
    select: {
      id: true,
      fiscal_year_start_month: true,
      leave_types: { select: { id: true, take_from_allowance: true } },
      schedule: { select: defaultWorkspaceScheduleSelect },
      member_schedules: { select: defaultMemberScheduleSelect, orderBy: { from: 'desc' } },
      member_allowances: {
        select: {
          id: true,
          member_id: true,
          year: true,
          allowance: true,
          brought_forward: true,
          taken: true,
          remaining: true,
          compensatory_time_off: true
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
      },
      subscriptions: {
        select: {
          id: true,
          provider: true,
          status: true,
          subscription_id: true,
          quantity: true,
          modifier_id: true,
          subscription_plan_id: true,
          customer_user_id: true,
          cancellation_effective_date: true,
          currency: true,
          unit_price: true,
          unpaid: true
        }
      }
    },
    where: { id: workspace_id }
  });
  if (!workspace) {
    res.status(401).json({ error: 'you-have-to-be-admin-to-add-department' });
    return;
  }

  if (!workspace.schedule) {
    res.status(401).json({ error: 'you-have-to-be-admin-to-add-department' });
    return;
  }

  const language = current_member.language;
  const date_format = current_member.date_format;
  const time_format = current_member.time_format;
  const long_datetime_format = current_member.long_datetime_format;
  const subscriptionAvailable = hasValidSubscription(workspace.subscriptions);

  if (month && !subscriptionAvailable) {
    res.status(401).json({ error: 'You_need_to_upgrade_your_subscription_to_access_this_feature' });
    return;
  }

  if (department_id && !subscriptionAvailable) {
    res.status(401).json({ error: 'You_need_to_upgrade_your_subscription_to_access_this_feature' });
    return;
  }

  let start = new Date(Date.UTC(year, workspace.fiscal_year_start_month, 1));
  let end = addDays(addYears(new Date(Date.UTC(year, workspace.fiscal_year_start_month, 1)), 1), -1);

  if (month !== null) {
    start = new Date(Date.UTC(year, month, 1));
    end = addDays(addMonths(new Date(Date.UTC(year, month, 1)), 1), -1);
  }

  const [leave_types, membersNoLang] = await prisma.$transaction([
    prisma.leaveType.findMany({
      select: {
        id: true,
        name: true,
        deleted: true,
        take_from_allowance: true,
        allowance_type_id: true,
        leave_unit: true,
        ignore_schedule: true,
        ignore_public_holidays: true,
        allowance_type: {
          select: {
            id: true,
            name: true,
            allowance_unit: true,
            ignore_allowance_limit: true
          }
        }
      },
      where: { workspace_id: workspace_id },
      orderBy: { position: 'asc' }
    }),
    prisma.member.findMany({
      select: exportMemberSelect,
      where: { workspace_id: workspace_id },
      orderBy: { name: 'asc' }
    })
  ]);

  let members = membersNoLang.map((member) => {
    const public_holidayDays = member.public_holiday.public_holiday_days;
    const mapedHolidays = public_holidayDays.map((day) => {
      const public_holiday_day_language = day.public_holiday_day_languages.find((lang) => lang.language === language);
      return {
        ...day,
        name: public_holiday_day_language?.name || ''
      };
    });
    return {
      ...member,
      public_holiday: {
        ...member.public_holiday,
        public_holiday_days: mapedHolidays
      }
    };
  });

  if (department_id) {
    members = members.filter((member) =>
      member.departments.find((department) => department.department.id === department_id)
    );
  }

  let requests = await prisma.request.findMany({
    select: exportRequestSelect,
    where: {
      workspace_id: workspace_id,
      OR: [
        { AND: [{ start: { gte: start } }, { start: { lte: end } }] },
        { AND: [{ end: { gte: start } }, { end: { lte: end } }] },
        { AND: [{ start: { lt: start } }, { end: { gt: end } }] }
      ]
    },
    orderBy: {
      start: 'asc'
    }
  });

  if (department_id) {
    requests = requests.filter((request) => members.find((member) => member.id === request.requester_member_id));
  }

  async function getSchamas(t: Translate) {
    const approvalProcessOptions = [
      {
        id: ApprovalProcess.Linear_all_have_to_agree,
        title: t('linear-all-must-agree'),
        description: t('linear-all-must-agree_description')
      },
      {
        id: ApprovalProcess.Linear_one_has_to_agree,
        title: t('linear-one-must-agree'),
        description: t('linear-one-must-agree-description')
      },
      {
        id: ApprovalProcess.Parallel_all_have_to_agree,
        title: t('parallel-all-must-agree'),
        description: t('parallel-all-must-agree-description')
      },
      {
        id: ApprovalProcess.Parallel_one_has_to_agree,
        title: t('parallel-one-must-agree'),
        description: t('parallel-one-must-agree-description')
      }
    ];
    let schema_allwoance: any = [
      {
        column: t('User_Id'),
        type: String,
        value: (member: ExportMemberType) => member.id,
        width: 14
      },
      {
        column: t('Custom_Id'),
        type: String,
        value: (member: ExportMemberType) => member.custom_id,
        width: 14
      },
      {
        column: t('Name'),
        type: String,
        value: (member: ExportMemberType) => member.name,
        width: 14
      },
      {
        column: t('Email'),
        type: String,
        value: (member: ExportMemberType) => member.email,
        width: 14
      },
      {
        column: t('Status'),
        type: String,
        value: (member: ExportMemberType) => member.status
      },
      {
        column: t('Employment_Start_Date'),
        type: Date,
        format: date_format,
        value: (member: ExportMemberType) => member.employment_start_date,
        width: 14
      },
      {
        column: t('Employment_End_Date'),
        type: Date,
        format: date_format,
        value: (member: ExportMemberType) => member.employment_end_date,
        width: 14
      },
      {
        column: t('Department'),
        type: String,
        value: (member: ExportMemberType) => member.departments.map((x) => x.department?.name).join(', ')
      },
      {
        column: t('Allowance'),
        type: String,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.allowance_type?.name
      },
      {
        column: t('Allowance_unit'),
        type: String,
        value: (member: ExportMemberType) =>
          member.allowances.find((x) => x.year == year)?.allowance_type?.allowance_unit == 'days'
            ? t('Days')
            : t('Minutes')
      },
      {
        column: t('Ignore_allowance_limit'),
        type: Boolean,
        value: (member: ExportMemberType) =>
          member.allowances.find((x) => x.year == year)?.allowance_type?.ignore_allowance_limit
      },
      {
        column: t('Brought_Forward'),
        type: Number,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.brought_forward
      },

      {
        column: t('Allowance'),
        type: Number,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.allowance
      },
      {
        column: t('compensatory_time_off'),
        type: Number,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.compensatory_time_off
      },
      {
        column: t('Taken'),
        type: Number,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.taken
      },
      {
        column: t('Remaining'),
        type: Number,
        value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.remaining
      }
    ];

    if (month !== null) {
      schema_allwoance = [
        {
          column: t('User_Id'),
          type: String,
          value: (member: ExportMemberType) => member.id,
          width: 14
        },
        {
          column: t('Custom_Id'),
          type: String,
          value: (member: ExportMemberType) => member.custom_id,
          width: 14
        },
        {
          column: t('Name'),
          type: String,
          value: (member: ExportMemberType) => member.name,
          width: 14
        },
        {
          column: t('Email'),
          type: String,
          value: (member: ExportMemberType) => member.email,
          width: 14
        },
        {
          column: t('Status'),
          type: String,
          value: (member: ExportMemberType) => member.status
        },
        {
          column: t('Employment_Start_Date'),
          type: Date,
          format: date_format,
          value: (member: ExportMemberType) => member.employment_start_date,
          width: 14
        },
        {
          column: t('Employment_End_Date'),
          type: Date,
          format: date_format,
          value: (member: ExportMemberType) => member.employment_end_date,
          width: 14
        },
        {
          column: t('Department'),
          type: String,
          value: (member: ExportMemberType) => member.departments.map((x) => x.department?.name).join(', ')
        },
        {
          column: t('Allowance'),
          type: String,
          value: (member: ExportMemberType) => member.allowances.find((x) => x.year == year)?.allowance_type?.name
        },
        {
          column: t('Allowance_unit'),
          type: String,
          value: (member: ExportMemberType) =>
            member.allowances.find((x) => x.year == year)?.allowance_type?.allowance_unit == 'days'
              ? t('Days')
              : t('Minutes')
        },
        {
          column: t('Ignore_allowance_limit'),
          type: Boolean,
          value: (member: ExportMemberType) =>
            member.allowances.find((x) => x.year == year)?.allowance_type?.ignore_allowance_limit
        }
      ];
    }

    const translateAt = (value: string) => {
      if (value == 'afternoon') return t('Afternoon');
      if (value == 'morning') return t('Morning');
      if (value == 'lunchtime') return t('Lunchtime');
      if (value == 'end_of_day') return t('End_of_Day');
    };
    const schema_leave = [
      {
        column: t('Id'),
        type: String,
        value: (request: ExportRequestType) => request.id,
        width: 14
      },
      {
        column: t('User_Id'),
        type: String,
        value: (request: ExportRequestType) => request.requester_member.id,
        width: 14
      },
      {
        column: t('Custom_Id'),
        type: String,
        value: (request: ExportRequestType) => request.requester_member.custom_id,
        width: 14
      },
      {
        column: t('Name'),
        type: String,
        value: (request: ExportRequestType) => request.requester_member.name,
        width: 14
      },
      {
        column: t('Email'),
        type: String,
        value: (request: ExportRequestType) => request.requester_member.email,
        width: 14
      },
      {
        column: t('Leave_Type'),
        type: String,
        value: (request: ExportRequestType) => request.details?.leave_type.name,
        width: 14
      },
      {
        column: t('Start_Date'),
        type: Date,
        format: `${date_format} ${time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'}`,
        value: (request: ExportRequestType) => request.start,
        width: 18
      },
      {
        column: t('Start_At'),
        type: String,
        value: (request: ExportRequestType) => translateAt(request.start_at),
        width: 14
      },
      {
        column: t('End_Date'),
        type: Date,
        format: `${date_format} ${time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'}`,
        value: (request: ExportRequestType) => request.end,
        width: 18
      },
      {
        column: t('End_At'),
        type: String,
        value: (request: ExportRequestType) => translateAt(request.end_at),
        width: 14
      },
      {
        column: t('Workday_absence_duration'),
        type: Number,
        value: (request: ExportRequestType) => request.details?.workday_absence_duration || 0,
        width: 14
      },
      {
        column: t('Duration'),
        type: Number,
        value: (request: ExportRequestType) => request.details?.duration || 0,
        width: 14
      },
      {
        column: t('Allowance_unit'),
        type: String,
        value: (request: ExportRequestType) => (isDayUnit(request.leave_unit) ? t('Days') : t('Minutes'))
      },
      {
        column: t('Reason'),
        type: String,
        value: (request: ExportRequestType) => request.details?.reason,
        width: 14
      },

      {
        column: t('Created_At'),
        type: Date,
        format: date_format,
        value: (request: ExportRequestType) => request.createdAt,
        width: 18
      },
      {
        column: t('Created_By'),
        type: String,
        value: (request: ExportRequestType) => request.request_creator_member?.name,
        width: 14
      },
      {
        column: t('Status'),
        type: String,
        value: (request: ExportRequestType) => request.details?.status,
        width: 14
      },
      {
        column: t('approval-process'),
        type: String,
        value: (request: ExportRequestType) =>
          approvalProcessOptions.find((x) => x.id == request.details?.approval_process)?.title,
        width: 14
      },
      {
        column: t('Approved_At'),
        type: String,
        // format: current_member.date_format + ' ' + (session.user.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'),
        value: (request: ExportRequestType) =>
          sortApprovers(request.details?.request_approvers ?? [])
            .filter((x) => x.status == 'APPROVED')
            .map((x) => (x.status_change_date ? format(x.status_change_date, long_datetime_format) : null))
            .join(', '),
        width: 18
      },
      {
        column: t('Approved_By'),
        type: String,
        value: (request: ExportRequestType) => {
          const approver = sortApprovers(request.details?.request_approvers ?? []).filter(
            (x) => x.status == 'APPROVED'
          );
          const list = [];
          for (let index = 0; index < approver.length; index++) {
            const approv = approver[index];
            if (approv) {
              const name = approv.approver_member?.name ?? t('Deleted_User');
              const status_changed_by_member = approv.status_changed_by_member?.name ?? t('Deleted_User');
              if (status_changed_by_member != name) {
                list.push(`${status_changed_by_member} ${t('in-behalf-of')} ${name}`);
              } else {
                list.push(name);
              }
            }
          }
          return list.join(', ');
        },
        width: 14
      },
      {
        column: t('Canceled_At'),
        type: Date,
        format: `${date_format} ${time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'}`,
        value: (request: ExportRequestType) => request.details?.canceld_date,
        width: 18
      },
      {
        column: t('Canceled_By'),
        type: String,
        value: (request: ExportRequestType) => request.details?.canceld_by_member?.name,
        width: 14
      },
      {
        column: t('Cancel_Reason'),
        type: String,
        value: (request: ExportRequestType) => request.details?.cancel_reason,
        width: 14
      },
      {
        column: t('Declined_At'),
        type: String,
        //  format: current_member.date_format + ' ' + (session.user.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'),
        value: (request: ExportRequestType) =>
          sortApprovers(request.details?.request_approvers ?? [])
            .filter((x) => x.status == 'DECLINED')
            .map((x) => (x.status_change_date ? format(x.status_change_date, long_datetime_format) : null))
            .join(', '),
        width: 18
      },
      {
        column: t('Declined_By'),
        type: String,
        value: (request: ExportRequestType) => {
          const approver = sortApprovers(request.details?.request_approvers ?? []).filter(
            (x) => x.status == 'DECLINED'
          );
          const list = [];
          for (let index = 0; index < approver.length; index++) {
            const approv = approver[index];
            if (approv) {
              const name = approv.approver_member?.name ?? t('Deleted_User');
              const status_changed_by_member = approv.status_changed_by_member?.name ?? t('Deleted_User');
              if (status_changed_by_member != name) {
                list.push(`${status_changed_by_member} ${t('in-behalf-of')} ${name}`);
              } else {
                list.push(name);
              }
            }
          }
          return list.join(', ');
        },
        width: 14
      },
      {
        column: t('Decline_Reason'),
        type: String,
        value: (request: ExportRequestType) =>
          sortApprovers(request.details?.request_approvers ?? [])
            .filter((x) => x.status == 'DECLINED')
            .map((x) => x.reason)
            .join(', '),
        width: 14
      },
      {
        column: t('Take_from_allowance'),
        type: Boolean,
        value: (request: ExportRequestType) => request.details?.leave_type.take_from_allowance,
        width: 14
      },
      {
        column: t('Allowance'),
        type: String,
        value: (request: ExportRequestType) => request.details?.leave_type.allowance_type?.name,
        width: 14
      }
    ];

    const schema_per_day = [
      {
        column: t('User_Id'),
        type: String,
        value: (member: ExportRequestperDayType) => member.id,
        width: 14
      },
      {
        column: t('Custom_Id'),
        type: String,
        value: (member: ExportRequestperDayType) => member.custom_id,
        width: 14
      },
      {
        column: t('Name'),
        type: String,
        value: (member: ExportRequestperDayType) => member.name,
        width: 14
      },
      {
        column: t('Email'),
        type: String,
        value: (member: ExportRequestperDayType) => member.email,
        width: 14
      },
      {
        column: t('Leave_Type'),
        type: String,
        value: (member: ExportRequestperDayType) => member.leave_type_name,
        width: 14
      },
      {
        column: t('Date'),
        type: Date,
        format: date_format,
        value: (request: ExportRequestperDayType) => request.date,
        width: 14
      },
      {
        column: t('Month'),
        type: String,
        format: date_format,
        value: (request: ExportRequestperDayType) => request.month,
        width: 14
      },
      {
        column: t('Weekday'),
        type: String,
        format: date_format,
        value: (request: ExportRequestperDayType) => request.weekday,
        width: 14
      },
      {
        column: t('Full_Day'),
        type: String,
        value: (request: ExportRequestperDayType) => request.fullday,
        width: 14
      },

      {
        column: t('Status'),
        type: String,
        value: (request: ExportRequestperDayType) => request.status,
        width: 14
      },
      {
        column: t('Take_from_allowance'),
        type: Boolean,
        value: (request: ExportRequestperDayType) => request.take_from_allowance,
        width: 14
      },
      {
        column: t('Allowance'),
        type: String,
        value: (request: ExportRequestperDayType) => request.allowance_type?.name,
        width: 14
      }
    ];

    return { schema_allwoance: schema_allwoance, schema_leave: schema_leave, schema_per_day };
  }

  const getT = ensureAvailabilityOfGetT();
  const t = await getT(language, 'backend');
  const { schema_allwoance, schema_leave, schema_per_day } = await getSchamas(t);

  const wb = new Workbook();
  const ws = wb.addWorksheet(
    month !== null
      ? `${t('Allowance')} ${start.toLocaleDateString(language, { month: '2-digit' })} ${start.getFullYear()}`
      : `${t('Allowance')} ${start.toLocaleDateString(language, {
          month: '2-digit'
        })} ${start.getFullYear()} - ${end.toLocaleDateString(language, {
          month: '2-digit'
        })} ${end.getFullYear()}`
  );

  try {
    addLeaveTypesToAllowanceSchema();

    let filteredMembers = [];

    for (let memberIndex = 0; memberIndex < members.length; memberIndex++) {
      const currentMember = members[memberIndex];
      if (!currentMember) continue;
      let stats: Prisma.JsonValue = {};

      // Sort the allowances array so that default: true is first and then by name
      currentMember.allowances.sort((a: any, b: any) => {
        if (a.allowance_type?.default === true) return -1;
        if (b.allowance_type?.default === true) return 1;
        return a.allowance_type?.name.localeCompare(b.allowance_type?.name);
      });

      for (let allowanceIndex = 0; allowanceIndex < currentMember.allowances.length; allowanceIndex++) {
        const currentAllowance = currentMember.allowances[allowanceIndex];
        if (!currentAllowance) continue;

        if (currentAllowance.year !== year) continue;

        let modifiedMember = { ...currentMember };
        modifiedMember.allowances = [currentAllowance];

        stats = modifiedMember.allowances[0]!.leave_types_stats;

        filteredMembers.push(modifiedMember);
      }

      let modifiedMember = { ...currentMember };
      modifiedMember.allowances = [
        {
          year: year,
          allowance: 0,
          brought_forward: 0,
          taken: 0,
          remaining: 0,
          compensatory_time_off: 0,
          allowance_type_id: '',
          allowance_type: {
            name: t('Non-deductible_leave'),
            id: 'non-deductible',
            ignore_allowance_limit: true,
            allowance_unit: 'days'
          },
          leave_types_stats: stats
        }
      ];

      filteredMembers.push(modifiedMember);
    }

    fillWorksheet(ws, schema_allwoance, filteredMembers);

    const ws2 = wb.addWorksheet(
      month !== null
        ? `${t('Leave')} ${start.toLocaleDateString(language, { month: '2-digit' })} ${start.getFullYear()}`
        : `${t('Leave')} ${start.toLocaleDateString(language, {
            month: '2-digit'
          })} ${start.getFullYear()} - ${end.toLocaleDateString(language, {
            month: '2-digit'
          })} ${end.getFullYear()}`
    );

    fillWorksheet(ws2, schema_leave, requests);

    const ws3 = wb.addWorksheet(t('Absences_per_day'));

    const reqPerDay = perDayExport(
      t,
      members,
      leave_types,
      workspace.schedule,
      language,
      start,
      end,
      subscriptionAvailable != null
    );

    const l = reqPerDay.length + 4;

    fillWorksheet(ws3, schema_per_day, reqPerDay);
    if (!subscriptionAvailable) {
      ws3.cell(l, 1).string(t('excel_upgrade_needed'));
      ws3.cell(l, 1).style({ font: { bold: true, color: 'orange' } });
    }
  } catch (e) {
    console.log(e);
  }
  const buffer = await wb.writeToBuffer();

  res
    .status(200)
    .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .send(buffer);

  function addLeaveTypesToAllowanceSchema() {
    if (!workspace) return;
    if (month !== null) {
      const sum: Map<string, Map<string, number>> = new Map();
      let stats: any = [];

      for (let i1 = 0; i1 < requests.length; i1++) {
        const request = requests[i1];
        if (!request) continue;
        if (!request.details) continue;
        if (!(request.details.status == RequestStatus.PENDING || request.details.status == RequestStatus.APPROVED))
          continue;
        if (!workspace.schedule) continue;
        const typeId: string = request.details.leave_type_id;
        const memberId: string = request.requester_member_id;
        const leave_type = leave_types.find((x) => x.id == typeId);
        if (!leave_type) continue;

        const request_member = members.find((x) => x.id == request.requester_member_id);
        if (!request_member) continue;

        if (request.end < start) continue;
        if (request.start > end) continue;

        if (!sum.has(memberId)) {
          sum.set(memberId, new Map());
        }
        if (!sum.get(memberId)!.has(typeId)) {
          sum.get(memberId)!.set(typeId, 0);
        }

        let member_schedules = workspace.member_schedules.filter(
          (ms: { member_id: string }) => ms.member_id === request.requester_member_id
        );

        let member_public_holiday_days = workspace.public_holiday_days.filter(
          (phd) => phd.public_holiday_id === request.requester_member.public_holiday_id
        );

        let adjustedStart = request.start;
        let adjustedEnd = request.end;
        let adjustedStartAt = request.start_at;
        let adjustedEndAt = request.end_at;

        // Check if the start date is before the first day of the year
        if (request.start < start) {
          adjustedStart = start;
          adjustedStartAt = 'morning';
        }

        // Check if the end date is after the last day of the year
        if (request.end > end) {
          adjustedEnd = end;
          adjustedEndAt = 'end_of_day';
        }

        const d = calcRequestDuration({
          start: adjustedStart,
          end: adjustedEnd,
          start_at: adjustedStartAt,
          end_at: adjustedEndAt,
          workspaceSchedule: workspace.schedule,
          memberSchedules: member_schedules,
          memberPublicHolidayDays: member_public_holiday_days,
          leaveType: leave_type,
          memberAllowances: request_member.allowances,
          requester_member_id: request.requester_member_id,
          workspace: workspace
        });

        let duration = d.total.workday_duration_in_minutes;
        if (isDayUnit(request.leave_unit)) {
          duration = d.total.workday_duration_in_days;
        }

        let currentSum = sum.get(memberId)!.get(typeId);
        sum.get(memberId)!.set(typeId, (currentSum ?? 0) + duration);
      }
      // Convert 'sum' object to 'stats' array
      sum.forEach((types, memberId) => {
        types.forEach((total, typeId) => {
          stats.push({
            member_id: memberId,
            leave_type_id: typeId,
            sum: total
          });
        });
      });

      schema_allwoance.push({
        column: t('Deducted_from_the_allowance'),
        type: Number,
        value: (member: ExportMemberType) => {
          return stats
            .filter((x: { member_id: string; leave_type_id: string }) => {
              const leave_type = leave_types.find((y: { id: string }) => y.id == x.leave_type_id);
              if (!leave_type?.take_from_allowance) return false;

              if (leave_type?.allowance_type?.id != member.allowances[0]?.allowance_type?.id) return false;

              return x.member_id == member.id && leave_type?.take_from_allowance;
            })
            .reduce((acc: number, curr: any) => {
              return acc + (curr.sum || 0); // Hier nehme ich an, dass die Eigenschaft "sum" existiert und eine Zahl ist.
            }, 0);
        }
      });

      for (let index = 0; index < leave_types.length; index++) {
        const leave_type = leave_types[index];
        if (leave_type) {
          schema_allwoance.push({
            column: leave_type.name + (leave_type.deleted ? ` (${t('deleted')})` : ''),
            type: Number,
            value: (member: ExportMemberType) => {
              return (
                stats.find((x: { member_id: string; leave_type_id: string }) => {
                  if (member.allowances[0]?.allowance_type?.name == t('Non-deductible_leave'))
                    return (
                      x.member_id == member.id && x.leave_type_id == leave_type.id && !leave_type.take_from_allowance
                    );

                  if (leave_type?.allowance_type?.id != member.allowances[0]?.allowance_type?.id) return false;
                  return x.member_id == member.id && x.leave_type_id == leave_type.id;
                })?.sum ?? 0
              );
            }
          });
        }
      }
    } else {
      for (let index = 0; index < leave_types.length; index++) {
        const leave_type = leave_types[index];
        if (leave_type) {
          schema_allwoance.push({
            column: leave_type.name + (leave_type.deleted ? ` (${t('deleted')})` : ''),
            type: Number,
            value: (member: ExportMemberType) => {
              const currentYearAllowance = member.allowances.find((x) => x.year == year);
              if (!currentYearAllowance) return 0;
              if (!currentYearAllowance.leave_types_stats) return 0;
              let resultArray = Object.entries(currentYearAllowance.leave_types_stats).map(([id, value]) => {
                return {
                  leave_type: leave_types.find((x: { name: string; id: string }) => x.id == id),
                  id: id,
                  amount: value.amount
                };
              });

              if (currentYearAllowance.allowance_type?.name == t('Non-deductible_leave')) {
                if (leave_type.allowance_type != null) {
                  return 0;
                }
                return resultArray.find((x) => x.id == leave_type.id)?.amount ?? 0;
              }
              if (leave_type.allowance_type == null) {
                return 0;
              }
              return resultArray.find((x) => x.id == leave_type.id)?.amount ?? 0;
            }
          });
        }
      }
    }
  }
}
const exportMemberSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  custom_id: true,
  status: true,
  employment_start_date: true,
  employment_end_date: true,
  workspace_id: true,
  birthday: true,
  public_holiday_id: true,
  name: true,
  email: true,
  has_cdn_image: true,
  firstName: true,
  lastName: true,
  departments: {
    select: {
      department: { select: { id: true, name: true } }
    }
  },
  has_approvers: {
    select: {
      approver_member: { select: { id: true, name: true } }
    }
  },
  allowances: {
    select: {
      remaining: true,
      year: true,
      brought_forward: true,
      compensatory_time_off: true,
      allowance: true,
      taken: true,
      leave_types_stats: true,
      allowance_type_id: true,
      allowance_type: {
        select: { id: true, name: true, ignore_allowance_limit: true, allowance_unit: true }
      }
    }
  },
  requests: {
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
          leave_type_id: true
        }
      }
    }
  },
  schedules: { select: defaultMemberScheduleSelect, orderBy: [{ from: 'desc' }] },
  public_holiday: {
    select: {
      name: true,
      public_holiday_days: {
        select: {
          id: true,
          date: true,
          year: true,
          custom_value: true,
          public_holiday_day_languages: {
            select: {
              id: true,
              name: true,
              language: true
            }
          }
        }
      }
    }
  }
});

const exportRequestSelect = Prisma.validator<Prisma.RequestSelect>()({
  id: true,
  start: true,
  end: true,
  start_at: true,
  end_at: true,
  leave_unit: true,
  createdAt: true,
  requester_member_id: true,
  request_creator_member: { select: { name: true } },
  requester_member: {
    select: {
      id: true,
      name: true,
      email: true,
      custom_id: true,
      public_holiday_id: true
    }
  },
  details: {
    select: {
      leave_type_id: true,
      status: true,
      workday_absence_duration: true,
      duration: true,
      reason: true,
      cancel_reason: true,
      canceld_date: true,
      canceld_by_member: { select: { name: true } },
      leave_type: {
        select: {
          name: true,
          take_from_allowance: true,
          allowance_type: { select: { name: true, allowance_unit: true } },
          leave_unit: true
        }
      },
      approval_process: true,
      request_approvers: {
        select: {
          uuid: true,
          approver_member_id: true,
          status: true,
          reason: true,
          status_change_date: true,
          predecessor_request_member_approver_id: true,
          status_changed_by_member: { select: { name: true } },
          approver_member: { select: { name: true } }
        }
      }
    }
  }
});

type ExportMemberType = Prisma.MemberGetPayload<{
  select: typeof exportMemberSelect;
}>;
type ExportRequestType = Prisma.RequestGetPayload<{
  select: typeof exportRequestSelect;
}>;
type ExportRequestperDayType = ExportMemberType & {
  date: Date;
  month: string;
  fullday: string;
  leave_type_name: string;
  status: string;
  weekday: string;
  take_from_allowance: boolean;
  allowance_type: { name: string; allowance_unit: AllowanceUnit } | null;
};
function perDayExport(
  t: Translate,
  members: {
    name: string | null;
    public_holiday: { public_holiday_days: { date: Date; name: string }[]; name: string };
    schedules: defaultMemberSelectOutput['schedules'];
    requests: {
      start: Date;
      end: Date;
      start_at: StartAt;
      end_at: EndAt;
      leave_unit: LeaveUnit;
      details: { status: RequestStatus; leave_type_id: string } | null;
    }[];
  }[],
  leave_types: {
    id: string;
    name: string;
    take_from_allowance: boolean;
    allowance_type: { id: string; name: string; allowance_unit: AllowanceUnit } | null;
  }[],
  workspaceSchedule: defaultWorkspaceScheduleSelectOutput,
  language: string,
  start: Date,
  end: Date,
  subscriptionAvailable: boolean
) {
  const reqPerDay = [];

  for (let index = 0; index < members.length; index++) {
    const member = members[index];
    if (member) {
      for (let i2 = 0; i2 < member.requests.length; i2++) {
        const request = member.requests[i2];
        if (request) {
          if (request.details?.status == 'APPROVED' || request.details?.status == 'PENDING') {
            const dates = getDates(new Date(request.start), new Date(request.end));

            for (let i = 0; i < dates.length; i++) {
              const date = dates[i];
              if (date && date >= start && date <= end) {
                let fullday = t('Full_Day');
                if (isDayUnit(request.leave_unit)) {
                  if (i == 0 && request.start_at == 'afternoon') {
                    fullday = t('Afternoon');
                  }

                  if (i == dates.length - 1 && request.end_at == 'lunchtime') {
                    fullday = t('Morning');
                  }
                } else {
                  const newR = cloneDeep(request);
                  setRequestStartEndTimesBasedOnScheduleOnDate(newR, date, member.schedules, workspaceSchedule);

                  fullday =
                    format(dateFromDatabaseIgnoreTimezone(newR.start), 'HH:mm') +
                    ' - ' +
                    format(dateFromDatabaseIgnoreTimezone(newR.end), 'HH:mm');
                }

                const leave_type = leave_types.find((x) => x.id == request.details?.leave_type_id);

                const merged = {
                  ...member,
                  ...{
                    date,
                    month: date.toLocaleString(language, { month: 'long' }),
                    fullday,
                    leave_type_name: leave_type?.name,
                    status: request.details?.status,
                    weekday: date.toLocaleString(language, { weekday: 'long' }),
                    take_from_allowance: leave_type?.take_from_allowance,
                    allowance_type: leave_type?.allowance_type
                  }
                };

                reqPerDay.push(merged);
              }
            }
          }
        }
      }

      for (let i2 = 0; i2 < member.public_holiday.public_holiday_days.length; i2++) {
        const public_holiday = member.public_holiday.public_holiday_days[i2];
        if (public_holiday && new Date(public_holiday.date) >= start && new Date(public_holiday.date) <= end) {
          const fullday = t('Full_Day');

          const merged = {
            ...member,
            ...{
              date: new Date(public_holiday.date),
              month: new Date(public_holiday.date).toLocaleString(language, {
                month: 'long'
              }),
              fullday,
              leave_type_name: member.public_holiday.name,
              status: 'PUBLIC HOLIDAY',
              weekday: new Date(public_holiday.date).toLocaleString(language, {
                weekday: 'long'
              })
            }
          };

          reqPerDay.push(merged);
        }
      }

      reqPerDay.sort(function (a, b) {
        return `${a.name}`.localeCompare(`${b.name}`) || a.date.getTime() - b.date.getTime();
      });
      if (!subscriptionAvailable && index == 1) {
        break;
      }
    }
  }

  return reqPerDay;
}
function sortApprovers(
  approver: {
    reason: string | null;
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    status_change_date: Date | null;
    status_changed_by_member: {
      name: string | null;
    } | null;
    approver_member: {
      name: string | null;
    } | null;
  }[]
) {
  const items: string[] = [];
  const approvers: {
    reason: string | null;
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    status_change_date: Date | null;
    status_changed_by_member: {
      name: string | null;
    } | null;
    approver_member: {
      name: string | null;
    } | null;
  }[] = [];
  const first = approver.find((y) => y.predecessor_request_member_approver_id == null);
  if (first) {
    items.push(`${first.approver_member_id}`);
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
