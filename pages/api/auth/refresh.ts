import { getIronSession } from 'iron-session';
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
export default async function refreshRoute(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  if (session.user?.microsoft_user_id) {
    const m = await prisma.member.findUnique({
      where: { microsoft_user_id: session.user.microsoft_user_id },
      select: { id: true, language: true }
    });
    //req.session.destroy();
    if (m && session.user) {
      session.user = {
        id: session.user.id,
        email: session.user.email,
        microsoft_user_id: session.user.microsoft_user_id,
        microsoft_tenant_id: session.user.microsoft_tenant_id,
        name: session.user.name,
        member_id: m.id,
        orgName: session.user.orgName,
        language: m.language,
        impersonate: session.user.impersonate
      };
      await session.save();
    }
  }

  res.redirect('/');
}
