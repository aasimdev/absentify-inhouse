// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { decode } from 'jsonwebtoken';
import { ensureAvailabilityOfGetT } from 'lib/monkey-patches';
import { hasBusinessSubscription, hasBusinessV1Subscription, hasEnterpriseSubscription } from 'lib/subscriptionHelper';
import type { NextApiRequest, NextApiResponse } from 'next';
import { defaultWorkspaceSelect } from 'server/api/routers/workspace';

import { prisma } from '~/server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  console.log(req.body);
  console.log(req.body.url);
  console.log(req.method);
  if (req.query.event_type) console.log(req.query.event_type[0]);
  console.log(req.headers.authorization);

  if (
    req.query.event_type &&
    req.method == 'DELETE' &&
    req.query.event_type[0] != 'request_status_changed' &&
    req.query.event_type[0] != 'request_created'
  ) {
    await prisma.webhookSetting.delete({
      where: {
        id: `${req.query.event_type[0]}`
      }
    });
    res.status(200).json({ ok: 'ok' });
    return;
  }

  if (!req.headers.authorization) {
    res.status(401).json({});
    return;
  }
  if (
    !(
      (req.query.event_type && req.query.event_type[0] == 'request_status_changed') ||
      (req.query.event_type && req.query.event_type[0] == 'request_created')
    )
  ) {
    res.status(500).json({});
    return;
  }

  const token = `${req.headers.authorization}`.split(' ')[1];
  if (token) {
    const t = <any>decode(token);
    console.log(t);

    const member = await prisma.member.findFirst({
      where: {
        OR: [{ microsoft_user_id: t.oid }, { email: t.preferred_username }]
      },
      select: {
        id: true,
        email: true,
        name: true,
        date_format: true,
        time_format: true,
        week_start: true,
        timezone: true,
        language: true,
        email_notifications_updates: true,
        sendinblue_contact_id: true,
        microsoft_tenantId: true,
        microsoft_user_id: true,
        workspace_id: true
      }
    });

    if (!member) {
      res.status(401).json({});
      return;
    }

    const [workspace, existingWebhookSettings] = await prisma.$transaction([
      prisma.workspace.findUnique({
        where: { id: member.workspace_id },
        select: defaultWorkspaceSelect
      }),
      prisma.webhookSetting.findMany({
        where: { workspace_id: member.workspace_id },
        select: { id: true }
      })
    ]);
    if (!workspace) {
      res.status(401).json({ error: 'You have to be admin to add department' });
      return;
    }

    const hasEnterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);

    const hasBusinessV1Plan = hasBusinessV1Subscription(workspace.subscriptions);
    const hasBusinessPlan = hasBusinessSubscription(workspace.subscriptions);

    if (!hasEnterprisePlan && !hasBusinessV1Plan && !hasBusinessPlan) {
      res.status(401).json({
        error: 'You need to have a higher plan to add a webhook.'
      });
      return;
    }

    if (hasBusinessV1Plan && existingWebhookSettings.length >= 3) {
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language, 'backend');
      res.status(401).json({ error: t('PowerAutomateTrigger_max_reached') });
      return;
    }

    if (hasBusinessPlan && existingWebhookSettings.length >= 3) {
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language, 'backend');
      res.status(401).json({ error: t('PowerAutomateTrigger_max_reached') });
      return;
    }

    const newWebhookSetting = await prisma.webhookSetting.create({
      data: {
        url: req.body.url,
        workspace_id: member.workspace_id,
        source: 'MicrosoftPowerAutomate',
        event: req.query.event_type[0]
      },
      select: { id: true }
    });

    const deleteUrl = `https://app.absentify.com/api/webhooks/manage_ms_webhook/${newWebhookSetting.id}`;
    res.setHeader('Location', deleteUrl);
    res.status(201).json({ url: deleteUrl });
  }
}
