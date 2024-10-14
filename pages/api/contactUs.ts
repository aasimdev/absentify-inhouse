import type { NextApiRequest, NextApiResponse } from 'next';
import { EmailClient } from '@azure/communication-email';
import { sendMail } from '~/lib/sendInBlueContactApi';
import { prisma } from '~/server/db';

type Data = {
  ok: string;
};
interface Values {
  email: string;
  name: string;
  size: string;
  projectDescription: string;
  website: string;
  workspace_id: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data | { error: string }>) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const data: Values = req.body;
    await sendMail({
      prisma: prisma,
      workspace_id: data?.workspace_id,
      subject: `Neuer Interessent`,
      html: `<b>Folgende Daten im Formular angegeben :</b><br><br>
       Name:${data?.name}<br>
       E-Mail: ${data?.email}<br>
       Unternehmensgröße: ${data?.size} Mitarbeiter<br>
       Unternehmenswebsite: ${data?.website}<br>
       Informationen zum Projekt: ${data?.projectDescription}
       `,
      recipients: {
        to: [
          {
            address: 'support@absentify.com',
            displayName: 'absentify Support'
          }
        ]
      }
    });
  } catch (e) {}
  res.status(200).json({ ok: 'ok' });
}
