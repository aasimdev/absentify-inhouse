import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { slugify } from 'inngest';
import { sendMail } from '~/lib/sendInBlueContactApi';

export const onBoardingEmails = inngest.createFunction(
  { id: slugify('Send first onboarding emails'), name: 'email_onboarding/user_signup' },
  { event: 'email_onboarding/user_signup' },
  async ({ event, step, logger }) => {
    await step.sleep('send-welcome-email', '20 mins');

    await step.run('send-welcome-email', async () => {
      const member = await prisma.member.findUnique({
        where: { id: event.data.member_id },
        select: {
          language: true,
          email: true,
          firstName: true,
          name: true,
          displayName: true,
          email_notifications_updates: true,
          workspace_id: true,
          workspace: { select: { name: true } }
        }
      });
      if (!member) {
        logger.info('member does not exist anymore');
        return;
      }
      if (!member.email) {
        logger.info('member has no email');
        return;
      }
      if (!member.email_notifications_updates) {
        logger.info('member has no email_notifications_updates set');
        return;
      }
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language, 'mails');

      let name = member.firstName || member.displayName || member.name || '';
      if (name != '') name = ' ' + name;

      await sendMail({
        prisma,
        workspace_id: member.workspace_id,
        recipients: {
          to: [
            {
              address: member.email,
              displayName: member.name ?? ''
            }
          ]
        },
        replyTo: [{ address: 'kelly@support-mail.absentify.com', displayName: 'Kelly from absentify' }],
        subject: t('onboardingmail_1_subject')
          .replaceAll('[Username]', name)
          .replaceAll('[CompanyName]', member.workspace.name),
        html: t('onboardingmail_1').replaceAll('[Username]', name).replaceAll('[CompanyName]', member.workspace.name)
      });
    });

    await step.sleep('send-2-welcome-email', '3d');

    await step.run('send-2-welcome-email', async () => {
      const member = await prisma.member.findUnique({
        where: { id: event.data.member_id },
        select: {
          language: true,
          email: true,
          firstName: true,
          name: true,
          displayName: true,
          email_notifications_updates: true,
          workspace_id: true,
          workspace: { select: { name: true } }
        }
      });
      if (!member) {
        logger.info('member does not exist anymore');
        return;
      }
      if (!member.email) {
        logger.info('member has no email');
        return;
      }
      if (!member.email_notifications_updates) {
        logger.info('member has no email_notifications_updates set');
        return;
      }
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language, 'mails');

      let name = member.firstName || member.displayName || member.name || '';
      if (name != '') name = ' ' + name;
      await sendMail({
        prisma,
        workspace_id: member.workspace_id,
        recipients: {
          to: [
            {
              address: member.email,
              displayName: member.name ?? ''
            }
          ]
        },
        replyTo: [{ address: 'kelly@support-mail.absentify.com', displayName: 'Kelly from absentify' }],
        subject: t('onboardingmail_2_subject')
          .replaceAll('[Username]', name)
          .replaceAll('[CompanyName]', member.workspace.name),
        html: t('onboardingmail_2').replaceAll('[Username]', name).replaceAll('[CompanyName]', member.workspace.name)
      });
    });

    await step.sleep('send-3-welcome-email', '4d');

    await step.run('send-3-welcome-email', async () => {
      const member = await prisma.member.findUnique({
        where: { id: event.data.member_id },
        select: {
          language: true,
          email: true,
          firstName: true,
          name: true,
          displayName: true,
          email_notifications_updates: true,
          workspace_id: true,
          workspace: { select: { name: true } }
        }
      });
      if (!member) {
        logger.info('member does not exist anymore');
        return;
      }
      if (!member.email) {
        logger.info('member has no email');
        return;
      }
      if (!member.email_notifications_updates) {
        logger.info('member has no email_notifications_updates set');
        return;
      }
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(member.language, 'mails');

      let name = member.firstName || member.displayName || member.name || '';
      if (name != '') name = ' ' + name;

      await sendMail({
        prisma, 
        workspace_id: member.workspace_id,
        recipients: {
          to: [
            {
              address: member.email,
              displayName: member.name ?? ''
            }
          ]
        },
        replyTo: [{ address: 'kelly@support-mail.absentify.com', displayName: 'Kelly from absentify' }],
        subject: t('onboardingmail_3_subject')
          .replaceAll('[Username]', name)
          .replaceAll('[CompanyName]', member.workspace.name),
        html: t('onboardingmail_3').replaceAll('[Username]', name).replaceAll('[CompanyName]', member.workspace.name)
      });
    });
  }
);
