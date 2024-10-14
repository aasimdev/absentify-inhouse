import { ApprovalProcess, DisplayNameFormat, GroupSyncSetting } from '@prisma/client';
import { EventSchemas, Inngest } from 'inngest';

type Events = {
  'dev/manual-load_holiday-cache': {};
  'process.webhook': { data: { id: number } };
  'request/create_calendar_entry': {
    data: { request_id: string; sync_id: number; calendar_sync_setting_id: string | null; microsoft_tenant_id: string };
  };
  'request/create_timeghost_time_entries': {
    data: {
      request_id: string;
      sync_log_id: number;
      timeghost_sync_setting_id: string | null;
      for_update: boolean;
      first_event: boolean
    };
  };
  'request/delete_timeghost_sync_setting': {
    data: { timeghost_sync_setting_id: string; deletePastSyncsInTg: boolean };
  };
  'request/delete_timeghost_time_entries': {
    data: {
      sync_log_id: number;
      first_event: boolean;
    };
  };
  'request/update_timeghost_sync_setting': {
    data: {
      request_id: string;
      sync_log_id: number;
      timeghost_sync_setting_id: string | null;
      first_event: boolean
    };
  };
  'request/delete_calendar_entry': { data: { request_id: string } };
  'request/delete_shared_calendar_setting': { data: { calendar_sync_setting_id: string } };
  'request/delete_microsoft_cal_entry': { data: { sync_log_id: number; microsoft_tenant_id: string } };
  'request/notifications.created_by_another_user': {
    data: {
      request_id: string;
      created_by: { name: string; email: string | null };
    };
  };
  'request/notifications.timeghost_sync_error': {
    data: {
      request_id: string;
      timeghost_sync_setting_name: string;
      timeghost_sync_setting_invalid_apikey_notification_sent: boolean | null;
    };
  };
  'request/notifications.approved': {
    data: {
      created_by: { name?: string | null | undefined; email?: string | null | undefined };
      request_id: string;
    };
  };
  'request/notifications.declined': {
    data: {
      created_by: { name?: string | null | undefined; email?: string | null | undefined };
      decline_reason: string;
      request_id: string;
    };
  };
  'request/notifications.canceled_by_user': {
    data: {
      request_id: string;
      currentUser: { email?: string | null | undefined };
    };
  };
  'request/notifications.canceled_by_someone': {
    data: {
      request_id: string;
      currentUser: { email?: string | null | undefined; name?: string | null | undefined };
    };
  };
  'request/notifications.approval_requests': {
    data: {
      request_id: string;
      _ctx: { user: { email: string | null | undefined; name: string | null | undefined } };
    };
  };
  'request/notifications.update_requester': {
    data: {
      request_id: string;
      updated_by: {
        name: string;
        email: string;
        original_approver_id: string;
      } | null;
    };
  };
  'request/notifications.send_reminder': {
    data: {
      member_id: string;
      request_id: string;
    };
  };
  'request/update_calendar_entry': { data: { request_id: string; microsoft_tenant_id: string } };
  'workspace/update.member.name_format': { data: { workspaceId: string; global_name_format: DisplayNameFormat } };
  'workspace/update.member.allowance': { data: { workspaceId: string } };
  'member/update.member.allowance': { data: { workspaceId: string; memberId: string } };
  'request/notifications.notify_approvers': {
    data: {
      created_by: { id: string; name?: string | null | undefined; email?: string | null | undefined };
      request_id: string;
      approval_process: ApprovalProcess;
      approved: boolean;
      decline_reason: string;
    };
  };
  'allowance/create_for_new_year': { data: { workspace_id: string; year: number } };
  'webhook/graph.user.changed': { data: { id: string } };
  'email/inactive_member.tried_to_access_absentify': { data: { inactive_member_id: string; workspace_id: string } };
  'microsoftGraphSubscription/update.expiration_date': {
    data: { subscription_id: string; tenant_id: string; resource: string };
  };
  'member/update.member.profile': {
    data: { microsoft_user_id: string; microsoft_tenant_id: string; token: string | null };
  };
  'member/keep.token.alive': { data: { member_id: string } };
  'email_onboarding/user_signup': { data: { member_id: string } };
  'request/notifications.updated_by_another_user': {
    data: {
      request_id: string;
      approver_id: string;
      updated_by: {
        id: string;
        name: string;
        email: string;
        status: string;
      };
    };
  };
  'holidayapi/fetch': {
    data: {
      year: number;
      country_code: string;
      lang: string;
    };
  };
  'member_allowances/create_missing_allowances_for_workspace_members': {
    data: { workspaces: { id: string }[] };
  };
  'member_allowances/start_create_allowance_new_year': { data: {} };
  'group/automatic_archivation_option': {
    data: {
      group_id: string;
      syncedDepIds: string[];
      notInGroupMembersFilter: {
        id: string;
        employment_end_date: Date | null;
        workspace_id: string;
        departments: {
          department: {
            id: string;
          };
        }[];
      }[];
      workspace: {
        id: string;
      };
    };
  };
  'email/automatic_member_creation': {
    data: {
      created_member_id: string;
      workspace_id: string;
    };
  };
  'email/automatic_member_archivation': {
    data: {
      archived_member_id: string;
      workspace_id: string;
    };
  };
  'response/to_group_changes': {
    data: {
      id: string;
      groupSyncSetting: GroupSyncSetting;
      token: string;
    };
  };
  'script/default_department_allowances': {};
  'script/prepare_workspaces': {
    data: {
      workspaces: {
        id: string;
      }[];
    };
  };
  'script/create_default_department_allowances': {
    data: {
      workspace: {
        id: string;
      };
    };
  };
  'email/failed_automatic_archivation': {
    data: {
      failed_member_id: string;
      workspace_id: string;
      reason: string;
    };
  };
  'publicHolidayDaySync/create_sync_items_for_member': {
    data: {
      member_id: string;
    };
  };
  'publicHolidayDaySync/batch_create_outlook_calendar_entry': {
    data: {
      microsoft_tenant_id: string;
      public_holiday_day_sync_status_id: number;
    };
  };
  'publicHolidayDaySync/batch_delete_outlook_calendar_entry': {
    data: {
      microsoft_tenant_id: string;
      public_holiday_day_sync_status_id: number;
    };
  };
  'weekly.birthday.anniversary.email': { data: { member_id: string } };
  'weekly.absence.summary.email': { data: { member_id: string; workspace_id: string } };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'absentify',
  schemas: new EventSchemas().fromRecord<Events>(),
  ...(process.env.BRANCH && process.env.BRANCH.trim() !== '' ? { env: process.env.BRANCH } : {})
});
