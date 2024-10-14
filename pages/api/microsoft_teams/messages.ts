// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { notificationApp } from '~/utils/microsoft_teams/initialize';
import { ResponseWrapper } from '~/utils/microsoft_teams/responseWrapper';
import { TeamsBot } from '~/utils/microsoft_teams/teamsBot';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const _res = new ResponseWrapper(res);
  const teamsBot = new TeamsBot();
  await notificationApp.requestHandler(_req, _res, async (context) => {
    await teamsBot.run(context);
  });
  res.status(200).json(_res.body);
}
