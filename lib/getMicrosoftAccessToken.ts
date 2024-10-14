import { Prisma, PrismaClient } from '@prisma/client';
import axios from 'axios';
import qs from 'qs';

export async function getMicrosoftPaymnetAccessToken() {
  try {
    const formData = {
      Client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID as string,
      Resource: '20e940b3-4c77-4b0b-9a53-9e16a1b010a7',
      client_secret: process.env.MSAL_SECRET as string,
      Grant_type: 'client_credentials'
    };

    const config = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };

    const response = await axios.post(
      'https://login.microsoftonline.com/43b518ca-563a-4dbb-a9c9-250802ea8563/oauth2/token',
      new URLSearchParams(formData),
      config
    );

    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft payment access token:', error);
    throw error;
  }
}

export async function getMicrosoftCalendarAccessToken(microsoft_tenantId: string | null) {
  try {
    const formData = {
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION as string,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: process.env.MSAL_SECRET_CALENDARS_PERMISSION as string,
      grant_type: 'client_credentials'
    };
    const config = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };
    const response = await axios.post(
      `https://login.microsoftonline.com/${microsoft_tenantId}/oauth2/v2.0/token`,
      new URLSearchParams(formData),
      config
    );
    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft default app access token:', error);
    throw error;
  }
}
export async function getMicrosoftDefaultAppAccessToken(microsoft_tenantId: string | null) {
  try {
    const formData = {
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID as string,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: process.env.MSAL_SECRET as string,
      grant_type: 'client_credentials'
    };

    const config = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };
    const response = await axios.post(
      `https://login.microsoftonline.com/${microsoft_tenantId}/oauth2/v2.0/token`,
      new URLSearchParams(formData),
      config
    );
    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft default app access token:', error);
    throw error;
  }
}
export async function getMicrosoftMailboxAccessToken(microsoft_tenantId: string | null) {
  const formData = {
    client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION as string,
    scope: 'https://graph.microsoft.com/.default',
    client_secret: process.env.MSAL_SECRET_MAILBOX_PERMISSION as string,
    grant_type: 'client_credentials'
  };

  const config = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  };

  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${microsoft_tenantId}/oauth2/v2.0/token`,
      new URLSearchParams(formData),
      config
    );
    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft mailbox access token:', error);
    throw error;
  }
}
export async function getMicrosoftGroupsAccessToken(microsoft_tenantId: string | null) {
  try {
    const formData = {
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION as string,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: process.env.MSAL_SECRET_GROUPS_PERMISSION as string,
      grant_type: 'client_credentials'
    };

    const config = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };

    const response = await axios.post(
      `https://login.microsoftonline.com/${microsoft_tenantId}/oauth2/v2.0/token`,
      new URLSearchParams(formData),
      config
    );

    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft groups access token:', error);
    throw error;
  }
}
export async function getMicrosoftGroupsDelegatedAccessToken(member_id: string, prisma: PrismaClient) {
  try {
    const t = await prisma.memberMicrosoftToken.findUnique({
      where: {
        client_id_member_id: {
          client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION as string,
          member_id: member_id
        }
      },
      select: { refresh_token: true }
    });
    if (!t) throw new Error('No token found');

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const inputdata = qs.stringify({
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
      scope: 'offline_access Group.ReadWrite.All',
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
      client_secret: process.env.MSAL_SECRET_GROUPS_PERMISSION + ''
    });

    const r22 = await axios.post(tokenUrl, inputdata, config);

    return r22.data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft groups delegated access token:', error);
    throw error;
  }
}
export async function getMicrosoftUsersAccessToken(microsoft_tenantId: string | null) {
  try {
    const formData = {
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION as string,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: process.env.MSAL_SECRET_USERS_PERMISSION as string,
      grant_type: 'client_credentials'
    };

    const config = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };

    const response = await axios.post(
      `https://login.microsoftonline.com/${microsoft_tenantId}/oauth2/v2.0/token`,
      new URLSearchParams(formData),
      config
    );

    const data = response.data;
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving Microsoft users access token:', error);
    throw error;
  }
}
