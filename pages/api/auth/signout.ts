import { getIronSession } from 'iron-session';
import { NextApiRequest, NextApiResponse } from 'next';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';

export default async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));
  session.destroy();
  res.redirect('/login?nosso=true');
}
