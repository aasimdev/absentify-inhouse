import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { getMicrosoftCalendarAccessToken, getMicrosoftGroupsDelegatedAccessToken } from '~/lib/getMicrosoftAccessToken';
import { Prisma, PrismaClient, SyncStatus } from '@prisma/client';
import { decode } from 'jsonwebtoken';
import { addDays } from 'date-fns';
import { setRequestStartEndTimesBasedOnSchedule } from '~/lib/requestUtilities';
import * as Sentry from '@sentry/nextjs';
import { Logger } from 'inngest/middleware/logger';
import axios from 'axios';
import { RetryAfterError, slugify } from 'inngest';
import { hasEnterpriseSubscription } from '~/lib/subscriptionHelper';
import { cloneDeep } from 'lodash';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { dateFromDatabaseIgnoreTimezone, isDayUnit } from '~/lib/DateHelper';
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
      status: true,
      leave_type_id: true,
      leave_type: {
        select: {
          outlook_synchronization_subject: true,
          name: true,
          outlook_synchronization_show_as: true,
          sync_to_outlook_as_dynamics_365_tracked: true,
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
      token_member_id: true,
      calendarSyncSettingLeaveTypes: {
        select: { leave_type_id: true, sync_as_name: true }
      }
    }
  }
});

type requestSyncLog_selectOutput = Prisma.RequestSyncLogGetPayload<{
  select: typeof requestSyncLog_select;
}>;
export const updateCalendarEntry = inngest.createFunction(
  {
    id: slugify('Update calendar entry via graph or send iCal email'),
    name: 'Update calendar entry via graph or send iCal email',
    concurrency: {
      limit: 1,
      key: 'event.data.microsoft_tenant_id'
    }
  },
  { event: 'request/update_calendar_entry' },
  async ({ event, step, logger }) => {
    const request_id = event.data.request_id;

    await step.run('Update calendar entry via graph or send iCal email', async () => {
      try {
        const [requestSyncLogs, request] = await prisma.$transaction([
          prisma.requestSyncLog.findMany({
            where: { request_id: request_id, sync_status: SyncStatus.Synced, sync_type: { not: 'timeghost' } },
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

        await update_cal_entries(request, requestSyncLogs, logger, prisma);
      } catch (e: any) {
        Sentry.captureException(e);
        throw e;
      }
    });

    await step.run('Create approve only items', async () => {
      let syncItems = await prisma.requestSyncLog.findMany({
        where: {
          request_id: request_id,
          sync_status: SyncStatus.Skipped,
          timeghost_sync_setting_id: null
        },
        select: { id: true, calendar_sync_setting_id: true, calendar_microsoft_tenant_id: true }
      });
      if (syncItems.length > 0)
        await inngest.send(
          syncItems.map((x) => {
            return {
              name: 'request/create_calendar_entry',
              data: {
                request_id: request_id,
                sync_id: x.id,
                calendar_sync_setting_id: x.calendar_sync_setting_id,
                microsoft_tenant_id: x.calendar_microsoft_tenant_id + ''
              }
            };
          })
        );
    });
  }
);

async function update_cal_entries(
  request: request_selectOutput,
  requestSyncLogs: requestSyncLog_selectOutput[],
  logger: Logger,
  prisma: PrismaClient
) {
  for (let index = 0; index < requestSyncLogs.length; index++) {
    const sync = requestSyncLogs[index];
    if (!sync) continue;

    if (
      (sync.sync_type == 'Outlook_User_Calendar' ||
        sync.sync_type == 'Shared_Outlook_Calendar' ||
        sync.sync_type == 'Outlook_Group_Calendar') &&
      sync.calendar_event_id
    ) {
      await updateOutlookCalendar(request, sync, prisma);
      await prisma.requestSyncLog.update({
        where: { id: sync.id },
        data: { sync_status: SyncStatus.Synced }
      });
      logger.info('Updated outlook calendar event');
    } else if (sync.sync_type == 'Ical' && sync.calendar_event_id) {
      //todo doesnt work, i dont know why, the busystatus is not updateing in ical
      // await updateICalEvent(request, sync);
      await prisma.requestSyncLog.update({
        where: { id: sync.id },
        data: { sync_status: SyncStatus.Synced }
      });
      logger.info('Updated ical calendar event');
    } else {
      await prisma.requestSyncLog.update({
        where: { id: sync.id },
        data: { sync_status: SyncStatus.Skipped }
      });
      logger.info('Skipped calendar event');
    }
  }
}

async function updateOutlookCalendar(
  request: request_selectOutput,
  request_sync: requestSyncLog_selectOutput,
  prisma: PrismaClient
) {
  if (
    request.details?.requester_member &&
    request.details.requester_member?.microsoft_tenantId &&
    request.details.requester_member.microsoft_user_id
  ) {
    try {
      const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
        where: { workspace_id: request.workspace_id }
      });
      if (!workspaceSchedule) throw new Error('Workspace schedule not found');

      let isAllDay = false;
      const r = cloneDeep(request);

      setRequestStartEndTimesBasedOnSchedule(r, request.details.requester_member.schedules, workspaceSchedule);

      if (isDayUnit(r.leave_unit) && r.start_at == 'morning' && r.end_at == 'end_of_day') {
        isAllDay = true;
        r.start.setUTCHours(0, 0, 0, 0);
        r.end = addDays(r.end.setUTCHours(0, 0, 0, 0), 1);
      } else {
        r.start = dateFromDatabaseIgnoreTimezone(r.start);
        r.end = dateFromDatabaseIgnoreTimezone(r.end);
      }

      let subject = request.details?.leave_type.outlook_synchronization_subject
        ? request.details?.leave_type.outlook_synchronization_subject
        : request.details?.leave_type.name;
      if (request_sync && request_sync.calendar_sync_setting) {
        let syncAsName = request_sync.calendar_sync_setting?.calendarSyncSettingLeaveTypes.find(
          (x) => x.leave_type_id == r.details?.leave_type_id
        )?.sync_as_name;
        if (!syncAsName) syncAsName = subject;
        subject = `${r.details?.requester_member?.name} - ${subject}`;
      }
      let access_token = '';
      let url = '';
      if (request_sync.sync_type == 'Shared_Outlook_Calendar' || request_sync.sync_type == 'Outlook_User_Calendar') {
        access_token = await getMicrosoftCalendarAccessToken(
          request_sync.calendar_microsoft_tenant_id
            ? request_sync.calendar_microsoft_tenant_id
            : request.details?.requester_member.microsoft_tenantId
        );
        const t: any = decode(access_token);
        if (t.roles && t.roles.find((x: string) => x == 'Calendars.ReadWrite')) {
          url = `https://graph.microsoft.com/v1.0/users/${request_sync.calendar_microsoft_user_id}/calendar/events/${request_sync.calendar_event_id}`;
          if (request_sync.calendar_sync_setting) {
            url = `https://graph.microsoft.com/v1.0/users/${request_sync.calendar_microsoft_user_id}/calendars/${request_sync.calendar_id}/events/${request_sync.calendar_event_id}`;
          }
        } else {
          throw new Error('App does not have permission to update calendar event');
        }
      } else if (
        request_sync.sync_type == 'Outlook_Group_Calendar' &&
        request_sync.calendar_sync_setting?.token_member_id
      ) {
        access_token = await getMicrosoftGroupsDelegatedAccessToken(
          request_sync.calendar_sync_setting.token_member_id,
          prisma
        );

        const t: any = decode(access_token);
        if (t.scp && t.scp.indexOf('Group.ReadWrite.All') > -1) {
          url = `https://graph.microsoft.com/v1.0/groups/${request_sync.calendar_id}/calendar/events/${request_sync.calendar_event_id}`;
        } else {
          throw new Error('App does not have permission to update group calendar event');
        }
      }
      if (access_token == '') throw new Error('Access token not found');
      if (url == '') throw new Error('Url not found');

      let categories = [];
      if (request.details?.leave_type.sync_to_outlook_as_dynamics_365_tracked && request.details.requester_member) {
        try {
          const categoriesReturn = await axios.get(
            `https://graph.microsoft.com/v1.0/users/${request.details.requester_member.microsoft_user_id}/outlook/masterCategories`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${access_token}`
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

      let z = await axios.patch(
        url,
        {
          subject,
          isAllDay,
          body: {
            contentType: 'html',
            content: hasEnterpriseSubscription(request.workspace.subscriptions) ? '' : 'Created by absentify'
          },
          start: {
            dateTime: r.start.toISOString().replace('.000Z', ''),
            timeZone: isAllDay ? 'UTC' : r.details?.requester_member?.timezone || r.workspace.global_timezone
          },
          end: {
            dateTime: r.end.toISOString().replace('.000Z', ''),
            timeZone: isAllDay ? 'UTC' : r.details?.requester_member?.timezone || r.workspace.global_timezone
          },
          showAs:
            request.details?.status == 'PENDING'
              ? 'tentative'
              : request.details?.leave_type.outlook_synchronization_show_as,
          categories: categories
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access_token}`
          }
        }
      );

      if (z.status === 429) {
        const retryAfter = z.headers['Retry-After'] ? parseInt(z.headers['Retry-After'], 10) * 1000 : 5000; //  Set default to 5 seconds if not available

        throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
      }
    } catch (e) {
      console.log((e as any).response);
      Sentry.captureException(e);
      throw e;
    }
  }
}
