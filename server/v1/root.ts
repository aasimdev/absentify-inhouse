import { createTRPCRouter } from '~/server/api/trpc';

import { leaveTypesPublicApiRouter } from './routers/leave_type';

import { departmentPublicApiRouter } from './routers/department';
import { workspacesPublicApiRouter } from './routers/workspace';
import { membersPublicApiRouter } from './routers/member';
import { publicHolidaysPublicApiRouter } from './routers/public_holiday';
import { requestsPublicApiRouter } from './routers/request';
import { absencesPublicApiRouter } from './routers/absences';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const apiV1Router = createTRPCRouter({
  member: membersPublicApiRouter,
  department: departmentPublicApiRouter,
  leaveTypes: leaveTypesPublicApiRouter,
  workspace: workspacesPublicApiRouter,
  publicHolidays: publicHolidaysPublicApiRouter,
  request: requestsPublicApiRouter,
  absences: absencesPublicApiRouter
});

// export type definition of API
export type AppRouter = typeof apiV1Router;
