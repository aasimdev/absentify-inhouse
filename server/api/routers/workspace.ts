import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Display, DisplayNameFormat, MicrosoftAppStatus, Prisma, TimeFormat } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { sendMail } from 'lib/sendInBlueContactApi';
import axios from 'axios';
import { paddle_config } from 'helper/paddle_config';
import {
  getMicrosoftGroupsAccessToken,
  getMicrosoftPaymnetAccessToken,
  getMicrosoftUsersAccessToken
} from '~/lib/getMicrosoftAccessToken';
import { Workbook } from 'excel4node';
import { fillWorksheet } from '~/lib/excelHelper';
import { memberRouter } from './member';
import { BlobServiceClient } from '@azure/storage-blob';
import * as Sentry from '@sentry/nextjs';
import getFileNames from '~/lib/getFileNames';
import { inngest } from '~/inngest/inngest_client';
import { PaddleService } from '~/utils/paddleV2Service';
import { defaultAllwoanceTypeSelect } from './allowance';
import { updateSmiirl } from '~/helper/smiirl';

type Group = {
  id: string;
  displayName: string;
  description: string;
  securityEnabled: boolean;
  visibility: string;
};
/**
 * Default selector for workspace.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultWorkspaceSelect = Prisma.validator<Prisma.WorkspaceSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  global_timezone: true,
  global_language: true,
  global_date_format: true,
  global_time_format: true,
  global_week_start: true,
  global_name_format: true,
  privacy_show_calendarview: true,
  privacy_show_otherdepartments: true,
  privacy_show_absences_in_past: true,
  min_enterprise_users: true,
  microsoft_mailboxSettings_read_write: true,
  microsoft_groups_read_write_all: true,
  microsoft_calendars_read_write: true,
  ai_bot_enabled: true,
  microsoft_users_read_all: true,
  fiscal_year_start_month: true,
  old_pricing: true,
  subscriptions: {
    select: {
      id: true,
      provider: true,
      status: true,
      subscription_id: true,
      updatedAt: true,
      quantity: true,
      modifier_id: true,
      subscription_plan_id: true,
      customer_user_id: true,
      cancellation_effective_date: true,
      currency: true,
      unit_price: true,
      unpaid: true,
      past_due_since: true,
      price_id: true,
      billing_cycle_interval: true
    }
  },
  company_logo_url: true,
  company_logo_ratio_square: true,
  global_display_calendar_weeks: true,
  display_logo: true,
  favicon_url: true,
  allow_manager_past_request_cancellation: true
});

export const workspaceRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: defaultWorkspaceSelect
    });

    if (
      workspace?.subscriptions.find(
        (x) =>
          x.status == 'deleted' && x.cancellation_effective_date && new Date(x.cancellation_effective_date) < new Date()
      )
    ) {
      await ctx.prisma.subscription.deleteMany({
        where: {
          workspace_id: ctx.current_member.workspace_id,
          status: 'deleted',
          OR: [
            {
              cancellation_effective_date: {
                lte: new Date()
              }
            },
            { cancellation_effective_date: null }
          ]
        }
      });
      await ctx.prisma.workspace.update({
        where: { id: ctx.current_member.workspace_id },
        data: { old_pricing: false }
      });
    }

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
      });
    }
    return workspace;
  }),

  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          global_language: z.string().optional(),
          global_date_format: z.string().optional(),
          global_time_format: z.nativeEnum(TimeFormat).optional(),
          global_week_start: z.string().optional(),
          global_timezone: z.string().optional(),
          global_name_format: z.nativeEnum(DisplayNameFormat).optional(),
          fiscal_year_start_month: z.number().optional(),
          privacy_show_calendarview: z.boolean().optional(),
          privacy_show_otherdepartments: z.boolean().optional(),
          privacy_show_absences_in_past: z.boolean().optional(),
          global_display_calendar_weeks: z.boolean().optional(),
          display_logo: z.nativeEnum(Display).optional(),
          allow_manager_past_request_cancellation: z.boolean().optional(),
          microsoft_mailboxSettings_read_write: z.nativeEnum(MicrosoftAppStatus).optional(),
          microsoft_groups_read_write_all: z.nativeEnum(MicrosoftAppStatus).optional(),
          microsoft_calendars_read_write: z.nativeEnum(MicrosoftAppStatus).optional(),
          microsoft_users_read_all: z.nativeEnum(MicrosoftAppStatus),
          ai_bot_enabled: z.boolean()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != input.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin_workspace')
        });
      }
      const old_workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });
      if (!old_workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('error_workspace_not_found')
        });
      }

      if (data.global_name_format != undefined && data.global_name_format != old_workspace.global_name_format) {
        await inngest.send({
          // The event name
          name: 'workspace/update.member.name_format',
          // The event's data
          data: {
            global_name_format: data.global_name_format,
            workspaceId: ctx.current_member.workspace_id
          }
        });
      }

      if (
        data.privacy_show_otherdepartments != old_workspace.privacy_show_otherdepartments &&
        !data.privacy_show_otherdepartments
      ) {
        const memberWithCutsomApprover = await ctx.prisma.member.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            approver_config_department_id: null
          },
          select: {
            id: true,
            name: true,
            email: true,
            departments: { select: { department_id: true } },
            has_approvers: {
              select: {
                approver_member_id: true,
                approver_member: {
                  select: {
                    name: true,
                    email: true,
                    departments: { select: { department_id: true } }
                  }
                }
              }
            }
          }
        });

        for (let i2 = 0; i2 < memberWithCutsomApprover.length; i2++) {
          const m = memberWithCutsomApprover[i2];
          if (m)
            for (let i3 = 0; i3 < m.has_approvers.length; i3++) {
              const approver = m.has_approvers[i3];
              if (approver) {
                const k = approver.approver_member.departments.find((x) =>
                  m.departments.find((y) => y.department_id == x.department_id)
                );
                if (!k) {
                  throw new TRPCError({
                    code: 'CONFLICT',
                    message: ctx.t(
                      'member_name-has-approver_name-as-approver-but-approver_name-is-not-in-the-same-department-as-member_name-please-change-the-approver-settings',
                      {
                        member_name: m.name,
                        approver_name: approver.approver_member.name
                      }
                    )
                  });
                }
              }
            }
        }
      }
      const workspace = await ctx.prisma.workspace.update({
        where: { id },
        data,
        select: defaultWorkspaceSelect
      });

      if (old_workspace.microsoft_users_read_all != 'ACTIVATED' && workspace.microsoft_users_read_all == 'ACTIVATED') {
        try {
          var date = new Date(); // Now
          date.setDate(date.getDate() + 25);
          const token = await getMicrosoftUsersAccessToken(ctx.session.user.microsoft_tenant_id);
          const formData = {
            changeType: 'updated,deleted',
            notificationUrl: 'https://inngest.absentify.com/api/webhooks/graph/users',
            lifecycleNotificationUrl: 'https://inngest.absentify.com/api/webhooks/graph/lifecycleNotifications',
            resource: '/users',
            expirationDateTime: date.toISOString(),
            clientState: 'SecretClientState'
          };

          const config = {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          };

          const response = await axios.post(`https://graph.microsoft.com/v1.0/subscriptions`, formData, config);

          await ctx.prisma.microsoftGraphSubscription.create({
            data: {
              change_type: 'updated,deleted',
              expiration_date: date,
              resource: '/users',
              subscription_id: response.data.id,
              tenant_id: ctx.session.user.microsoft_tenant_id
            }
          });

          const membersWithoutMicrosoft = await ctx.prisma.member.findMany({
            where: {
              workspace_id: ctx.current_member.workspace_id,
              microsoft_user_id: null,
              microsoft_tenantId: null,
              email: { not: null }
            },
            select: { id: true, email: true }
          });

          for (let i5 = 0; i5 < membersWithoutMicrosoft.length; i5++) {
            const member = membersWithoutMicrosoft[i5];
            if (!member) continue;
            if (!member.email) continue;

            const graphUser = await fetch(
              `https://graph.microsoft.com/v1.0/users?$filter=UserPrincipalName eq '${member.email.toLowerCase()}'&$select=id,displayName`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

            if (graphUser.ok) {
              const x = await graphUser.json();
              if (x.value[0].id) {
                await ctx.prisma.member.update({
                  where: { id: member.id },
                  data: {
                    microsoft_user_id: x.value[0].id,
                    microsoft_tenantId: ctx.session.user.microsoft_tenant_id
                  }
                });
              }
            }
          }

          const members = await ctx.prisma.member.findMany({
            where: {
              workspace_id: ctx.current_member.workspace_id,
              microsoft_user_id: { not: null },
              microsoft_tenantId: { not: null }
            },
            select: { id: true, microsoft_user_id: true, microsoft_tenantId: true }
          });
          for (let i5 = 0; i5 < members.length; i5++) {
            const member = members[i5];
            if (!member) continue;
            if (!member.microsoft_user_id || !member.microsoft_tenantId) continue;
            await inngest.send({
              name: 'member/update.member.profile',
              data: {
                microsoft_user_id: member.microsoft_user_id,
                microsoft_tenant_id: member.microsoft_tenantId,
                token: token
              }
            });
          }
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      if (old_workspace.microsoft_users_read_all == 'ACTIVATED' && workspace.microsoft_users_read_all == 'REVOKED') {
        try {
          const token = await getMicrosoftUsersAccessToken(ctx.session.user.microsoft_tenant_id);
          const grapSubscriptions = await ctx.prisma.microsoftGraphSubscription.findMany({
            where: { tenant_id: ctx.session.user.microsoft_tenant_id, resource: '/users' },
            select: { subscription_id: true }
          });

          const config = {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          };

          for (let i4 = 0; i4 < grapSubscriptions.length; i4++) {
            const grapSubscription = grapSubscriptions[i4];
            if (!grapSubscription) continue;
            await axios.delete(
              `https://graph.microsoft.com/v1.0/subscriptions/${grapSubscription.subscription_id}`,
              config
            );
            await ctx.prisma.microsoftGraphSubscription.delete({
              where: { subscription_id: grapSubscription.subscription_id }
            });
          }
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      if (
        old_workspace.microsoft_groups_read_write_all != 'ACTIVATED' &&
        workspace.microsoft_groups_read_write_all == 'ACTIVATED'
      ) {
        try {
          var date = new Date(); // Now
          date.setDate(date.getDate() + 25);
          const token = await getMicrosoftGroupsAccessToken(ctx.session.user.microsoft_tenant_id);
          const formData = {
            changeType: 'updated,deleted',
            notificationUrl: 'https://inngest.absentify.com/api/webhooks/graph/groups',
            lifecycleNotificationUrl: 'https://inngest.absentify.com/api/webhooks/graph/lifecycleNotifications',
            resource: '/groups',
            expirationDateTime: date.toISOString(),
            clientState: 'SecretClientState'
          };

          console.log(formData);

          const config = {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          };

          const response = await axios.post(`https://graph.microsoft.com/v1.0/subscriptions`, formData, config);

          await ctx.prisma.microsoftGraphSubscription.create({
            data: {
              change_type: 'updated,deleted',
              expiration_date: date,
              resource: '/groups',
              subscription_id: response.data.id,
              tenant_id: ctx.session.user.microsoft_tenant_id
            }
          });
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      if (
        old_workspace.microsoft_groups_read_write_all == 'ACTIVATED' &&
        workspace.microsoft_groups_read_write_all == 'REVOKED'
      ) {
        try {
          const token = await getMicrosoftGroupsAccessToken(ctx.session.user.microsoft_tenant_id);
          const grapSubscriptions = await ctx.prisma.microsoftGraphSubscription.findMany({
            where: { tenant_id: ctx.session.user.microsoft_tenant_id, resource: '/groups' },
            select: { subscription_id: true }
          });

          const config = {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          };

          for (let i4 = 0; i4 < grapSubscriptions.length; i4++) {
            const grapSubscription = grapSubscriptions[i4];
            if (!grapSubscription) continue;
            await axios.delete(
              `https://graph.microsoft.com/v1.0/subscriptions/${grapSubscription.subscription_id}`,
              config
            );
            await ctx.prisma.microsoftGraphSubscription.delete({
              where: { subscription_id: grapSubscription.subscription_id }
            });
          }
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      if (
        old_workspace.microsoft_calendars_read_write != workspace.microsoft_calendars_read_write &&
        workspace.microsoft_calendars_read_write == 'ACTIVATED'
      ) {
        const members = await ctx.prisma.member.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true }
        });
        await inngest.send(
          members.map((m) => {
            return {
              name: 'publicHolidayDaySync/create_sync_items_for_member',
              data: {
                member_id: m.id
              }
            };
          })
        );
      }

      if (
        data.fiscal_year_start_month != undefined &&
        old_workspace.fiscal_year_start_month != data.fiscal_year_start_month
      ) {
        await inngest.send({
          // The event name
          name: 'workspace/update.member.allowance',
          // The event's data
          data: {
            workspaceId: ctx.current_member.workspace_id
          }
        });
      }

      return workspace;
    }),
  changeImageRatio: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        company_logo_ratio_square: z.boolean()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, company_logo_ratio_square } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != input.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin_workspace')
        });
      }
      const workspace = await ctx.prisma.workspace.update({
        where: { id },
        select: { id: true },
        data: {
          company_logo_ratio_square
        }
      });

      return workspace;
    }),
  deleteImage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, type } = input;
        const workspace = await ctx.prisma.workspace.findUnique({
          where: { id },
          select: { company_logo_url: true, favicon_url: true }
        });
        let url = null;
        if (type === 'favicon' && workspace?.favicon_url) {
          url = new URL(workspace?.favicon_url);
        } else if (type !== 'favicon' && workspace?.company_logo_url) {
          url = new URL(workspace?.company_logo_url);
        }
        if (!url) return;
        const path = url.pathname;
        const blobName = path.substring(path.lastIndexOf('/') + 1);
        const fileName = blobName.split('32x32');
        let blobNames = [
          blobName,
          `${fileName[0]}96x96${fileName[1]}`,
          `${fileName[0]}256x256${fileName[1]}`,
          `${fileName[0]}400x80${fileName[1]}`
        ];
        if (type === 'favicon') blobNames = [blobName];
        const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_COMPANY_LOGO_URL + '');
        const containerClient = blobServiceClient.getContainerClient('');
        if (type === 'favicon') {
          await ctx.prisma.workspace.update({
            where: { id },
            select: { id: true },
            data: {
              favicon_url: null
            }
          });
        } else {
          await ctx.prisma.workspace.update({
            where: { id },
            select: { id: true },
            data: {
              company_logo_url: null
            }
          });
        }
        for (const name of blobNames) {
          const blockBlobClient = containerClient.getBlockBlobClient(name);
          await blockBlobClient.delete();
        }
      } catch (error: any) {
        console.log('Error:', error.message);
      }
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        options: z.array(z.string())
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const [workspace, members] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id },
          select: { ...defaultWorkspaceSelect, brevo_company_id: true }
        }),
        ctx.prisma.member.findMany({
          where: { workspace_id: id },
          select: {
            id: true,
            brevo_contact_id: true,
            has_cdn_image: true,
            microsoft_user_id: true,
            email: true
          }
        })
      ]);

      if (workspace?.id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      try {
        const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_URL + '');
        const containerClient = blobServiceClient.getContainerClient('');
        for (const member of members) {
          if (!member.has_cdn_image || !member.microsoft_user_id) continue;
          const blobNames = getFileNames(member.microsoft_user_id);
          for (const name of blobNames) {
            const blockBlobClient = containerClient.getBlockBlobClient(name);
            await blockBlobClient.delete();
          }
        }
      } catch (e) {
        Sentry.captureException(e);
      }
      for (let index = 0; index < workspace.subscriptions.length; index++) {
        const subscription = workspace.subscriptions[index];
        if (!subscription) continue;
        if (subscription.provider == 'paddle') {
          await axios.post(
            (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
              ? 'https://sandbox-vendors.paddle.com/api'
              : 'https://vendors.paddle.com/api') + '/2.0/subscription/users_cancel',
            {
              vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
              vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
              subscription_id: Number(subscription.subscription_id)
            }
          );
        } else if (subscription.provider == 'paddle_v2') {
          try {
            await PaddleService.cancelSubscription(subscription.subscription_id);
          } catch (e) {
            console.log(e);
          }
        } else if (subscription.provider == 'microsoftFulfillment') {
          const paymentToken = await getMicrosoftPaymnetAccessToken();
          await axios.delete(
            'https://marketplaceapi.microsoft.com/api/saas/subscriptions/' +
              subscription.subscription_id +
              '?api-version=2018-08-31',
            {
              headers: {
                'content-type': 'application/json',
                authorization: 'Bearer ' + paymentToken
              }
            }
          );
        }
      }
      await inngest.send({
        name: 'brevo/delete_contacts',
        data: {
          brevo_contact_ids_or_emails: members.map((x) => x.brevo_contact_id || x.email).filter(Boolean) as string[]
        }
      });

      if (workspace.brevo_company_id)
        await inngest.send({
          name: 'brevo/delete_company',
          data: { brevo_company_id: workspace.brevo_company_id }
        });

      await ctx.prisma.$transaction([ctx.prisma.workspace.delete({ where: { id: workspace.id } })]);

      await ctx.prisma.accountDeletionReason.create({
        data: {
          firstReason: input.options[0] as string,
          secondReason: input.options[1] as string,
          thirdReason: input.options[2] ?? null,
          deleted_users_count: members.length
        }
      });
      await updateSmiirl(ctx.prisma);
      return {
        id
      };
    }),
  getMicrosoftGroups: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: { microsoft_groups_read_write_all: true }
    });
    if (!workspace) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    if (workspace.microsoft_groups_read_write_all != 'ACTIVATED') {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    if (!ctx.current_member?.microsoft_tenantId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }

    const ms_auth_token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
    if (!ms_auth_token) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    if (ms_auth_token) {
      //call with axois microsoft graph api to get all groups

      try {
        let allGroups: Group[] = [];
        let url =
          'https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,securityEnabled,visibility';

        while (url) {
          const response = await axios.get(url, {
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${ms_auth_token}`
            }
          });

          if (response.status === 200) {
            allGroups = allGroups.concat(response.data.value);
            // Überprüfen, ob ein nextLink vorhanden ist, und URL aktualisieren
            url = response.data['@odata.nextLink'];
          }
        }

        return allGroups.sort((a, b) => {
          return a.displayName.localeCompare(b.displayName);
        });
      } catch (e) {
        console.log(e);
        return [];
      }
    }
    return [];
  }),
  getImportExcelFile: protectedProcedure
    .input(
      z.object({
        selectedGroups: z.array(z.string()).nullable()
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      type User = {
        id: string;
        custom_id: string;
        displayName: string;
        mail: string;
        userPrincipalName: string;
        accountEnabled: boolean;
      };

      let users: User[] = [];
      if (input.selectedGroups && input.selectedGroups.length > 0) {
        try {
          const microsoft_token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
          for (let index = 0; index < input.selectedGroups.length; index++) {
            const group = input.selectedGroups[index];
            let d = await axios.get<{
              value: User[];
            }>(
              'https://graph.microsoft.com/v1.0/groups/' +
                group +
                '/members?$select=id,displayName,mail,userPrincipalName,accountEnabled',
              {
                headers: {
                  'content-type': 'application/json',
                  Authorization: `Bearer ${microsoft_token}`
                }
              }
            );
            if (d.status == 200) {
              users = [...users, ...d.data.value.filter((x) => x.accountEnabled && x.mail != null)];

              //make all mail to lowercase
              users.forEach((x) => {
                x.mail = x.mail.toLowerCase();
                x.userPrincipalName = x.userPrincipalName.toLowerCase();
              });
            }
          }

          const caller = memberRouter.createCaller({
            prisma: ctx.prisma,
            session: ctx.session,
            current_member: ctx.current_member,
            req: ctx.req
          });
          let existingEmails = await caller.checkExistingEmails({
            emails: users.map((x) => x.mail)
          });

          //make all emails to lowercase
          existingEmails.forEach((x) => {
            if (x.email !== null) {
              x.email = x.email.toLowerCase();
            }
          });

          users = users.filter((x) => !existingEmails.find((y) => y.email == x.mail));

          //remove users with duplicate emails
          users = users.filter((x) => !users.find((y) => y.mail == x.mail && y.id != x.id));

          console.log(users);
        } catch (e) {
          console.log(e);
        }
      }

      const [departments, publicHolidays, allowanceTypes] = await ctx.prisma.$transaction([
        ctx.prisma.department.findMany({
          select: { id: true, name: true },
          where: { workspace_id: ctx.current_member?.workspace_id },
          orderBy: { name: 'asc' }
        }),
        ctx.prisma.publicHoliday.findMany({
          select: { id: true, name: true },
          where: { workspace_id: ctx.current_member?.workspace_id },
          orderBy: { name: 'asc' }
        }),
        ctx.prisma.allowanceType.findMany({
          select: defaultAllwoanceTypeSelect,
          where: { workspace_id: ctx.current_member.workspace_id },
          orderBy: [{ default: 'desc' }, { name: 'desc' }]
        })
      ]);
      const schema_users = [
        {
          column: ctx.t('Name'),
          type: String,
          value: (user: User) => user.displayName
        },
        {
          column: ctx.t('Email'),
          type: String,
          value: (user: User) => user.mail
        },
        {
          column: ctx.t('Department'),
          type: String,
          value: () => ''
        },
        {
          column: ctx.t('Public_holidays'),
          type: String,
          value: () => ''
        },
        {
          column: ctx.t('Employment_Start_Date'),
          type: Date,
          format: ctx.current_member.date_format,
          value: () => ''
        },
        {
          column: ctx.t('custom_id'),
          type: String,
          value: (user: User) => user.custom_id
        },
        {
          column: ctx.t('Account_Enabled'),
          type: String,
          value: () => ''
        }
      ];
      const allowance_schema = [];
      for (const allowanceType of allowanceTypes) {
        if (allowanceType.allowance_unit === 'days') {
          allowance_schema.push(
            {
              column: `${allowanceType.name}(days) Annual allowance current year`,
              type: Number,
              value: () => ''
            },
            {
              column: `${allowanceType.name}(days) Annual allowance next year`,
              type: Number,
              value: () => ''
            }
          );
        } else if (allowanceType.allowance_unit === 'hours') {
          allowance_schema.push(
            {
              column: `${allowanceType.name}(hours) Annual allowance current year`,
              type: Date,
              value: () => ''
            },
            {
              column: `${allowanceType.name}(hours) Annual allowance next year`,
              type: Date,
              value: () => ''
            }
          );
        }
      }

      const schema_public_holidays = [
        {
          column: ctx.t('Name'),
          type: String,
          value: (publicHoliday: { name: string; id: string }) => publicHoliday.name,
          width: 14
        }
      ];

      const schema_department = [
        {
          column: ctx.t('Name'),
          type: String,
          value: (leaveType: { name: string; id: string }) => leaveType.name,
          width: 14
        }
      ];

      const wb = new Workbook();
      const ws = wb.addWorksheet(ctx.t('Import_Data'));

      ws.addDataValidation({
        type: 'list',
        allowBlank: false,
        sqref: 'D2:D1000',
        showDropDown: true,
        formulas: [`='${ctx.t('Public_holidays')}'!$A$2:$A$200`]
      });

      ws.addDataValidation({
        type: 'list',
        allowBlank: false,
        sqref: 'C2:C1000',
        showDropDown: true,
        formulas: [`='${ctx.t('Departments')}'!$A$2:$A$200`]
      });

      ws.addDataValidation({
        type: 'list',
        allowBlank: false,
        prompt: ctx.t('Account_Enabled_Hint'),
        showDropDown: true,
        sqref: 'G2:G1000',
        formulas: [ctx.t('Account_Enabled_Value_Active') + ',' + ctx.t('Account_Enabled_Value_Inactive')]
      });

      fillWorksheet(ws, [...schema_users, ...allowance_schema], users);

      const ws2 = wb.addWorksheet(ctx.t('Departments'));

      fillWorksheet(ws2, schema_department, departments);

      const ws3 = wb.addWorksheet(ctx.t('Public_holidays'));

      fillWorksheet(ws3, schema_public_holidays, publicHolidays);

      const buffer = await wb.writeToBuffer();

      return { base64File: buffer.toString('base64') };
    }),
  finishMsPay: protectedProcedure
    .input(
      z.object({
        x_ms_marketplace_token: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only available in production'
        });
      }
      const ms_auth_token = await getMicrosoftPaymnetAccessToken();
      if (ms_auth_token) {
        let d = await axios.post(
          'https://marketplaceapi.microsoft.com/api/saas/subscriptions/resolve?api-version=2018-08-31',
          {},
          {
            headers: {
              'content-type': 'application/json',
              'x-ms-marketplace-token': input.x_ms_marketplace_token,
              authorization: 'Bearer ' + ms_auth_token
            }
          }
        );
        if (d.status == 200) {
          let x: {
            id: string;
            subscriptionName: string;
            offerId: string;
            planId: string;
            quantity: number;
            subscription: {
              id: string;
              publisherId: string;
              offerId: string;
              name: string;
              saasSubscriptionStatus:
                | 'Subscribed'
                | 'Suspended'
                | 'Unsubscribed'
                | 'Started'
                | 'PendingFulfillmentStart'
                | 'InProgress'
                | 'Reinstated'
                | 'Succeeded'
                | 'Failed'
                | 'Updating';
              beneficiary: {
                emailId: string;
                objectId: string;
                tenantId: string;
                puid: string;
              };
              purchaser: {
                emailId: string;
                objectId: string;
                tenantId: string;
                puid: string;
              };
              planId: string;
              term: {
                termUnit: string;
              };
              autoRenew: boolean;
              isTest: boolean;
              isFreeTrial: boolean;
              allowedCustomerOperations: string[];
              sandboxType: string;
              created: Date;
              lastModified: Date;
              quantity: number;
              sessionMode: string;
            };
          } = d.data;

          await axios.post(
            'https://marketplaceapi.microsoft.com/api/saas/subscriptions/' + x.id + '/activate?api-version=2018-08-31',
            {
              planId: x.planId,
              quantity: x.quantity
            },
            {
              headers: {
                'content-type': 'application/json',
                authorization: 'Bearer ' + ms_auth_token
              }
            }
          );
          let existingSubscription = await ctx.prisma.subscription.findFirst({
            where: { subscription_id: x.id },
            select: { id: true }
          });
          if (existingSubscription) {
            await ctx.prisma.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                workspace_id: ctx.current_member.workspace_id,
                provider: 'microsoftFulfillment',
                quantity: x.quantity,
                subscription_plan_id: x.subscription.term.termUnit.endsWith('M')
                  ? paddle_config.products.ENTERPRISE.monthly_plan_id + ''
                  : paddle_config.products.ENTERPRISE.yearly_plan_id + '',
                subscription_id: x.id,
                customer_user_id: x.subscription.purchaser.objectId,
                unit_price: x.subscription.term.termUnit.endsWith('M') ? 3 : 30,
                currency: 'USD',
                //PendingFulfillmentStart, Subscribed, Suspended or Unsubscribed
                status: 'active'
              },
              select: { id: true }
            });
          } else {
            await ctx.prisma.subscription.create({
              data: {
                workspace_id: ctx.current_member.workspace_id,
                provider: 'microsoftFulfillment',
                quantity: x.quantity,
                subscription_plan_id: x.subscription.term.termUnit.endsWith('M')
                  ? paddle_config.products.ENTERPRISE.monthly_plan_id + ''
                  : paddle_config.products.ENTERPRISE.yearly_plan_id + '',
                subscription_id: x.id,
                customer_user_id: x.subscription.purchaser.objectId,
                unit_price: x.subscription.term.termUnit.endsWith('M') ? 3 : 30,
                currency: 'USD',
                //PendingFulfillmentStart, Subscribed, Suspended or Unsubscribed
                status: 'active'
              },
              select: { id: true }
            });

            await ctx.prisma.workspace.update({
              where: { id: ctx.current_member.workspace_id },
              data: { enabled_to_purchase_enterprise: true },
              select: { id: true }
            });

            await sendMail({
              prisma: ctx.prisma,
              workspace_id: null,
              subject: `Microsoft Payment created`,
              html: JSON.stringify(x),
              recipients: {
                to: [
                  {
                    address: 'support@absentify.com',
                    displayName: 'absentify Support'
                  }
                ]
              }
            });
          }
        } else {
          if (d.status == 400) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: ctx.t('ms_marketplace_token_invalid')
            });
          }
          if (d.status == 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: ctx.t('ms_marketplace_token_invalid')
            });
          }
          if (d.status == 500) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: ctx.t('internal_server_error')
            });
          }
        }
      } else {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_ms_auth_token_found')
        });
      }
      await inngest.send({
        name: 'brevo/create_or_update_all_workspace_contacts',
        data: { workspace_id: ctx.current_member.workspace_id }
      });
      //in DB speichern unter Subscriptions
      //bei Eroflg aktivate url aufrufen
    })
});
