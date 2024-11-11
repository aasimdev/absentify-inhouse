import axios from 'axios';
import { htmlConst } from '../email/email';
import { isEmailValid } from '~/helper/isEmailValid';
import { PrismaClient } from '@prisma/client';
import { EmailAttachment, EmailClient } from '@azure/communication-email';
import * as Sentry from '@sentry/nextjs';

export async function sendUniversalTransactionalMail(params: {
  prisma: PrismaClient;
  workspace_id: string;
  subject: string;
  to: { email: string; name: string };
  replyTo: { email: string; name: string };
  params: {
    h1: string;
    firstLine: string;
    secondLine: string;
    thirdLine: string;
    fourthLine: string;
    fifthLine?: string;
    buttonText: string;
    pageTitle: string;
    link: string;
    teamsLink: string | null;
    teamsLinkText: string | null;
    approvers: { name: string; image: string; status: string }[] | null;
    company_image_url: string | null;
    reason?: string;
  };
}) {
  const replyToValid = isEmailValid(params?.replyTo?.email);
  const sendToValid = isEmailValid(params?.to?.email);
  if (!sendToValid || !params.subject || !params.params) {
    throw new Error('BAD REQUEST');
  }

  if (params.subject.length < 6) {
    params.subject = params.subject.padEnd(5, ' ') + '.'; // Fill the subject with spaces and add a period at the end
  }

  await sendMail({
    prisma: params.prisma,
    workspace_id: params.workspace_id,
    subject: params.subject,
    html: htmlConst(params.params),
    replyTo: [
      {
        address: replyToValid ? params?.replyTo?.email : 'notifications@mails.absentify.com',
        displayName: replyToValid ? params?.replyTo?.name : 'absentify'
      }
    ],
    recipients: {
      to: [
        {
          address: params.to.email,
          displayName: params.to.name
        }
      ]
    }
  });

  return;
}

export async function sendMail(params: {
  prisma: PrismaClient;
  replyTo?: { address: string; displayName: string }[];
  subject: string;
  plainText?: string;
  html: string;
  recipients: { to: { address: string; displayName?: string }[] };
  workspace_id: string | null;
  headers?:
    | {
        [propertyName: string]: string;
      }
    | undefined;
  attachments?: EmailAttachment[] | undefined;
}) {
  let operationId = '';
  try {
    // Email validation regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate each email address
    const validRecipients = params.recipients.to.filter((recipient) => emailRegex.test(recipient.address));

    // Check email history for bounced recipients
    const bouncedRecipients = await params.prisma.emailHitsoryRecipientStatus.findMany({
      where: {
        recipient: {
          in: validRecipients.map((recipient) => recipient.address)
        },
        deliveryStatus: 'Bounced'
      },
      select: {
        recipient: true,
        deliveryDetails: true
      }
    });

    // Distinguish between hard and soft bounces
    const problematicAddresses = bouncedRecipients
      .filter(
        (bounced) =>
          (bounced.deliveryDetails && bounced.deliveryDetails.includes('550')) || // Hard bounce
          (bounced.deliveryDetails && bounced.deliveryDetails.includes('Recipient address rejected')) || // Access denied
          (bounced.deliveryDetails && bounced.deliveryDetails.includes('InfoDomainNonexistent')) // InfoDomainNonexistent
      )
      .map((bounced) => bounced.recipient);

    // const softBouncedAddresses = bouncedRecipients
    //   .filter((bounced) => !bounced.error?.includes('550 5.1.1')) // Soft bounce
    //   .map((bounced) => bounced.to);

    // Log hard bounced recipients and skip them
    if (problematicAddresses.length > 0 && params.workspace_id) {
      await params.prisma.emailHistory.create({
        data: {
          workspace_id: params.workspace_id,
          to: JSON.stringify(problematicAddresses),
          subject: params.subject,
          body: params.html,
          status: 'NotSentDueToHardBounce',
          error: 'Recipients had a hard bounce.',
          operationId: '-',
          recipientStatuses: {
            create: problematicAddresses.map((address) => ({
              recipient: address,
              deliveryStatus: 'NotSentDueToHardBounce',
              deliveryDetails: 'Recipients had a hard bounce.',
              deliveryAttemptTimestamp: new Date()
            }))
          }
        },
        select: {
          id: true
        }
      });
      //  console.log('Hard bounce recipients skipped.');
    }

    // Filter out hard bounced recipients
    params.recipients.to = validRecipients
      .filter((recipient) => !problematicAddresses.includes(recipient.address))
      .map((recipient) => ({
        address: recipient.address.toLocaleLowerCase(),
        displayName: recipient.displayName || ''
      }));

    if (params.recipients.to.length === 0) {
      console.log('No valid recipients found after filtering hard bounced addresses.');
      return;
    }

    const client = new EmailClient(process.env.COMMUNICATION_SERVICES_CONNECTION_STRING + '');
    const poller = await client.beginSend({
      senderAddress: 'notifications@mails.absentify.com',
      replyTo: params.replyTo,
      content: {
        subject: params.subject,
        plainText: params.plainText,
        html: params.html
      },
      recipients: params.recipients,
      headers: params.headers,
      attachments: params.attachments
    });
    const result = await poller.pollUntilDone();
    operationId = result.id;
    if (params.workspace_id) {
      await params.prisma.emailHistory.create({
        data: {
          workspace_id: params.workspace_id,
          to: JSON.stringify(params.recipients.to),
          subject: params.subject,
          body: params.html,
          status: result.status,
          error: result.error ? result.error.message : null,
          operationId,
          recipientStatuses: {
            create: params.recipients.to.map((recipient) => ({
              recipient: recipient.address
            }))
          }
        },
        select: {
          id: true
        }
      });
    }
  } catch (e: unknown) {
    console.log('Error sending mail:', e);
    Sentry.captureException(e);
    throw e;
  }
}
