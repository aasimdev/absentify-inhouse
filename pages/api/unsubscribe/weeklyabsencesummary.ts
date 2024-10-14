// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getIronSession } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { prisma } from '~/server/db';
import { getIronSessionConfig, SessionData } from '~/utils/ironSessionConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));
  const getT = ensureAvailabilityOfGetT();
  const language = session?.user?.language || req.query.language || 'en';
  const t = await getT(language + "", 'backend');

  if (!session?.user || !session.user.member_id) {
    const loginHtmlResponse = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('Login_Required')}</title>
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              a { color: #0070f3; text-decoration: none; }
          </style>
      </head>
      <body>
          <h1>${t('You_need_to_login')}</h1>
          <p>${t('Please_login_to_continue')}.</p>
          <a href="https://app.absentify.com">${t('Login_here')}</a>
          <p>${t('After_login_try_again')}</p>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(loginHtmlResponse);
  }

  // If logged in, proceed to unsubscribe
  await prisma.member.update({
    where: { id: session.user.member_id },
    data: {
      email_notif_weekly_absence_summary: false
    },
    select: {
      email_notif_weekly_absence_summary: true,
      language: true
    }
  });

  const htmlResponse = `
    <!DOCTYPE html>
    <html lang="${session.user.language}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('Unsubscribe_Confirmation')}</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        </style>
    </head>
    <body>
        <h1>${t('Successfully_unsubscribed_from_weekly_absence_summary_close_this_window')}</h1>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(htmlResponse);
}
