import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const validSubdomainPattern = /^absentify-dev.*\.azurewebsites\.net$/;
  const requestUrl = req.query.state + '';

  try {
    const url = new URL(requestUrl);

    if (!validSubdomainPattern.test(url.hostname)) {
      res.status(401).json({ error: 'Wrong domain' });
      return;
    }

    res.redirect(`${req.query.state}?code=${req.query.code}`);
  } catch (error) {
    res.status(400).json({ error: 'Invalid URL' });
  }
}