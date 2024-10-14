import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';
import axios from 'axios';
import { getMicrosoftGroupsAccessToken, getMicrosoftUsersAccessToken } from '~/lib/getMicrosoftAccessToken';
import * as Sentry from '@sentry/nextjs';
import { addDays } from 'date-fns';
export const graphNotificationsKeepAlive = inngest.createFunction(
  {
    id: slugify('Keeps the Graph Subscriptions alive'),
    name: 'Keeps the Graph Subscriptions alive'
  },
  { cron: '0 23 * * *' },
  async ({ step }) => {
    const subscriptions = await step.run('Update User Profile', async () => {
      const today = new Date();
      // Zeit auf Mitternacht setzen für genaue Abfrage
      today.setHours(0, 0, 0, 0);
      const subscriptions = await prisma.microsoftGraphSubscription.findMany({
        where: {
          expiration_date: {
            gte: addDays(today, -1),
            lte: addDays(today, 2)
          }
        },
        select: {
          id: true,
          subscription_id: true,
          tenant_id: true,
          resource: true
        }
      });
      return subscriptions;
    });

    await step.sendEvent(
      'send-subscriptions-events',
      subscriptions.map((subscription) => {
        return {
          name: 'microsoftGraphSubscription/update.expiration_date',
          data: {
            subscription_id: subscription.subscription_id,
            tenant_id: subscription.tenant_id,
            resource: subscription.resource
          }
        };
      })
    );

    return { success: true };
  }
);

export const updateGraphSubscriptionExpirationDate = inngest.createFunction(
  { id: 'microsoft-graph-subscription-update-expiration-date' },
  { event: 'microsoftGraphSubscription/update.expiration_date' },
  async ({ event, logger }) => {
    try {
      let token = null;
      if (event.data.resource === '/users') {
        token = await getMicrosoftUsersAccessToken(event.data.tenant_id);
      } else if (event.data.resource === '/groups') {
        token = await getMicrosoftGroupsAccessToken(event.data.tenant_id);
      }
      if (!token) throw new Error('No token found');

      const config = {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      };
      let date = addDays(new Date(), 20);

      await axios.patch(
        `https://graph.microsoft.com/v1.0/subscriptions/${event.data.subscription_id}`,
        { expirationDateTime: date.toISOString() },
        config
      );

      await prisma.microsoftGraphSubscription.update({
        where: { subscription_id: event.data.subscription_id },
        data: { expiration_date: date }
      });
    } catch (e) {
      logger.warn(e);
      /*     await prisma.microsoftGraphSubscription.delete({
        where: { subscription_id: ressource.subscriptionId }
      }); */
      Sentry.captureException(e);
    }
  }
);
