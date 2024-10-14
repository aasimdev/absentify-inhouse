// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getIronSession } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import { paddle_config, paddle_v2_price_ids } from '~/helper/paddle_config';

export default async function handler(_req: NextApiRequest, res: NextApiResponse<any>) {
  if (_req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await getIronSession<SessionData>(_req, res, getIronSessionConfig(_req));
  if (!session.user) return res.status(401).json({ message: 'Unauthorized' });

  if (!session.user.member_id) return res.status(401).json({ message: 'Unauthorized' });

  /*   if (process.env.NEXT_PUBLIC_RUNMODE !== 'Preview' && process.env.NEXT_PUBLIC_RUNMODE !== 'Development') {
    return res.status(401).json({ message: 'Unauthorized' });
  } */

  const member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: { is_admin: true, workspace_id: true }
  });

  if (!member) return res.status(401).json({ message: 'Unauthorized' });

  const subscription = await prisma.subscription.count({ where: { workspace_id: member.workspace_id } });

  if (subscription > 0) return res.status(401).json({ message: 'You have already valid subscription' });

  const { type } = _req.query;

  await prisma.subscription.create({
    data: {
      workspace_id: member.workspace_id,
      status: 'active',
      provider: 'absentify',
      quantity: 1,
      subscription_plan_id:
        type == 'enterprise'
          ? paddle_config.products.ENTERPRISE.monthly_plan_id_v2
          : type == 'smallteam'
          ? paddle_config.products.SMALLTEAM.monthly_plan_id_v2
          : paddle_config.products.BUSINESS.monthly_plan_id_v2,
      price_id:
        type == 'enterprise'
          ? paddle_v2_price_ids.ENTERPRISE.monthly_price_id
          : type == 'smallteam'
          ? paddle_v2_price_ids.SMALL_TEAM.monthly_price_id
          : paddle_v2_price_ids.BUSINESS.monthly_price_id_v1,
      subscription_id: '',
      customer_user_id: ''
    }
  });

  res.status(200).json('Done');
}
