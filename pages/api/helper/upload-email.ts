import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import * as xlsx from 'xlsx';
import { promises as fs } from 'fs';
import { prisma } from '~/server/db';
import { getIronSession } from 'iron-session';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';

export const config = {
  api: {
    bodyParser: false // Disable built-in bodyParser to handle file upload
  }
};

const readFile = (req: NextApiRequest): Promise<File> => {
  const form = new IncomingForm();
  return new Promise((resolve, reject) => {
    form.parse(req, (_err, _fields, files) => {
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) reject(new Error('Keine Datei hochgeladen'));
      resolve(file as File);
    });
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));
  if (!session.user || !session.user.member_id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (session.user.microsoft_user_id !== 'f4058fbc-db7f-4572-962b-f6192f0e0b6a') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const file = await readFile(req);
    const data = await fs.readFile(file.filepath);

    // Parse the Excel file
    const workbook = xlsx.read(data, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Keine Arbeitsblätter in der Excel-Datei gefunden');
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) throw new Error('Arbeitsblatt nicht gefunden');
    const rows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let updatedCount = 0;
    const notFoundEmails: string[] = [];

    // Process the rows (skipping the header row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && Array.isArray(row) && row.length >= 2 && row[0] && row[1]) {
        const oldEmail = row[0] as string;
        const newEmail = row[1] as string;

        // Update the emails in the database
        const result = await prisma.member.updateMany({
          where: { email: oldEmail },
          data: {
            email: newEmail,
            microsoft_user_id: null,
            microsoft_tenantId: null
          }
        });

        if (result.count > 0) {
          updatedCount += result.count;
        } else {
          notFoundEmails.push(oldEmail);
        }
      }
    }

    const totalProcessed = rows.length - 1; // Subtract 1 for the header row
    const allFound = notFoundEmails.length === 0;

    res.status(200).json({
      message: `Emails updated successfully!`,
      totalProcessed,
      updatedCount,
      notFoundEmails,
      allFound
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred.' });
  }
}
