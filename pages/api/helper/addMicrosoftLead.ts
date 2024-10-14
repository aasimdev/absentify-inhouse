// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '~/server/db';

export interface UserDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  company: string;
}

export interface RootObject {
  userDetails: UserDetails;
  leadSource: string;
  actionCode: string;
  offerTitle: string;
  description: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const data: RootObject = req.body;
    
  if (!data || !data.userDetails) {
    res.status(400).json({ error: 'Bad Request'})
    return;
  }

  await prisma.microsoftLeads.create({
    data: {
      actionCode: data.actionCode,
      offerTitle: data.offerTitle,
      description: data.description,
      firstName: data.userDetails.firstName,
      lastName: data.userDetails.lastName,
      email: data.userDetails.email,
      phone: data.userDetails.phone,
      country: data.userDetails.country,
      company: data.userDetails.company,
      leadSource: data.leadSource,
    },
  });
  res.status(200).json({ status: 'ok' });
};
