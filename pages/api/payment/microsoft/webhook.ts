// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { paddle_config } from '~/helper/paddle_config';
import { prisma } from '~/server/db';
import { sendMail } from '~/lib/sendInBlueContactApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { body } = req;

  if (
    body.action == 'ChangePlan' ||
    body.action == 'ChangeQuantity' ||
    body.action == 'Reinstate' ||
    body.action == 'Renew' ||
    body.action == 'Suspend' ||
    body.action == 'Unsubscribe'
  ) {
    const bodyData: {
      id: string;
      activityId: string;
      publisherId: string;
      offerId: string;
      planId: string;
      quantity: number;
      subscriptionId: string;
      timeStamp: Date;
      action: string;
      status: string;
      operationRequestSource: string;
      subscription: {
        id: string;
        name: string;
        publisherId: string;
        offerId: string;
        planId: string;
        quantity: number;
        beneficiary: {
          emailId: string;
          objectId: string;
          tenantId: string;
          puid: string;
        };
        purchaser: {
          emailId: string;
          objectId: string;
          tenantId: string;
          puid: string;
        };
        allowedCustomerOperations: string[];
        sessionMode: string;
        isFreeTrial: boolean;
        isTest: boolean;
        sandboxType: string;
        saasSubscriptionStatus:
          | 'Subscribed'
          | 'Suspended'
          | 'Unsubscribed'
          | 'Started'
          | 'PendingFulfillmentStart'
          | 'InProgress'
          | 'Reinstated'
          | 'Succeeded'
          | 'Failed'
          | 'Updating';
        term: {
          startDate: Date;
          endDate: Date;
          termUnit: string;
          chargeDuration: string;
        };
        autoRenew: boolean;
        created: Date;
        lastModified: Date;
      };
      purchaseToken: string;
    } = body;
    if (bodyData.subscription.sandboxType != 'None') {
      res.status(200).json({ success: true });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { subscription_id: bodyData.subscriptionId },
      select: { id: true, workspace_id: true }
    });

    if (!subscription) {
      await sendMail({
        prisma,
        workspace_id: null,
        subject: `Microsoft Webhook-Error`,
        html: JSON.stringify(bodyData),
        recipients: {
          to: [
            {
              address: 'support@absentify.com',
              displayName: 'absentify Support'
            }
          ]
        }
      });

      res.status(400).json({ error: 'enterprise_subscription_not_found' });
      return;
    } else {
      await sendMail({
        prisma,
        workspace_id: null,
        subject: `Microsoft Payment Updated`,
        html: JSON.stringify(bodyData),
        recipients: {
          to: [
            {
              address: 'support@absentify.com',
              displayName: 'absentify Support'
            }
          ]
        }
      });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: bodyData.subscription.saasSubscriptionStatus == 'Subscribed' ? 'active' : 'deleted',
        subscription_plan_id: bodyData.subscription.term.termUnit.endsWith('M')
          ? paddle_config.products.ENTERPRISE.monthly_plan_id + ''
          : paddle_config.products.ENTERPRISE.yearly_plan_id + '',
        quantity: bodyData.quantity,
        unit_price: bodyData.subscription.term.termUnit.endsWith('M') ? 3 : 30,
        currency: 'USD',
        cancellation_effective_date:
          bodyData.subscription.saasSubscriptionStatus !== 'Subscribed' ? bodyData.subscription.term.endDate : null
      },
      select: { id: true }
    });
  }
  res.status(200).json({ success: true });
}
