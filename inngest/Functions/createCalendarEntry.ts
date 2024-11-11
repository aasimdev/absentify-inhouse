import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { getMicrosoftCalendarAccessToken, getMicrosoftGroupsDelegatedAccessToken } from '~/lib/getMicrosoftAccessToken';
import { MicrosoftAppStatus, Prisma, PrismaClient, SyncStatus } from '@prisma/client';
import { decode } from 'jsonwebtoken';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { setRequestStartEndTimesBasedOnSchedule } from '~/lib/requestUtilities';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import ical, { ICalCalendarMethod, ICalEventBusyStatus, ICalEventData } from 'ical-generator';
import { RetryAfterError, slugify } from 'inngest';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';
import { cloneDeep } from 'lodash';
import { hasEnterpriseSubscription } from '~/lib/subscriptionHelper';
import { dateFromDatabaseIgnoreTimezone, isDayUnit } from '~/lib/DateHelper';
import { addDays } from 'date-fns';
import { Logger } from 'inngest/middleware/logger';
import { sendMail } from '~/lib/sendInBlueContactApi';
const request_select = Prisma.validator<Prisma.RequestSelect>()({
  id: true,
  start: true,
  start_at: true,
  end: true,
  end_at: true,
  leave_unit: true,
  workspace_id: true,
  workspace: {
    select: {
      microsoft_calendars_read_write: true,
      global_timezone: true,
      subscriptions: { select: { subscription_plan_id: true, cancellation_effective_date: true, status: true } },
      schedule: { select: defaultWorkspaceScheduleSelect }
    }
  },
  details: {
    select: {
      status: true,
      leave_type_id: true,
      leave_type: {
        select: {
          outlook_synchronization_subject: true,
          name: true,
          outlook_synchronization_show_as: true,
          sync_to_outlook_as_dynamics_365_tracked: true,
          sync_option: true,
          leave_unit: true
        }
      },
      requester_member: {
        select: {
          id: true,
          name: true,
          email: true,
          departments: { select: { department_id: true } },
          email_ical_notifications: true,
          microsoft_tenantId: true,
          microsoft_user_id: true,
          date_format: true,
          time_format: true,
          language: true,
          timezone: true,
          status: true,
          public_holiday: {
            select: {
              public_holiday_days: { select: { date: true, year: true } }
            }
          },
          schedules: {
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
            orderBy: { from: 'desc' }
          }
        }
      }
    }
  }
});
type request_selectOutput = Prisma.RequestGetPayload<{
  select: typeof request_select;
}>;

const calendarSyncSetting_select = Prisma.validator<Prisma.CalendarSyncSettingSelect>()({
  id: true,
  calendar_microsoft_user_id: true,
  calendar_microsoft_tenant_id: true,
  email: true,
  calendar_id: true,
  calendar_sync_type: true,
  token_member_id: true,
  calendarSyncSettingLeaveTypes: {
    select: { leave_type_id: true, sync_as_name: true, only_approved: true }
  },
  calendarSyncSettingDepartments: { select: { department_id: true } }
});

type calendarSyncSetting_selectOutput = Prisma.CalendarSyncSettingGetPayload<{
  select: typeof calendarSyncSetting_select;
}>;
export const createCalendarEntry = inngest.createFunction(
  {
    id: slugify('Create calendar entry via graph or send iCal email'),
    name: 'Create calendar entry via graph or send iCal email',
    cancelOn: [
      {
        event: 'request/delete_shared_calendar_setting', // The event name that cancels this function
        match: 'data.calendar_sync_setting_id' // The field that must match in both events received
      }
    ],
    concurrency: {
      limit: 1,
      key: 'event.data.microsoft_tenant_id'
    }
  },
  { event: 'request/create_calendar_entry' },
  async ({ event, step, logger }) => {
    const request_id = event.data.request_id;
    const sync_id = event.data.sync_id;
    const calendar_sync_setting_id = event.data.calendar_sync_setting_id;
    if (!calendar_sync_setting_id)
      await step.run('Create calendar entry via graph or send iCal email', async () => {
        try {
          let callId: {
            mode: string;
            id: string | null;
          } | null = null;
          const request = await prisma.request.findUnique({ where: { id: request_id }, select: request_select });
          if (!request) {
            logger.error('Request not found');
            throw new Error('Request not found');
          }

          if (
            request.details &&
            request.details.requester_member &&
            request.details.requester_member.microsoft_tenantId &&
            request.details.requester_member.microsoft_user_id
          ) {
            if (request.details.leave_type.sync_option == 'Disabled') {
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: { sync_status: SyncStatus.Skipped },
                select: { id: true }
              });
              return;
            }

            if (request.details.leave_type.sync_option === 'OnlyApproved' && request.details.status !== 'APPROVED') {
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: { sync_status: SyncStatus.Skipped },
                select: { id: true }
              });
              return;
            }

            if (request.workspace.microsoft_calendars_read_write == MicrosoftAppStatus.ACTIVATED) {
              const access_token = await getMicrosoftCalendarAccessToken(
                request.details.requester_member.microsoft_tenantId
              );
              const t: any = decode(access_token);
              let ok = false;

              if (t.roles && t.roles.find((x: string) => x == 'Calendars.ReadWrite')) {
                const url = `https://graph.microsoft.com/v1.0/users/${request.details.requester_member.microsoft_user_id}/calendar/events`;
                let cal = await createCalEvent(request, access_token, access_token, url, null);

                if (cal && cal.status === 429) {
                  const retryAfter = cal.headers['Retry-After']
                    ? parseInt(cal.headers['Retry-After'], 10) * 1000
                    : 5000; //  Set default to 5 seconds if not available

                  throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
                }

                if (cal) callId = { mode: 'Outlook_User_Calendar', id: cal.id };
                logger.info('Outlook calendar event created');

                ok = true;
              }
              if (!ok) {
                /* await prisma.workspace.update({
                  where: { id: request.workspace_id },
                  data: { microsoft_calendars_read_write: MicrosoftAppStatus.REVOKED },
                  select: { id: true }
                }); */

                const calId = await createICalEvent(request, null);
                callId = { mode: 'iCal', id: calId };
              }
            } else if (request.details.requester_member.status === 'ACTIVE') {
              const calId = await createICalEvent(request, null);
              callId = { mode: 'iCal', id: calId };
            }
          } else if (request.details?.requester_member?.email && request.details.requester_member.status === 'ACTIVE') {
            const calId = await createICalEvent(request, null);
            callId = { mode: 'iCal', id: calId };
          }

          if (!callId || !callId.id) {
            await prisma.requestSyncLog.update({
              where: { id: sync_id },
              data: { sync_status: SyncStatus.Skipped },
              select: { id: true }
            });
            logger.info('Skipped');
          } else {
            await prisma.requestSyncLog.update({
              where: { id: sync_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                calendar_microsoft_user_id: request.details?.requester_member?.microsoft_user_id,
                calendar_microsoft_tenant_id: request.details?.requester_member?.microsoft_tenantId,
                calendar_event_id: callId.id,
                email: callId.mode == 'iCal' ? request.details?.requester_member?.email : null,
                sync_status: SyncStatus.Synced,
                sync_type: callId.mode == 'iCal' ? 'Ical' : 'Outlook_User_Calendar'
              },
              select: { id: true }
            });
          }
        } catch (e: any) {
          logger.error(e);
          await prisma.requestSyncLog.update({
            where: { id: sync_id },
            data: {
              sync_status: SyncStatus.Failed,
              error: e.toString(),
              sync_type: 'Outlook_User_Calendar'
            },
            select: { id: true }
          });
          Sentry.captureException(e);
          throw e;
        }
      });
    if (calendar_sync_setting_id)
      await step.run('Create shared calendar entry via graph or mail', async () => {
        const [request, sharedCalSettings] = await prisma.$transaction([
          prisma.request.findUnique({ where: { id: request_id }, select: request_select }),
          prisma.calendarSyncSetting.findUnique({
            where: { id: calendar_sync_setting_id },
            select: calendarSyncSetting_select
          })
        ]);

        if (!request) {
          logger.error('Request not found');
          throw new Error('Request not found');
        }

        if (!sharedCalSettings) {
          logger.error('Calendar sync setting not found');
          throw new Error('Calendar sync setting not found');
        }
        //  console.log(request)
        if (sharedCalSettings.calendar_sync_type == 'outlook_calendar') {
          try {
            const calId = await createSharedOutlookCalEvent(request, sharedCalSettings, logger);
            if (calId)
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: {
                  workspace_id: request.workspace_id,
                  request_id: request.id,
                  calendar_event_id: calId.calId,
                  calendar_id: calId.calendar_id,
                  sync_status: SyncStatus.Synced,
                  sync_type: 'Shared_Outlook_Calendar',
                  calendar_sync_setting_id: sharedCalSettings.id,
                  calendar_microsoft_user_id: sharedCalSettings.calendar_microsoft_user_id,
                  calendar_microsoft_tenant_id: sharedCalSettings.calendar_microsoft_tenant_id
                },
                select: { id: true }
              });
            else {
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: { sync_status: SyncStatus.Skipped },
                select: { id: true }
              });
            }
          } catch (e: any) {
            await prisma.requestSyncLog.update({
              where: { id: sync_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                sync_status: SyncStatus.Failed,
                error: e.toString(),
                sync_type: 'Shared_Outlook_Calendar',
                calendar_sync_setting_id: sharedCalSettings.id,
                calendar_microsoft_user_id: sharedCalSettings.calendar_microsoft_user_id,
                calendar_microsoft_tenant_id: sharedCalSettings.calendar_microsoft_tenant_id
              },
              select: { id: true }
            });
            console.log(e);
            throw e;
          }
        } else if (sharedCalSettings.calendar_sync_type == 'outlook_group_calendar') {
          try {
            const calId = await createGroupOutlookCalEvent(request, sharedCalSettings, logger, prisma);
            if (calId)
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: {
                  workspace_id: request.workspace_id,
                  request_id: request.id,
                  calendar_event_id: calId.calId,
                  calendar_id: calId.calendar_id,
                  sync_status: SyncStatus.Synced,
                  sync_type: 'Outlook_Group_Calendar',
                  calendar_sync_setting_id: sharedCalSettings.id,
                  calendar_microsoft_user_id: sharedCalSettings.calendar_microsoft_user_id,
                  calendar_microsoft_tenant_id: sharedCalSettings.calendar_microsoft_tenant_id
                },
                select: { id: true }
              });
            else {
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: { sync_status: SyncStatus.Skipped },
                select: { id: true }
              });
            }
          } catch (e: any) {
            await prisma.requestSyncLog.update({
              where: { id: sync_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                sync_status: SyncStatus.Failed,
                error: e.toString(),
                sync_type: 'Outlook_Group_Calendar',
                calendar_sync_setting_id: sharedCalSettings.id,
                calendar_microsoft_user_id: sharedCalSettings.calendar_microsoft_user_id,
                calendar_microsoft_tenant_id: sharedCalSettings.calendar_microsoft_tenant_id
              },
              select: { id: true }
            });
            console.log(e);
            throw e;
          }
        } else if (sharedCalSettings.calendar_sync_type == 'ical_email') {
          try {
            const calId = await createICalEvent(request, sharedCalSettings);
            if (calId)
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: {
                  workspace_id: request.workspace_id,
                  request_id: request.id,
                  calendar_event_id: calId,
                  email: sharedCalSettings.email,
                  sync_status: SyncStatus.Synced,
                  sync_type: 'Ical',
                  calendar_sync_setting_id: sharedCalSettings.id
                },
                select: { id: true }
              });
            else {
              await prisma.requestSyncLog.update({
                where: { id: sync_id },
                data: { sync_status: SyncStatus.Skipped },
                select: { id: true }
              });
            }
          } catch (e: any) {
            await prisma.requestSyncLog.update({
              where: { id: sync_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                email: sharedCalSettings.email,
                sync_status: SyncStatus.Failed,
                error: e.toString(),
                sync_type: 'Ical',
                calendar_sync_setting_id: sharedCalSettings.id
              },
              select: { id: true }
            });
            console.log(e);
            throw e;
          }
        }
      });
  }
);

async function createCalEvent(
  request: request_selectOutput,
  access_token: string,
  access_token_outlook: string,
  url: string,
  sync: calendarSyncSetting_selectOutput | null
) {
  let categories = [];
  if (request.details?.leave_type.sync_to_outlook_as_dynamics_365_tracked && request.details.requester_member) {
    try {
      const categoriesReturn = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${request.details.requester_member.microsoft_user_id}/outlook/masterCategories`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access_token_outlook}`
          }
        }
      );

      if (categoriesReturn.status == 200) {
        const categoriesData = categoriesReturn.data.value;
        let cat = categoriesData.find((category: any) => category.id == '2d5d7f9e-44a2-4629-b7e6-2533db0aae02');
        if (cat) {
          categories.push(cat.displayName);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  let isAllDay = false;
  const r = cloneDeep(request);
  if (!r.workspace.schedule) {
    return null;
  }

  setRequestStartEndTimesBasedOnSchedule(r, r.details?.requester_member?.schedules ?? [], r.workspace.schedule);

  if (isDayUnit(r.leave_unit) && r.start_at == 'morning' && r.end_at == 'end_of_day') {
    isAllDay = true;
    r.start.setUTCHours(0, 0, 0, 0);
    r.end = addDays(r.end.setUTCHours(0, 0, 0, 0), 1);
  }

  let subject = r.details?.leave_type.outlook_synchronization_subject
    ? r.details?.leave_type.outlook_synchronization_subject
    : r.details?.leave_type.name;
  if (sync) {
    let syncAsName = sync.calendarSyncSettingLeaveTypes.find(
      (x) => x.leave_type_id == r.details?.leave_type_id
    )?.sync_as_name;
    if (syncAsName != undefined) {
      subject = `${r.details?.requester_member?.name} - ${syncAsName}`;
    } else {
      subject = `${r.details?.requester_member?.name} - ${subject}`;
    }
  }
  try {
    const dataToSend = {
      subject,
      isAllDay,
      body: {
        contentType: 'html',
        content: hasEnterpriseSubscription(request.workspace.subscriptions) ? '' : 'Created by absentify'
      },
      start: {
        dateTime: r.start.toISOString().replace('.000Z', ''),
        timeZone: r.details?.requester_member?.timezone || r.workspace.global_timezone
      },
      end: {
        dateTime: r.end.toISOString().replace('.000Z', ''),
        timeZone: r.details?.requester_member?.timezone || r.workspace.global_timezone
      },
      showAs: r.details?.status == 'PENDING' ? 'tentative' : r.details?.leave_type.outlook_synchronization_show_as,
      categories: categories,
      isReminderOn: false
    };
    const response = await axios.post(url, dataToSend, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`
      }
    });

    const z = response.data;
    if (z.id) {
      return {
        id: z.id,
        status: response.status,
        headers: response.headers
      };
    }
  } catch (e) {
    //if status is 429, back off is activated inside the createSharedOutlookCalEvent function
    //should we set the 429 status as not an error here?
    console.log((e as any).response.status);
    console.log((e as any).response.data.error);
    Sentry.captureException(e);
    return null;
  }
  return null;
}

async function createSharedOutlookCalEvent(
  request: request_selectOutput,
  calendar_sync_setting: calendarSyncSetting_selectOutput,
  logger: Logger
): Promise<{ calId: string; calendar_id: string | null } | null> {
  if (
    calendar_sync_setting &&
    calendar_sync_setting.calendar_id &&
    calendar_sync_setting.calendar_microsoft_tenant_id &&
    request.details?.requester_member
  ) {
    const leaveTypeSync = calendar_sync_setting.calendarSyncSettingLeaveTypes.find(
      (leave_type) => leave_type.leave_type_id === request.details?.leave_type_id
    );
    if (request.details.status !== 'APPROVED' && leaveTypeSync?.only_approved) return null;
    const access_token = await getMicrosoftCalendarAccessToken(calendar_sync_setting.calendar_microsoft_tenant_id);
    const t: any = decode(access_token);

    if (t.roles && t.roles.find((x: string) => x == 'Calendars.ReadWrite')) {
      const url = `https://graph.microsoft.com/v1.0/users/${calendar_sync_setting.calendar_microsoft_user_id}/calendars/${calendar_sync_setting.calendar_id}/events`;
      const calEvent = await createCalEvent(request, access_token, access_token, url, calendar_sync_setting);

      if (calEvent && calEvent.id) {
        // Handle success or other errors
        logger.error('Shared Calender event created');
        return { calId: calEvent.id, calendar_id: calendar_sync_setting.calendar_id };
      } else if (calEvent && calEvent.status === 429) {
        const retryAfter = calEvent.headers['Retry-After']
          ? parseInt(calEvent.headers['Retry-After'], 10) * 1000
          : 5000; //  Set default to 5 seconds if not available

        throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
      }
    }
  }
  return null;
}
async function createGroupOutlookCalEvent(
  request: request_selectOutput,
  calendar_sync_setting: calendarSyncSetting_selectOutput,
  logger: Logger,
  prisma: PrismaClient
): Promise<{ calId: string; calendar_id: string | null } | null> {
  if (
    calendar_sync_setting &&
    calendar_sync_setting.calendar_id &&
    calendar_sync_setting.calendar_microsoft_tenant_id &&
    request.details?.requester_member
  ) {
    const leaveTypeSync = calendar_sync_setting.calendarSyncSettingLeaveTypes.find(
      (leave_type) => leave_type.leave_type_id === request.details?.leave_type_id
    );
    if (request.details.status !== 'APPROVED' && leaveTypeSync?.only_approved) return null;
    if (!calendar_sync_setting.token_member_id) return null;
    const access_token = await getMicrosoftGroupsDelegatedAccessToken(calendar_sync_setting.token_member_id, prisma);
    const access_token_outlook = await getMicrosoftCalendarAccessToken(
      calendar_sync_setting.calendar_microsoft_tenant_id
    );
    const t: any = decode(access_token);

    if (t.scp && t.scp.indexOf('Group.ReadWrite.All') > -1) {
      const url = `https://graph.microsoft.com/v1.0/groups/${calendar_sync_setting.calendar_id}/calendar/events`;
      const calEvent = await createCalEvent(request, access_token, access_token_outlook, url, calendar_sync_setting);

      if (calEvent && calEvent.id) {
        // Handle success or other errors
        logger.error('Group Calender event created');
        return { calId: calEvent.id, calendar_id: calendar_sync_setting.calendar_id };
      } else if (calEvent && calEvent.status === 429) {
        const retryAfter = calEvent.headers['Retry-After']
          ? parseInt(calEvent.headers['Retry-After'], 10) * 1000
          : 5000; //  Set default to 5 seconds if not available

        throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
      }
    }
  }
  return null;
}
async function createICalEvent(
  request: request_selectOutput,
  calendar_sync_setting: calendarSyncSetting_selectOutput | null
) {
  if (!request.details) return null;
  if (!request.details.requester_member) return null;

  if (calendar_sync_setting) {
    const leaveTypeSync = calendar_sync_setting.calendarSyncSettingLeaveTypes.find(
      (leave_type) => leave_type.leave_type_id === request.details?.leave_type_id
    );
    if (request.details.status !== 'APPROVED' && leaveTypeSync?.only_approved) return null;
  } else {
    if (!request.details.requester_member.email_ical_notifications) return null;
  }

  const memberSchedules = await prisma.memberSchedule.findMany({
    select: defaultMemberScheduleSelect,
    where: { member_id: request.details.requester_member.id },
    orderBy: { from: 'desc' }
  });

  let isAllDay = false;
  const r = cloneDeep(request);
  if (!r.workspace.schedule) {
    return null;
  }

  setRequestStartEndTimesBasedOnSchedule(r, memberSchedules, r.workspace.schedule);

  if (isDayUnit(r.leave_unit) && r.start_at == 'morning' && r.end_at == 'end_of_day') {
    isAllDay = true;
    r.start.setUTCHours(0, 0, 0, 0);
    r.end = addDays(r.end.setUTCHours(0, 0, 0, 0), 1);
  }
  try {
    const cal = ical({
      timezone: request.details.requester_member.timezone || request.workspace.global_timezone,
      method: ICalCalendarMethod.REQUEST,
      name: request.details.leave_type.outlook_synchronization_subject
        ? request.details.leave_type.outlook_synchronization_subject
        : request.details.leave_type.name
    });

    let subject = request.details.leave_type.outlook_synchronization_subject
      ? request.details.leave_type.outlook_synchronization_subject
      : request.details.leave_type.name;
    if (calendar_sync_setting) {
      let syncAsName = calendar_sync_setting.calendarSyncSettingLeaveTypes.find(
        (x) => x.leave_type_id == request.details?.leave_type_id
      )?.sync_as_name;
      if (syncAsName != undefined) {
        subject = `${request.details.requester_member.name} - ${syncAsName}`;
      } else {
        subject = `${request.details.requester_member.name} - ${subject}`;
      }
    }

    let busystatus: ICalEventBusyStatus = ICalEventBusyStatus.BUSY;
    if (request.details?.leave_type.outlook_synchronization_show_as == 'free') busystatus = ICalEventBusyStatus.FREE;
    else if (request.details?.leave_type.outlook_synchronization_show_as == 'oof') busystatus = ICalEventBusyStatus.OOF;
    else if (request.details?.leave_type.outlook_synchronization_show_as == 'workingElsewhere')
      busystatus = ICalEventBusyStatus.FREE;
    else if (request.details?.leave_type.outlook_synchronization_show_as == 'tentative')
      busystatus = ICalEventBusyStatus.TENTATIVE;

    //todo the update ical method does not work, so we set the busy status directly to setting and not to tentative
    //if (request.details?.status == 'PENDING') busystatus = ICalEventBusyStatus.TENTATIVE;

    const iCalData: ICalEventData = {
      start: dateFromDatabaseIgnoreTimezone(r.start),
      end: dateFromDatabaseIgnoreTimezone(r.end),
      floating: false,
      timezone: request.details.requester_member.timezone || request.workspace.global_timezone,
      busystatus,
      //allDay creat issues with timezone and outlook
      // allDay: isAllDay,
      summary: subject,
      description: hasEnterpriseSubscription(request.workspace.subscriptions) ? '' : 'Created by absentify',
      url: 'https://absentify.com'
    };

    const event = cal.createEvent(iCalData);

    let calString = cal.toString();
    if (request.details.leave_type.outlook_synchronization_show_as == 'workingElsewhere') {
      calString = calString.replace(
        'X-MICROSOFT-CDO-BUSYSTATUS:FREE',
        'X-MICROSOFT-CDO-BUSYSTATUS:TENTATIVE\nX-MICROSOFT-CDO-INTENDEDSTATUS:WORKINGELSEWHERE'
      );
    }
    if (subject.length < 6) {
      subject = subject.padEnd(5, ' ') + '.'; // Fill the subject with spaces and add a period at the end
    }

    const base64CalString = Buffer.from(calString).toString('base64');

    await sendMail({
      prisma: prisma,
      workspace_id: request.workspace_id,
      subject: subject,
      plainText: 'Created by absentify',
      html: 'Created by <a href="https://absentify.com">absentify</a>',
      recipients: {
        to: [
          {
            address: calendar_sync_setting?.email
              ? calendar_sync_setting.email
              : `${request.details.requester_member.email}`
          }
        ]
      },
      attachments: [
        {
          name: 'invite.ics',
          contentType: 'text/calendar; method=REQUEST; charset="UTF-8"',
          contentInBase64: base64CalString
        }
      ],
      headers: {
        'Content-Class': 'urn:content-classes:calendarmessage',
        'Content-Type': 'text/calendar; method=REQUEST; charset="UTF-8"',
        'Content-Disposition': 'inline'
      }
    });

    const id = event.id();
    return id;
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
    return null;
  }
}
