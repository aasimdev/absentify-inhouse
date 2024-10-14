import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { RetryAfterError } from 'inngest';
import { getMicrosoftCalendarAccessToken } from '~/lib/getMicrosoftAccessToken';
import { decode } from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { addDays } from 'date-fns';
import { hasEnterpriseSubscription, summarizeSubscriptions } from '~/lib/subscriptionHelper';

export const createPublicHolidaySyncItemsForMember = inngest.createFunction(
  {
    id: 'create-public-holiday-sync-items-for-member',
    name: 'Create Public Holiday Sync Items for Member'
  },
  { event: 'publicHolidayDaySync/create_sync_items_for_member' },
  async ({ event }) => {
    const member = await prisma.member.findUnique({
      where: { id: event.data.member_id },
      select: {
        id: true,
        microsoft_tenantId: true,
        microsoft_user_id: true,
        workspace_id: true,
        public_holiday_id: true,
        status: true
      }
    });
    if (!member) return;
    const workspace = await prisma.workspace.findUnique({
      where: { id: member.workspace_id },
      select: {
        microsoft_calendars_read_write: true,
        subscriptions: {
          select: {
            status: true,
            cancellation_effective_date: true,
            subscription_plan_id: true,
            billing_cycle_interval: true,
            quantity: true,
            provider: true,
            subscription_id: true
          }
        }
      }
    });
    if (!workspace) return;

    if (workspace.microsoft_calendars_read_write != 'ACTIVATED') return;

    const calSyncs = await prisma.publicHolidayDaySyncStatus.findMany({
      where: { member_id: member.id, outlook_event_id: { not: null } },
      select: {
        id: true,
        microsoft_tenant_id: true
      }
    });
    if (calSyncs.length > 0)
      await inngest.send(
        calSyncs.map((calSync) => {
          return {
            name: 'publicHolidayDaySync/batch_delete_outlook_calendar_entry',
            data: {
              microsoft_tenant_id: calSync.microsoft_tenant_id,
              public_holiday_day_sync_status_id: calSync.id
            }
          };
        })
      );

    const subscription = summarizeSubscriptions(workspace.subscriptions);
    if (!subscription.has_valid_subscription) {
      return;
    }
    if (!subscription.business && subscription.enterprise == 0) {
      return;
    }

    if (member.microsoft_tenantId && member.microsoft_user_id && member.status != 'ARCHIVED') {
      const publicHolidayDays = await prisma.publicHolidayDay.findMany({
        where: { public_holiday_id: member.public_holiday_id, year: { gte: new Date().getUTCFullYear() } },
        select: { id: true }
      });

      const createdIds = [];

      for (const day of publicHolidayDays) {
        const createdRecord = await prisma.publicHolidayDaySyncStatus.create({
          data: {
            microsoft_tenant_id: member.microsoft_tenantId,
            member_id: member.id,
            synced_status: 'pending',
            microsoft_user_id: member.microsoft_user_id,
            public_holiday_day_id: day.id,
            workspace_id: member.workspace_id
          },
          select: { id: true }
        });
        createdIds.push(createdRecord.id);
      }
      await inngest.send(
        createdIds.map((x) => {
          return {
            // The event name
            name: 'publicHolidayDaySync/batch_create_outlook_calendar_entry',
            // The event's data
            data: {
              microsoft_tenant_id: member.microsoft_tenantId + '',
              public_holiday_day_sync_status_id: x
            }
          };
        })
      );
    }
  }
);

export const batchDeletePublicHolidayFromOutlook = inngest.createFunction(
  {
    id: 'batch-delete-public-holidays-from-microsoft-calendar',
    name: 'Batch Delete Public Holidays from Microsoft Calendar',
    batchEvents: {
      maxSize: 20,
      timeout: '5s',
      key: 'event.data.microsoft_tenant_id'
    },
    concurrency: {
      limit: 1,
      key: 'event.data.microsoft_tenant_id'
    }
  },
  { event: 'publicHolidayDaySync/batch_delete_outlook_calendar_entry' },
  async ({ events }) => {
    const tenantId = events[0].data.microsoft_tenant_id;
    let access_token = '';
    try {
      access_token = await getMicrosoftCalendarAccessToken(tenantId);
      const t: any = decode(access_token);

      if (!t.roles || !t.roles.find((x: string) => x === 'Calendars.ReadWrite')) {
        return { success: false, reason: 'Insufficient permissions' };
      }
    } catch (e) {
      console.log(e);
      return { success: false, reason: 'Insufficient permissions' };
    }
    if (!access_token) {
      return { success: false, reason: 'Insufficient permissions' };
    }

    const calSyncs = await prisma.publicHolidayDaySyncStatus.findMany({
      where: { id: { in: events.map((e) => e.data.public_holiday_day_sync_status_id) } },
      select: {
        id: true,
        microsoft_tenant_id: true,
        outlook_event_id: true,
        microsoft_user_id: true
      }
    });

    const batchRequests = calSyncs.map((calSync) => {
      const url = `/users/${calSync.microsoft_user_id}/calendar/events/${calSync.outlook_event_id}`;

      return {
        id: calSync.id,
        method: 'DELETE',
        url: url
      };
    });

    const batchBody = {
      requests: batchRequests
    };

    try {
      const response = await axios.post('https://graph.microsoft.com/v1.0/$batch', batchBody, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const responseBody = response.data;
      for (const res of responseBody.responses) {
        console.log(res);
        const calSync = calSyncs.find((e) => e.id + '' === res.id + '');
        if (!calSync) continue;

        if (res.status >= 200 && res.status < 300) {
          await prisma.publicHolidayDaySyncStatus.delete({
            where: { id: calSync.id }
          });
        } else if (res.status === 404) {
          await prisma.publicHolidayDaySyncStatus.delete({
            where: { id: calSync.id }
          });
        } else if (res.status === 429) {
          const retryAfter = res.headers['Retry-After'] || 5;
          throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
        } else {
          await prisma.publicHolidayDaySyncStatus.update({
            where: { id: calSync.id },
            data: {
              synced_status: 'error',
              synced_error: res.statusText,
              synced_error_detail: JSON.stringify(res.body),
              retry_count: { increment: 1 }
            }
          });
        }
      }
    } catch (err) {
      console.log(err);
      if (err instanceof RetryAfterError) {
        throw err;
      }
      const error = err as AxiosError;
      if (error.response && error.response.status === 429) {
        events[0].id;
        const retryAfter = error.response.headers['Retry-After'] || 5;
        throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
      } else {
        throw error;
      }
    }

    return { success: true };
  }
);

export const batchCreatePublicHolidayInOutlook = inngest.createFunction(
  {
    id: 'batch-create-public-holidays-in-microsoft-calendar',
    name: 'Batch Create Public Holidays in Microsoft Calendar',
    batchEvents: {
      maxSize: 20,
      timeout: '5s',
      key: 'event.data.microsoft_tenant_id'
    },
    concurrency: {
      limit: 1,
      key: 'event.data.microsoft_tenant_id'
    }
  },
  { event: 'publicHolidayDaySync/batch_create_outlook_calendar_entry' },
  async ({ events }) => {
    const tenantId = events[0].data.microsoft_tenant_id;
    let access_token = '';
    try {
      access_token = await getMicrosoftCalendarAccessToken(tenantId);
      const t: any = decode(access_token);

      if (!t.roles || !t.roles.find((x: string) => x === 'Calendars.ReadWrite')) {
        return { success: false, reason: 'Insufficient permissions' };
      }
    } catch (e) {
      console.log(e);
      return { success: false, reason: 'Insufficient permissions' };
    }
    if (!access_token) {
      return { success: false, reason: 'Insufficient permissions' };
    }

    const syncItems = await prisma.publicHolidayDaySyncStatus.findMany({
      where: {
        id: { in: events.map((e) => e.data.public_holiday_day_sync_status_id) },
        retry_count: { lt: 5 },
        synced_status: { not: 'success' }
      },
      select: {
        id: true,
        retry_count: true,
        member: {
          select: {
            id: true,
            timezone: true,
            language: true,
            microsoft_tenantId: true,
            microsoft_user_id: true,
            workspace: {
              select: {
                global_timezone: true,
                subscriptions: {
                  select: {
                    status: true,
                    subscription_plan_id: true,
                    cancellation_effective_date: true
                  }
                }
              }
            }
          }
        },
        public_holiday_day: {
          select: {
            id: true,
            date: true,
            duration: true,
            holiday_api: {
              select: {
                holiday_api_languages: {
                  select: {
                    name: true,
                    language: true
                  }
                }
              }
            },
            public_holiday_day_languages: {
              select: {
                language: true,
                name: true
              }
            }
          }
        }
      }
    });

    let batchRequests = [];

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (!event) continue;

      const data = event.data;

      const syncItem = syncItems.find((e) => e.id === data.public_holiday_day_sync_status_id);
      if (!syncItem) continue;

      const member = syncItem.member;
      if (!member) continue;
      if (!member.microsoft_user_id) continue;
      const public_holiday_day = syncItem.public_holiday_day;

      if (!public_holiday_day) continue;

      let start = new Date(
        Date.UTC(
          public_holiday_day.date.getUTCFullYear(),
          public_holiday_day.date.getUTCMonth(),
          public_holiday_day.date.getUTCDate(),
          0,
          0,
          0
        )
      );
      let end = new Date(
        Date.UTC(
          public_holiday_day.date.getUTCFullYear(),
          public_holiday_day.date.getUTCMonth(),
          public_holiday_day.date.getUTCDate(),
          0,
          0,
          0
        )
      );

      let isAllDay = false;

      if (public_holiday_day.duration == 'FullDay') {
        isAllDay = true;
        start.setUTCHours(0, 0, 0, 0);
        end = addDays(end.setUTCHours(0, 0, 0, 0), 1);
      } else if (public_holiday_day.duration == 'Morning') {
        isAllDay = false;
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(12, 0, 0, 0);
      } else if (public_holiday_day.duration == 'Afternoon') {
        isAllDay = false;
        start.setUTCHours(12, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 0);
      }

      let name = 'Temnp';
      if (public_holiday_day.holiday_api && public_holiday_day.holiday_api.holiday_api_languages.length > 0) {
        name =
          public_holiday_day.holiday_api.holiday_api_languages.find((e) => e.language === member.language)?.name ??
          'Temp';
      } else {
        name =
          public_holiday_day.public_holiday_day_languages.find((e) => e.language === member.language)?.name ?? 'Temp';
      }
      const dataToSend = {
        subject: name,
        isAllDay,
        body: {
          contentType: 'html',
          content: hasEnterpriseSubscription(member.workspace.subscriptions) ? '' : 'Created by absentify'
        },
        start: {
          dateTime: start.toISOString().replace('.000Z', ''),
          timeZone: member.timezone || member.workspace.global_timezone
        },
        end: {
          dateTime: end.toISOString().replace('.000Z', ''),
          timeZone: member.timezone || member.workspace.global_timezone
        },
        showAs: 'oof',
        isReminderOn: false
      };

      batchRequests.push({
        id: syncItem.id,
        method: 'POST',
        url: `/users/${member.microsoft_user_id}/calendar/events`,
        body: dataToSend,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    try {
      const batchResponse = await fetch('https://graph.microsoft.com/v1.0/$batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`
        },
        body: JSON.stringify({ requests: batchRequests })
      });

      const batchResult = await batchResponse.json();

      if (!batchResult.responses || !Array.isArray(batchResult.responses)) {
        throw new Error('Invalid batch response format: '+ JSON.stringify(batchResult));
      }

      for (const res of batchResult.responses) {
        console.log(res.status);
        const syncItem = syncItems.find((e) => e.id + '' === res.id + '');
        if (!syncItem) continue;

        if (res.status >= 200 && res.status < 300) {
          await prisma.publicHolidayDaySyncStatus.update({
            where: { id: syncItem.id },
            data: {
              outlook_event_id: res.body.id,
              synced_status: 'success',
              synced_date: new Date()
            },
            select: { id: true }
          });
          continue;
        } else if (res.status === 429) {
          const retryAfter = res.headers['Retry-After'] || 5;
          throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
        } else {
          await prisma.publicHolidayDaySyncStatus.update({
            where: { id: syncItem.id },
            data: {
              synced_status: 'error',
              synced_error: res.statusText,
              synced_error_detail: JSON.stringify(res.body),
              retry_count: { increment: 1 }
            },
            select: { id: true }
          });
          if (syncItem.member.microsoft_tenantId)
            inngest.send({
              name: 'publicHolidayDaySync/batch_create_outlook_calendar_entry',
              data: {
                public_holiday_day_sync_status_id: syncItem.id,
                microsoft_tenant_id: syncItem.member.microsoft_tenantId
              }
            });
        }
      }
    } catch (err) {
      console.log(err);

      if (err instanceof RetryAfterError) {
        throw err;
      }

      const error = err as AxiosError;
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['Retry-After'] || 5;
        throw new RetryAfterError('Hit Microsoft rate limit', retryAfter);
      } else {
        // Re-throw the error for other types of errors
        throw error;
      }
    }

    return { success: true };
  }
);
