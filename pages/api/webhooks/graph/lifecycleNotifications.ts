// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getMicrosoftGroupsAccessToken, getMicrosoftUsersAccessToken } from '~/lib/getMicrosoftAccessToken';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '~/server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let validationToken = req.query['validationToken'];

  // If a validation token is present, we need to respond within 5 seconds by
  // returning the given validation token. This only happens when a new
  // webhook is being added
  if (validationToken) {
    res.status(200).send(validationToken);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // console.log(req.body);
  console.log(JSON.stringify(req.body));

  for (let index = 0; index < req.body.value.length; index++) {
    const ressource = req.body.value[index];
    //check user exists in db
    try {
      if (ressource.lifecycleEvent == 'reauthorizationRequired') {
        let x = await prisma.microsoftGraphSubscription.findUnique({
          where: { subscription_id: ressource.subscriptionId },
          select: { resource: true }
        });

        if (!x) continue;

        let token = null;
        if (x.resource === '/users') {
          token = await getMicrosoftUsersAccessToken(ressource.tenantId);
        } else if (x.resource === '/groups') {
          token = await getMicrosoftGroupsAccessToken(ressource.tenantId);
        }

        const config = {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        };
        var date = new Date(); // Now
        date.setDate(date.getDate() + 25);
        const response = await axios.patch(
          `https://graph.microsoft.com/v1.0/subscriptions/${ressource.subscriptionId}`,
          { expirationDateTime: date.toISOString() },
          config
        );

        await prisma.microsoftGraphSubscription.update({
          where: { subscription_id: ressource.subscriptionId },
          data: { expiration_date: date }
        });

        console.log(response.statusText);
      } else if (ressource.lifecycleEvent == 'subscriptionRemoved') {
        await prisma.microsoftGraphSubscription.delete({
          where: { subscription_id: ressource.subscriptionId }
        });
      }
    } catch (e) {
      /*     await prisma.microsoftGraphSubscription.delete({
        where: { subscription_id: ressource.subscriptionId }
      }); */
      Sentry.captureException(e);
    }
  }

  res.status(200).json({ name: 'John Doe' });
}
