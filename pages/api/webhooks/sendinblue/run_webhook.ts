// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '~/server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
 // console.log(req.body);

  if (!req.body.email) {
    res.status(200).json({ success: 'ok' });
    return;
  }
  if (!req.body.content) {
    res.status(200).json({ success: 'ok' });
    return;
  }
  if (!req.body.content[0]) {
    res.status(200).json({ success: 'ok' });
    return;
  }
  await prisma.member.updateMany({
    where: { email: req.body.email },
    data: { email_notifications_updates: !req.body.content[0].emailBlacklist }
  });

  res.status(200).json({ success: 'ok' });
}
