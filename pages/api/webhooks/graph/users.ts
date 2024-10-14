// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { inngest } from '~/inngest/inngest_client';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let validationToken = req.query['validationToken'];

  // If a validation token is present, we need to respond within 5 seconds by
  // returning the given validation token. This only happens when a new
  // webhook is being added
  if (validationToken) {
    res.status(200).send(validationToken);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  /*   let data: {
    value: [
      {
        changeType: 'string';
        clientState: 'SecretClientState';
        resource: 'Users/07307fa0-e41c-46ad-9609-dfd2320a1ab4';
        resourceData: [Object];
        subscriptionExpirationDateTime: '2023-10-08T10:25:23.297-07:00';
        subscriptionId: '455f6ce2-1b58-407d-88bb-987b9205c9ad';
        tenantId: '43b518ca-563a-4dbb-a9c9-250802ea8563';
      }
    ];
  }; */

  for (let index = 0; index < req.body.value.length; index++) {
    try {
      const ressource = req.body.value[index];
      const now = new Date();
      await inngest.send({
        // The event name, run event only once per hour
        id: 'update.member.profile-' + ressource.resourceData.id + '-' + now.getDate(),
        name: 'member/update.member.profile',
        // The event's data
        data: {
          microsoft_user_id: ressource.resourceData.id,
          microsoft_tenant_id: ressource.tenantId,
          token: null
        }
      });

      //check user exists in db
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'An error occurred while updating the user profile.' });
      return;
    }
  }

  res.status(200).json({ ok: 'ok' });
}
