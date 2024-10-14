import { getIronSession } from 'iron-session';
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';

export default async function impersonateRoute(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  if (session.user?.microsoft_user_id !== 'f4058fbc-db7f-4572-962b-f6192f0e0b6a') {
    // let's pretend this route does not exist if user is not an admin
    return res.status(404).end();
  }

  const member = await prisma.member.findUnique({
    where: { id: req.query.memberId + '' },
    select: { id: true, microsoft_user_id: true, email: true, microsoft_tenantId: true, name: true, language: true }
  });

  if (!member) {
    res.redirect('/');
    return;
  }

  if (!member.microsoft_user_id) {
    res.redirect('/');
    return;
  }

  session.user = {
    id: member.microsoft_user_id,
    email: member.email + '',
    member_id: member.id,
    microsoft_user_id: member.microsoft_user_id,
    microsoft_tenant_id: member.microsoft_tenantId + '',
    name: member.name + '',
    orgName: '',
    language: member.language,
    impersonate: true
  };

  await session.save();
  res.redirect('/');
}
