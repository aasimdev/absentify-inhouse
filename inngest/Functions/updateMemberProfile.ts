import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { NonRetriableError, slugify } from 'inngest';
import { getMicrosoftUsersAccessToken } from '~/lib/getMicrosoftAccessToken';
import { DisplayNameFormat } from '@prisma/client';
import axios from 'axios';
import { createName } from '~/utils/createName';
import sharp from 'sharp';
import { BlobServiceClient } from '@azure/storage-blob';
import { sendMail } from '~/lib/sendInBlueContactApi';
import * as Sentry from '@sentry/nextjs';
import qs from 'qs';
const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_URL + '');
export const updateMemberProfile = inngest.createFunction(
  {
    id: slugify('Update member profile with Microsoft Graph Data'),
    name: 'Update member profile with Microsoft Graph Data'
  },
  { event: 'member/update.member.profile' },
  async ({ event, step }) => {
    await step.run('Update User Profile', async () => {
      const existingMember = await prisma.member.findUnique({
        where: { microsoft_user_id: event.data.microsoft_user_id },
        select: {
          id: true,
          name: true,
          has_cdn_image: true,
          microsoft_user_id: true,
          firstName: true,
          lastName: true,
          email: true,
          displayName: true,
          language: true,
          is_admin: true,
          email_notifications_updates: true,
          mobile_phone: true,
          business_phone: true,
          workspace: { select: { global_name_format: true } }
        }
      });
      if (existingMember) {
        let token = event.data.token;
        if (token == null) token = await getMicrosoftUsersAccessToken(event.data.microsoft_tenant_id);
        if (token) {
          await checkAndUpdateUserImage(token, existingMember);
          await checkAndUpdateUserMetadata(token, event.data.microsoft_user_id, existingMember);
        }
        if (!token) {
          return { success: true, message: 'No token' };
        }
      }
    });

    return { success: true };
  }
);

export const keepTokenAlive = inngest.createFunction(
  {
    id: slugify('Keeps the Microsoft Graph Token alive'),
    name: 'Keeps the Microsoft Graph Token alive'
  },
  { event: 'member/keep.token.alive' },
  async ({ event, step, attempt }) => {
    await step.sleep('wait-1day', '1d');
    await step.run('refresh token', async () => {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };
      const member = await prisma.memberMicrosoftToken.findUnique({
        where: {
          client_id_member_id: {
            client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
            member_id: event.data.member_id
          }
        },
        select: { refresh_token: true, member_id: true, member: { select: { workspace_id: true, email: true } } }
      });

      if (!member) {
        throw new NonRetriableError('No member found');
      }
      const data = qs.stringify({
        client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
        scope: 'offline_access Group.ReadWrite.All',
        refresh_token: member.refresh_token,
        grant_type: 'refresh_token',
        client_secret: process.env.MSAL_SECRET_GROUPS_PERMISSION + ''
      });

      try {
        const r22 = await axios.post(tokenUrl, data, config);

        prisma.memberMicrosoftToken.update({
          where: {
            client_id_member_id: {
              client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
              member_id: event.data.member_id
            }
          },
          data: {
            refresh_token: r22.data.refresh_token,
            scope: r22.data.scope
          }
        });
      } catch (err) {
        if (attempt > 3) {
          await prisma.memberMicrosoftToken.delete({
            where: {
              client_id_member_id: {
                client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
                member_id: event.data.member_id
              }
            }
          });
          const generateRandomState = () => {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0]!.toString(36);
          };
          const generateMicrosoftLoginUrl = () => {
            let redirectUri = `https://app.absentify/api/auth/group_delegated`;
            let state = generateRandomState();

            const baseUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
            const params = new URLSearchParams({
              client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
              scope: 'openid email profile offline_access Group.ReadWrite.All',
              response_type: 'code',
              redirect_uri: redirectUri,
              state: state
            });

            return `${baseUrl}?${params.toString()}`;
          };

          if (member.member.email) {
            await sendMail({
              prisma,
              workspace_id: member.member.workspace_id,
              recipients: {
                to: [
                  {
                    address: member.member.email
                  }
                ]
              },
              replyTo: [{ address: 'kelly@support-mail.absentify.com', displayName: 'Kelly from absentify' }],
              subject: `We could not renew your Microsoft Token`,
              html: 'Your Microsoft token could not be renewed. Please log in again: ' + generateMicrosoftLoginUrl()
            });
          }

          throw new NonRetriableError('No permission', { cause: err });
        }
      }
    });

    await step.sendEvent('restart', {
      name: 'member/keep.token.alive',
      data: { member_id: event.data.member_id }
    });

    return { success: true };
  }
);

async function checkAndUpdateUserMetadata(
  token: string,
  microsoft_user_id: string,
  member: {
    id: string;
    name: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    language: string | null;
    is_admin: boolean;
    email_notifications_updates: boolean | null;
    has_cdn_image: boolean;
    mobile_phone: string | null;
    business_phone: string | null;
    workspace: {
      global_name_format: DisplayNameFormat;
    };
  }
) {
  try {
    // https://docs.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0#examples
    const me = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${microsoft_user_id}?$select=id,userPrincipalName,mail,givenName,surname,displayName,mobilePhone,businessPhones`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (me.status == 200 && me.data) {
      const meData = me.data;
      const newEmail = meData.mail
        ? (meData.mail + '').toLocaleLowerCase()
        : meData.userPrincipalName.toLocaleLowerCase();
      const newName = createName(
        member.workspace.global_name_format ?? 'First',
        meData.givenName,
        meData.surname,
        meData.displayName,
        newEmail
      );
      await updateUserIfNessesery(member, meData, newEmail, newName);
    }
  } catch (e) {
    Sentry.captureException(e);
  }
}

export interface SizedImage {
  size: number;
  filename: string;
  buffer: ArrayBuffer;
}

export const resizeImages = async (
  buffer: ArrayBuffer,
  sizes: Array<number | string>,
  basename: string
): Promise<SizedImage[]> => {
  const resizedImages: SizedImage[] = [];

  for (const size of sizes) {
    if (typeof size === 'string' && size.includes('landscape')) {
      const [width, height] = size.split('landscape');
      const resizedBuffer: ArrayBuffer = await sharp(Buffer.from(buffer))
        .resize(Number(width), Number(height), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();
      resizedImages.push({
        size: Number(width),
        filename: `${basename}_${width}x${height}.jpeg`,
        buffer: resizedBuffer
      });
    } else if (typeof size === 'number') {
      const resizedBuffer: ArrayBuffer = await sharp(Buffer.from(buffer))
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();
      resizedImages.push({
        size,
        filename: `${basename}_${size}x${size}.jpeg`,
        buffer: resizedBuffer
      });
    }
  }

  return resizedImages;
};

async function checkAndUpdateUserImage(
  token: string,
  member: {
    id: string;
    has_cdn_image: boolean;
    microsoft_user_id: string | null;
  }
) {
  let has_cdn_image = false;
  if (!member.microsoft_user_id) return false;
  try {
    // https://docs.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0#examples
    const profilePicture = await fetch(
      `https://graph.microsoft.com/v1.0/users/${member.microsoft_user_id}/photo/$value`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (profilePicture.ok) {
      const inputBuffer = await profilePicture.arrayBuffer();
      const imageSizes: number[] = [32, 64, 128, 256, 512];
      const filename = member.microsoft_user_id; // Basisname für die Dateien

      const resizedImages: SizedImage[] = await resizeImages(inputBuffer, imageSizes, filename);

      for (let index = 0; index < resizedImages.length; index++) {
        const buffer = resizedImages[index];
        if (!buffer) continue;
        const containerClient = blobServiceClient.getContainerClient('');
        const blockBlobClient = containerClient.getBlockBlobClient(buffer.filename);
        const blobOptions = { blobHTTPHeaders: { blobContentType: 'image/jpeg' } };
        await blockBlobClient.uploadData(buffer.buffer, blobOptions);
      }
      if (resizedImages.length > 0 && resizedImages[1]) {
        if (!member.has_cdn_image) {
          await prisma.member.update({
            where: { id: member.id },
            select: { id: true },
            data: {
              has_cdn_image: true
            }
          });
        }
      }
    }
  } catch (e) {
    Sentry.captureException(e);
  }

  return has_cdn_image;
}

async function updateUserIfNessesery(
  m: {
    workspace: {
      global_name_format: DisplayNameFormat;
    };
    id: string;
    name: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    language: string | null;
    mobile_phone: string | null;
    business_phone: string | null;
    is_admin: boolean;
    email_notifications_updates: boolean | null;
  } | null,
  meData: any,
  newEmail: string,
  newName: string
) {
  if (
    m &&
    (m.displayName !== meData.displayName ||
      m.firstName !== meData.givenName ||
      m.lastName !== meData.surname ||
      m.mobile_phone !== meData.mobilePhone ||
      m.business_phone !== (meData.businessPhones?.length > 0 ? meData.businessPhones[0] : m.business_phone) ||
      m.email !== newEmail.toLowerCase() ||
      m.name !== newName)
  ) {
    await prisma.member.update({
      where: { id: m.id },
      select: { id: true },
      data: {
        name: newName,
        lastName: meData.surname,
        firstName: meData.givenName,
        displayName: meData.displayName,
        email: newEmail,
        mobile_phone: meData.mobilePhone,
        business_phone: meData.businessPhones?.length > 0 ? meData.businessPhones[0] : m.business_phone
      }
    });

    inngest.send({
      name: 'brevo/create_or_update_contact',
      data: { member_id: m.id }
    });
  }
}
