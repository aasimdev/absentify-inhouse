// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import NextCors from 'nextjs-cors';
import axios from 'axios';
import { prisma } from '~/server/db';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  await NextCors(req, res, {
    // Options
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  /*  if (_req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

    const session = await getIronSession<SessionData>(req, res, getIronSessionConfig({ _req }));;
  if (!session.user) return res.status(401).json({ message: 'Unauthorized' });
  console.log(session.user.id); */

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Authorization header is missing');
  }

  const token = authHeader.split(' ')[1]; // Bearer [token]

  if (!token) {
    return res.status(401).send('Bearer token not found');
  }
  /* const code ="0.AXMAyhi1QzpWu02pySUIAuqFY78qzk2OP4FCn3rWAvw5GIZzABk.AgABAAIAAAAmoFfGtYxvRrNriQdPKIZ-AgDs_wUA9P85C1Fvd-Tl7X5HJmc_4xaHY_UwGDi9mn7meZF7Dh9S104mtEMWQ9suBAgqrVF8ES0XbkLJWiVtQ0MfAN2n3HoJ8kY43pHULwQeeSni4mvBfoOeBLXBQmgR1hXjkrOh170lwMqJbT0zf-qNS3KLUk8hTnnoSMbU9WHWac3LkL1lU2MrjeuGGCNF9at-jDVaBNBrdfSKjSzHOHAX8vnul6HdwbqQijJrcDGpw4sqqgLNiTymID1MHWyfBgtPR_FVVuUhmjQwKmPItooOct79zryG_UbzcZUAlG47iXpEnyU8I6dqXSVj43X7MHyIsgs4LH1mujH5zn_8DphO3IyaGDohvdjGL1vmG1jhrnvIVu3wkmXEEryrM1cQAD3D6dsXwzlW37Qa4lhZqxyDerqE8OXnux8W3q3v0hkc5ijbwg9_sutr3M9YFbYskFOEDvuOQxJ_M0QrUi4884m_-B65TLcL5fggvqVORgj5VKttEIlgayz20MBLV_IT9198_c3Ulurw9hNDHvLsZJYWNgkdG7zlSQOo1HKnSK5sPQPJvptAjH0ap6OjXPSwbCfg8TkGNSCl6gSGAwILS0Q3AUxP8K05uaCSiOxbEffL033he7WHPRUBw2_XROGza_4ArERy_ELUroMKwnPBIRdSmjnQ3Z2xLP1alCm55RWRHzPbtsmM8TQxSb4bVnPgCNd2DGadco-wIZSh6FBI1a8ohIG7OhgLfJUfaPj9dz9lQ9jz3aNV-PF3wWHEtEq9fg"
      const msalClient = new msal.ConfidentialClientApplication({
    auth: {
      clientId: process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
      clientSecret: process.env.MSAL_SECRET + ''
    }
  });
  const result = await msalClient.acquireTokenByCode({
    code: code,
    scopes: ['api://teams.absentify.com/4dce2abf-3f8e-4281-9f7a-d602fc391886/user_impersonation'],
    redirectUri: 'http://localhost:3000/teams/auth-end.html'
  }); */

  //const token = result.accessToken;
  // console.log('token', token);

  //const token =
  // 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjlHbW55RlBraGMzaE91UjIybXZTdmduTG83WSJ9.eyJhdWQiOiI0ZGNlMmFiZi0zZjhlLTQyODEtOWY3YS1kNjAyZmMzOTE4ODYiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNDNiNTE4Y2EtNTYzYS00ZGJiLWE5YzktMjUwODAyZWE4NTYzL3YyLjAiLCJpYXQiOjE3MDA0MDA2MTEsIm5iZiI6MTcwMDQwMDYxMSwiZXhwIjoxNzAwNDA1NDU3LCJhaW8iOiJBWFFBaS84VkFBQUFEelQwdytzd1NJK3JjQkdUZC9kMjFzUlFuNVNvUUtLVXhsbGp0VjJDd1BuamZLVjF4dG5paTZXZXZWL3M3bC8zOWVjWkpZNktwWEpNQllyZ0lOd0M4RXZaOG43VjAycFE1QVdiOGtFcjJZUlV3Y1ROSk44T2lTcGdWc1VyeFpnZDBHYmJCVHhCMTFzZDJkZXFpNThwUHc9PSIsImF6cCI6IjRkY2UyYWJmLTNmOGUtNDI4MS05ZjdhLWQ2MDJmYzM5MTg4NiIsImF6cGFjciI6IjEiLCJuYW1lIjoiTWFyYyBIb2NobGV1dG5lciIsIm9pZCI6IjU2YTFiY2U1LWY3YjktNDU0ZC05MzNhLTBmM2ZhMDVkYzA2MSIsInByZWZlcnJlZF91c2VybmFtZSI6Im1hcmNAYWJzZW50aWZ5LmNvbSIsInJoIjoiMC5BWE1BeWhpMVF6cFd1MDJweVNVSUF1cUZZNzhxemsyT1A0RkNuM3JXQXZ3NUdJWnpBQmsuIiwic2NwIjoidXNlcl9pbXBlcnNvbmF0aW9uIiwic3ViIjoiemhPbXZYMEhkbmhhR01CNG1zMEszWnhjc3lfNVNjX0RZc1R6TEJ4Qmk3QSIsInRpZCI6IjQzYjUxOGNhLTU2M2EtNGRiYi1hOWM5LTI1MDgwMmVhODU2MyIsInV0aSI6IlBpenF3SDQwV0V1cGpVcEZTdnVXQUEiLCJ2ZXIiOiIyLjAifQ.I6EyzfSSKJnVpsrjtVJUFDmRArftvydhCqlr_gv9a4ySlx4_CiKl8fCjAbdd5Uchv--kDkNAkGoEhu_xiQbO8aBzD7nvt3ecvv7ZVziClZ_HC4yorab42XPaByOQyT4__IwMCchEbHm1CLkICb371fWE_7MJ25XpWHg9WvS_Olws6tbKqwgZIjJc6chi_z_vVkhAFm51cddi7M_DDnvZOnbTXxXYNEP5X2LQc7nSA9GhGaJhmdJkTBMOc_KwRWg2cDPiucbrqsAnY8swLJZ52hU1LiN379NliNBI71kN9aBJQ8WsLPLJ_6l4Y8gJCTs9V6aZzsnr3PlK-BnvtQ4ylQ';
  //const t = <any>decode(token);

  let meData = null;
  try {
    const me = await axios.get(
      `https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName,mail,givenName,surname,displayName`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (me.status == 200 && me.data) {
      meData = me.data;

      const member = await prisma.member.findUnique({
        where: { microsoft_user_id: meData.id },
        select: {
          id: true,
          language: true,
          departments: { select: { department: { select: { id: true, name: true } } } }
        }
      });

      if (!member) return res.status(401).send('No user found');
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language ?? 'en', 'backend');
      let departments = [
        { id: '1', name: t('All_departments') },
        { id: '2', name: t('absentToday') }
      ];
      for (let index = 0; index < member.departments.length; index++) {
        const element = member.departments[index];
        if (!element) continue;
        departments.push({ id: element.department.id, name: element.department.name });
      }

      return res.status(200).json(departments);
    } else {
      return res.status(401).send('Bearer token not valid 2');
    }
  } catch (e) {
    return res.status(401).send('Bearer token not valid');
  }
}
