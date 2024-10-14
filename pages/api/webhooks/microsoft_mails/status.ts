// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '~/server/db';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notifications = req.body;

  try {
    for (const notification of notifications) {
      // Check if the notification is a validation request
      if (
        notification.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent' &&
        notification.data.validationUrl
      ) {
        await axios.get(notification.data.validationUrl);
        return res.status(200).json({ validationResponse: notification.data.validationCode });
      }

      // Continue with the normal notification handling
      // Check if the notification object and its fields exist
      if (!notification.data || !notification.data.messageId || !notification.data.recipient) {
        throw new Error('Invalid notification format');
      }

      const messageId = notification.data.messageId;
      const recipient = notification.data.recipient;
      const deliveryStatus = notification.data.status;
      const deliveryDetails = notification.data.deliveryStatusDetails;
      const deliveryAttemptTimestamp = notification.data.deliveryAttemptTimestamp
        ? new Date(notification.data.deliveryAttemptTimestamp)
        : null;

      await prisma.emailHitsoryRecipientStatus.updateMany({
        where: {
          emailHistory: {
            operationId: messageId
          },
          recipient: recipient
        },
        data: {
          deliveryStatus: deliveryStatus,
          deliveryDetails: deliveryDetails ? JSON.stringify(deliveryDetails) : null,
          deliveryAttemptTimestamp: deliveryAttemptTimestamp
        }
      });
    }
    res.status(200).json({ success: 'ok' });
  } catch (error) {
    console.error('Error updating email history:', error);
    res.status(500).json({ success: 'error' });
  }

  // res.status(200).json({ success: 'ok' });
}
