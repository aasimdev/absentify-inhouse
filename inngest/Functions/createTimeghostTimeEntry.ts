import { inngest } from '../inngest_client';
import { RetryAfterError, slugify, NonRetriableError } from 'inngest';
import { prisma } from '~/server/db';
import { Prisma, SyncStatus, TimeghostAccesStatus } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { getDayStartAndEndTimeFromschedule } from '~/lib/requestUtilities';
import { BodyParams, TimeEntry, TimeghostService } from '~/lib/timeghostService';
import { zonedTimeToUtc } from 'date-fns-tz';
import { dateFromDatabaseIgnoreTimezone, isDayUnit } from '~/lib/DateHelper';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { cloneDeep } from 'lodash';
import axios, { AxiosError } from 'axios';

export interface TimeghostUser {
  id: string; // UUID format for user ID
  name: string; // Full name of the user
  email: string; // Email address
  admin: boolean; // Boolean flag for admin status
  has_license: boolean; // Boolean flag for license status
  removed?: boolean; // Optional property: true if the user is removed
  ts?: number | null; // Optional property: timestamp (can be a number or null)
}

const timeghostSyncSetting_select = Prisma.validator<Prisma.TimeghostSyncSettingSelect>()({
  id: true,
  workspace_id: true,
  name: true,
  timeghost_workspace_id: true,
  timeghost_api_access_token: true,
  invalid_apikey_notification_sent: true,
  deleted:true,
  timeghostSyncSettingLeaveTypes: {
    select: {
      leave_type_id: true
    }
  },
  timeghostSyncSettingDepartments: {
    select: {
      department_id: true
    }
  }
});

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

export const createTimeghostTimeEntries = inngest.createFunction(
  {
    id: slugify('Create timeghost time entries via timeghost API'),
    name: 'Create timeghost time entries via timeghost API',
    concurrency: { limit: 200 },
    cancelOn: [
      {
        //for requests in future dates: if request is canceled  within overview/ my calendar
        event: 'request/delete_timeghost_time_entries', // The event name that cancels this function
        match: 'data.request_id' // The field that must match in both events received
      },
      {
        //for requests in future dates: if timeghost_sync_setting is removed
        event: 'request/delete_timeghost_sync_setting', // The event name that cancels this function
        match: 'data.timeghost_sync_setting_id' // The field that must match in both events received
      }
    ]
  },
  {
    event: 'request/create_timeghost_time_entries'
  },
  async ({ event, step, logger }) => {
    const request_id = event.data.request_id;
    const sync_log_id = event.data.sync_log_id;
    const timeghost_sync_setting_id = event.data.timeghost_sync_setting_id;
    const for_update = event.data.for_update;

    if (timeghost_sync_setting_id) {
      const [requestFromDb, timeghostSyncSetting] = await prisma.$transaction([
        prisma.request.findUnique({ where: { id: request_id }, select: request_select }),
        prisma.timeghostSyncSetting.findUnique({
          where: { id: timeghost_sync_setting_id },
          select: timeghostSyncSetting_select
        })
      ]);
      //clone request
      const request = cloneDeep(requestFromDb);
      if (!request) {
        logger.error('Request not found');
        throw new Error('Request not found');
      }

      if (!timeghostSyncSetting) {
        logger.error('timeghost sync setting not found');
        throw new Error('timeghost sync setting not found');
      }

      if(timeghostSyncSetting.deleted){
        return {message: "timeghost sync setting not found"}
      }
      const apiKey = timeghostSyncSetting.timeghost_api_access_token;
      const notification_sent = timeghostSyncSetting.invalid_apikey_notification_sent;
      let schedule =
        request.details &&
        request.details.requester_member &&
        request.details.requester_member.schedules.find((x) => x.from && x.from <= request.start);
      if (!schedule) {
        const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
          where: { workspace_id: request.workspace_id }
        });

        schedule = workspaceSchedule as defaultMemberSelectOutput['schedules'][0];
      }
      const { start } = getDayStartAndEndTimeFromschedule(
        request.start,
        request.start_at == 'morning' ? 'morning' : 'afternoon',
        request.end_at == 'lunchtime' ? 'lunchtime' : 'end_of_day',
        schedule
      );

      if (request.details && request.details.requester_member && request.details.requester_member.timezone) {
        const timezone = request.details.requester_member.timezone;
        const startDateInUserTimezone = zonedTimeToUtc(dateFromDatabaseIgnoreTimezone(start), timezone);
        const timeghost_user_id = request.details.requester_member.microsoft_user_id;
        //send function to sleep if start date is in the future
        await step.sleepUntil('wait-for-start', startDateInUserTimezone.toISOString());
        const requestSyncLog = await prisma.requestSyncLog.findUnique({ where: { id: sync_log_id } });
        if (requestSyncLog) {
          //check if timeghost api key is still valid
          const first_step_output = await step.run('Check if timeghost api key is still valid', async () => {
            if (
              requestSyncLog.timeghost_api_access_authenticated === TimeghostAccesStatus.Error &&
              !for_update &&
              notification_sent 
            ) {
              //to prevent sending the same error notification multiple times
              return 'Email error notification for ' + timeghostSyncSetting.name + ' already sent';
            } else {
              try {
                //calling timeghost service to check if api key is still valid
                const response = await TimeghostService.makeCurrentUserRequest(apiKey, 'get/currentuser');
                if (response.data) {
                  let is_timeghost_user_active = false;
                  let workspace_ids: string[] = [];
                  response.data.workspaces.forEach((workspace: { id: string; name: string }) => {
                    workspace_ids.push(workspace.id);
                  });
                  for (let i = 0; i < workspace_ids.length; i++) {
                    let workspace_id = workspace_ids[i];
                    if (workspace_id) {
                      const w = await TimeghostService.makeWorkspaceRequest(apiKey, `get/workspaces/${workspace_id}`);
                      is_timeghost_user_active = w.data.users.some(
                        (user: TimeghostUser) => user.id == timeghost_user_id
                      );
                      if (is_timeghost_user_active) {
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
                          workspace_id: request.workspace_id,
                          request_id: request.id,
                          timeghost_sync_setting_id: timeghostSyncSetting.id,
                          sync_status: SyncStatus.Failed,
                          error: `${status} ${JSON.stringify(data)}`, //error message from timeghost
                          sync_type: 'timeghost',
                          timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                          timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                          timeghost_api_access_token: apiKey
                        },
                        select: { id: true }
                      });
                      if(typeof data === 'object' && data != null && 'message' in data && typeof data.message === 'string'){
                        if(data.message.includes('Unable to validate Token')){
                            // Update the notification_sent flag in the database
                            await prisma.timeghostSyncSetting.update({
                              where: { id: timeghostSyncSetting.id },
                              data: {
                                invalid_apikey_notification_sent: true
                              }
                            });
                            if (event.data.first_event) {
                              //sending mail error notification.....');
                              await inngest.send({
                                name: 'request/notifications.timeghost_sync_error',
                                data: {
                                  request_id: request.id,
                                  timeghost_sync_setting_name: timeghostSyncSetting.name,
                                  timeghost_sync_setting_invalid_apikey_notification_sent: notification_sent,
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
                          workspace_id: request.workspace_id,
                          request_id: request.id,
                          timeghost_sync_setting_id: timeghostSyncSetting.id,
                          sync_status: SyncStatus.Failed,
                          error: `${status} ${JSON.stringify(data)}`, //error message from timeghost
                          sync_type: 'timeghost',
                          timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                          timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                          timeghost_api_access_token: apiKey
                        },
                        select: { id: true }
                      });

                      throw new RetryAfterError(status + ':' + JSON.stringify(data), 10 * 60 * 1000); //10 min
                    }
                  } else if (axiosError.request) {
                    // The request was made but no response was received
                    await prisma.requestSyncLog.update({
                      where: { id: sync_log_id },
                      data: {
                        workspace_id: request.workspace_id,
                        request_id: request.id,
                        timeghost_sync_setting_id: timeghostSyncSetting.id,
                        sync_status: SyncStatus.Failed,
                        error: `No response received from the timeghost API`, //error message from timeghost
                        sync_type: 'timeghost',
                        timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                        timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                        timeghost_api_access_token: apiKey
                      },
                      select: { id: true }
                    });
                    throw new RetryAfterError(`No response received from the timeghost API`, 10 * 60 * 1000); //10 min
                  } else {
                    await prisma.requestSyncLog.update({
                      where: { id: sync_log_id },
                      data: {
                        workspace_id: request.workspace_id,
                        request_id: request.id,
                        timeghost_sync_setting_id: timeghostSyncSetting.id,
                        sync_status: SyncStatus.Failed,
                        error: `Error setting up the request: ${axiosError.message}`, //error message from timeghost
                        sync_type: 'timeghost',
                        timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                        timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                        timeghost_api_access_token: apiKey
                      },
                      select: { id: true }
                    });
                    throw new RetryAfterError(`Error setting up the request: ${axiosError.message}`, 10 * 60 * 1000); //10 min
                  }
                } else {
                  throw error;
                }
              }
            }
          });
          //Check if user in workspace
          const second_step_output: boolean | string = await step.run(
            'Check if user in timeghost workspace',
            async () => {
              if (timeghost_user_id) {
                try {
                  const response = await TimeghostService.makeWorkspaceRequest(
                    apiKey,
                    `get/workspaces/${timeghostSyncSetting.timeghost_workspace_id}`
                  );
                  if (response.data) {
                    return response.data.users.some((user: TimeghostUser) => user.id == timeghost_user_id);
                  }
                } catch (error) {
                  if (axios.isAxiosError(error)) {
                    // This is an Axios error
                    const axiosError = error as AxiosError;
                    if (axiosError.response) {
                      const { status, data } = axiosError.response;

                      return `${status} ${JSON.stringify(data)}`;
                    }
                  }
                  return JSON.stringify(error);
                }
              } else {
                return 'Admin has not yet activated the account - user inactive';
              }
            }
          );
          // Check if first_step_output exists and has the is_timeghost_user_active property
          if (first_step_output === null) {
            return {
              message: "Step 'Check if timeghost api key is still valid' failed!"
            };
          }
          //check if user active in absentify and timeghost
          if (
            typeof first_step_output == 'object' &&
            (!first_step_output.is_timeghost_user_active || timeghost_user_id == null)
          ) {
            await prisma.requestSyncLog.update({
              where: { id: sync_log_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                timeghost_sync_setting_id: timeghostSyncSetting.id,
                sync_status: SyncStatus.Failed,
                sync_type: 'timeghost',
                error: 'User is inactive',
                timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
              },
              select: { id: true }
            });
            return {
              message: 'User is inactive'
            };
          }

          //Check if user in workspace
          if (typeof second_step_output === 'boolean' && !second_step_output) {
            await prisma.requestSyncLog.update({
              where: { id: sync_log_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                timeghost_sync_setting_id: timeghostSyncSetting.id,
                sync_status: SyncStatus.Failed,
                sync_type: 'timeghost',
                error: `User not found in timeghost workspace`,
                timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
              },
              select: { id: true }
            });
            return {
              message: 'User not found in timeghost workspace'
            };
          }
          //Check if error occures by cheking if user in workspace
          if (typeof second_step_output === 'string') {
            await prisma.requestSyncLog.update({
              where: { id: sync_log_id },
              data: {
                workspace_id: request.workspace_id,
                request_id: request.id,
                timeghost_sync_setting_id: timeghostSyncSetting.id,
                sync_status: SyncStatus.Failed,
                sync_type: 'timeghost',
                error: second_step_output,
                timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
              },
              select: { id: true }
            });
            return {
              message: second_step_output
            };
          }

          await step.run('Create timeghost time entry via timeghost API', async () => {
            if (request.details && request.details.requester_member) {
              const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
                where: { workspace_id: request.workspace_id }
              });
              if (workspaceSchedule && request.details.status === 'APPROVED') {
                if (request.details && request.details.requester_member && request.details.requester_member.timezone) {
                  try {
                    const url = 'https://timeghost-api.azurewebsites.net/api/add/comego';
                    if (!requestSyncLog.timeghost_time_entry) {
                      return {
                        message: 'requestSyncLog timeghost_time_entry not found'
                      };
                    }
                    const input = {
                      url,
                      apiKey,
                      timeEntry: JSON.parse(requestSyncLog.timeghost_time_entry),
                      timeghost_user_id
                    };

                    const body = [input.timeEntry];
                    const headers = {
                      'Content-Type': 'application/json',
                      'x-api-key': input.apiKey,
                      'workspace-id': timeghostSyncSetting.timeghost_workspace_id
                    };
                    const response = await axios.post(input.url, body, { headers });
                    const synchronization = response.data;
                    if (synchronization) {
                      if (synchronization.id) {
                        await prisma.requestSyncLog.update({
                          where: { id: sync_log_id },
                          data: {
                            workspace_id: request.workspace_id,
                            request_id: request.id,
                            timeghost_sync_setting_id: timeghostSyncSetting.id,
                            timeghost_item_id: synchronization.id,
                            sync_status: SyncStatus.Synced,
                            sync_type: 'timeghost',
                            error: null,
                            timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                            timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token,
                            timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                            timeghost_user_id
                          },
                          select: { id: true }
                        });
                        logger.info('timeghost time entry created');
                      }
                    }

                    return {
                      message: 'timeghost time entry created'
                    };
                  } catch (error) {
                    if (axios.isAxiosError(error)) {
                      logger.info('api/add/comego failed');
                      Sentry.captureException(error);

                      // This is an Axios error
                      const axiosError = error as AxiosError;

                      if (axiosError.response) {
                        // The request was made and the server responded with a status code
                        // that falls out of the range of 2xx
                        const status = axiosError.response.status;
                        const responseData = axiosError.response.data;
                        if(status === 429){
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: 'Too Many Requests: Rate limit exceeded',
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          throw new RetryAfterError('Too Many Requests: Rate limit exceeded', 10 * 60 * 1000);
                        }

                        if (status === 500) {
                          if(typeof responseData === 'object' && responseData != null && 'message' in responseData && typeof responseData.message === 'string'){
                            if(responseData.message.includes('The request rate is too large')){
                              await prisma.requestSyncLog.update({
                                where: { id: sync_log_id },
                                data: {
                                  workspace_id: request.workspace_id,
                                  request_id: request.id,
                                  timeghost_sync_setting_id: timeghostSyncSetting.id,
                                  sync_status: SyncStatus.Failed,
                                  sync_type: 'timeghost',
                                  error: `${status} ${JSON.stringify(responseData)}`,
                                  timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                                  timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                                  timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                                },
                                select: { id: true }
                              });
                              throw new Error(`${status} ${JSON.stringify(responseData)}`); 
                            }
                          }
                        }
                        if (status === 401) {
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: `${status} ${JSON.stringify(responseData)}`,
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          return `${status} ${JSON.stringify(responseData)}`;
                        } else if (status === 503) {
                          // The service is unavailable. 5-6 sek
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: `${status} ${JSON.stringify(responseData)}`,
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          throw new RetryAfterError(status + ':' + JSON.stringify(responseData), 10 * 60 * 1000); //10 min
                        } else if (status === 404) {
                          // load balancer error
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: `${status} ${JSON.stringify(responseData)}`,
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          throw new RetryAfterError(status + ':' + JSON.stringify(responseData), 10 * 60 * 1000); //10 min
                        } else if (status === 408) {
                          // Request timeout error
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: `${status} ${JSON.stringify(responseData)}`,
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          throw new RetryAfterError(status + ':' + JSON.stringify(responseData), 10 * 60 * 1000); //10 min
                        } else {
                          await prisma.requestSyncLog.update({
                            where: { id: sync_log_id },
                            data: {
                              workspace_id: request.workspace_id,
                              request_id: request.id,
                              timeghost_sync_setting_id: timeghostSyncSetting.id,
                              sync_status: SyncStatus.Failed,
                              sync_type: 'timeghost',
                              error: `Error occurred in step create timeghost time entry via timeghost API: ${status} ${JSON.stringify(
                                responseData
                              )}`,
                              timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                              timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                              timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                            },
                            select: { id: true }
                          });
                          throw new RetryAfterError(
                            `Error occurred in step create timeghost time entry via timeghost API: ${status} ${JSON.stringify(
                              responseData
                            )}`, 10 * 60 * 1000
                          );
                        }
                      } else if (axiosError.request) {
                        // The request was made but no response was received
                        await prisma.requestSyncLog.update({
                          where: { id: sync_log_id },
                          data: {
                            workspace_id: request.workspace_id,
                            request_id: request.id,
                            timeghost_sync_setting_id: timeghostSyncSetting.id,
                            sync_status: SyncStatus.Failed,
                            sync_type: 'timeghost',
                            error: 'No response received from the timeghost API',
                            timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                            timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                            timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                          },
                          select: { id: true }
                        });
                        throw new RetryAfterError('No response received from the timeghost API', 10 * 60 * 1000); //10 min
                      } else {
                        // Something happened in setting up the request that triggered an Error
                        await prisma.requestSyncLog.update({
                          where: { id: sync_log_id },
                          data: {
                            workspace_id: request.workspace_id,
                            request_id: request.id,
                            timeghost_sync_setting_id: timeghostSyncSetting.id,
                            sync_status: SyncStatus.Failed,
                            sync_type: 'timeghost',
                            error: `Error setting up the request: ${axiosError.message}`,
                            timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                            timeghost_api_access_authenticated: TimeghostAccesStatus.Success,
                            timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                          },
                          select: { id: true }
                        });
                        throw new RetryAfterError(`Error setting up the request: ${axiosError.message}`, 10 * 60 * 1000); //10 min
                      }
                    } else {
                      // This is not an Axios error
                      throw error;
                    }
                  }
                }
              } else if (request.details.status === 'PENDING') {
                return { message: 'Waiting for approval - pending' };
              } else {
                await prisma.requestSyncLog.update({
                  where: { id: sync_log_id },
                  data: {
                    workspace_id: request.workspace_id,
                    request_id: request.id,
                    timeghost_sync_setting_id: timeghostSyncSetting.id,
                    sync_status: SyncStatus.Failed,
                    sync_type: 'timeghost',
                    error:
                      'Required info(s) is(are) missing for synchronization. For example: tg_item_id,timeghost_api_access_authenticated,.. ',
                    timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
                    timeghost_api_access_authenticated: TimeghostAccesStatus.Error,
                    timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token
                  },
                  select: { id: true }
                });
                return {
                  message:
                    'Required info(s) is(are) missing for synchronization. For example: tg_item_id,timeghost_api_access_authenticated,..'
                }; //ex: tg_item_id, timeghost_api_access_authenticated is equal error
              }
            }
          });

          //final output if all steps succed
          return {
            message: 'All steps runned'
          };
        }
      }
    }
  }
);

export const updateTimeghostSyncSetting = inngest.createFunction(
  {
    id: slugify('Update timeghost sync setting'),
    name: 'Update timeghost sync setting'
  },
  {
    event: 'request/update_timeghost_sync_setting'
  },
  async ({ event, step }) => {
    const sync_log_id = event.data.sync_log_id;
    const timeghost_sync_setting_id = event.data.timeghost_sync_setting_id;
    const request_id = event.data.request_id;
    if (!timeghost_sync_setting_id) return 'timeghost sync setting not found';
    await step.run('Update timeghost sync setting', async () => {
      //update requestSyncLog and resync unsynced request due to timeghost_api_access_authenticated error (api key change)
      await inngest.send({
        name: 'request/create_timeghost_time_entries',
        data: {
          request_id: request_id,
          sync_log_id: sync_log_id,
          timeghost_sync_setting_id: timeghost_sync_setting_id,
          for_update: true,
          first_event: event.data.first_event
        }
      });
    });
    return 'Call create timeghost time entries ';
  }
);
