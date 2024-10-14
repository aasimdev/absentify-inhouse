import { createTRPCRouter } from '~/server/api/trpc';
import { departmentRouter } from '~/server/api/routers/department';
import { administrationRouter } from './routers/administration';
import { calendarSyncSettingRouter } from './routers/calendar_sync_settings';
import { crowdinRouter } from './routers/crowdin';
import { leaveTypeRouter } from './routers/leave_type';
import { memberRouter } from './routers/member';
import { memberAllowanceRouter } from './routers/member_allowance';
import { memberMailboxSettingsRouter } from './routers/member_mailbox_settings';
import { memberScheduleRouter } from './routers/member_schedule';
import { microsoftScopesRouter } from './routers/microsoft_scopes';
import { publicHolidayRouter } from './routers/public_holiday';
import { publicHolidayDayRouter } from './routers/public_holiday_day';
import { registerRouter } from './routers/register';
import { requestRouter } from './routers/request';
import { userRouter } from './routers/user';
import { webhookSettingRouter } from './routers/webhook_setting';
import { workspaceRouter } from './routers/workspace';
import { workspaceScheduleRouter } from './routers/workspace_schedule';
import { apikeyRouter } from './routers/apikey';
import { allowanceRouter } from './routers/allowance';
import { timeghostSyncSettingRouter } from './routers/timeghost_sync_settings';
import { subscriptionRouter } from './routers/subscription';
import { groupRouter } from "./routers/group";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  department: departmentRouter,
  member_schedule: memberScheduleRouter,
  member_mailbox_settings: memberMailboxSettingsRouter,
  leave_type: leaveTypeRouter,
  member: memberRouter,
  public_holiday: publicHolidayRouter,
  public_holiday_day: publicHolidayDayRouter,
  workspace: workspaceRouter,
  request: requestRouter,
  microsoft_scopes: microsoftScopesRouter,
  workspace_schedule: workspaceScheduleRouter,
  member_allowance: memberAllowanceRouter,
  user: userRouter,
  register: registerRouter,
  webhook_setting: webhookSettingRouter,
  crowdin: crowdinRouter,
  calendar_sync_setting: calendarSyncSettingRouter,
  timeghost_sync_setting: timeghostSyncSettingRouter,
  administration: administrationRouter,
  apikey: apikeyRouter,
  allowance: allowanceRouter,
  subscription: subscriptionRouter,
  group: groupRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
