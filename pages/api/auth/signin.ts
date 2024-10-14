import * as msal from '@azure/msal-node';
import { createName } from '~/utils/createName';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import * as Sentry from '@sentry/nextjs';
import { decode } from 'jsonwebtoken';
import { prisma } from '~/server/db';
import axios from 'axios';
import { addMinutes } from 'date-fns';
import { getFingerprint } from '~/server/api/trpc';
import { NextApiRequest, NextApiResponse } from 'next';
import { inngest } from '~/inngest/inngest_client';
import { getIronSession } from 'iron-session';
declare module 'iron-session' {
  interface IronSessionData {
    user?: {
      id: string;
      email: string;
      microsoft_user_id: string;
      microsoft_tenant_id: string;
      name: string;
      member_id: string | null;
      orgName: string | null;
      language: string;
      impersonate: boolean;
    };
  }
}
export default async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  //if user delete account but still logged in in teams the session is not deleted
  if (session.user && session.user.member_id) {
    const m = await prisma.member.findUnique({
      where: { id: session.user.member_id },
      select: {
        id: true
      }
    });
    if (!m) {
      session.destroy();
      res.redirect('/login?nosso=true');
      return;
    }
  }

  if (session.user?.id) {
    if (req.query.redirect_after_login) {
      res.redirect(req.query.redirect_after_login + '');
      return;
    }
    res.redirect('/');
    return;
  }

  if (req.query.error_description) {
    let errorDescription = req.query.error_description;
    if (Array.isArray(errorDescription)) {
      errorDescription = errorDescription.join(',');
    }
    res.redirect('/login?nosso=true&error=' + encodeURIComponent(errorDescription));
    return;
  }

  if (req.query.error) {
    let error = req.query.error;
    if (Array.isArray(error)) {
      error = error.join(',');
    }
    res.redirect('/login?nosso=true&error=' + encodeURIComponent(error));
    return;
  }

  const msalClient = new msal.ConfidentialClientApplication({
    auth: {
      clientId: process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
      clientSecret: process.env.MSAL_SECRET + ''
    }
  });
  let accessToken = null;
  let result = null;
  if (req.query.ssotoken) {
    console.log('get sso token');
    try {
      const t = <any>decode(req.query.ssotoken + '');
      result = await msalClient.acquireTokenOnBehalfOf({
        authority: `https://login.microsoftonline.com/${t.tid}`,
        oboAssertion: req.query.ssotoken + '',
        scopes: ['User.Read', 'offline_access'],
        skipCache: true
      });
      accessToken = result?.accessToken;
    } catch (e) {
      console.log(e);
      res.redirect('/login?nosso=true');
      return;
    }
  } else if (req.query.code) {
    try {
      var host = req.headers.host; // z.B. "localhost:3000"
      var protocol = req.headers['x-forwarded-proto'] || 'http'; // 'http' oder 'https'
      if (req.headers['x-ms-original-url']) {
        var url = new URL(req.headers['x-ms-original-url'] + '');
        protocol = url.protocol.slice(0, -1);
        host = url.host;
      }
      const serverUrl = `${protocol}://${host}`;
      const validSubdomainPattern = /^absentify-dev.*\.azurewebsites\.net$/;
      result = await msalClient.acquireTokenByCode({
        code: req.query.code + '',
        scopes: ['openid', 'email', 'profile', 'offline_access', 'User.Read'],
        redirectUri:
          host && validSubdomainPattern.test(host)
            ? 'https://app.absentify.com/api/auth/dev_signin'
            : serverUrl + (host === 'teams.absentify.com' ? '/teams/auth-end.html' : '/api/auth/signin')
      });
      accessToken = result.accessToken;
    } catch (e) {
      console.log(e);
      Sentry.captureException(e);
      res.redirect('/login?nosso=true&error=' + 'Contact your Microsoft tenant admin');
      return;
    }
  } else if (req.query.sp_token) {
    accessToken = req.query.sp_token + '';
    const t = <any>decode(req.query.sp_token + '');
    result = { uniqueId: t.oid, tenantId: t.tid };
  } else {
    res.redirect('/login?nosso=true&error=' + 'no code or sso-token');
    return;
  }
  if (!accessToken) {
    res.redirect('/login?nosso=true&error=' + 'no access token');
    return;
  }
  if (!result) {
    res.redirect('/login?nosso=true&error=' + 'no user id');
    return;
  }

  let meData = null;
  try {
    const me = await axios.get(
      `https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName,mail,givenName,surname,displayName`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (me.status == 200 && me.data) {
      meData = me.data;
    } else {
      res.redirect('/login?nosso=true&error=' + 'Can not get user data');
      return;
    }
  } catch (e) {
    res.redirect('/login?nosso=true&error=' + 'Can not get user data from graph');
    return;
  }

  const newEmail = meData.mail ? (meData.mail + '').toLocaleLowerCase() : meData.userPrincipalName.toLocaleLowerCase();
  let m = await prisma.member.findUnique({
    where: { microsoft_user_id: result.uniqueId },
    select: {
      id: true,
      email_notifications_updates: true,
      sendinblue_contact_id: true,
      has_cdn_image: true,
      displayName: true,
      microsoft_user_id: true,
      firstName: true,
      lastName: true,
      email: true,
      language: true,
      name: true,
      is_admin: true,
      workspace: { select: { global_name_format: true } }
    }
  });

  //check user is invited
  if (!m) {
    m = await prisma.member.findFirst({
      where: { AND: [{ email: newEmail }, { microsoft_user_id: null }] },
      select: {
        id: true,
        email_notifications_updates: true,
        sendinblue_contact_id: true,
        microsoft_user_id: true,
        has_cdn_image: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        language: true,
        name: true,
        is_admin: true,
        workspace: { select: { global_name_format: true } }
      }
    });
    if (m) {
      m = await prisma.member.update({
        where: { id: m.id },
        select: {
          id: true,
          email_notifications_updates: true,
          sendinblue_contact_id: true,
          microsoft_user_id: true,
          has_cdn_image: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          language: true,
          name: true,
          is_admin: true,
          workspace: { select: { global_name_format: true } }
        },
        data: {
          microsoft_user_id: result.uniqueId,
          microsoft_tenantId: result.tenantId
        }
      });

      await inngest.send({
        name: 'publicHolidayDaySync/create_sync_items_for_member',
        data: {
          member_id: m.id
        }
      });
    }
  }

  let orgName = null;
  if (!m) {
    try {
      let org = await axios.get(
        'https://graph.microsoft.com/v1.0/organization?$select=displayName',

        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      if (org.status == 200 && org.data.value && org.data.value.length > 0) {
        orgName = org.data.value[0].displayName;
      }
    } catch (e: any) {
      console.log('error: fetch organisation via graph' + e.response?.status);
    }
  }
  const newName = createName(
    m?.workspace.global_name_format ?? 'First',
    meData.givenName,
    meData.surname,
    meData.displayName,
    newEmail
  );

  if (m) {
    const now = new Date();
    await inngest.send({
      // The event name, run event only once per hour
      id:
        'update.member.profile' + result.uniqueId + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes(),
      name: 'member/update.member.profile',
      // The event's data
      data: {
        microsoft_user_id: result.uniqueId,
        microsoft_tenant_id: result.tenantId,
        token: accessToken
      }
    });
  }
  session.user = {
    id: result.uniqueId,
    email: newEmail,
    microsoft_user_id: result.uniqueId,
    microsoft_tenant_id: result.tenantId,
    name: newName,
    member_id: m?.id ?? null,
    orgName: orgName,
    language: m?.language ?? 'en',
    impersonate: false
  };
  await session.save();

  if (session.user.member_id == null) {
    res.redirect('/signup');
    return;
  }
  if (session.user.member_id != null) {
    await createSignInLog(req, session.user.member_id);
  }
  if (req.query.redirect_after_login) {
    res.redirect(req.query.redirect_after_login + '');
    return;
  }
  res.redirect('/');
}
async function createSignInLog(req: NextApiRequest, member_id: string) {
  try {
    let ip = getFingerprint(req);
    if (ip == '127.0.0.1') ip = '2a03:80:140:e400:81b:5f6a:fedc:5480';
    if (ip == '::1') ip = '2a03:80:140:e401:b9d4:af4b:216f:60ee';
    let ipData: { country_name: string; city: string } | null = null;
    try {
      const i = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=407d89a261f042fb9e5f87b58220a212&ip=${ip}`);
      if (i.status == 200) {
        ipData = { ...i.data };
      }
    } catch (_e: any) {
      console.log('error:', _e.message);
    }
    var host = req.headers.host; // z.B. "localhost:3000"
    if (req.headers['x-ms-original-url']) {
      var url = new URL(req.headers['x-ms-original-url'] + '');
      host = url.host;
    }
    const time = new Date();
    const time_of_creation = addMinutes(time, time.getTimezoneOffset() * -1);
    const userAgent = req.headers['user-agent'];
    const app = host === 'teams.absentify.com' ? 'Teams' : 'Web';
    const device =
      userAgent && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
        ? 'Mobile'
        : 'Browser';
    if (typeof app === 'string' && typeof device === 'string') {
      await prisma.signInLog.create({
        data: {
          time_of_creation,
          app,
          device,
          ip,
          location: ipData?.country_name && ipData?.city ? `${ipData?.country_name} - ${ipData?.city}` : null,
          member_id: member_id
        }
      });
    }
  } catch (e) {
    Sentry.captureException(e);
  }
}
