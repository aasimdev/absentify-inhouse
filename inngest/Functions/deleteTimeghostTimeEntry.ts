import { Prisma, SyncStatus, TimeghostAccesStatus } from '@prisma/client';
import { inngest } from '../inngest_client';
import { slugify, NonRetriableError, RetryAfterError } from 'inngest';
import { prisma } from '~/server/db';
import * as Sentry from '@sentry/nextjs';
import axios, { AxiosError } from 'axios';
import { TimeghostService } from '~/lib/timeghostService';
import { TimeghostUser } from './createTimeghostTimeEntry';
const request_select = Prisma.validator<Prisma.RequestSelect>()({
  id: true,
  start: true,
  start_at: true,
  end: true,
  end_at: true,
  workspace_id: true,
  details: {
    select: {
      leave_type_id: true,
      leave_type: {
        select: {
          outlook_synchronization_subject: true,
          name: true,
          outlook_synchronization_show_as: true
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

export const deleteTimeghostTimeEntries = inngest.createFunction(
  {
    id: slugify('Delete timeghost time entries via timeghost API'),
    name: 'Delete timeghost time entries via timeghost API',
    concurrency: { limit: 200 } // is 200 ok??
  },
  { event: 'request/delete_timeghost_time_entries' },
  async ({ event, step, logger }) => {
    const sync_log_id = event.data.sync_log_id;

    const sync = await prisma.requestSyncLog.findUnique({
      where: { id: sync_log_id },
      select: {
        timeghost_item_id: true,
        timeghost_workspace_id: true,
        request_id: true,
        timeghost_sync_setting: { select: {id:true, name: true, timeghost_api_access_token: true,invalid_apikey_notification_sent: true} },
        sync_status: true,
        timeghost_user_id: true,
        request: {select :{requester_member: {select: { microsoft_user_id: true}}}}
      }
    });

    if (sync && sync.timeghost_item_id && sync.timeghost_workspace_id && sync.timeghost_sync_setting) {
      const apiKey = sync.timeghost_sync_setting.timeghost_api_access_token;
      const sync_setting_name = sync.timeghost_sync_setting.name;
      const sync_setting_id = sync.timeghost_sync_setting.id 
      const timeghost_sync_setting_invalid_apikey_notification_sent = sync.timeghost_sync_setting.invalid_apikey_notification_sent
      const timeghost_item_id = sync.timeghost_item_id;
      const user_id = sync.request.requester_member.microsoft_user_id;
      const timeghost_workspace_id = sync.timeghost_workspace_id;
      //check if timeghost_api_access_token is still valid')

      const firstStepOutput = await step.run('Check if timeghost_api_access_token is still valid', async () => {
        try {
          const response = await TimeghostService.makeCurrentUserRequest(apiKey, 'get/currentuser');
          if (response.data) {
            let is_timeghost_user_active = false;
           let workspace_ids:string[] = [];
            response.data.workspaces.forEach((workspace:{id:string,name:string}) => {
              workspace_ids.push(workspace.id);
            });
            for (let i = 0; i < workspace_ids.length; i++) {
              let workspace_id = workspace_ids[i];
              if(workspace_id){
                const w = await TimeghostService.makeWorkspaceRequest(apiKey, `get/workspaces/${workspace_id}`);
                is_timeghost_user_active = w.data.users.some((user: TimeghostUser) => user.id == user_id);
                if(is_timeghost_user_active){
                  break;
                }
              }
            }
            return {
              message: 'Timeghost API access authenticated',
              is_timeghost_user_active
            };
          }
        } catch (error) {
          if (axios.isAxiosError(error)) {
            

            // This is an Axios error
            const axiosError = error as AxiosError;

            if (axiosError.response) {
              const { status, data } = axiosError.response;
              if (status === 500) {
                await prisma.requestSyncLog.update({
                  where: { id: sync_log_id },
                  data: {
                    sync_status: SyncStatus.MustBeDeleted,
                    timeghost_api_access_token: apiKey,
                    timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                    error: `${status} ${JSON.stringify(data)}`
                  },
                  select: { id: true }
                }); 
                if(typeof data === 'object' && data != null && 'message' in data && typeof data.message === 'string'){
                  if(data.message.includes('Unable to validate Token')){
                       // Update the notification_sent flag in the database
                    await prisma.timeghostSyncSetting.update({
                      where: { id: sync_setting_id },
                      data: {
                        invalid_apikey_notification_sent: true
                      }
                    });
                        if (event.data.first_event) {
                          //sending mail error notification
                            await inngest.send({
                              name: 'request/notifications.timeghost_sync_error',
                              data: {
                                request_id: sync.request_id,
                                timeghost_sync_setting_name: sync_setting_name,
                                timeghost_sync_setting_invalid_apikey_notification_sent: timeghost_sync_setting_invalid_apikey_notification_sent,
                              }
                            });
                          }
                          return `${status} ${JSON.stringify(data)}`;
                        }
                    }
                throw new RetryAfterError(`${status} ${JSON.stringify(data)}`, 10 * 60 * 1000);
              } else {
                await prisma.requestSyncLog.update({
                  where: { id: sync_log_id },
                  data: {
                    sync_status: SyncStatus.MustBeDeleted,
                    timeghost_api_access_token: apiKey,
                    timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                    error: `${status} ${JSON.stringify(data)}`
                  },
                  select: { id: true }
                });
                throw new RetryAfterError(`${status} ${JSON.stringify(data)}`, 10 * 60 * 1000); //10 min
              }

             
            } else if (axiosError.request) {
              await prisma.requestSyncLog.update({
                where: { id: sync_log_id },
                data: {
                  sync_status: SyncStatus.MustBeDeleted,
                  timeghost_api_access_token: apiKey,
                  timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                  error: 'No response received from the timeghost API'
                },
                select: { id: true }
              });
              throw new RetryAfterError('No response received from the timeghost API', 10 * 60 * 1000); //10 min
            } else {
              await prisma.requestSyncLog.update({
                where: { id: sync_log_id },
                data: {
                  sync_status: SyncStatus.MustBeDeleted,
                  timeghost_api_access_token: apiKey,
                  timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                  error: `${axiosError.message}`
                },
                select: { id: true }
              });
              throw new RetryAfterError(`Error setting up the request: ${axiosError.message}`, 10 * 60 * 1000); //10 min
            }
          } else {
            throw error;
          }
        }
      });

      // Check if firstStepOutput exists and has the is_timeghost_user_active property
      if (typeof firstStepOutput === 'object' && firstStepOutput !== null) {
        if (firstStepOutput.is_timeghost_user_active) {
          await step.run('Delete timeghost Entry by ItemId', async () => {
            //delete timeghost time entry

            const url = `https://timeghost-api.azurewebsites.net/api/delete/comego/${timeghost_item_id}`;

            try {
              const res = await axios.delete(url, {
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'workspace-id': timeghost_workspace_id
                }
              });
              if (res.data) {
                await prisma.requestSyncLog.updateMany({
                  where: { id: sync_log_id },
                  data: { sync_status: SyncStatus.Removed, error: null, timeghost_api_access_token:apiKey }
                });
                logger.info('timeghost time entry deleted');
                return 'timeghost time entry deleted';
              }
            } catch (error) {
              if (axios.isAxiosError(error)) {
                // This is an Axios error
                const axiosError = error as AxiosError;
                logger.info('error deleting timeghost time entry');
                Sentry.captureException(error);
                if (axiosError.response) {
                  // The request was made and the server responded with a status code
                  // that falls out of the range of 2xx
                  const status = axiosError.response.status;
                  const responseData = axiosError.response.data;
                  if(status === 429){
                    await prisma.requestSyncLog.update({
                      where: { id: sync_log_id },
                      data: { sync_status: SyncStatus.MustBeDeleted, timeghost_api_access_token: apiKey,
                        timeghost_api_access_authenticated: TimeghostAccesStatus.Success, error: 'Too Many Requests: Rate limit exceeded' },
                    });
                    throw new RetryAfterError('Too Many Requests: Rate limit exceeded', 10 * 60 * 1000);
                  }
                  if (status === 500 ) {
                    if(typeof responseData === 'object' && responseData != null && 'message' in responseData && typeof responseData.message === 'string'){
                      if(responseData.message.includes('The request rate is too large')){
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: { sync_status: SyncStatus.MustBeDeleted, timeghost_api_access_token: apiKey,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success, error: `${status} ${JSON.stringify(responseData)}` }
                          });
                          throw new Error(`${status} ${JSON.stringify(responseData)}`); 
                      }
                    }
                  } else  {
                    await prisma.requestSyncLog.update({
                      where: { id: sync_log_id },
                      data: { sync_status: SyncStatus.MustBeDeleted, timeghost_api_access_token: apiKey,
                        timeghost_api_access_authenticated: TimeghostAccesStatus.Success, error: `${status} ${JSON.stringify(responseData)}` }
                    });
                    throw new RetryAfterError(
                      `error deleting timeghost time entry: ${status} ${JSON.stringify(responseData)}`, 10 * 60 * 1000
                    );
                  }
                } else if (axiosError.request) {
                  // The request was made but no response was received
                  await prisma.requestSyncLog.update({
                    where: { id: sync_log_id },
                    data: {
                      sync_status: SyncStatus.MustBeDeleted,
                      timeghost_api_access_token: apiKey,
                      timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                      error: 'No response received from the timeghost API'
                    }
                  });
                  throw new RetryAfterError('No response received from the timeghost API', 10 * 60 * 1000); //10 min
                } else {
                  // Something happened in setting up the request that triggered an Error
                  await prisma.requestSyncLog.update({
                    where: { id: sync_log_id },
                    data: {
                      sync_status: SyncStatus.MustBeDeleted,
                      timeghost_api_access_token: apiKey,
                      timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                      error: `Error setting up the request: ${axiosError.message}`
                    }
                  });
                  throw new RetryAfterError('No response received from the timeghost API', 10 * 60 * 1000); //10 min
                }
              } else {
                // This is not an Axios error
                throw error;
              }
            }
          });
          return 'timeghost time entries deleted';
        } else {
          return {
            message: 'Timeghost user is inactive'
          };
        }
      }
    } else {
      await prisma.requestSyncLog.update({
        where: { id: sync_log_id },
        data: {
          sync_status: SyncStatus.Failed,
          error: 'Canceled or Declined Request'
        },
        select: { id: true }
      });
      return {
        message: 'Canceled or Declined Request'
      }
    }
  }
);

export const deleteTimeghostSyncSetting = inngest.createFunction(
  {
    id: slugify('Delete timeghost sync setting'),
    name: 'Delete timeghost sync setting '
  },
  { event: 'request/delete_timeghost_sync_setting' },
  async ({ event, step }) => {
    const timeghost_sync_setting_id = event.data.timeghost_sync_setting_id;
    const deletePastSyncsInTg = event.data.deletePastSyncsInTg;
    await step.run('Delete timeghost sync setting with all data by sync_log_id', async () => {
      if (deletePastSyncsInTg) {
        const requestSyncLogs = await prisma.requestSyncLog.findMany({
          where: { timeghost_sync_setting_id: timeghost_sync_setting_id, sync_status: SyncStatus.Synced },
          select: { id: true }
        });
        if (requestSyncLogs.length > 0) {
          await inngest.send(
            requestSyncLogs.map((log,i) => {
              if(i == 0){
                return {
                  name: 'request/delete_timeghost_time_entries',
                  data: {
                    sync_log_id: log.id,
                    first_event: true
                  }
                };
              } else {
                return {
                  name: 'request/delete_timeghost_time_entries',
                  data: {
                    sync_log_id: log.id,
                    first_event: false
                  }
                };
              }
            })
          );
        }
      }
    });
    //delete timeghost sync setting from db;
    await step.sleep('wait-1-day', '1d');
    await step.run('Delete timeghost sync setting', async () => {
      await prisma.timeghostSyncSetting.delete({ where: { id: timeghost_sync_setting_id } });
    });
  }
);
