import { BillingCycleInterval, SubscriptionProvider, SubscriptionStatus } from '@prisma/client';
import { de } from 'date-fns/locale';
import {
  paddle_business_ids,
  paddle_business_ids_v1,
  paddle_department_addon_ids,
  paddle_enterprise_ids,
  paddle_manager_addon_ids,
  paddle_shared_outlook_calendar_sync_addon_ids,
  paddle_small_team_ids
} from '~/helper/paddle_config';

export type SubscriptionSummary = {
  has_valid_subscription: boolean;
  subscription_id: string;
  status: SubscriptionStatus | null;
  provider: SubscriptionProvider | null;
  billing_cycle_interval: BillingCycleInterval;
  cancellation_effective_date: Date | null;
  has_business_V1_subscription?: boolean;
  small_team: number;
  business: boolean;
  business_by_user: number;
  enterprise: number;
  addons: {
    multi_manager: boolean;
    calendar_sync: number;
    allowance_types: number;
    departments: number;
    webhooks: number;
    unlimited_departments: boolean;
  };
};

// Helper function to check subscription status and cancellation effective date
const isActiveOrFutureCanceled = (status: string, cancellation_effective_date: Date | null): boolean => {
  return (
    ['active', 'paused', 'pending', 'past_due', 'trialing'].includes(status) ||
    (status === 'deleted' && cancellation_effective_date !== null && new Date(cancellation_effective_date) > new Date())
  );
};

export const hasEnterpriseSubscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
  }[]
): boolean => {
  // Check if any subscription includes an enterprise product with a valid status
  return subscriptions.some(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      paddle_enterprise_ids.includes(subscription.subscription_plan_id)
  );
};
export const hasSmalTeamSubscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
  }[]
): boolean => {
  // Check if any subscription includes a business product with a valid status
  return subscriptions.some(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      paddle_small_team_ids.includes(subscription.subscription_plan_id)
  );
};
export const hasBusinessV1Subscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
  }[]
): boolean => {
  // Check if any subscription includes a business product with a valid status
  return subscriptions.some(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      paddle_business_ids_v1.includes(subscription.subscription_plan_id)
  );
};

export const hasBusinessSubscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
  }[]
): boolean => {
  // Check if any subscription includes a business product with a valid status
  return subscriptions.some(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      paddle_business_ids.includes(subscription.subscription_plan_id)
  );
};

export const getBusinessV1Subscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
    currency: string;
    billing_cycle_interval: BillingCycleInterval;
    subscription_id: string;
    customer_user_id: string;
  }[]
):
  | {
      status: SubscriptionStatus;
      subscription_plan_id: string;
      cancellation_effective_date: Date | null;
      currency: string;
      billing_cycle_interval: BillingCycleInterval;
      subscription_id: string;
      customer_user_id: string;
    }
  | undefined => {
  // Check if any subscription includes a business product with a valid status
  return subscriptions.find(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      paddle_business_ids_v1.includes(subscription.subscription_plan_id)
  );
};

export const getSubscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
    currency: string;
    billing_cycle_interval: BillingCycleInterval;
    subscription_id: string;
    customer_user_id: string;
  }[]
):
  | {
      status: SubscriptionStatus;
      subscription_plan_id: string;
      cancellation_effective_date: Date | null;
      currency: string;
      billing_cycle_interval: BillingCycleInterval;
      subscription_id: string;
      customer_user_id: string;
    }
  | undefined => {
  // Check if any subscription includes a business product with a valid status
  return subscriptions.find(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      (paddle_business_ids_v1.includes(subscription.subscription_plan_id) ||
        paddle_business_ids.includes(subscription.subscription_plan_id) ||
        paddle_small_team_ids.includes(subscription.subscription_plan_id) ||
        paddle_enterprise_ids.includes(subscription.subscription_plan_id))
  );
};

export const hasValidSubscription = (
  subscriptions: {
    status: SubscriptionStatus;
    subscription_plan_id: string;
    cancellation_effective_date: Date | null;
  }[]
): boolean => {
  // Combine both business and enterprise product IDs into one array
  const combinedProductIds = [
    ...paddle_business_ids_v1,
    ...paddle_enterprise_ids,
    ...paddle_business_ids,
    ...paddle_small_team_ids
  ];

  // Check if any subscription includes product with a valid status
  return subscriptions.some(
    (subscription) =>
      isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date) &&
      combinedProductIds.includes(subscription.subscription_plan_id)
  );
};

export const summarizeSubscriptions = (
  subscriptions: {
    status: SubscriptionStatus;
    cancellation_effective_date: Date | null;
    subscription_plan_id: string;
    billing_cycle_interval: BillingCycleInterval;
    quantity: number;
    provider: SubscriptionProvider;
    subscription_id: string;
  }[]
): SubscriptionSummary => {
  let has_valid_subscription = false;
  let has_business_V1_subscription = false;
  let business = false;
  let business_by_user = 0;
  let small_team = 0;
  let enterprise = 0;
  let multi_manager = false;
  let calendar_sync = 0;
  let webhooks = 0;
  let departments = 0;
  let allowance_types = 0;
  let unlimited_departments = false;
  let billing_cycle_interval: BillingCycleInterval = 'month';
  let cancellation_effective_date = null;
  let status: SubscriptionStatus | null = null;
  let provider: SubscriptionProvider | null = null;
  let subscription_id = '';

  for (const subscription of subscriptions) {
    if (!isActiveOrFutureCanceled(subscription.status, subscription.cancellation_effective_date)) continue;

    // Check and set the small_team flag
    if (paddle_small_team_ids.includes(subscription.subscription_plan_id)) {
      billing_cycle_interval = subscription.billing_cycle_interval;
      status = subscription.status;
      provider = subscription.provider;
      small_team = subscription.quantity;
      cancellation_effective_date = subscription.cancellation_effective_date;
      departments = 4;
      calendar_sync = 1;
      allowance_types = 2;
      multi_manager = false;
    }

    // Check and set the business flag
    if (paddle_business_ids.includes(subscription.subscription_plan_id)) {
      billing_cycle_interval = subscription.billing_cycle_interval;
      status = subscription.status;
      provider = subscription.provider;
      business_by_user = subscription.quantity;
      cancellation_effective_date = subscription.cancellation_effective_date;
      departments = 8;
      calendar_sync = 5;
      multi_manager = true;
      allowance_types = 4;
      webhooks = 3;
    }

    // Check and set the business flag
    if (paddle_business_ids_v1.includes(subscription.subscription_plan_id)) {
      billing_cycle_interval = subscription.billing_cycle_interval;
      status = subscription.status;
      provider = subscription.provider;
      business = true;
      cancellation_effective_date = subscription.cancellation_effective_date;
      allowance_types += 4;
      webhooks += 3;
      calendar_sync += 1;
      departments += 4;
    }

    // Check and set the enterprise flag
    if (paddle_enterprise_ids.includes(subscription.subscription_plan_id)) {
      billing_cycle_interval = subscription.billing_cycle_interval;
      status = subscription.status;
      enterprise = subscription.quantity;
      provider = subscription.provider;
      cancellation_effective_date = subscription.cancellation_effective_date;
      multi_manager = true;
    }

    // Check and set the multi manager flag
    if (
      paddle_manager_addon_ids.includes(subscription.subscription_plan_id) &&
      (subscription.status === 'active' || subscription.status == 'trialing')
    ) {
      multi_manager = true;
    }

    // Sum the quantity of calendar sync
    if (
      paddle_shared_outlook_calendar_sync_addon_ids.includes(subscription.subscription_plan_id) &&
      (subscription.status === 'active' || subscription.status == 'trialing')
    ) {
      calendar_sync += subscription.quantity;
    }

    // Sum the quantity of departments
    if (
      paddle_department_addon_ids.includes(subscription.subscription_plan_id) &&
      (subscription.status === 'active' || subscription.status == 'trialing')
    ) {
      departments += subscription.quantity;
    }
    if (subscription.subscription_plan_id == 'UNLIMITED_DEPARTMENTS_ADDON') {
      unlimited_departments = true;
    }
    if (subscription.status == 'deleted') {
      departments = 2;
      calendar_sync = 0;
      multi_manager = false;
      allowance_types = 1;
      webhooks = 0;
    }
  }
  has_valid_subscription = hasValidSubscription(subscriptions);
  has_business_V1_subscription = hasBusinessV1Subscription(subscriptions);
  if (departments == 0) departments = 2;
  if (allowance_types == 0) allowance_types = 1;
  return {
    has_valid_subscription: has_valid_subscription,
    status: status,
    provider: provider,
    cancellation_effective_date,
    billing_cycle_interval: billing_cycle_interval == 'month' ? 'month' : 'year',
    small_team,
    business,
    business_by_user,
    enterprise,
    subscription_id,
    has_business_V1_subscription,
    addons: {
      multi_manager,
      calendar_sync,
      departments,
      allowance_types,
      unlimited_departments,
      webhooks
    }
  };
};
