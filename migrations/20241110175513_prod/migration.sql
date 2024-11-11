-- CreateTable
CREATE TABLE `Deal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `referrer` VARCHAR(2500) NULL,
    `utmSource` VARCHAR(191) NULL,
    `utmMedium` VARCHAR(191) NULL,
    `utmCampaign` VARCHAR(191) NULL,
    `utmContent` VARCHAR(191) NULL,
    `gclid` VARCHAR(191) NULL,
    `deviceType` VARCHAR(191) NULL,
    `browser` VARCHAR(2500) NULL,
    `os` VARCHAR(2500) NULL,
    `pageSource` VARCHAR(191) NULL,
    `visitedPages` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `microsoft_login_state` VARCHAR(191) NULL,
    `email_after_login` VARCHAR(191) NULL,
    `microsoft_tenant_id` VARCHAR(191) NULL,
    `microsoft_user_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING_MICROSOFT_LOGIN', 'ACTIVE') NOT NULL DEFAULT 'PENDING_MICROSOFT_LOGIN',
    `set_as_active_at` DATETIME(3) NULL,

    UNIQUE INDEX `Deal_email_key`(`email`),
    INDEX `Deal_microsoft_login_state_idx`(`microsoft_login_state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountDeletionReason` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `firstReason` VARCHAR(2500) NOT NULL,
    `secondReason` VARCHAR(2500) NOT NULL,
    `thirdReason` VARCHAR(2500) NULL,
    `deleted_users_count` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Member` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `is_admin` BOOLEAN NOT NULL DEFAULT false,
    `employment_start_date` DATE NULL,
    `employment_end_date` DATE NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `birthday` DATE NULL,
    `public_holiday_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `custom_id` VARCHAR(191) NULL,
    `default_timeline_department_id` VARCHAR(191) NULL,
    `approver_config_department_id` VARCHAR(191) NULL,
    `approver_config_microsoft_profile_manager_sync` INTEGER NULL,
    `approval_process` ENUM('Linear_all_have_to_agree', 'Linear_one_has_to_agree', 'Parallel_all_have_to_agree', 'Parallel_one_has_to_agree') NOT NULL DEFAULT 'Linear_all_have_to_agree',
    `brevo_contact_id` INTEGER NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `date_format` VARCHAR(191) NOT NULL DEFAULT 'MM/dd/yyyy',
    `time_format` ENUM('H12', 'H24') NOT NULL DEFAULT 'H24',
    `long_datetime_format` VARCHAR(191) NOT NULL DEFAULT 'MM/dd/yyyy HH:mm',
    `week_start` CHAR(1) NOT NULL DEFAULT '0',
    `display_calendar_weeks` BOOLEAN NOT NULL DEFAULT false,
    `timezone` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `email_notif_bday_anniv_remind` BOOLEAN NOT NULL DEFAULT false,
    `email_notif_weekly_absence_summary` BOOLEAN NOT NULL DEFAULT false,
    `email_notifications_updates` BOOLEAN NOT NULL DEFAULT true,
    `email_ical_notifications` BOOLEAN NOT NULL DEFAULT true,
    `microsoft_tenantId` VARCHAR(191) NULL,
    `mobile_phone` VARCHAR(191) NULL,
    `business_phone` VARCHAR(191) NULL,
    `microsoft_user_id` VARCHAR(191) NULL,
    `has_cdn_image` BOOLEAN NOT NULL DEFAULT false,
    `notifications_receiving_method` ENUM('TeamsBot', 'EmailAndTeamsBot') NOT NULL DEFAULT 'EmailAndTeamsBot',
    `status` ENUM('INACTIVE', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',

    UNIQUE INDEX `Member_brevo_contact_id_key`(`brevo_contact_id`),
    UNIQUE INDEX `Member_microsoft_user_id_key`(`microsoft_user_id`),
    INDEX `Member_workspace_id_idx`(`workspace_id`),
    INDEX `Member_email_idx`(`email`),
    INDEX `Member_public_holiday_id_idx`(`public_holiday_id`),
    INDEX `Member_microsoft_user_id_idx`(`microsoft_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberMicrosoftToken` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `refresh_token` LONGTEXT NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,

    INDEX `MemberMicrosoftToken_member_id_idx`(`member_id`),
    UNIQUE INDEX `MemberMicrosoftToken_client_id_member_id_key`(`client_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `global_timezone` VARCHAR(191) NOT NULL,
    `global_language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `global_date_format` VARCHAR(191) NOT NULL DEFAULT 'MM/dd/yyyy',
    `global_time_format` ENUM('H12', 'H24') NOT NULL DEFAULT 'H24',
    `global_week_start` CHAR(1) NOT NULL DEFAULT '0',
    `global_name_format` ENUM('Microsoft_DisplayName', 'First', 'Last', 'FirstLast', 'LastFirst') NOT NULL DEFAULT 'Microsoft_DisplayName',
    `fiscal_year_start_month` INTEGER NOT NULL DEFAULT 0,
    `global_display_calendar_weeks` BOOLEAN NOT NULL DEFAULT false,
    `privacy_show_leavetypes` BOOLEAN NOT NULL DEFAULT true,
    `privacy_show_calendarview` BOOLEAN NOT NULL DEFAULT true,
    `privacy_show_otherdepartments` BOOLEAN NOT NULL DEFAULT false,
    `privacy_show_absences_in_past` BOOLEAN NOT NULL DEFAULT true,
    `brevo_company_id` VARCHAR(191) NULL,
    `referrer` VARCHAR(191) NULL,
    `gclid` VARCHAR(191) NULL,
    `enabled_to_purchase_enterprise` BOOLEAN NOT NULL DEFAULT false,
    `min_enterprise_users` INTEGER NOT NULL DEFAULT 50,
    `microsoft_mailboxSettings_read_write` ENUM('PENDING', 'ACTIVATED', 'REVOKED', 'NONE') NOT NULL DEFAULT 'NONE',
    `microsoft_groups_read_write_all` ENUM('PENDING', 'ACTIVATED', 'REVOKED', 'NONE') NOT NULL DEFAULT 'NONE',
    `microsoft_calendars_read_write` ENUM('PENDING', 'ACTIVATED', 'REVOKED', 'NONE') NOT NULL DEFAULT 'NONE',
    `microsoft_users_read_all` ENUM('PENDING', 'ACTIVATED', 'REVOKED', 'NONE') NOT NULL DEFAULT 'NONE',
    `company_logo_url` VARCHAR(2500) NULL,
    `company_logo_ratio_square` BOOLEAN NOT NULL DEFAULT true,
    `display_logo` ENUM('ShowLogoAndName', 'ShowLogo') NOT NULL DEFAULT 'ShowLogo',
    `favicon_url` VARCHAR(2500) NULL,
    `allow_manager_past_request_cancellation` BOOLEAN NOT NULL DEFAULT false,
    `old_pricing` BOOLEAN NOT NULL DEFAULT false,
    `ai_bot_enabled` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberMailboxSettings` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `internalReplyMessage` VARCHAR(2500) NOT NULL,
    `externalReplyMessage` VARCHAR(2500) NOT NULL,
    `externalAudience` ENUM('none', 'contactsOnly', 'all') NOT NULL,
    `allow_member_edit_out_of_office_message` BOOLEAN NOT NULL DEFAULT true,

    INDEX `MemberMailboxSettings_member_id_idx`(`member_id`),
    INDEX `MemberMailboxSettings_workspace_id_idx`(`workspace_id`),
    INDEX `MemberMailboxSettings_leave_type_id_idx`(`leave_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `provider` ENUM('absentify', 'paddle', 'paddle_v2', 'microsoftFulfillment') NOT NULL,
    `status` ENUM('active', 'trialing', 'past_due', 'paused', 'deleted', 'pending') NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `subscription_plan_id` VARCHAR(191) NOT NULL,
    `price_id` VARCHAR(191) NULL,
    `customer_user_id` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `modifier_id` VARCHAR(191) NULL,
    `unpaid` DOUBLE NULL,
    `unit_price` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `cancellation_effective_date` DATETIME(3) NULL,
    `past_due_since` DATETIME(3) NULL,
    `billing_cycle_interval` ENUM('day', 'week', 'month', 'year') NOT NULL DEFAULT 'month',

    INDEX `Subscription_workspace_id_idx`(`workspace_id`),
    INDEX `Subscription_createdAt_unpaid_idx`(`createdAt`, `unpaid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAmountStats` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `number_of_users` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `valid_until` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `run_as_member_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ApiKey_key_key`(`key`),
    INDEX `ApiKey_workspace_id_idx`(`workspace_id`),
    INDEX `ApiKey_run_as_member_id_idx`(`run_as_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AllowanceType` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `default` BOOLEAN NOT NULL DEFAULT true,
    `allowance_unit` ENUM('days', 'hours') NOT NULL DEFAULT 'days',
    `ignore_allowance_limit` BOOLEAN NOT NULL DEFAULT false,
    `max_carry_forward` DOUBLE NOT NULL DEFAULT 0,
    `carry_forward_months_after_fiscal_year` INTEGER NOT NULL DEFAULT 0,

    INDEX `AllowanceType_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AllowancePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `accrual_month` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `policy_amount` DOUBLE NOT NULL,
    `accrual_cycle` ENUM('month', 'year') NOT NULL,
    `cycle_on_employment_start` BOOLEAN NOT NULL DEFAULT false,
    `policy_duration` INTEGER NULL,
    `upfront_allocation` BOOLEAN NOT NULL DEFAULT true,
    `allowance_type_id` VARCHAR(191) NOT NULL,
    `max_carry_forward` DOUBLE NULL,

    INDEX `AllowancePolicy_workspace_id_allowance_type_id_idx`(`workspace_id`, `allowance_type_id`),
    INDEX `AllowancePolicy_allowance_type_id_idx`(`allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookSetting` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2500) NOT NULL,
    `source` ENUM('Website', 'MicrosoftPowerAutomate') NOT NULL DEFAULT 'Website',
    `event` VARCHAR(191) NOT NULL DEFAULT 'request_created;request_status_changed',

    INDEX `WebhookSetting_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'ERROR') NOT NULL,
    `webhook_setting_id` VARCHAR(191) NOT NULL,

    INDEX `WebhookHistory_status_idx`(`status`),
    INDEX `WebhookHistory_webhook_setting_id_idx`(`webhook_setting_id`),
    INDEX `WebhookHistory_workspace_id_idx`(`workspace_id`),
    INDEX `WebhookHistory_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookHistoryAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `url` VARCHAR(5000) NOT NULL,
    `request_data` TEXT NOT NULL,
    `response_data` TEXT NOT NULL,
    `webhook_history_id` INTEGER NOT NULL,

    INDEX `WebhookHistoryAttempt_webhook_history_id_idx`(`webhook_history_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarSyncSetting` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(2500) NOT NULL,
    `calendar_id` VARCHAR(191) NULL,
    `calendar_name` VARCHAR(191) NULL,
    `calendar_microsoft_user_id` VARCHAR(191) NULL,
    `calendar_microsoft_tenant_id` VARCHAR(191) NULL,
    `calendar_sync_type` ENUM('outlook_calendar', 'ical_email', 'outlook_group_calendar') NOT NULL,
    `email` VARCHAR(191) NULL,
    `token_member_id` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `CalendarSyncSetting_workspace_id_idx`(`workspace_id`),
    INDEX `CalendarSyncSetting_token_member_id_idx`(`token_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeghostSyncSetting` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(2500) NOT NULL,
    `timeghost_workspace_id` VARCHAR(191) NOT NULL,
    `timeghost_api_access_token` VARCHAR(191) NOT NULL,
    `invalid_apikey_notification_sent` BOOLEAN NULL DEFAULT false,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `TimeghostSyncSetting_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarSyncSettingLeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `calendar_sync_setting_id` VARCHAR(191) NOT NULL,
    `sync_as_name` VARCHAR(191) NOT NULL,
    `only_approved` BOOLEAN NOT NULL DEFAULT false,

    INDEX `CalendarSyncSettingLeaveType_calendar_sync_setting_id_idx`(`calendar_sync_setting_id`),
    UNIQUE INDEX `CalendarSyncSettingLeaveType_leave_type_id_calendar_sync_set_key`(`leave_type_id`, `calendar_sync_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeghostSyncSettingLeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `timeghost_sync_setting_id` VARCHAR(191) NOT NULL,

    INDEX `TimeghostSyncSettingLeaveType_timeghost_sync_setting_id_idx`(`timeghost_sync_setting_id`),
    UNIQUE INDEX `TimeghostSyncSettingLeaveType_leave_type_id_timeghost_sync_s_key`(`leave_type_id`, `timeghost_sync_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarSyncSettingDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `department_id` VARCHAR(191) NOT NULL,
    `calendar_sync_setting_id` VARCHAR(191) NOT NULL,

    INDEX `CalendarSyncSettingDepartment_calendar_sync_setting_id_idx`(`calendar_sync_setting_id`),
    UNIQUE INDEX `CalendarSyncSettingDepartment_department_id_calendar_sync_se_key`(`department_id`, `calendar_sync_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeghostSyncSettingDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `department_id` VARCHAR(191) NOT NULL,
    `timeghost_sync_setting_id` VARCHAR(191) NOT NULL,

    INDEX `TimeghostSyncSettingDepartment_timeghost_sync_setting_id_idx`(`timeghost_sync_setting_id`),
    UNIQUE INDEX `TimeghostSyncSettingDepartment_department_id_timeghost_sync__key`(`department_id`, `timeghost_sync_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maximum_absent` INTEGER NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `approval_process` ENUM('Linear_all_have_to_agree', 'Linear_one_has_to_agree', 'Parallel_all_have_to_agree', 'Parallel_one_has_to_agree') NOT NULL DEFAULT 'Linear_all_have_to_agree',
    `default_department_allowances` JSON NULL,

    INDEX `Department_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupSyncSetting` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `automatic_account_create_option` BOOLEAN NOT NULL,
    `manager_change_option` BOOLEAN NOT NULL,
    `remove_from_department_option` BOOLEAN NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `GroupSyncSetting_group_id_key`(`group_id`),
    INDEX `GroupSyncSetting_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentGroupSyncSetting` (
    `department_id` VARCHAR(191) NOT NULL,
    `group_sync_setting_id` VARCHAR(191) NOT NULL,

    INDEX `DepartmentGroupSyncSetting_group_sync_setting_id_department__idx`(`group_sync_setting_id`, `department_id`),
    PRIMARY KEY (`department_id`, `group_sync_setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaddleBillingDetails` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `address_id` VARCHAR(191) NULL,
    `business_id` VARCHAR(191) NULL,
    `workspace_id` VARCHAR(191) NOT NULL,

    INDEX `PaddleBillingDetails_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `take_from_allowance` BOOLEAN NOT NULL DEFAULT false,
    `needs_approval` BOOLEAN NOT NULL DEFAULT true,
    `maximum_absent` BOOLEAN NOT NULL DEFAULT true,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `deleted_by_member_id` VARCHAR(191) NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `privacy_hide_leavetype` BOOLEAN NOT NULL DEFAULT false,
    `outlook_synchronization_show_as` ENUM('free', 'tentative', 'busy', 'oof', 'workingElsewhere', 'unknown') NOT NULL DEFAULT 'oof',
    `outlook_synchronization_subject` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `allowance_type_id` VARCHAR(191) NULL,
    `reason_mandatory` BOOLEAN NOT NULL DEFAULT false,
    `reason_hint_text` VARCHAR(250) NULL,
    `sync_option` ENUM('Disabled', 'All', 'OnlyApproved') NOT NULL DEFAULT 'All',
    `sync_to_outlook_as_dynamics_365_tracked` BOOLEAN NOT NULL DEFAULT false,
    `leave_unit` ENUM('days', 'half_days', 'hours', 'minutes_30', 'minutes_15', 'minutes_10', 'minutes_5', 'minutes_1') NOT NULL DEFAULT 'days',
    `ignore_schedule` BOOLEAN NOT NULL DEFAULT false,
    `ignore_public_holidays` BOOLEAN NOT NULL DEFAULT false,

    INDEX `LeaveType_workspace_id_deleted_idx`(`workspace_id`, `deleted`),
    INDEX `LeaveType_deleted_by_member_id_idx`(`deleted_by_member_id`),
    INDEX `LeaveType_allowance_type_id_idx`(`allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberAllowance` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `policies` DOUBLE NOT NULL DEFAULT 0,
    `adjustments` DOUBLE NOT NULL DEFAULT 0,
    `carry_over` DOUBLE NOT NULL DEFAULT 0,
    `expiration` DOUBLE NOT NULL DEFAULT 0,
    `taken` DOUBLE NOT NULL,
    `remaining` DOUBLE NOT NULL,
    `allowance` DOUBLE NOT NULL,
    `brought_forward` DOUBLE NOT NULL,
    `compensatory_time_off` DOUBLE NOT NULL,
    `leave_types_stats` JSON NULL,
    `allowance_type_id` VARCHAR(191) NOT NULL,
    `overwrite_brought_forward` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MemberAllowance_member_id_idx`(`member_id`),
    INDEX `MemberAllowance_workspace_id_idx`(`workspace_id`),
    INDEX `MemberAllowance_allowance_type_id_idx`(`allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberAllowanceTypeConfigurtaion` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `allowance_type_id` VARCHAR(191) NOT NULL,
    `default` BOOLEAN NOT NULL DEFAULT false,
    `disabled` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MemberAllowanceTypeConfigurtaion_member_id_idx`(`member_id`),
    INDEX `MemberAllowanceTypeConfigurtaion_workspace_id_idx`(`workspace_id`),
    INDEX `MemberAllowanceTypeConfigurtaion_allowance_type_id_idx`(`allowance_type_id`),
    UNIQUE INDEX `MemberAllowanceTypeConfigurtaion_member_id_allowance_type_id_key`(`member_id`, `allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberAllowancePolicySubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `policy_start_date` DATETIME(3) NOT NULL,
    `policy_end_date` DATETIME(3) NULL,
    `policy_id` VARCHAR(191) NOT NULL,
    `allowance_type_id` VARCHAR(191) NOT NULL,

    INDEX `MemberAllowancePolicySubscription_workspace_id_member_id_idx`(`workspace_id`, `member_id`),
    INDEX `MemberAllowancePolicySubscription_member_id_idx`(`member_id`),
    INDEX `MemberAllowancePolicySubscription_policy_id_idx`(`policy_id`),
    INDEX `MemberAllowancePolicySubscription_allowance_type_id_idx`(`allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberAllowanceAdjustment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `allowance_type_id` VARCHAR(191) NOT NULL,
    `expiry_date` DATETIME(3) NULL,
    `createdBy_member_id` VARCHAR(191) NULL,

    INDEX `MemberAllowanceAdjustment_member_id_idx`(`member_id`),
    INDEX `MemberAllowanceAdjustment_createdBy_member_id_idx`(`createdBy_member_id`),
    INDEX `MemberAllowanceAdjustment_allowance_type_id_idx`(`allowance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberApprover` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `approver_member_id` VARCHAR(191) NOT NULL,
    `predecessor_approver_member_approver_id` VARCHAR(191) NULL,
    `changed_by_webhook` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MemberApprover_member_id_idx`(`member_id`),
    INDEX `MemberApprover_approver_member_id_idx`(`approver_member_id`),
    INDEX `MemberApprover_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `department_id` VARCHAR(191) NOT NULL,
    `manager_type` ENUM('Member', 'Manager') NOT NULL DEFAULT 'Member',
    `predecessor_manager_id` VARCHAR(191) NULL,
    `changed_by_webhook` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MemberDepartment_member_id_idx`(`member_id`),
    INDEX `MemberDepartment_workspace_id_idx`(`workspace_id`),
    UNIQUE INDEX `MemberDepartment_department_id_member_id_key`(`department_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `from` DATE NULL,
    `monday_am_start` TIME NOT NULL,
    `monday_am_end` TIME NOT NULL,
    `monday_pm_start` TIME NOT NULL,
    `monday_pm_end` TIME NOT NULL,
    `monday_am_enabled` BOOLEAN NOT NULL,
    `monday_pm_enabled` BOOLEAN NOT NULL,
    `monday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `tuesday_am_start` TIME NOT NULL,
    `tuesday_am_end` TIME NOT NULL,
    `tuesday_pm_start` TIME NOT NULL,
    `tuesday_pm_end` TIME NOT NULL,
    `tuesday_am_enabled` BOOLEAN NOT NULL,
    `tuesday_pm_enabled` BOOLEAN NOT NULL,
    `tuesday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `wednesday_am_start` TIME NOT NULL,
    `wednesday_am_end` TIME NOT NULL,
    `wednesday_pm_start` TIME NOT NULL,
    `wednesday_pm_end` TIME NOT NULL,
    `wednesday_am_enabled` BOOLEAN NOT NULL,
    `wednesday_pm_enabled` BOOLEAN NOT NULL,
    `wednesday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `thursday_am_start` TIME NOT NULL,
    `thursday_am_end` TIME NOT NULL,
    `thursday_pm_start` TIME NOT NULL,
    `thursday_pm_end` TIME NOT NULL,
    `thursday_am_enabled` BOOLEAN NOT NULL,
    `thursday_pm_enabled` BOOLEAN NOT NULL,
    `thursday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `friday_am_start` TIME NOT NULL,
    `friday_am_end` TIME NOT NULL,
    `friday_pm_start` TIME NOT NULL,
    `friday_pm_end` TIME NOT NULL,
    `friday_am_enabled` BOOLEAN NOT NULL,
    `friday_pm_enabled` BOOLEAN NOT NULL,
    `friday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `saturday_am_start` TIME NOT NULL,
    `saturday_am_end` TIME NOT NULL,
    `saturday_pm_start` TIME NOT NULL,
    `saturday_pm_end` TIME NOT NULL,
    `saturday_am_enabled` BOOLEAN NOT NULL,
    `saturday_pm_enabled` BOOLEAN NOT NULL,
    `saturday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `sunday_am_start` TIME NOT NULL,
    `sunday_am_end` TIME NOT NULL,
    `sunday_pm_start` TIME NOT NULL,
    `sunday_pm_end` TIME NOT NULL,
    `sunday_am_enabled` BOOLEAN NOT NULL,
    `sunday_pm_enabled` BOOLEAN NOT NULL,
    `sunday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MemberSchedule_member_id_idx`(`member_id`),
    INDEX `MemberSchedule_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicHolidayDay` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `date` DATE NOT NULL,
    `year` INTEGER NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `custom_value` BOOLEAN NOT NULL DEFAULT false,
    `public_holiday_id` VARCHAR(191) NOT NULL,
    `duration` ENUM('Morning', 'Afternoon', 'FullDay') NOT NULL DEFAULT 'FullDay',
    `holidayapi_uuid_year` VARCHAR(191) NULL,

    INDEX `PublicHolidayDay_workspace_id_date_idx`(`workspace_id`, `date`),
    INDEX `PublicHolidayDay_workspace_id_public_holiday_id_idx`(`workspace_id`, `public_holiday_id`),
    INDEX `PublicHolidayDay_public_holiday_id_idx`(`public_holiday_id`),
    INDEX `PublicHolidayDay_holidayapi_uuid_year_idx`(`holidayapi_uuid_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicHolidayDayLanguage` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `public_holiday_day_id` VARCHAR(191) NOT NULL,

    INDEX `PublicHolidayDayLanguage_public_holiday_day_id_idx`(`public_holiday_day_id`),
    INDEX `PublicHolidayDayLanguage_workspace_id_idx`(`workspace_id`),
    UNIQUE INDEX `PublicHolidayDayLanguage_public_holiday_day_id_language_key`(`public_holiday_day_id`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicHoliday` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country_code` VARCHAR(191) NULL,
    `county_code` VARCHAR(191) NULL,
    `workspace_id` VARCHAR(191) NOT NULL,

    INDEX `PublicHoliday_workspace_id_idx`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HolidayApi` (
    `id_year` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `observed` VARCHAR(191) NOT NULL,
    `public` BOOLEAN NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `subdivisions` TEXT NULL,
    `year` INTEGER NOT NULL,

    PRIMARY KEY (`id_year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HolidayApiLanguage` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `holiday_api_id` VARCHAR(191) NOT NULL,

    INDEX `HolidayApiLanguage_holiday_api_id_language_idx`(`holiday_api_id`, `language`),
    UNIQUE INDEX `HolidayApiLanguage_holiday_api_id_language_key`(`holiday_api_id`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Request` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy_member_id` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `start` DATETIME(0) NOT NULL,
    `end` DATETIME(0) NOT NULL,
    `start_at` ENUM('morning', 'afternoon') NOT NULL DEFAULT 'morning',
    `end_at` ENUM('lunchtime', 'end_of_day') NOT NULL DEFAULT 'end_of_day',
    `leave_unit` ENUM('days', 'half_days', 'hours', 'minutes_30', 'minutes_15', 'minutes_10', 'minutes_5', 'minutes_1') NOT NULL DEFAULT 'days',
    `requester_member_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `request_details_id` VARCHAR(191) NULL,
    `out_of_office_message_status` ENUM('None', 'MustBeConfigured', 'Configured', 'Error', 'MustBeRemoved') NOT NULL DEFAULT 'None',
    `requester_adaptive_card_id` VARCHAR(191) NULL,

    INDEX `Request_start_out_of_office_message_status_idx`(`start`, `out_of_office_message_status`),
    INDEX `Request_requester_member_id_idx`(`requester_member_id`),
    INDEX `Request_workspace_id_start_end_requester_member_id_idx`(`workspace_id`, `start`, `end`, `requester_member_id`),
    INDEX `Request_createdBy_member_id_idx`(`createdBy_member_id`),
    INDEX `Request_request_details_id_idx`(`request_details_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestSyncLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `calendar_id` VARCHAR(191) NULL,
    `calendar_event_id` VARCHAR(191) NULL,
    `calendar_sync_setting_id` VARCHAR(191) NULL,
    `calendar_microsoft_user_id` VARCHAR(191) NULL,
    `calendar_microsoft_tenant_id` VARCHAR(191) NULL,
    `timeghost_item_id` VARCHAR(191) NULL,
    `timeghost_api_access_token` VARCHAR(191) NULL,
    `timeghost_api_access_authenticated` ENUM('None', 'Success', 'Error') NOT NULL DEFAULT 'None',
    `timeghost_sync_setting_id` VARCHAR(191) NULL,
    `timeghost_workspace_id` VARCHAR(191) NULL,
    `timeghost_user_id` VARCHAR(191) NULL,
    `timeghost_time_entry` VARCHAR(2500) NULL,
    `email` VARCHAR(191) NULL,
    `error` VARCHAR(2500) NULL,
    `sync_type` ENUM('Outlook_User_Calendar', 'Shared_Outlook_Calendar', 'Ical', 'timeghost', 'Outlook_Group_Calendar') NULL,
    `sync_status` ENUM('NotSynced', 'Synced', 'Failed', 'MustBeDeleted', 'Removed', 'Skipped') NOT NULL,

    INDEX `RequestSyncLog_request_id_idx`(`request_id`),
    INDEX `RequestSyncLog_updatedAt_sync_status_idx`(`updatedAt`, `sync_status`),
    INDEX `RequestSyncLog_workspace_id_request_id_idx`(`workspace_id`, `request_id`),
    INDEX `RequestSyncLog_calendar_sync_setting_id_idx`(`calendar_sync_setting_id`),
    INDEX `RequestSyncLog_timeghost_sync_setting_id_idx`(`timeghost_sync_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestDetail` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `requester_member_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'CANCELED') NOT NULL,
    `reason` VARCHAR(2500) NULL,
    `cancel_reason` VARCHAR(2500) NULL,
    `canceld_by_member_id` VARCHAR(191) NULL,
    `canceld_date` DATETIME(3) NULL,
    `workday_absence_duration` DOUBLE NOT NULL DEFAULT 0,
    `duration` DOUBLE NOT NULL DEFAULT 0,
    `approval_process` ENUM('Linear_all_have_to_agree', 'Linear_one_has_to_agree', 'Parallel_all_have_to_agree', 'Parallel_one_has_to_agree') NOT NULL DEFAULT 'Linear_all_have_to_agree',

    INDEX `RequestDetail_requester_member_id_idx`(`requester_member_id`),
    INDEX `RequestDetail_canceld_by_member_id_idx`(`canceld_by_member_id`),
    INDEX `RequestDetail_workspace_id_status_idx`(`workspace_id`, `status`),
    INDEX `RequestDetail_leave_type_id_idx`(`leave_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestApprover` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `approver_member_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'CANCELED', 'APPROVED_BY_ANOTHER_MANAGER', 'DECLINED_BY_ANOTHER_MANAGER', 'CANCELED_BY_ANOTHER_MANAGER') NOT NULL,
    `reason` VARCHAR(2500) NULL,
    `status_change_date` DATETIME(3) NULL,
    `request_details_id` VARCHAR(191) NOT NULL,
    `reminderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `predecessor_request_member_approver_id` VARCHAR(191) NULL,
    `status_changed_by_member_id` VARCHAR(191) NULL,
    `adaptive_card_id` VARCHAR(191) NULL,

    INDEX `RequestApprover_request_details_id_idx`(`request_details_id`),
    INDEX `RequestApprover_approver_member_id_idx`(`approver_member_id`),
    INDEX `RequestApprover_status_changed_by_member_id_idx`(`status_changed_by_member_id`),
    UNIQUE INDEX `RequestApprover_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MicrosoftLeads` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `leadSource` VARCHAR(191) NULL,
    `actionCode` VARCHAR(191) NULL,
    `offerTitle` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignInLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `time_of_creation` DATETIME(3) NOT NULL,
    `app` VARCHAR(191) NOT NULL,
    `device` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,

    INDEX `SignInLog_member_id_idx`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `monday_am_start` TIME NOT NULL,
    `monday_am_end` TIME NOT NULL,
    `monday_pm_start` TIME NOT NULL,
    `monday_pm_end` TIME NOT NULL,
    `monday_am_enabled` BOOLEAN NOT NULL,
    `monday_pm_enabled` BOOLEAN NOT NULL,
    `monday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `tuesday_am_start` TIME NOT NULL,
    `tuesday_am_end` TIME NOT NULL,
    `tuesday_pm_start` TIME NOT NULL,
    `tuesday_pm_end` TIME NOT NULL,
    `tuesday_am_enabled` BOOLEAN NOT NULL,
    `tuesday_pm_enabled` BOOLEAN NOT NULL,
    `tuesday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `wednesday_am_start` TIME NOT NULL,
    `wednesday_am_end` TIME NOT NULL,
    `wednesday_pm_start` TIME NOT NULL,
    `wednesday_pm_end` TIME NOT NULL,
    `wednesday_am_enabled` BOOLEAN NOT NULL,
    `wednesday_pm_enabled` BOOLEAN NOT NULL,
    `wednesday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `thursday_am_start` TIME NOT NULL,
    `thursday_am_end` TIME NOT NULL,
    `thursday_pm_start` TIME NOT NULL,
    `thursday_pm_end` TIME NOT NULL,
    `thursday_am_enabled` BOOLEAN NOT NULL,
    `thursday_pm_enabled` BOOLEAN NOT NULL,
    `thursday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `friday_am_start` TIME NOT NULL,
    `friday_am_end` TIME NOT NULL,
    `friday_pm_start` TIME NOT NULL,
    `friday_pm_end` TIME NOT NULL,
    `friday_am_enabled` BOOLEAN NOT NULL,
    `friday_pm_enabled` BOOLEAN NOT NULL,
    `friday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `saturday_am_start` TIME NOT NULL,
    `saturday_am_end` TIME NOT NULL,
    `saturday_pm_start` TIME NOT NULL,
    `saturday_pm_end` TIME NOT NULL,
    `saturday_am_enabled` BOOLEAN NOT NULL,
    `saturday_pm_enabled` BOOLEAN NOT NULL,
    `saturday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,
    `sunday_am_start` TIME NOT NULL,
    `sunday_am_end` TIME NOT NULL,
    `sunday_pm_start` TIME NOT NULL,
    `sunday_pm_end` TIME NOT NULL,
    `sunday_am_enabled` BOOLEAN NOT NULL,
    `sunday_pm_enabled` BOOLEAN NOT NULL,
    `sunday_deduct_fullday` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `WorkspaceSchedule_workspace_id_key`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamsBotConversationReferences` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `user_aad_id` VARCHAR(191) NOT NULL,
    `ref_id` VARCHAR(191) NOT NULL,
    `ref_data` JSON NOT NULL,

    UNIQUE INDEX `TeamsBotConversationReferences_ref_id_key`(`ref_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MicrosoftGraphSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `expiration_date` DATETIME(3) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `change_type` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MicrosoftGraphSubscription_subscription_id_key`(`subscription_id`),
    INDEX `MicrosoftGraphSubscription_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_id` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `error` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operationId` VARCHAR(191) NOT NULL,

    INDEX `EmailHistory_workspace_id_idx`(`workspace_id`),
    INDEX `EmailHistory_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailHitsoryRecipientStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `emailHistoryId` INTEGER NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `deliveryStatus` VARCHAR(191) NULL,
    `deliveryDetails` TEXT NULL,
    `deliveryAttemptTimestamp` DATETIME(3) NULL,

    INDEX `EmailHitsoryRecipientStatus_emailHistoryId_idx`(`emailHistoryId`),
    INDEX `EmailHitsoryRecipientStatus_recipient_idx`(`recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicHolidayDaySyncStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `synced_date` DATETIME(3) NULL,
    `synced_status` VARCHAR(191) NULL,
    `synced_error` VARCHAR(191) NULL,
    `synced_error_detail` TEXT NULL,
    `public_holiday_day_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `outlook_event_id` VARCHAR(191) NULL,
    `microsoft_user_id` VARCHAR(191) NOT NULL,
    `microsoft_tenant_id` VARCHAR(191) NOT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
