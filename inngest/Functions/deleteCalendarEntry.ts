import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { getMicrosoftCalendarAccessToken, getMicrosoftGroupsDelegatedAccessToken } from '~/lib/getMicrosoftAccessToken';
import { Prisma, PrismaClient, SyncStatus, SyncType } from '@prisma/client';
import { decode } from 'jsonwebtoken';
import { setRequestStartEndTimesBasedOnSchedule } from '~/lib/requestUtilities';
import * as Sentry from '@sentry/nextjs';
import ical, { ICalCalendarMethod, ICalEventBusyStatus, ICalEventStatus } from 'ical-generator';
import { RetryAfterError, slugify } from 'inngest';
import { hasEnterpriseSubscription } from '~/lib/subscriptionHelper';
import { cloneDeep } from 'lodash';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { dateFromDatabaseIgnoreTimezone, isDayUnit } from '~/lib/DateHelper';
import { addDays } from 'date-fns';
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
      subscriptions: { select: { status: true, subscription_plan_id: true, cancellation_effective_date: true } }
    }
  },
  details: {
    select: {
      leave_type_id: true,
      leave_type: {
        select: {
          outlook_synchronization_subject: true,
          name: true,
          outlook_synchronization_show_as: true,
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
          public_holiday: {
            select: {
              public_holiday_days: { select: { date: true, year: true } }
            }
          },
          schedules: {
            select: defaultMemberScheduleSelect,
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

const requestSyncLog_select = Prisma.validator<Prisma.RequestSyncLogSelect>()({
  id: true,
  email: true,
  sync_type: true,
  calendar_id: true,
  request_id: true,
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

type requestSyncLog_selectOutput = Prisma.RequestSyncLogGetPayload<{
  select: typeof requestSyncLog_select;
}>;
export const deleteCalendarEntry = inngest.createFunction(
  {
    id: slugify('Delete calendar entry via graph or send iCal email'),
    name: 'Delete calendar entry via graph or send iCal email'
  },
  { event: 'request/delete_calendar_entry' },
  async ({ event, step, logger }) => {
    const request_id = event.data.request_id;
    await step.run('Delete calendar entry via graph or send iCal email', async () => {
      try {
        const [requestSyncLogs, request] = await prisma.$transaction([
          prisma.requestSyncLog.findMany({
            where: { request_id: request_id, sync_status: SyncStatus.Synced,timeghost_sync_setting_id: null },
            select: requestSyncLog_select
          }),
          prisma.request.findUnique({ where: { id: request_id }, select: request_select })
        ]);

        if (!request) {
          logger.error('Request not found');
          throw new Error('Request not found');
        }

        if (!requestSyncLogs) {
          logger.error('Sync not found');
          throw new Error('Sync not found');
        }
        for (let index = 0; index < requestSyncLogs.length; index++) {
          const sync = requestSyncLogs[index];
          if (sync) {
            if (
              (sync.sync_type == 'Shared_Outlook_Calendar' ||
                sync.sync_type == 'Outlook_Group_Calendar' ||
                sync.sync_type == 'Outlook_User_Calendar') &&
              sync.calendar_event_id
            ) {
              await inngest.send({
                name: 'request/delete_microsoft_cal_entry',
                data: {
                  sync_log_id: sync.id,
                  microsoft_tenant_id: sync.calendar_microsoft_tenant_id + ''
                }
              });
            } else if (sync.sync_type == 'Ical' && sync.calendar_event_id) {
              await deleteICalEvent(request, sync);
              await prisma.requestSyncLog.update({
                where: { id: sync.id },
                data: { sync_status: SyncStatus.Removed }
              });
              logger.info('Deleted ical calendar event');
            } else {
              await prisma.requestSyncLog.update({
                where: { id: sync.id },
                data: { sync_status: SyncStatus.Skipped }
              });
              logger.info('Skipped calendar event');
            }
          }
        }
      } catch (e: any) {
        Sentry.captureException(e);
        throw e;
      }
    });
  }
);

export const deleteSharedCalendarSetting = inngest.createFunction(
  {
    id: slugify('Delete shared calendar setting with all data'),
    name: 'Delete shared calendar setting with all data'
  },
  { event: 'request/delete_shared_calendar_setting' },
  async ({ event, step }) => {
    const shared_calendar_setting_id = event.data.calendar_sync_setting_id;

    await step.run('Delete shared calendar setting with all data', async () => {
      const requestSyncLogs = await prisma.requestSyncLog.findMany({
        where: { calendar_sync_setting_id: shared_calendar_setting_id, sync_status: SyncStatus.Synced },
        select: { id: true, calendar_microsoft_tenant_id: true }
      });
      if (requestSyncLogs.length > 0)
        await inngest.send(
          requestSyncLogs.map((log) => {
            return {
              name: 'request/delete_microsoft_cal_entry',
              data: {
                sync_log_id: log.id,
                microsoft_tenant_id: log.calendar_microsoft_tenant_id + ''
              }
            };
          })
        );
    });

    await step.sleep('wait-1-day', '1d');
    await step.run('Delete shared calendar setting', async () => {
      await prisma.calendarSyncSetting.delete({ where: { id: shared_calendar_setting_id } });
    });
  }
);

export const deleteMicrosoftCalEntry = inngest.createFunction(
  {
    id: slugify('Delete Microsoft Calendar entry'),
    name: 'Delete Microsoft Calendar entry',
    concurrency: {
      limit: 1,
      key: 'event.data.microsoft_tenant_id'
    }
  },
  { event: 'request/delete_microsoft_cal_entry' },
  async ({ event, step, logger }) => {
    const sync_log_id = event.data.sync_log_id;
    await step.run('Delete Outlook Cal Entry by sync_log_id', async () => {
      const sync = await prisma.requestSyncLog.findUnique({
        where: { id: sync_log_id },
        select: {
          calendar_microsoft_user_id: true,
          calendar_microsoft_tenant_id: true,
          calendar_event_id: true,
          calendar_id: true,
          sync_type: true,
          calendar_sync_setting: { select: { token_member_id: true } }
        }
      });
      if (sync && sync.calendar_microsoft_tenant_id && sync.calendar_microsoft_user_id && sync.calendar_event_id) {
        await deleteOutlookCalendar({
          calendar_event_id: sync.calendar_event_id,
          microsoft_tenantId: sync.calendar_microsoft_tenant_id,
          microsoft_user_id: sync.calendar_microsoft_user_id,
          calendar_id: sync.calendar_id ?? undefined,
          sync_type: sync.sync_type,
          token_member_id: sync.calendar_sync_setting?.token_member_id ?? null,
          prisma: prisma
        });
        await prisma.requestSyncLog.updateMany({
          where: { id: sync_log_id },
          data: { sync_status: SyncStatus.Removed }
        });
        logger.info('Deleted outlook calendar event');
      }
    });
  }
);

async function deleteICalEvent(request: request_selectOutput, sync: requestSyncLog_selectOutput) {
  if (request.details?.requester_member) {
    const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
      where: { workspace_id: request.workspace_id }
    });
    if (!workspaceSchedule) throw new Error('Workspace schedule not found');

    const r = cloneDeep(request);
    setRequestStartEndTimesBasedOnSchedule(r, request.details.requester_member.schedules, workspaceSchedule);

    let isAllDay = false;

    if (isDayUnit(r.leave_unit) && r.start_at == 'morning' && r.end_at == 'end_of_day') {
      isAllDay = true;
      r.start.setUTCHours(0, 0, 0, 0);
      r.end = addDays(r.end.setUTCHours(0, 0, 0, 0), 1);
    }

    try {
      let subject = request.details?.leave_type.outlook_synchronization_subject
        ? request.details?.leave_type.outlook_synchronization_subject
        : request.details?.leave_type.name;
      if (sync.calendar_sync_setting_id) {
        let syncAsName = sync.calendar_sync_setting?.calendarSyncSettingLeaveTypes.find(
          (x) => x.leave_type_id == r.details?.leave_type_id
        )?.sync_as_name;
        if (!syncAsName) syncAsName = subject;
        subject = `${r.details?.requester_member?.name} - ${subject}`;
      }

      const cal = ical({
        method: ICalCalendarMethod.CANCEL,

        name: request.details?.leave_type.outlook_synchronization_subject
          ? request.details?.leave_type.outlook_synchronization_subject
          : request.details?.leave_type.name
      });
      let busystatus: ICalEventBusyStatus = ICalEventBusyStatus.BUSY;
      if (request.details?.leave_type.outlook_synchronization_show_as == 'free') busystatus = ICalEventBusyStatus.FREE;
      else if (request.details?.leave_type.outlook_synchronization_show_as == 'oof')
        busystatus = ICalEventBusyStatus.OOF;
      else if (request.details?.leave_type.outlook_synchronization_show_as == 'tentative')
        busystatus = ICalEventBusyStatus.TENTATIVE;

      cal.createEvent({
        id: sync.calendar_event_id,
        status: ICalEventStatus.CANCELLED,
        start: dateFromDatabaseIgnoreTimezone(r.start),
        end: dateFromDatabaseIgnoreTimezone(r.end),
        floating: true,
        timezone: request.details?.requester_member?.timezone || request.workspace.global_timezone,
        busystatus,
        //allDay creat issues with timezone and outlook
        //allDay: isAllDay,
        summary: subject,
        description: hasEnterpriseSubscription(request.workspace.subscriptions) ? '' : 'Created by absentify',
        //   organizer: 'notifications@absentify.com',
        url: 'https://absentify.com'
      });

      const base64CalString = Buffer.from(cal.toString()).toString('base64');

      await sendMail({
        prisma: prisma,
        workspace_id: request.workspace_id,
        subject: subject,
        plainText: 'Created by absentify',
        html: 'Created by <a href="https://absentify.com">absentify</a>',
        recipients: {
          to: [
            {
              address: sync.email + ''
            }
          ]
        },
        attachments: [
          {
            name: 'invite.ics',
            contentType: 'text/calendar; method=CANCEL',
            contentInBase64: base64CalString
          }
        ],
        headers: {
          'Content-Class': 'urn:content-classes:calendarmessage',
          'Content-Type': 'text/calendar; method=CANCEL'
        }
      });
    } catch (e) {
      console.log((e as any).response);
      Sentry.captureException(e);
    }
  }
}
async function deleteOutlookCalendar(data: {
  microsoft_tenantId: string;
  microsoft_user_id: string;
  calendar_id?: string;
  calendar_event_id: string;
  sync_type: SyncType | null;
  token_member_id: string | null;
  prisma: PrismaClient;
}) {
  if (!data.sync_type) throw new Error('Sync type is missing');
  let url = '';
  let access_token = '';
  if (data.sync_type == 'Shared_Outlook_Calendar' || data.sync_type == 'Outlook_User_Calendar') {
    access_token = await getMicrosoftCalendarAccessToken(data.microsoft_tenantId);
    const t: any = decode(access_token);

    if (t.roles && t.roles.find((x: string) => x == 'Calendars.ReadWrite')) {
      url = `https://graph.microsoft.com/v1.0/users/${data.microsoft_user_id}/calendar/events/${data.calendar_event_id}`;
      if (data.calendar_id) {
        url = `https://graph.microsoft.com/v1.0/users/${data.microsoft_user_id}/calendars/${data.calendar_id}/events/${data.calendar_event_id}`;
      }
    }
  } else if (data.sync_type == 'Outlook_Group_Calendar' && data.token_member_id) {
    access_token = await getMicrosoftGroupsDelegatedAccessToken(data.token_member_id, data.prisma);
    const t: any = decode(access_token);
    if (t.scp && t.scp.indexOf('Group.ReadWrite.All') > -1) {
      url = `https://graph.microsoft.com/v1.0/groups/${data.calendar_id}/calendar/events/${data.calendar_event_id}`;
    } else {
      throw new Error('App does not have permission to update group calendar event');
    }
  }

  if (!url || !access_token) {
    throw new Error('Failed to delete event');
  }

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });

  if (res.ok) return;

  if (res.status === 429) {
    // Too many requests, need to back off

    const retryAfter = res.headers.get('Retry-After')
      ? parseInt(res.headers.get('Retry-After') || '5', 10) * 1000
      : 5000; //  Set default to 5 seconds if not available
    throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
  } else if (res.status === 404) {
    // Event not found, no need to retry
    return;
  } else {
    console.log(res.status);
    console.log(res.json());
    throw new Error('Failed to delete event');
  }
}
