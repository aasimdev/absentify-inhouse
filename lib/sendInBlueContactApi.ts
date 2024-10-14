import axios from 'axios';
import { htmlConst } from '../email/email';
import { isEmailValid } from '~/helper/isEmailValid';
import { ContactsApi, ContactsApiApiKeys, CreateContact, UpdateContact } from '@getbrevo/brevo';
import { PrismaClient } from '@prisma/client';
import { EmailAttachment, EmailClient } from '@azure/communication-email';
import * as Sentry from '@sentry/nextjs';
export async function deleteSendInBlueContact(sendInClueIds: (string | null | undefined)[]) {
  try {
    for (let index = 0; index < sendInClueIds.length; index++) {
      const sendinblue_contact_id = sendInClueIds[index];
      if (sendinblue_contact_id) {
        await axios.delete(
          'https://api.brevo.com/v3/contacts/' + sendinblue_contact_id,

          {
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              'api-key': `${process.env.SENDINBLUE_API_KEY}`
            }
          }
        );
      }
    }
  } catch (e) {
    console.log(e);
  }
}

export async function getSendInBlueContact(sendinblue_contact_id: string) {
  const apiInstance = new ContactsApi();
  const contact = await apiInstance.getContactInfo(sendinblue_contact_id);
  return contact.body;
}

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
export async function createOrUpdateSendInBlueContact(
  member: {
    id: string;
    sendinblue_contact_id: string | null;
    email?: string | null | undefined;
    email_notifications_updates: boolean | null;
    language: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    is_admin: boolean;
  },
  prisma: PrismaClient
) {
  if (!member.email) return;

  const apiInstance = initializeSendInBlueApi();
  const attributes = buildAttributes(member);

  // Überprüfen, ob eine SendInBlue-Kontakt-ID bereits vorhanden ist
  if (member.sendinblue_contact_id) {
    // Direktes Aktualisieren des Kontakts, da die ID bekannt ist
    await retryApiCall(() =>
      updateSendInBlueContact(apiInstance, member.sendinblue_contact_id + '', attributes, prisma, member.id)
    );
  } else {
    // Versuch, Kontaktinformationen zu erhalten oder neuen Kontakt zu erstellen
    try {
      const contact = await retryApiCall(() => apiInstance.getContactInfo((member.email + '').toLowerCase()));
      await retryApiCall(() => updateSendInBlueContact(apiInstance, contact.body.id, attributes, prisma, member.id));
    } catch (e) {
      if ((e as any).response?.body?.code === 'document_not_found') {
        await retryApiCall(() => createSendInBlueContact(apiInstance, member, attributes, prisma));
      } else if (
        (e as any).response?.body?.code === 'invalid_parameter' &&
        (e as any).response?.body?.message.includes('Contact already exist')
      ) {
        // Behandle den Fall, dass der Kontakt bereits existiert
        console.log('Handling existing contact error during creation attempt.');
        const existingContact = await retryApiCall(() => apiInstance.getContactInfo((member.email + '').toLowerCase()));
        await retryApiCall(() =>
          updateSendInBlueContact(apiInstance, existingContact.body.id, attributes, prisma, member.id)
        );
      } else {
        console.error('Error:', e);
      }
    }
  }
}

function initializeSendInBlueApi(): ContactsApi {
  const apiInstance = new ContactsApi();
  apiInstance.setApiKey(ContactsApiApiKeys.apiKey, `${process.env.SENDINBLUE_API_KEY}`);
  return apiInstance;
}

function buildAttributes(member: any): any {
  return {
    EMAIL: member.email,
    VORNAME: member.firstName || member.name || '',
    NACHNAME: member.lastName || member.name || '',
    WANT_TO_GET_UPDATES: member.email_notifications_updates,
    LANGUAGE: member.language,
    IS_ADMIN: member.is_admin
  };
}

async function updateSendInBlueContact(
  apiInstance: ContactsApi,
  contactId: string,
  attributes: any,
  prisma: PrismaClient,
  memberId: string
) {
  try {
    const updateContact = new UpdateContact();
    updateContact.attributes = attributes;
    updateContact.emailBlacklisted = !attributes.WANT_TO_GET_UPDATES;
    await apiInstance.updateContact(contactId, updateContact);
    await prisma.member.update({ where: { id: memberId }, data: { sendinblue_contact_id: contactId + '' } });
  } catch (e) {
    console.error('Error updating contact:', e);
  }
}

async function createSendInBlueContact(apiInstance: ContactsApi, member: any, attributes: any, prisma: PrismaClient) {
  const createContact = new CreateContact();
  createContact.email = member.email;
  createContact.attributes = attributes;
  createContact.emailBlacklisted = !attributes.WANT_TO_GET_UPDATES;
  try {
    const newContact = await apiInstance.createContact(createContact);
    if (newContact.body.id) {
      await prisma.member.update({
        where: { id: member.id },
        data: { sendinblue_contact_id: newContact.body.id + '' }
      });
    }
  } catch (e) {
    console.error('Failed to create contact:', e);
  }
}

async function retryApiCall(apiFunction: () => Promise<any>, maxAttempts: number = 5) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await apiFunction();
    } catch (e) {
      if ((e as any).response?.status === 429 && attempt < maxAttempts - 1) {
        // Read the rate limit headers
        const rateLimitReset = (e as any).response?.headers['x-sib-ratelimit-reset'];

        // Convert reset time to milliseconds (if in seconds)
        const waitTime = rateLimitReset * 1000; // Adjust this calculation based on the header unit

        // Logging the wait time (optional, for debugging purposes)
        console.log(`Rate limit exceeded. Retrying after ${waitTime} milliseconds`);

        // Wait for the rate limit to reset
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        // Rethrow the error if it's not a rate limit error or if max attempts are reached
        throw e;
      }
    }
    attempt++;
  }
}
