import axios from 'axios';
import { RouterOutputs } from '~/utils/api';
import * as Sentry from '@sentry/nextjs';
import { getDates, isHourUnit } from './DateHelper';
import { dateFromDatabaseIgnoreTimezone } from './DateHelper';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { zonedTimeToUtc } from 'date-fns-tz'
import {
  getDayStartAndEndTimeFromschedule,
  findscheduleOnDate
} from './requestUtilities';
import { EndAt, LeaveUnit, Prisma, StartAt } from '@prisma/client';

export interface BodyParams {
  request: {
    start: Date;
    end: Date;
    start_at: StartAt;
    end_at: EndAt;
    leave_unit: LeaveUnit;
  };
  timeEntries: TimeEntry[];
  timeghost_user_id: string;
  timeghost_workspace_id: string | null;
  memberSchedules: defaultMemberSelectOutput['schedules'];
  workspaceSchedule: RouterOutputs['workspace_schedule']['current'];
}

export interface TgUser {
  userId: string;
  isUserAdmin: boolean;
}
export interface TimeEntry {
  user: {
    id: string;
  };
  start: string;
  end: string;
  timeZone: string;
  type: string;
  workspace: {
    id: string;
  };
}

export type weekdays = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
export interface Input {
  url: string;
  apiKey: string;
  timeEntry: TimeEntry;
  timeghost_user_id: string;
}

export class TimeghostService {
  private static readonly BASE_URL = 'https://timeghost-api.azurewebsites.net/api/';

  public static async makeCurrentUserRequest(apiKey: string, endpoint: string) {
    return axios.get(TimeghostService.BASE_URL + endpoint, {
      headers: {
        'x-api-key': apiKey
      }
    });
  }

  public static async makeWorkspaceRequest(apiKey: string, endpoint: string) {
    return axios.get(TimeghostService.BASE_URL + endpoint, {
      headers: {
        'x-api-key': apiKey
      }
    });
  }

  public static async getTimeghostUserByApiKey(apiKey: string) {
    const response = await TimeghostService.makeCurrentUserRequest(apiKey, 'get/currentuser');
    if (!response.data) {
      return null;
    }
    const userId = response.data.id;
    const is_timeghost_user_active = !response.data.deleted;
    const isUserAdmin =
      is_timeghost_user_active &&
      response.data.workspace.users.find(
        (user: { id: string; admin: boolean }) => user.id == userId && user.admin == true
      ).admin;
    return {
      userId,
      isUserAdmin
    };
  }

  public static async getAllWorkspaces(apiKey: string) {
    try {
      const response = await TimeghostService.makeCurrentUserRequest(apiKey, 'get/currentuser');
      const userWorkspaces: {
        allUserWorkspaces: { id: string; name: string }[];
        userDefaultWorspaceId: string;
      } = { allUserWorkspaces: response.data.workspaces, userDefaultWorspaceId: response.data.defaultWorkspace };
      return userWorkspaces;
    } catch (error: any) {
      console.error('Error fetching workspaces:', error.message);
      throw error;
    }
  }

  public static async getTimeghostUsersByApiKey(apiKey: string) {
    try {
      const response = await TimeghostService.makeCurrentUserRequest(apiKey, 'get/currentuser');
      return response.data.workspace.users;
    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      throw error;
    }
  }

  public static async getTimeghostWorkspaceById(timeghost_workspace_id: string, apiKey: string) {
    try {
      const response = await TimeghostService.makeWorkspaceRequest(apiKey, `get/workspaces/${timeghost_workspace_id}`);
      const timeghost_workspace = response.data;
      return timeghost_workspace;
    } catch (error: any) {
      console.error('Error fetching workspace:', error.message);
      throw error;
    }
  }

  public static async getWorkspaceComegoStatus( apiKey: string,timeghost_workspace_id: string) {
    try {
      const response = await TimeghostService.makeWorkspaceRequest(apiKey, `get/workspaces/${timeghost_workspace_id}`);
      const timeghost_workspace = response.data;
      if(timeghost_workspace){
        return timeghost_workspace.settings.comego
      }
    } catch (error){
      if (axios.isAxiosError(error)) {
        throw error;
      }
    }
  }

  public static async get_timeghost_time_entries(input: Input) {
    if (input.apiKey && input.timeghost_user_id) {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': input.apiKey
      };
      try {
        const response = await axios.get(`${TimeghostService.BASE_URL}/timeentries`, { headers });
        return response.data;
      } catch (error: any) {
        console.error('Error getting timeghost time entries:', error.message);
        throw error;
      }
    }
  }
  public static getStartAndEndTime(
    day: string,
    schedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current']
  ): { amEnabled: boolean; pmEnabled: boolean; deductFullday: boolean } {
    return {
      amEnabled: schedule[`${day}_am_enabled` as keyof RouterOutputs['workspace_schedule']['current']] as boolean,
      pmEnabled: schedule[`${day}_pm_enabled` as keyof RouterOutputs['workspace_schedule']['current']] as boolean,
      deductFullday: schedule[
        `${day}_deduct_fullday` as keyof RouterOutputs['workspace_schedule']['current']
      ] as boolean
    };
  }
  public static getDayOfWeek(date: Date): weekdays {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()] as weekdays;
  }
  public static getDaysBetweenDates(startDate: Date, endDate: Date) {
    const days = getDates(startDate, endDate);

    return days.map((day) => {
      return {
        day: day,
        dayOfWeek: TimeghostService.getDayOfWeek(day)
      };
    });
  }

  public static setBody(input: BodyParams, timezone: string) {
    if (!input.timeghost_workspace_id) {
      return;
    }
    const days = TimeghostService.getDaysBetweenDates(input.request.start, input.request.end);
    const numberOfDays = days.length;
    const { start_at, end_at } = input.request;
    const oneDay: boolean = numberOfDays === 1;
    const twoDays: boolean = numberOfDays === 2;
    const moreThanTwoDays: boolean = numberOfDays > 2;

    const createEntry = (start: Date, end: Date, timeghost_workspace_id: string) => {
      input.timeEntries.push(
        TimeghostService.createTimeEntry(input.timeghost_user_id, timezone, timeghost_workspace_id,start, end)
      );
    };

    for (let iteration = 0; iteration < numberOfDays; iteration++) {
      const d = days[iteration];
      if (d) {
        const { day: currentDate, dayOfWeek } = d;
        const schedule = findscheduleOnDate(currentDate, input.workspaceSchedule, input.memberSchedules);
        const lastIteration = iteration == numberOfDays - 1;
        const { amEnabled, pmEnabled, deductFullday } = TimeghostService.getStartAndEndTime(dayOfWeek, schedule);
        // for request with hour unit
       
        if (isHourUnit(input.request.leave_unit)) {
          if(deductFullday){
            createEntry(dateFromDatabaseIgnoreTimezone(input.request.start),dateFromDatabaseIgnoreTimezone(input.request.end), input.timeghost_workspace_id);
          }
          if(input.request.start_at == 'morning' && input.request.end_at == 'lunchtime'){
            if(amEnabled){
              createEntry(dateFromDatabaseIgnoreTimezone(input.request.start),dateFromDatabaseIgnoreTimezone(input.request.end), input.timeghost_workspace_id);
            }
          }
          if(input.request.start_at == 'afternoon' && input.request.end_at == 'end_of_day'){
            if(pmEnabled){
              createEntry(dateFromDatabaseIgnoreTimezone(input.request.start),dateFromDatabaseIgnoreTimezone(input.request.end), input.timeghost_workspace_id);
            }
          }
          continue;
        }
        // the follwoing conditions are for the case when the request is day unit
        // setRequestStartEndTimesBasedOnScheduleOnDate does not provide the correct start and end times from the schedule
        let morning = getDayStartAndEndTimeFromschedule(currentDate, 'morning', 'lunchtime', schedule); // morning ->ex: 8h - 12h
        let afternoon = getDayStartAndEndTimeFromschedule(currentDate, 'afternoon', 'end_of_day', schedule); // afternoo -> ex:13h - 17h
        morning.start = dateFromDatabaseIgnoreTimezone(morning.start);
        morning.end = dateFromDatabaseIgnoreTimezone(morning.end);
        afternoon.start = dateFromDatabaseIgnoreTimezone(afternoon.start);
        afternoon.end = dateFromDatabaseIgnoreTimezone(afternoon.end);
        //request start and end same day
        if (oneDay) {
          if (start_at == 'morning' && end_at == 'lunchtime' && amEnabled) {
            createEntry(morning.start, morning.end, input.timeghost_workspace_id);
          }
          if (start_at == 'afternoon' && end_at == 'end_of_day' && pmEnabled) {
            createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
          }
          if (start_at == 'morning' && end_at == 'end_of_day') {
            if (amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
            if (pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
          }
        }
        //request start and end are in 2 different days
        else if (twoDays) {
          if (start_at == 'morning' && end_at == 'lunchtime') {
            if (iteration == 0) {
              if (amEnabled) {
                createEntry(morning.start, morning.end, input.timeghost_workspace_id);
              }
              if (pmEnabled) {
                createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
              }
            }
            if (iteration == 1 && amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
          }
          if (start_at == 'afternoon' && end_at == 'end_of_day') {
            if (iteration == 0 && pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
            if (iteration == 1) {
              if (amEnabled) {
                createEntry(morning.start, morning.end, input.timeghost_workspace_id);
              }
              if (pmEnabled) {
                createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
              }
            }
          }
          if (start_at == 'afternoon' && end_at == 'lunchtime') {
            if (iteration == 0 && pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
            if (iteration == 1 && amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
          }
          if (start_at == 'morning' && end_at == 'end_of_day') {
            if (amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
            if (pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
          }
        }
        //more than 2 days request
        else if (moreThanTwoDays) {
          if (start_at == 'morning' && end_at == 'lunchtime') {
            if (!lastIteration) {
              if (amEnabled) {
                createEntry(morning.start, morning.end, input.timeghost_workspace_id);
              }
              if (pmEnabled) {
                createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
              }
            }
            if (lastIteration && amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
          }

          if (start_at == 'afternoon' && end_at == 'end_of_day') {
            if (iteration == 0 && pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
            if (iteration != 0) {
              if (amEnabled) {
                createEntry(morning.start, morning.end, input.timeghost_workspace_id);
              }
              if (pmEnabled) {
                createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
              }
            }
          }
          if (start_at == 'afternoon' && end_at == 'lunchtime') {
            if (iteration == 0 && pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
            if (iteration != 0 && !lastIteration) {
              if (amEnabled) {
                createEntry(morning.start, morning.end, input.timeghost_workspace_id);
              }
              if (pmEnabled) {
                createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
              }
            }
            if (lastIteration && amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
          }
          if (start_at == 'morning' && end_at == 'end_of_day') {
            if (amEnabled) {
              createEntry(morning.start, morning.end, input.timeghost_workspace_id);
            }
            if (pmEnabled) {
              createEntry(afternoon.start, afternoon.end, input.timeghost_workspace_id);
            }
          }
        }
      }
    }
  }

  public static createTimeEntry(
    timeghost_user_id: string,
    timezone: string,
    timeghost_workspace_id: string,
    start: Date,
    end: Date
  ) {
    return {
      user: {
        id: timeghost_user_id
      },
      start: zonedTimeToUtc(start, timezone).toISOString(), // take into account the user's timezone ex:
      end: zonedTimeToUtc(end, timezone).toISOString(),
      timeZone: timezone,
      type: 'absence',
      name: 'Created by absentify',
      source: 'absentify',
      workspace: {
        id: timeghost_workspace_id
      }
    };
  }
  
  public static getLeaveTypeNames(
    timeghost_sync_setting: RouterOutputs['timeghost_sync_setting']['all'][0],
    leave_types: RouterOutputs['leave_type']['all']
  ) {
    const leave_type_ids = new Set(
      timeghost_sync_setting.timeghostSyncSettingLeaveTypes.map((item) => item.leave_type.id)
    );
    const matchingIds = leave_types.filter((leave_type) => leave_type_ids.has(leave_type.id)).map((item) => item.name);
    return matchingIds.join(', ');
  }

  public static getDepartmentNames(
    timeghost_sync_setting: RouterOutputs['timeghost_sync_setting']['all'][0],
    departments: RouterOutputs['department']['all']
  ) {
    const department_ids = new Set(
      timeghost_sync_setting.timeghostSyncSettingDepartments.map((item) => item.department.id)
    );
    const matchingIds = departments.filter((department) => department_ids.has(department.id)).map((item) => item.name);
    return matchingIds.join(', ');
  }
}
