import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { createPicture, defaultMemberSelect } from '~/server/api/routers/member';
import { defaultWorkspaceSelect } from '~/server/api/routers/workspace';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { sendUniversalTransactionalMail } from '~/lib/sendInBlueContactApi';
import { mainLink } from '~/helper/mainLink';
import { slugify } from 'inngest';
import { addDays } from 'date-fns';

export const deleteOldMailHistoryLogs = inngest.createFunction(
  {
    id: slugify("Delete Old Mail History Logs"),
    name: "Delete Old Mail History Logs"
  },
  { cron: '0 22 * * *' },
  async () => {
    await prisma.emailHistory.deleteMany({
      where: {
        sentAt: { lte: addDays(new Date(), -90) }
      }
    });

    return { success: true };
  }
);


export const sendEmailToAdminAboutInactiveMemberAccess = inngest.createFunction(
  {
    id: slugify('Notification: Inactive member tried to access absentify'),
    name: 'email/inactive_member.tried_to_access_absentify'
  },
  { event: 'email/inactive_member.tried_to_access_absentify' },
  async ({ event, step }) => {
    const data = event.data;
    await step.run('send email', async () => {
      const [inactive_member, workspace, admin_members] = await prisma.$transaction([
        prisma.member.findUnique({ where: { id: data.inactive_member_id }, select: defaultMemberSelect }),
        prisma.workspace.findUnique({ where: { id: data.workspace_id }, select: defaultWorkspaceSelect }),
        prisma.member.findMany({
          select: { id: true, email: true, language: true, name: true },
          where: {
            workspace_id: data.workspace_id,
            is_admin: true,
            microsoft_user_id: { not: null }
          }
        })
      ]);

      if (!inactive_member || !inactive_member.email) throw new Error('member not found');
      if (!workspace) throw new Error('workspace not found');
      for (let index = 0; index < admin_members.length; index++) {
        const admin_user = admin_members[index];

        if (admin_user && admin_user.email) {
          const getT = ensureAvailabilityOfGetT();
          const t = await getT(admin_user.language, 'mails');
          const logo = inactive_member?.workspace_id
            ? await prisma.workspace.findUnique({
                where: { id: inactive_member?.workspace_id },
                select: { company_logo_url: true, company_logo_ratio_square: true }
              })
            : null;
          const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');
          await sendUniversalTransactionalMail({
            prisma,
            workspace_id: data.workspace_id,
            subject: t('inactive_subject'),
            params: {
              h1: t('inactive_subject'),
              pageTitle: t('inactive_subject'),
              firstLine: t('firstLine_access_request', {
                administrator_full_name: admin_user.name + ''
              }),
              secondLine: t('secondLine_inactive_access_request', {
                new_user_name: inactive_member.name,
                new_user_email: inactive_member.email
              }),
              thirdLine: '',
              fourthLine: '',
              buttonText: t('button_activate_request'),
              link: `${mainLink}/settings/organisation/users?user_id=${inactive_member.id}`,
              teamsLink: null,
              teamsLinkText: null,
              approvers: null,
              company_image_url: logo?.company_logo_url ? picture : null
            },
            to: {
              email: admin_user.email.toLowerCase(),
              name: admin_user.name ?? admin_user.email.toLowerCase()
            },
            replyTo: {
              email: inactive_member.email,
              name: inactive_member.name ?? inactive_member.email
            }
          });
        }
      }
      return { message: 'ok' };
    });
  }
);

export const automaticCreationOfMember = inngest.createFunction(
  {
    id: slugify('Notification: Automatic creation of member by group synchronization'),
    name: 'email/automatic_member_creation'
  },
  { event: 'email/automatic_member_creation' },
  async ({ event, step }) => {
    const { created_member_id, workspace_id } = event.data;
    await step.run('send email', async () => {
      const [created_member, workspace, admin_members] = await prisma.$transaction([
        prisma.member.findUnique({ where: { id: created_member_id }, select: defaultMemberSelect }),
        prisma.workspace.findUnique({ where: { id: workspace_id }, select: defaultWorkspaceSelect }),
        prisma.member.findMany({
          select: { id: true, email: true, language: true, name: true },
          where: {
            workspace_id: workspace_id,
            is_admin: true,
            microsoft_user_id: { not: null }
          }
        })
      ]);

      if (!created_member || !created_member.email) throw new Error('member not found');
      if (!workspace) throw new Error('workspace not found');
      for (let index = 0; index < admin_members.length; index++) {
        const admin_user = admin_members[index];

        if (admin_user && admin_user.email) {
          const getT = ensureAvailabilityOfGetT();
          const t = await getT(admin_user.language, 'mails');
          const logo = created_member?.workspace_id
            ? await prisma.workspace.findUnique({
                where: { id: created_member?.workspace_id },
                select: { company_logo_url: true, company_logo_ratio_square: true }
              })
            : null;
          const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');
          await sendUniversalTransactionalMail({
            prisma,
            workspace_id: workspace_id,
            subject: t('automatic_create_subject'),
            params: {
              h1: t('automatic_create_subject'),
              pageTitle: t('automatic_create_subject'),
              firstLine: t('firstLine_access_request', {
                administrator_full_name: admin_user.name || admin_user.email
              }),
              secondLine: t('automatic_create_second_line', {
                employee_name: created_member.name,
                employee_email: created_member.email
              }),
              thirdLine: t('automatic_create_third_line'),
              fourthLine: '',
              buttonText: t('manage_employee'),
              link: `${mainLink}/settings/organisation/users?user_id=${created_member.id}`,
              teamsLink: null,
              teamsLinkText: null,
              approvers: null,
              company_image_url: logo?.company_logo_url ? picture : null
            },
            to: {
              email: admin_user.email.toLowerCase(),
              name: admin_user.name ?? admin_user.email.toLowerCase()
            },
            replyTo: {
              email: created_member.email,
              name: created_member.name ?? created_member.email
            }
          });
        }
      }
      return { message: 'ok' };
    });
  }
);

export const automaticArchivationOfMember = inngest.createFunction(
  {
    id: slugify('Notification: Automatic archivation of member by group synchronization'),
    name: 'email/automatic_member_archivation'
  },
  { event: 'email/automatic_member_archivation' },
  async ({ event, step }) => {
    const { archived_member_id, workspace_id } = event.data;
    await step.run('send email', async () => {
      console.log('Automatic archivation');
      const [archived_member, workspace, admin_members] = await prisma.$transaction([
        prisma.member.findUnique({ where: { id: archived_member_id }, select: defaultMemberSelect }),
        prisma.workspace.findUnique({ where: { id: workspace_id }, select: defaultWorkspaceSelect }),
        prisma.member.findMany({
          select: { id: true, email: true, language: true, name: true },
          where: {
            workspace_id: workspace_id,
            is_admin: true,
            microsoft_user_id: { not: null }
          }
        })
      ]);

      if (!archived_member || !archived_member.email) throw new Error('member not found');
      if (!workspace) throw new Error('workspace not found');
      for (let index = 0; index < admin_members.length; index++) {
        const admin_user = admin_members[index];

        if (admin_user && admin_user.email) {
          const getT = ensureAvailabilityOfGetT();
          const t = await getT(admin_user.language, 'mails');
          const logo = archived_member?.workspace_id
            ? await prisma.workspace.findUnique({
                where: { id: archived_member?.workspace_id },
                select: { company_logo_url: true, company_logo_ratio_square: true }
              })
            : null;
          const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');
          await sendUniversalTransactionalMail({
            prisma,
            workspace_id: workspace_id,
            subject: t('automatic_archivation_subject'),
            params: {
              h1: t('automatic_archivation_subject'),
              pageTitle: t('automatic_archivation_subject'),
              firstLine: t('firstLine_access_request', {
                administrator_full_name: admin_user.name || admin_user.email
              }),
              secondLine: t('automatic_archive_second_line', {
                employee_name: archived_member.name,
                employee_email: archived_member.email
              }),
              thirdLine: t('automatic_archive_third_line'),
              fourthLine: '',
              buttonText: t('manage_employee'),
              link: `${mainLink}/settings/organisation/users?user_id=${archived_member.id}`,
              teamsLink: null,
              teamsLinkText: null,
              approvers: null,
              company_image_url: logo?.company_logo_url ? picture : null
            },
            to: {
              email: admin_user.email.toLowerCase(),
              name: admin_user.name ?? admin_user.email.toLowerCase()
            },
            replyTo: {
              email: archived_member.email,
              name: archived_member.name ?? archived_member.email
            }
          });
        }
      }
      return { message: 'ok' };
    });
  }
);

export const failedArchivationOfMember = inngest.createFunction(
  {
    id: slugify('Notification: Failed automatic archivation of member by group synchronization'),
    name: 'email/failed_automatic_archivation'
  },
  { event: 'email/failed_automatic_archivation' },
  async ({ event, step }) => {
    const { failed_member_id, workspace_id, reason } = event.data;
    await step.run('send email', async () => {
      const [failed_member, workspace, admin_members] = await prisma.$transaction([
        prisma.member.findUnique({ where: { id: failed_member_id }, select: defaultMemberSelect }),
        prisma.workspace.findUnique({ where: { id: workspace_id }, select: defaultWorkspaceSelect }),
        prisma.member.findMany({
          select: { id: true, email: true, language: true, name: true },
          where: {
            workspace_id: workspace_id,
            is_admin: true,
            microsoft_user_id: { not: null }
          }
        })
      ]);

      if (!failed_member || !failed_member.email) throw new Error('member not found');
      if (!workspace) throw new Error('workspace not found');
      for (let index = 0; index < admin_members.length; index++) {
        const admin_user = admin_members[index];

        if (admin_user && admin_user.email) {
          const getT = ensureAvailabilityOfGetT();
          const t = await getT(admin_user.language, 'mails');
          const logo = failed_member?.workspace_id
            ? await prisma.workspace.findUnique({
                where: { id: failed_member?.workspace_id },
                select: { company_logo_url: true, company_logo_ratio_square: true }
              })
            : null;
          const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');
          await sendUniversalTransactionalMail({
            prisma,
            workspace_id: workspace_id,
            subject: t('failed_archivation_subjest'),
            params: {
              h1: t('failed_archivation_subjest'),
              pageTitle: t('failed_archivation_subjest'),
              firstLine: t('firstLine_access_request', {
                administrator_full_name: admin_user.name || admin_user.email
              }),
              secondLine: t('failed_archivation_second_line', {
                employee_name: failed_member.name,
                employee_email: failed_member.email
              }),
              thirdLine: t('failed_reason', {
                reason
              }),
              fourthLine: '',
              buttonText: t('manage_employee'),
              link: `${mainLink}/settings/organisation/users?user_id=${failed_member.id}`,
              teamsLink: null,
              teamsLinkText: null,
              approvers: null,
              company_image_url: logo?.company_logo_url ? picture : null
            },
            to: {
              email: admin_user.email.toLowerCase(),
              name: admin_user.name ?? admin_user.email.toLowerCase()
            },
            replyTo: {
              email: failed_member.email,
              name: failed_member.name ?? failed_member.email
            }
          });
        }
      }
      return { message: 'ok' };
    });
  }
);
