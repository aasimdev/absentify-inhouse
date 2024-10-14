import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';
import { getMicrosoftPaymnetAccessToken } from '~/lib/getMicrosoftAccessToken';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import { paddle_config } from '~/helper/paddle_config';
import { PaddleService } from '~/utils/paddleV2Service';
import { sendMail } from '~/lib/sendInBlueContactApi';
interface Subscription {
  id: string;
  subscription_id: string;
  subscription_plan_id: string;
  unpaid: number | null;
}
type GroupedSubscriptions = {
  [key: string]: Subscription[];
};
export const scheduleSubScriptionUpdates = inngest.createFunction(
  {
    id: slugify('Scheduled Subscription Update'),
    name: 'Scheduled Subscription User Count Update'
  },
  { cron: '0 23 * * *' },
  async () => {
    const subscriptions = await prisma.subscription.findMany({
      select: {
        id: true,
        subscription_id: true,
        workspace_id: true,
        quantity: true,
        workspace: { select: { min_enterprise_users: true, old_pricing: true } },
        provider: true,
        subscription_plan_id: true,
        customer_user_id: true,
        status: true
      },
      where: {
        OR: [
          {
            subscription_plan_id: `${paddle_config.products.ENTERPRISE.monthly_plan_id}`
          },
          {
            subscription_plan_id: `${paddle_config.products.ENTERPRISE.yearly_plan_id}`
          },
          {
            subscription_plan_id: `${paddle_config.products.ENTERPRISE.monthly_plan_id_v2}`
          },
          {
            subscription_plan_id: `${paddle_config.products.ENTERPRISE.yearly_plan_id_v2}`
          },
          {
            subscription_plan_id: `${paddle_config.products.BUSINESS.monthly_plan_id_v2}`
          },
          {
            subscription_plan_id: `${paddle_config.products.BUSINESS.yearly_plan_id_v2}`
          },
          {
            subscription_plan_id: `${paddle_config.products.SMALLTEAM.monthly_plan_id_v2}`
          },
          {
            subscription_plan_id: `${paddle_config.products.SMALLTEAM.yearly_plan_id_v2}`
          }
        ]
      }
    });

    for (let i1 = 0; i1 < subscriptions.length; i1++) {
      const subscription = subscriptions[i1];
      if (!subscription) continue;
      var tempLog = '';
      try {
        const members = await prisma.member.findMany({
          select: { id: true, workspace_id: true },
          where: {
            workspace_id: subscription.workspace_id
          }
        });
        tempLog += `members: ${members.length} `;

        let count = members.length;

        if (
          subscription.subscription_plan_id == `${paddle_config.products.ENTERPRISE.monthly_plan_id_v2}` ||
          subscription.subscription_plan_id == `${paddle_config.products.ENTERPRISE.yearly_plan_id_v2}` ||
          subscription.subscription_plan_id == `${paddle_config.products.ENTERPRISE.monthly_plan_id}` ||
          subscription.subscription_plan_id == `${paddle_config.products.ENTERPRISE.yearly_plan_id}`
        ) {
          if (count < subscription.workspace.min_enterprise_users && subscription.workspace.old_pricing) {
            count = subscription.workspace.min_enterprise_users;
          }
        }
        tempLog += `count: ${count} `;
        if (count != subscription.quantity) {
          if (subscription.provider == 'paddle') {
            await axios.post(
              `${
                process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                  ? 'https://sandbox-vendors.paddle.com/api'
                  : 'https://vendors.paddle.com/api'
              }/2.0/subscription/users/update`,
              {
                vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
                vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
                subscription_id: Number(subscription.subscription_id),
                quantity: count,
                bill_immediately:
                  subscription.subscription_plan_id == paddle_config.products.ENTERPRISE.yearly_plan_id + ''
                    ? true
                    : false
              }
            );
          } else if (subscription.provider == 'paddle_v2') {
            if (subscription.status == 'deleted') continue;
            if (subscription.status == 'past_due') continue;
            tempLog += `paddle_v2 `;
            let sub = await PaddleService.getSubscription(subscription.subscription_id);
            tempLog += `sub: ${sub.data.items.length} `;
            let items = sub.data.items.map((y) => {
              return { price_id: y.price.id, quantity: y.quantity };
            });

            const extingSubscription = sub.data.items.find(
              (x) =>
                x.price.product_id == paddle_config.products.ENTERPRISE.monthly_plan_id_v2 + '' ||
                x.price.product_id == paddle_config.products.ENTERPRISE.yearly_plan_id_v2 + '' ||
                x.price.product_id == paddle_config.products.SMALLTEAM.monthly_plan_id_v2 + '' ||
                x.price.product_id == paddle_config.products.SMALLTEAM.yearly_plan_id_v2 + '' ||
                x.price.product_id == paddle_config.products.BUSINESS.monthly_plan_id_v2 + '' ||
                x.price.product_id == paddle_config.products.BUSINESS.yearly_plan_id_v2 + ''
            );
            if (!extingSubscription) continue;

            let e = items.find((x) => x.price_id == extingSubscription.price.id);
            if (!e) continue;
            e.quantity = count;
            tempLog += `items: ${items.length} `;
            let proration_billing_mode:
              | 'prorated_immediately'
              | 'prorated_next_billing_period'
              | 'full_immediately'
              | 'full_next_billing_period'
              | 'do_not_bill' = 'prorated_immediately';
            try {
              const retVal = await PaddleService.previewUpdateSubscription(subscription.subscription_id, {
                items: items.filter((x) => x.quantity > 0),
                proration_billing_mode: 'prorated_immediately',
                on_payment_failure: 'apply_change'
              });
              tempLog += `retVal: ${JSON.stringify(retVal)} `;

              if (retVal.data.update_summary == null) {
                proration_billing_mode = 'prorated_immediately';
              } else if (retVal.data.collection_mode == 'manual' && retVal.data.update_summary.result.amount < 5000) {
                proration_billing_mode = 'prorated_next_billing_period';
              } else if (
                retVal.data.collection_mode == 'automatic' &&
                retVal.data.update_summary.result.amount < 1000
              ) {
                proration_billing_mode = 'prorated_next_billing_period';
              }
            } catch (e) {
              proration_billing_mode = 'prorated_next_billing_period';
            }

            tempLog += `proration_billing_mode: ${proration_billing_mode} `;
            await PaddleService.updateSubscription(subscription.subscription_id, {
              items: items.filter((x) => x.quantity > 0),
              proration_billing_mode: proration_billing_mode,
              on_payment_failure: 'apply_change'
            });
            tempLog += `updateSubscription: ${proration_billing_mode} `;
          } else if (subscription.provider == 'microsoftFulfillment') {
            let payment_token = await getMicrosoftPaymnetAccessToken();
            await axios.patch(
              `https://marketplaceapi.microsoft.com/api/saas/subscriptions/${subscription.subscription_id}?api-version=2018-08-31`,
              {
                quantity: count
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  authorization: 'Bearer ' + payment_token
                }
              }
            );
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        await sendMail({
          prisma,
          workspace_id: null,
          subject: 'Fehler Plan Upgrade',
          html: JSON.stringify(err) + '</br>' + JSON.stringify(subscription) + '</br>' + tempLog,
          recipients: {
            to: [
              {
                address: 'support@absentify.com'
              }
            ]
          }
        });
      }
    }

    return { success: true };
  }
);
export const scheduledUnpaidSubscriptions = inngest.createFunction(
  {
    id: slugify('Bill unpaid subscriptions'),
    name: 'Bill unpaid subscriptions'
  },
  { cron: '0 * * * *' },
  async () => {
    const d = new Date();

    d.setHours(d.getHours() - 2);

    const subscriptions = await prisma.subscription.findMany({
      select: {
        id: true,
        subscription_id: true,
        unpaid: true,
        subscription_plan_id: true
      },
      where: {
        createdAt: { lte: d },
        unpaid: { gt: 0 },
        provider: 'paddle'
      }
    });

    // Group all subscriptions by subscription_id
    const groupedSubscriptions = subscriptions.reduce<GroupedSubscriptions>((acc, subscription) => {
      if (!acc[subscription.subscription_id]) {
        acc[subscription.subscription_id] = [];
      }
      acc[subscription.subscription_id]?.push(subscription);
      return acc;
    }, {});

    for (const [groupId, groupSubscriptions] of Object.entries(groupedSubscriptions)) {
      console.log(`Group ID: ${groupId}`);
      console.log('Subscriptions in this group:');

      await bill(groupSubscriptions, 'DEPARTMENTS_ADDON');
      await bill(groupSubscriptions, 'CALENDAR_SYNC_ADDON');
      await bill(groupSubscriptions, 'MANAGER_ADDON');
    }

    return { success: true };
  }
);
async function bill(group: Subscription[], subscription_plan_id: string) {
  const sum_unpaid = group
    .filter((x) => x.subscription_plan_id == subscription_plan_id)
    .map((item) => item.unpaid)
    .reduce((prev: number, curr: number | null) => prev + (curr ?? 0), 0);
  console.log('sum_unpaid1', sum_unpaid);
  if (sum_unpaid == 0) {
    return;
  }

  let charge_name = 'Proportional billing of calendar sync';
  if (subscription_plan_id == 'DEPARTMENTS_ADDON') {
    charge_name = 'Proportional billing of departments';
  } else if (subscription_plan_id == 'MANAGER_ADDON') {
    charge_name = 'Proportional billing of manager addon';
  }
  console.log('sum_unpaid', sum_unpaid);
  console.log('group[0]', group[0]);
  if (group[0]) {
    const charge = await axios.request({
      method: 'POST',
      url: `${
        process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
          ? 'https://sandbox-vendors.paddle.com/api'
          : 'https://vendors.paddle.com/api'
      }/2.0/subscription/${group[0].subscription_id}/charge`,
      data: {
        vendor_id: parseInt(`${process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID}`),
        vendor_auth_code: `${process.env.PADDLE_VENDOR_AUTH_CODE}`,
        amount: sum_unpaid.toFixed(2),
        charge_name
      }
    });

    if (charge.data.error) {
      console.log(charge.data.error);
    }
    if (charge.data.success) {
      await prisma.subscription.updateMany({
        where: {
          subscription_id: group[0].subscription_id,
          subscription_plan_id
        },
        data: { unpaid: 0 }
      });
    }
  }
}
