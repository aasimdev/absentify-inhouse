// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { SubscriptionProvider, SubscriptionStatus } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { paddle_v2_price_ids } from '~/helper/paddle_config';
import { inngest } from '~/inngest/inngest_client';

import { prisma } from '~/server/db';
interface UnitPrice {
  amount: string;
  currency_code: string;
}

interface BillingCycle {
  interval: string;
  frequency: number;
}

interface Price {
  id: string;
  tax_mode: string;
  product_id: string;
  unit_price: UnitPrice;
  description: string;
  trial_period: any; // 'null' oder ein detailliertes Objekt, falls definiert
  billing_cycle: BillingCycle;
}

interface SubscriptionItem {
  price: Price;
  status: string;
  quantity: number;
  recurring: boolean;
  created_at: string;
  updated_at: string;
  trial_dates: any; // 'null' oder ein detailliertes Objekt, falls definiert
  next_billed_at: string;
  previously_billed_at: string;
}

interface CustomData {
  rewardful: string; // JSON als String
  workspace_id: string;
}

interface CurrentBillingPeriod {
  ends_at: string;
  starts_at: string;
}

interface SubscriptionData {
  id: string;
  items: SubscriptionItem[];
  status: string;
  discount: any; // 'null' oder ein detailliertes Objekt, falls definiert
  paused_at: any; // 'null' oder ein detailliertes Objekt, falls definiert
  address_id: string;
  created_at: string;
  started_at: string;
  updated_at: string;
  business_id: any; // 'null' oder ein detailliertes Objekt, falls definiert
  canceled_at: any; // 'null' oder ein detailliertes Objekt, falls definiert
  custom_data: CustomData;
  customer_id: string;
  billing_cycle: BillingCycle;
  currency_code: string;
  next_billed_at: string;
  transaction_id: string;
  billing_details: any; // 'null' oder ein detailliertes Objekt, falls definiert
  collection_mode: string;
  first_billed_at: string;
  scheduled_change: any; // 'null' oder ein detailliertes Objekt, falls definiert
  current_billing_period: CurrentBillingPeriod;
}

interface EventNotification {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id: string;
  data: SubscriptionData;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { body }: { body: EventNotification } = req;

  if (
    body.event_type === 'subscription.created' ||
    body.event_type === 'subscription.updated' ||
    body.event_type === 'subscription.canceled'
  ) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        subscription_id: body.data.id
      }
    });

    if (subscription) {
      console.log(body, body.data.items[0], 'subscription exists - updating');
      await updateSubscriptionData(body);
    } else {
      if (body.event_type === 'subscription.canceled' || body.event_type === 'subscription.updated') {
        res.status(200).json({ success: true });
        return;
      }
      console.log(body, body.data.items[0], 'subscription does not exist - creating');
      await createSubscriptionData(body);
    }
  }
  res.status(200).json({ success: true });
}

async function updateSubscriptionData(body: EventNotification) {
  const currentItems = body.data.items.map((item: any) => item.price.id);

  // Fetch all existing subscription items associated with the subscription ID
  const existingItems = await prisma.subscription.findMany({
    where: {
      subscription_id: body.data.id
    }
  });

  // Identify items to be deleted
  const itemsToDelete = existingItems.filter((item) => !currentItems.includes(item.price_id));

  // Delete items that are not present in the current request body
  const deletePromises = itemsToDelete.map(async (item) => {
    await prisma.subscription.delete({
      where: {
        id: item.id
      }
    });
  });

  // Update or create subscription items
  const updatePromises = body.data.items.map(async (item: any) => {
    const existingItem = await prisma.subscription.findFirst({
      where: {
        subscription_id: body.data.id,
        price_id: item.price.id
      }
    });
    if (existingItem) {
      await prisma.subscription.update({
        where: {
          id: existingItem.id
        },
        data: prepareSubscriptionItemData(item, body, existingItem)
      });
    } else {
      await prisma.subscription.create({
        data: prepareSubscriptionItemData(item, body)
      });
    }
  });
  if (
    body.data.items.find((x) =>
      [paddle_v2_price_ids.BUSINESS.yearly_price_id_v1, paddle_v2_price_ids.BUSINESS.monthly_price_id_v1].includes(
        x.price.id
      )
    )
  )
    await prisma.workspace.update({
      where: { id: body.data.custom_data.workspace_id },
      data: { old_pricing: true },
      select: { id: true }
    });
  await Promise.all([...deletePromises, ...updatePromises]);
}

async function createSubscriptionData(body: EventNotification) {
  const createPromises = body.data.items.map(async (item: any) => {
    await prisma.subscription.create({
      data: prepareSubscriptionItemData(item, body)
    });
  });
  if (
    body.data.items.find((x) =>
      [paddle_v2_price_ids.BUSINESS.yearly_price_id_v1, paddle_v2_price_ids.BUSINESS.monthly_price_id_v1].includes(
        x.price.id
      )
    )
  ) {
    const workspace = await prisma.workspace.update({
      where: { id: body.data.custom_data.workspace_id },
      data: { old_pricing: true },
      select: {
        id: true,
        members: { where: { status: { not: 'ARCHIVED' }, microsoft_user_id: { not: null } }, select: { id: true } }
      }
    });

    await inngest.send(
      workspace.members.map((m) => {
        return {
          name: 'publicHolidayDaySync/create_sync_items_for_member',
          data: {
            member_id: m.id
          }
        };
      })
    );
  }
  await Promise.all(createPromises);
}

function prepareSubscriptionItemData(
  item: any,
  body: EventNotification,
  existingSubscription?: { status: SubscriptionStatus }
) {
  let cancellation_effective_date = null;
  if (body.data.scheduled_change?.effective_at && body.data.scheduled_change?.action == 'cancel') {
    body.data.status = 'deleted';
    cancellation_effective_date = new Date(body.data.scheduled_change.effective_at);
  }

  if (body.data.status == 'canceled') {
    cancellation_effective_date = new Date();
    body.data.status = 'deleted';
  }
  let past_due_since: Date | null = null;
  if (existingSubscription) {
    if (existingSubscription.status != 'past_due' && body.data.status == 'past_due') {
      past_due_since = new Date();
    }
    if (body.data.status == 'active') {
      past_due_since = null;
    }
  }

  return {
    workspace_id: body.data.custom_data.workspace_id,
    provider: SubscriptionProvider.paddle_v2,
    status: body.data.status as SubscriptionStatus,
    subscription_id: body.data.id,
    customer_user_id: body.data.customer_id,
    currency: body.data.currency_code,
    cancellation_effective_date: cancellation_effective_date,
    quantity: item.quantity,
    // next_billed_at: new Date(item.next_billed_at),
    // previously_billed_at: new Date(item.previously_billed_at),
    // createdAt: new Date(item.created_at),
    //updatedAt: new Date(item.updated_at),
    price_id: item.price.id,
    //product_id: item.price.product_id,
    unit_price: item.price.unit_price.amount ? parseFloat(item.price.unit_price.amount) : 0,
    billing_cycle_interval: item.price.billing_cycle.interval,
    //billing_cycle_frequency: item.price.billing_cycle.frequency,
    subscription_plan_id: item.price.product_id,
    past_due_since: past_due_since
  };
}
