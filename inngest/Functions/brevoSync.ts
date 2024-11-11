import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import * as Sentry from '@sentry/nextjs';
import axios from 'axios';
import {
  hasBusinessSubscription,
  hasBusinessV1Subscription,
  hasEnterpriseSubscription,
  hasSmalTeamSubscription,
  hasValidSubscription
} from '~/lib/subscriptionHelper';
export const brevoCreateCompany = inngest.createFunction(
  {
    id: 'brevo-create-company',
    name: 'Create Brevo Company',
    concurrency: 5,
    throttle: {
      limit: 10000,
      period: '1h'
    }
  },
  { event: 'brevo/create_company' },
  async ({ event, step }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode ' + process.env.NEXT_PUBLIC_RUNMODE };
    const { workspace_id } = event.data;
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspace_id },
      select: {
        name: true,
        id: true,
        brevo_company_id: true,
        createdAt: true,
        members: { select: { brevo_contact_id: true } },
        subscriptions: {
          select: {
            id: true,
            status: true,
            subscription_plan_id: true,
            cancellation_effective_date: true
          }
        }
      }
    });

    if (!workspace)
      return {
        status: 'error',
        message: 'Workspace not found'
      };

    if (workspace.brevo_company_id) {
      return {
        status: 'success',
        message: 'Company already exists'
      };
    }

    try {
      const linkedContactsIds = workspace.members
        .map((m) => m.brevo_contact_id)
        .filter((id): id is number => id !== null && id !== undefined);
      const response = await axios.post(
        'https://api.brevo.com/v3/companies',
        {
          name: workspace.name,
          attributes: {
            workspace_id: workspace.id
            //  IS_PAID_CUSTOMER: hasValidSubscription(workspace.subscriptions),
            //  CREATED_AT: workspace.createdAt
          },
          linkedContactsIds: linkedContactsIds
        },
        {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'api-key': `${process.env.SENDINBLUE_API_KEY}`
          },
          validateStatus: (status) => {
            return status >= 200 && status < 300;
          }
        }
      );

      if (response.data.id) {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { brevo_company_id: response.data.id },
          select: { id: true }
        });

        return {
          status: 'success'
        };
      } else {
        throw new Error('no id returned');
      }
    } catch (e) {
      console.log('brevo-create-company', e);
      Sentry.captureException(e);
      step.sleep('retry-after', '5 mins');
      throw e;
    }
  }
);

export const brevoDeleteCompany = inngest.createFunction(
  {
    id: 'brevo-delete-company',
    name: 'Delete Brevo Company',
    concurrency: 5,
    throttle: {
      limit: 10000,
      period: '1h'
    }
  },
  { event: 'brevo/delete_company' },
  async ({ event, step }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode' };

    const { brevo_company_id } = event.data;
    if (!brevo_company_id)
      return {
        status: 'error',
        message: 'Brevo company id is required'
      };

    try {
      await axios.delete(`https://api.brevo.com/v3/companies/${brevo_company_id}`, {
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'api-key': `${process.env.SENDINBLUE_API_KEY}`
        },
        validateStatus: (status) => {
          return status >= 200 && status < 300;
        }
      });
    } catch (e) {
      console.log('brevo-delete-company', e);
      Sentry.captureException(e);
      step.sleep('retry-after', '5 mins');
      throw e;
    }
  }
);

export const brevoCreateContactIfNotExists = inngest.createFunction(
  {
    id: 'brevo-create-contact-if-not-exists',
    name: 'Create Brevo Contact if Not Exists',
    concurrency: 5,
    throttle: {
      limit: 10000,
      period: '1h'
    }
  },
  { event: 'brevo/create_contact_if_not_exists' },
  async ({ event, step, logger }) => {
    const { email, language } = event.data;
    if (!email) {
      return {
        status: 'error',
        message: 'Email is required to create Brevo contact'
      };
    }

    try {
      // Check whether the contact already exists in Brevo
      const response = await axios.get(`https://api.brevo.com/v3/contacts/${email}?identifierType=email_id`, {
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'api-key': `${process.env.SENDINBLUE_API_KEY}`
        },
        validateStatus: (status) => {
          return status >= 200 && status < 500;
        }
      });
      const listIds = [24];

      if (response.status >= 200 && response.status < 300 && response.data.id) {
        // Contact already exists, therefore return brevo_contact_id
        return {
          status: 'success',
          message: 'Contact already exists in Brevo',
          brevo_contact_id: response.data.id
        };
      } else if (response.status === 404) {
        // Contact does not exist, so create
        const createResponse = await axios.post(
          'https://api.brevo.com/v3/contacts',
          {
            email: email,
            listIds: listIds,
            attributes: {
              LANGUAGE: language,
              IS_ADMIN: false,
              EMAIL: email,
              WANT_TO_GET_UPDATES: true
            }
          },
          {
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              'api-key': `${process.env.SENDINBLUE_API_KEY}`
            },
            validateStatus: (status) => {
              return status >= 200 && status < 300;
            }
          }
        );

        if (createResponse.status >= 200 && createResponse.status < 300 && createResponse.data.id) {
          return {
            status: 'success',
            message: 'Contact created in Brevo',
            brevo_contact_id: createResponse.data.id
          };
        } else {
          throw new Error(createResponse.data.message);
        }
      } else {
        throw new Error(response.data.message);
      }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        logger.error('brevo-create-contact-if-not-exists', e.response?.status, e.response?.data);
      } else {
        logger.error('brevo-create-contact-if-not-exists', e);
      }
      Sentry.captureException(e);
      step.sleep('retry-after', '5 mins');
      throw e;
    }
  }
);

export const brevoCreateOrUpdateContact = inngest.createFunction(
  {
    id: 'brevo-create-or-update-contact',
    name: 'Create or Update Brevo Contact',
    concurrency: 5,
    throttle: {
      limit: 10000,
      period: '1h'
    }
  },
  { event: 'brevo/create_or_update_contact' },
  async ({ event, step, logger }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode' };

    const { member_id } = event.data;
    if (!member_id)
      return {
        status: 'error',
        message: 'Member id is required'
      };

    const member = await prisma.member.findUnique({
      where: { id: member_id },
      select: {
        id: true,
        status: true,
        workspace_id: true,
        email_notifications_updates: true,
        brevo_contact_id: true,
        email: true,
        name: true,
        language: true,
        is_admin: true,
        firstName: true,
        lastName: true,
        displayName: true,
        timezone: true,
        mobile_phone: true
      }
    });

    if (!member)
      return {
        status: 'error',
        message: 'Member not found'
      };

    if (!member.email)
      return {
        status: 'error',
        message: 'Member email is required'
      };

    const workspace_creator = await prisma.member.findFirst({
      where: { workspace_id: member.workspace_id, is_admin: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    if (!workspace_creator)
      return {
        status: 'error',
        message: 'Workspace creator not found'
      };

    const workspace = await prisma.workspace.findUnique({
      where: { id: member.workspace_id },
      select: {
        subscriptions: {
          select: {
            id: true,
            status: true,
            subscription_plan_id: true,
            cancellation_effective_date: true
          }
        }
      }
    });
    if (!workspace)
      return {
        status: 'error',
        message: 'Workspace not found'
      };

    const listIds = [];
    const unlinkListIds = [24];
    if (hasValidSubscription(workspace.subscriptions)) {
      listIds.push(18);
    } else {
      unlinkListIds.push(18);
    }

    if (hasEnterpriseSubscription(workspace.subscriptions)) {
      listIds.push(19);
    } else {
      unlinkListIds.push(19);
    }

    if (hasSmalTeamSubscription(workspace.subscriptions)) {
      listIds.push(20);
    } else {
      unlinkListIds.push(20);
    }

    if (hasBusinessV1Subscription(workspace.subscriptions)) {
      listIds.push(21);
    } else {
      unlinkListIds.push(21);
    }

    if (hasBusinessSubscription(workspace.subscriptions)) {
      listIds.push(22);
    } else {
      unlinkListIds.push(22);
    }

    try {
      if (member.brevo_contact_id) {
        try {
          await axios.put(
            `https://api.brevo.com/v3/contacts/${member.brevo_contact_id}`,
            {
              ext_id: member.id,
              emailBlacklisted: !member.email_notifications_updates,
              attributes: {
                EXT_ID: member.id,
                EMAIL: member.email,
                VORNAME: member.firstName || member.name || '',
                NACHNAME: member.lastName || '',
                WANT_TO_GET_UPDATES: member.email_notifications_updates,
                LANGUAGE: member.language,
                IS_ADMIN: member.is_admin,
                NAME: member.name,
                //  'CONTACT TIMEZONE': member.timezone,
                WORKSPACE_CREATOR: workspace_creator.id === member.id,
                //  SMS: member.mobile_phone,
                IN_APP_STATUS: [member.status]
              },
              listIds: listIds,
              unlinkListIds: unlinkListIds
            },
            {
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'api-key': `${process.env.SENDINBLUE_API_KEY}`
              },
              validateStatus: (status) => {
                return status >= 200 && status < 300;
              }
            }
          );
        } catch (e) {
          if (axios.isAxiosError(e)) {
            logger.error('brevo-create-or-update-contact', e.response?.status, e.response?.data);
          } else {
            logger.error('brevo-create-or-update-contact', e);
          }
          Sentry.captureException(e);
          step.sleep('retry-after', '5 mins');
          throw e;
        }
      } else {
        const response = await axios.get(`https://api.brevo.com/v3/contacts/${member.email}?identifierType=email_id`, {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'api-key': `${process.env.SENDINBLUE_API_KEY}`
          },
          validateStatus: (status) => {
            // Akzeptiere alle Statuscodes im Bereich 200-499, um nicht automatisch in den Catch-Block zu springen
            return status >= 200 && status < 500;
          }
        });
        if (response.status >= 200 && response.status < 300 && response.data.id) {
          await prisma.member.update({
            where: { id: member.id },
            data: { brevo_contact_id: response.data.id },
            select: { id: true }
          });
          inngest.send({
            name: 'brevo/create_or_update_contact',
            data: { member_id: member.id }
          });
        } else if (response.status === 404) {
          const r = await axios.post(
            'https://api.brevo.com/v3/contacts',
            {
              email: member.email,
              ext_id: member.id
            },
            {
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'api-key': `${process.env.SENDINBLUE_API_KEY}`
              },
              validateStatus: (status) => {
                // Akzeptiere alle Statuscodes im Bereich 200-499, um nicht automatisch in den Catch-Block zu springen
                return status >= 200 && status < 300;
              }
            }
          );
          if (r.status >= 200 && r.status < 300 && r.data.id) {
            await prisma.member.update({
              where: { id: member.id },
              data: { brevo_contact_id: r.data.id },
              select: { id: true }
            });
            inngest.send({
              name: 'brevo/create_or_update_contact',
              data: { member_id: member.id }
            });
          } else {
            throw new Error(r.data.message);
          }
        } else {
          throw new Error(response.data.message);
        }
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: member.workspace_id },
        select: { brevo_company_id: true, members: { select: { brevo_contact_id: true } } }
      });

      if (workspace && workspace.brevo_company_id) {
        const company = await axios.get(
          `https://api.brevo.com/v3/companies/${workspace.brevo_company_id}`,

          {
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              'api-key': `${process.env.SENDINBLUE_API_KEY}`
            },
            validateStatus: (status) => {
              return status >= 200 && status < 300;
            }
          }
        );

        const linkedContactsIds = workspace.members
          .map((m) => m.brevo_contact_id)
          .filter((id): id is number => id !== null && id !== undefined);

        if (company.data.linkedContactsIds.length !== linkedContactsIds.length) {
          //find ids to unlink
          const unlinkListIds = company.data.linkedContactsIds.filter((id: number) => !linkedContactsIds.includes(id));

          //find ids to link
          const linkListIds = linkedContactsIds.filter((id) => !company.data.linkedContactsIds.includes(id));

          await axios.patch(
            `https://api.brevo.com/v3/companies/link-unlink/${workspace.brevo_company_id}`,
            {
              linkContactIds: linkListIds,
              unlinkContactIds: unlinkListIds
            },
            {
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'api-key': `${process.env.SENDINBLUE_API_KEY}`
              },
              validateStatus: (status) => {
                // Akzeptiere alle Statuscodes im Bereich 200-499, um nicht automatisch in den Catch-Block zu springen
                return status >= 200 && status < 300;
              }
            }
          );
        }
      }
    } catch (e) {
      console.log('brevo-create-or-update-contact', e);
      Sentry.captureException(e);
      step.sleep('retry-after', '5 mins');
      throw e;
    }
  }
);
export const brevoCreateOrUpdateAllWorkspaceContacts = inngest.createFunction(
  {
    id: 'brevo-create-or-update-all-workspace-contacts',
    name: 'Create or Update All Workspace Contacts'
  },
  { event: 'brevo/create_or_update_all_workspace_contacts' },
  async ({ event }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode' };

    const { workspace_id } = event.data;
    if (!workspace_id)
      return {
        status: 'error',
        message: 'Workspace id is required'
      };

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspace_id },
      select: {
        name: true,
        id: true,
        createdAt: true,
        brevo_company_id: true,
        subscriptions: { select: { status: true, subscription_plan_id: true, cancellation_effective_date: true } }
      }
    });

    if (!workspace)
      return {
        status: 'error',
        message: 'Workspace not found'
      };
    if (workspace.brevo_company_id) {
      const response = await axios.patch(
        `https://api.brevo.com/v3/companies/${workspace.brevo_company_id}`,
        {
          name: workspace.name,
          attributes: {
            workspace_id: workspace.id
            //    IS_PAID_CUSTOMER: hasValidSubscription(workspace.subscriptions),
            //CREATED_AT: workspace.createdAt
          }
        },
        {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'api-key': `${process.env.SENDINBLUE_API_KEY}`
          },
          validateStatus: (status) => {
            return status >= 200 && status < 300;
          }
        }
      );
      console.log('brevo-create-or-update-all-workspace-contacts', response.data, response.status);
    }

    const members = await prisma.member.findMany({
      where: { workspace_id },
      select: { id: true }
    });

    const batchSize = 150;

    const sendBatch = async (batch: { id: string }[]) => {
      await inngest.send(
        batch.map((id) => {
          return {
            name: 'brevo/create_or_update_contact',
            data: { member_id: id.id }
          };
        })
      );
    };

    let i = 0;
    while (i < members.length) {
      const batch = members.slice(i, Math.min(i + batchSize, members.length));
      if (batch.length > 0) {
        await sendBatch(batch);
      }
      i += batchSize;
    }
  }
);
export const brevoDeleteContacts = inngest.createFunction(
  {
    id: 'brevo-delete-contacts',
    name: 'Delete Brevo Contacts'
  },
  { event: 'brevo/delete_contacts' },
  async ({ event }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode' };

    const { brevo_contact_ids_or_emails } = event.data;
    if (!brevo_contact_ids_or_emails)
      return {
        status: 'error',
        message: 'Brevo contact ids are required'
      };

    const batchSize = 150;

    const sendBatch = async (batch: string[]) => {
      await inngest.send(
        batch.map((id) => {
          return {
            name: 'brevo/delete_contact',
            data: {
              brevo_contact_id_or_email: id
            }
          };
        })
      );
    };

    let i = 0;
    while (i < brevo_contact_ids_or_emails.length) {
      const batch = brevo_contact_ids_or_emails.slice(i, Math.min(i + batchSize, brevo_contact_ids_or_emails.length));
      if (batch.length > 0) {
        await sendBatch(batch);
      }
      i += batchSize;
    }
  }
);

export const brevoDeleteContact = inngest.createFunction(
  {
    id: 'brevo-delete-contact',
    name: 'Delete Brevo Contact',
    concurrency: 5,
    throttle: {
      limit: 10000,
      period: '1h'
    }
  },
  { event: 'brevo/delete_contact' },
  async ({ event, step }) => {
    if (process.env.NEXT_PUBLIC_RUNMODE !== 'Production')
      return { status: 'success', message: 'skipped in non-production mode' };

    const { brevo_contact_id_or_email } = event.data;
    if (!brevo_contact_id_or_email)
      return {
        status: 'error',
        message: 'Brevo contact id is required'
      };

    if (brevo_contact_id_or_email === 'null')
      return {
        status: 'success',
        message: 'contact not found'
      };

    try {
      const response = await axios.delete(`https://api.brevo.com/v3/contacts/${brevo_contact_id_or_email}`, {
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'api-key': `${process.env.SENDINBLUE_API_KEY}`
        },
        validateStatus: (status) => {
          return status >= 200 && status < 500;
        }
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          status: 'success',
          message: 'contact deleted'
        };
      } else if (response.status === 404) {
        return {
          status: 'success',
          message: 'contact not found'
        };
      } else {
        throw new Error(response.data.message);
      }
    } catch (e) {
      console.log('brevo-delete-contact', e);
      Sentry.captureException(e);
      step.sleep('retry-after', '5 mins');
      throw e;
    }
  }
);
