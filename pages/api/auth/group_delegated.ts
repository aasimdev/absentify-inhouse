import { getIronSession } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import qs from 'qs';
import axios from 'axios';
import { inngest } from '~/inngest/inngest_client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  if (!session.user?.member_id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  let member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: { name: true }
  });

  if (!member) {
    res.status(500).json({ error: 'No member' });
    return;
  }
  if (!req.query.code) {
    res.status(400).json({ error: 'No code' });
    return;
  }

  try {
    const host = req.headers.host; // z.B. "localhost:3000"
    const protocol = req.headers['x-forwarded-proto'] || 'http'; // 'http' oder 'https'
    const serverUrl = `${protocol}://${host}`;
    let redirect_uri = serverUrl + '/api/auth/group_delegated';

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    let data = qs.stringify({
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
      scope: 'offline_access Group.ReadWrite.All',
      code: req.query.code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code',
      client_secret: process.env.MSAL_SECRET_GROUPS_PERMISSION + ''
    });

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const r = await axios.post(tokenUrl, data, config);
    data = qs.stringify({
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
      scope: 'offline_access Group.ReadWrite.All',
      refresh_token: r.data.refresh_token,
      grant_type: 'refresh_token',
      client_secret: process.env.MSAL_SECRET_GROUPS_PERMISSION + ''
    });

    const r22 = await axios.post(tokenUrl, data, config);
    await prisma.memberMicrosoftToken.upsert({
      where: {
        client_id_member_id: {
          client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
          member_id: session.user.member_id
        }
      },
      create: {
        refresh_token: r22.data.refresh_token,
        member_id: session.user.member_id,
        scope: r22.data.scope,
        client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + ''
      },
      update: {
        refresh_token: r22.data.refresh_token,
        scope: r22.data.scope
      }
    });

    await inngest.send({
      id: 'member/keep.token.alive',
      name: 'member/keep.token.alive',
      data: {
        member_id: session.user.member_id
      }
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: 'Fatal error' });
    return;
  }
  res.send('You have been successfully authenticated, you can close this window now.');
}
