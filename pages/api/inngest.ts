import { serve } from 'inngest/next';
import { inngest } from '~/inngest/inngest_client';
import { updateGlobalNameFornat } from '~/inngest/Functions/updateGlobalNameFornat';
import { updateAllWorkspaceMemberAllowance, updateMemberAllowance } from '~/inngest/Functions/updateMemberAllowance';
import { createCalendarEntry } from '~/inngest/Functions/createCalendarEntry';
import { createTimeghostTimeEntries, updateTimeghostSyncSetting } from '~/inngest/Functions/createTimeghostTimeEntry';
import {
  deleteCalendarEntry,
  deleteMicrosoftCalEntry,
  deleteSharedCalendarSetting
} from '~/inngest/Functions/deleteCalendarEntry';
import { updateCalendarEntry } from '~/inngest/Functions/updateCalendarEntry';
import {
  notificationRequestApproved,
  notificationRequestUpdatedToApprovers,
  notificationRequestApprovalRequest,
  notificationRequestCancledBySomeone,
  notificationRequestCancledByUser,
  notificationRequestDeclined,
  notificationRequestSendReminder,
  notificationRequestUpdateRequester,
  notifictaionOnCreatedByAnotherUser,
  notificationTimeghostSyncError,
  updatedByAnotherUser
} from '~/inngest/Functions/requestNotifications';
import {
  createAllowanceForNewYear,
  createMissingAllowancesForWorkspaceMembers
} from '~/inngest/Functions/createAllowanceForNewYear';

import {
  automaticArchivationOfMember,
  automaticCreationOfMember,
  deleteOldMailHistoryLogs,
  failedArchivationOfMember,
  sendEmailToAdminAboutInactiveMemberAccess
} from '~/inngest/Functions/emailNotifications';
import { keepTokenAlive, updateMemberProfile } from '~/inngest/Functions/updateMemberProfile';
import {
  graphNotificationsKeepAlive,
  updateGraphSubscriptionExpirationDate
} from '~/inngest/Functions/graphNotificationsKeepAlive';
import { deleteTimeghostSyncSetting, deleteTimeghostTimeEntries } from '~/inngest/Functions/deleteTimeghostTimeEntry';
import { onBoardingEmails } from '~/inngest/Functions/onboardingEmails';
import { automaticArchivation } from '~/inngest/Functions/automaticArchivation';
import { responseToGroupChanges } from '~/inngest/Functions/responseToGroupChanges';
import {
  createDefaultDepartmentAllowances,
  defaultDepartmentAllowancesScript,
  prepareDepartmentsAllowances
} from '~/inngest/Functions/defaultDepartmentAllowancesMigration';
import {
  fetchHolidays,
  updateHolidayApiCache,
  updateHolidayApiCacheLocalDev
} from '~/inngest/Functions/holidayApiCache';

import {
  scheduleSubScriptionUpdates,
  scheduledUnpaidSubscriptions
} from '~/inngest/Functions/scheduled_subscription_updates';
import { deleteOldWebhookHistoryAttempts, processWebhook } from '~/inngest/Functions/webhooks_job';
import { scheduledOutOfOfficeReplies } from '~/inngest/Functions/scheduledOutOfOfficeReplies';
import {
  batchCreatePublicHolidayInOutlook,
  batchDeletePublicHolidayFromOutlook,
  createPublicHolidaySyncItemsForMember
} from '~/inngest/Functions/publicHolidaySync';
import {
  birthdayAndAnniversaryNotification,
  sendWeeklyBirthdayAndAnniversaryEmail
} from '~/inngest/Functions/birthdayAndAnniversaryNotification';
import {
  weeklyAbsenceSummaryNotification,
  sendWeeklyAbsenceSummaryNotification
} from '~/inngest/Functions/weeklyAbsenceSummaryNotification';

export default serve({
  client: inngest,
  functions: [
    updateGlobalNameFornat,
    updateMemberAllowance,
    updateAllWorkspaceMemberAllowance,
    createAllowanceForNewYear,
    automaticArchivation,
    responseToGroupChanges,
    createCalendarEntry,
    createTimeghostTimeEntries,
    deleteTimeghostTimeEntries,
    deleteTimeghostSyncSetting,
    deleteCalendarEntry,
    deleteMicrosoftCalEntry,
    deleteSharedCalendarSetting,
    updateCalendarEntry,
    updateTimeghostSyncSetting,
    notificationRequestApproved,
    notificationRequestUpdatedToApprovers,
    notificationRequestApprovalRequest,
    notificationRequestCancledBySomeone,
    notificationRequestCancledByUser,
    notificationRequestDeclined,
    notificationRequestSendReminder,
    notificationRequestUpdateRequester,
    notifictaionOnCreatedByAnotherUser,
    notificationTimeghostSyncError,
    updatedByAnotherUser,
    automaticCreationOfMember,
    automaticArchivationOfMember,
    failedArchivationOfMember,
    sendEmailToAdminAboutInactiveMemberAccess,
    updateMemberProfile,
    keepTokenAlive,
    graphNotificationsKeepAlive,
    updateGraphSubscriptionExpirationDate,
    onBoardingEmails,
    createMissingAllowancesForWorkspaceMembers,
    defaultDepartmentAllowancesScript,
    prepareDepartmentsAllowances,
    createDefaultDepartmentAllowances,
    updateHolidayApiCache,
    fetchHolidays,
    scheduledOutOfOfficeReplies,
    scheduleSubScriptionUpdates,
    scheduledUnpaidSubscriptions,
    deleteOldWebhookHistoryAttempts,
    processWebhook,
    batchDeletePublicHolidayFromOutlook,
    batchCreatePublicHolidayInOutlook,
    updateHolidayApiCacheLocalDev,
    deleteOldMailHistoryLogs,
    createPublicHolidaySyncItemsForMember,
    birthdayAndAnniversaryNotification,
    sendWeeklyBirthdayAndAnniversaryEmail,
    weeklyAbsenceSummaryNotification,
    sendWeeklyAbsenceSummaryNotification
  ]
});
