import { getIronSession } from 'iron-session';
import { sign } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));
  const redirectUrl = req.query.redirect;

  if (!session.user?.member_id) {
    res.redirect('https://app.absentify.com');
    return;
  }
  let member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: { name: true }
  });

  if (!member) {
    res.redirect('https://app.absentify.com');
    return;
  }

  const FrillSSOKey = `${process.env.FILL_SSO_KEY}`;
  const userData = {
    email: session.user.email,
    id: session.user.id,
    name: member.name
  };
  const frillUserToken = sign(userData, FrillSSOKey, { algorithm: 'HS256' });
  res.redirect(`${redirectUrl}?ssoToken=${frillUserToken}`);
}
