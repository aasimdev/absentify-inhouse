import { protectedProcedure, createTRPCRouter } from '../trpc';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { PaddleService } from '~/utils/paddleV2Service';
import { defaultWorkspaceSelect } from './workspace';
import { z } from 'zod';
import {
  paddle_business_ids,
  paddle_business_ids_v1,
  paddle_config,
  paddle_enterprise_ids,
  paddle_small_team_ids,
  paddle_v2_price_ids
} from '~/helper/paddle_config';
import {
  getBusinessV1Subscription,
  getSubscription,
  hasBusinessSubscription,
  hasEnterpriseSubscription,
  hasSmalTeamSubscription,
  summarizeSubscriptions
} from '~/lib/subscriptionHelper';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import * as Sentry from '@sentry/nextjs';
export const subscriptionRouter = createTRPCRouter({
  getUpdateUrl: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }

    const subscription = await ctx.prisma.subscription.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id, OR: [{ provider: 'paddle' }, { provider: 'paddle_v2' }] },
      select: { id: true, provider: true, subscription_id: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return null;
    }

    if (subscription.provider == 'paddle') {
      let retVal = await axios.post(
        (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
          ? 'https://sandbox-vendors.paddle.com/api'
          : 'https://vendors.paddle.com/api') + '/2.0/subscription/users',
        {
          vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
          vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
          subscription_id: Number(subscription.subscription_id)
        }
      );

      return retVal.data.response[0].update_url;
    } else if (subscription.provider == 'paddle_v2') {
      return await PaddleService.getUpdateUrl(subscription.subscription_id);
    }

    return null;
  }),
  getCancleUrl: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }

    const subscription = await ctx.prisma.subscription.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id, OR: [{ provider: 'paddle' }, { provider: 'paddle_v2' }] },
      select: { id: true, provider: true, subscription_id: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return null;
    }

    if (subscription.provider == 'paddle') {
      let retVal = await axios.post(
        (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
          ? 'https://sandbox-vendors.paddle.com/api'
          : 'https://vendors.paddle.com/api') + '/2.0/subscription/users',
        {
          vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
          vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
          subscription_id: Number(subscription.subscription_id)
        }
      );
      return retVal.data.response?.cancel_url;
    } else if (subscription.provider == 'paddle_v2') {
      return await PaddleService.getCancelUrl(subscription.subscription_id);
    }

    return null;
  }),
  payments: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: defaultWorkspaceSelect
    });
    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
      });
    }

    let payments: {
      id: string;
      subscription_id: string;
      amount: number;
      currency: string;
      payout_date: string;
      is_paid: boolean;
      is_one_off_charge: boolean;
      receipt_url: string;
      transaction_id?: string;
    }[] = [];
    for (let index = 0; index < workspace.subscriptions.length; index++) {
      const subscription = workspace.subscriptions[index];

      if (subscription && subscription.provider == 'paddle') {
        let retVal = await axios.post(
          (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
            ? 'https://sandbox-vendors.paddle.com/api'
            : 'https://vendors.paddle.com/api') + '/2.0/subscription/payments',
          {
            vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
            subscription_id: Number(subscription.subscription_id),
            is_paid: 1
          }
        );

        payments.push(...retVal.data.response);
      } else if (subscription && subscription.provider == 'paddle_v2') {
        payments = await PaddleService.getPayments(subscription.customer_user_id);
      }
    }

    const filteredPayments = payments.filter((payment) => payment.payout_date);

    return filteredPayments;
  }),
  editBillingInfo: protectedProcedure
    .input(
      z.object({
        member: z.object({
          email: z.string(),
          name: z.string().nullable()
        }),
        addressParams: z.object({
          country_code: z.string(),
          first_line: z.string().nullable(),
          second_line: z.string().nullable(),
          city: z.string().nullable(),
          postal_code: z.string(),
          region: z.string().nullable()
        }),
        businessParams: z.object({
          name: z.string(),
          tax_identifier: z.string().nullable()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const mainLink =
          process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
            ? 'https://sandbox-api.paddle.com'
            : 'https://api.paddle.com';
        const access_token = process.env.PADDLE_VENDOR_AUTH_CODE;
        const { member, addressParams, businessParams } = input;
        const paddleBillingDetails = await ctx.prisma.paddleBillingDetails.findFirst({
          where: { workspace_id: ctx.current_member.workspace_id },
          orderBy: { createdAt: 'desc' }
        });
        const {
          data: { data: customers }
        } = await axios.get(`${mainLink}/customers?search=${member.email}`, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });

        if (
          paddleBillingDetails &&
          paddleBillingDetails.address_id &&
          paddleBillingDetails.business_id &&
          customers[0]?.id &&
          customers[0]?.id === paddleBillingDetails.customer_id
        ) {
          const {
            data: { data: customer }
          } = await axios.patch(
            `${mainLink}/customers/${paddleBillingDetails.customer_id}`,
            {
              email: member.email,
              name: member.name
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );

          const {
            data: { data: address }
          } = await axios.patch(
            `${mainLink}/customers/${customer.id}/addresses/${paddleBillingDetails.address_id}`,
            {
              country_code: addressParams.country_code,
              first_line: addressParams.first_line,
              second_line: addressParams.second_line,
              city: addressParams.city,
              postal_code: addressParams.postal_code,
              region: addressParams.region
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          const {
            data: { data: business }
          } = await axios.patch(
            `${mainLink}/customers/${customer.id}/businesses/${paddleBillingDetails.business_id}`,
            {
              name: businessParams.name,
              tax_identifier: businessParams.tax_identifier
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          return { customer_id: customer.id, address_id: address.id, business_id: business.id };
        }

        let customer: { id: string } | null = null;
        if (customers.length > 0 && customers[0]) {
          const {
            data: { data: updatedCustomer }
          } = await axios.patch(
            `${mainLink}/customers/${customers[0].id}`,
            {
              email: member.email,
              name: member.name
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          customer = updatedCustomer;
        } else {
          const {
            data: { data: createdCustomer }
          } = await axios.post(
            `${mainLink}/customers`,
            {
              email: member.email,
              name: member.name,
              locale: ctx.current_member.language
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );

          customer = createdCustomer;
        }
        if (!customer) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'error updating the customer'
          });
        }

        const {
          data: { data: adresses }
        } = await axios.get(`${mainLink}/customers/${customer.id}/addresses`, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });

        let address: { id: string } | null = null;
        if (adresses.length > 0 && adresses[0]) {
          const {
            data: { data: updatedAddress }
          } = await axios.patch(
            `${mainLink}/customers/${customer.id}/addresses/${adresses[0].id}`,
            {
              country_code: addressParams.country_code,
              first_line: addressParams.first_line,
              second_line: addressParams.second_line,
              city: addressParams.city,
              postal_code: addressParams.postal_code,
              region: addressParams.region
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          address = updatedAddress;
        } else {
          const {
            data: { data: createdAddress }
          } = await axios.post(
            `${mainLink}/customers/${customer.id}/addresses`,
            {
              country_code: addressParams.country_code,
              first_line: addressParams.first_line,
              second_line: addressParams.second_line,
              city: addressParams.city,
              postal_code: addressParams.postal_code,
              region: addressParams.region
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          address = createdAddress;
        }
        if (!address) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'error updating address'
          });
        }

        const {
          data: { data: businesses }
        } = await axios.get(`${mainLink}/customers/${customer.id}/businesses`, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });

        let business: { id: string } | null = null;
        if (businesses.length > 0 && businesses[0]) {
          const {
            data: { data: updatedBussines }
          } = await axios.patch(
            `${mainLink}/customers/${customer.id}/businesses/${businesses[0].id}`,
            {
              name: businessParams.name,
              tax_identifier: businessParams.tax_identifier
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          business = updatedBussines;
        } else {
          const {
            data: { data: createdBussines }
          } = await axios.post(
            `${mainLink}/customers/${customer.id}/businesses`,
            {
              name: businessParams.name,
              tax_identifier: businessParams.tax_identifier
            },
            {
              headers: {
                Authorization: `Bearer ${access_token}`
              }
            }
          );
          business = createdBussines;
        }
        if (!business) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'error updating business'
          });
        }

        if (paddleBillingDetails?.customer_id === customers[0]?.id) {
          await ctx.prisma.paddleBillingDetails.updateMany({
            where: { customer_id: customers[0]?.id },
            data: {
              address_id: address.id,
              business_id: business.id,
              workspace_id: ctx.current_member.workspace_id
            }
          });
        } else {
          await ctx.prisma.paddleBillingDetails.create({
            data: {
              customer_id: customer.id,
              address_id: address.id,
              business_id: business.id,
              workspace_id: ctx.current_member.workspace_id
            }
          });
        }

        return { customer_id: customer.id, address_id: address.id, business_id: business.id };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${error.response.data.error.errors[0]?.message} in field ${error.response.data.error.errors[0]?.field}`
        });
      }
    }),
  getpaddleBillingDetails: protectedProcedure.query(async ({ ctx }) => {
    const paddleBillingDetails = await ctx.prisma.paddleBillingDetails.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id },
      orderBy: { createdAt: 'desc' }
    });
    return paddleBillingDetails;
  }),
  getpaddleBilingInformation: protectedProcedure.query(async ({ ctx }) => {
    const paddleBillingDetails = await ctx.prisma.paddleBillingDetails.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id },
      orderBy: { createdAt: 'desc' }
    });
    const mainLink =
      process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
    const access_token = process.env.PADDLE_VENDOR_AUTH_CODE;
    if (!paddleBillingDetails) return null;

    const {
      data: { data: member }
    } = await axios.get(`${mainLink}/customers/${paddleBillingDetails.customer_id}`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    const {
      data: { data: addressParams }
    } = await axios.get(
      `${mainLink}/customers/${paddleBillingDetails.customer_id}/addresses/${paddleBillingDetails.address_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    const {
      data: { data: businessParams }
    } = await axios.get(
      `${mainLink}/customers/${paddleBillingDetails.customer_id}/businesses/${paddleBillingDetails.business_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    const PaddleBillingInfo: {
      member: {
        email: string;
        name: string | null;
      };
      addressParams: {
        first_line: string | null;
        second_line: string | null;
        city: string | null;
        postal_code: string | null;
        region: string | null;
        country_code: string;
      };
      businessParams: {
        name: string;
        tax_identifier: string;
      };
    } = { member, addressParams, businessParams };
    return PaddleBillingInfo;
  }),
  subscription_details: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: defaultWorkspaceSelect
    });
    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
      });
    }

    let d: PaddleReturnValue[] = [];
    for (let index = 0; index < workspace.subscriptions.length; index++) {
      const subscription = workspace.subscriptions[index];

      if (subscription && subscription.provider == 'paddle') {
        let retVal = await axios.post(
          (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
            ? 'https://sandbox-vendors.paddle.com/api'
            : 'https://vendors.paddle.com/api') + '/2.0/subscription/users',
          {
            vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE,
            subscription_id: Number(subscription.subscription_id)
          }
        );

        d.push(...retVal.data.response);
      } else if (subscription && subscription.provider == 'paddle_v2') {
        let retVal = await PaddleService.getSubscription(subscription.subscription_id);
        if (
          paddle_business_ids_v1.includes(subscription.subscription_plan_id) ||
          paddle_small_team_ids.includes(subscription.subscription_plan_id) ||
          paddle_business_ids.includes(subscription.subscription_plan_id) ||
          paddle_enterprise_ids.includes(subscription.subscription_plan_id)
        )
          d.push({
            subscription_id: retVal.data.id,
            next_payment: {
              date: retVal.data.next_billed_at,
              amount: 0,
              currency: retVal.data.currency_code
            },
            state: retVal.data.status
          });
      }
    }
    return d;
  }),
  unsubscribe_all: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      //NOTE - useTranslation in backend
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const { id } = input;
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id },
        select: defaultWorkspaceSelect
      });

      if (workspace?.id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      for (let index = 0; index < workspace.subscriptions.length; index++) {
        const subscription = workspace.subscriptions[index];

        if (subscription && subscription.provider == 'paddle') {
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
        } else if (
          subscription &&
          subscription.provider == 'paddle_v2' &&
          (paddle_business_ids_v1.includes(subscription.subscription_plan_id) ||
            paddle_small_team_ids.includes(subscription.subscription_plan_id) ||
            paddle_business_ids.includes(subscription.subscription_plan_id) ||
            paddle_enterprise_ids.includes(subscription.subscription_plan_id))
        ) {
          await PaddleService.cancelSubscription(subscription.subscription_id);
        }
      }
      return workspace;
    }),
  downgrade: protectedProcedure
    .input(
      z.object({
        new_plan: z.enum(['small_team', 'business', 'free'])
      })
    )
    .mutation(async ({ input, ctx }) => {
      //NOTE - useTranslation in backend
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (workspace?.id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const business_subscription_2 = workspace.subscriptions.find((s) => s.provider == 'paddle_v2');
      if (!business_subscription_2) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_subscription_found')
        });
      }

      const departmentCount = await ctx.prisma.department.count({
        where: { workspace_id: ctx.current_member.workspace_id }
      });
      const allowance_types = await ctx.prisma.allowanceType.count({
        where: { workspace_id: ctx.current_member.workspace_id }
      });
      const calendar_syncs = await ctx.prisma.calendarSyncSetting.count({
        where: { workspace_id: ctx.current_member.workspace_id, deleted: false }
      });
      const webhooks = await ctx.prisma.webhookSetting.count({
        where: { workspace_id: ctx.current_member.workspace_id }
      });
      const managerCount = await ctx.prisma.department.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true, members: { where: { manager_type: 'Manager' }, select: { id: true } } }
      });
      const moreThenOneManager = managerCount.find((x) => x.members.length > 1);
      const members = await ctx.prisma.member.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { has_approvers: true }
      });
      const moreThenOneApprover = members.find((x) => x.has_approvers.length > 1);
      if (input.new_plan == 'free') {
        if (
          !hasSmalTeamSubscription(workspace.subscriptions) &&
          !hasBusinessSubscription(workspace.subscriptions) &&
          !hasEnterpriseSubscription(workspace.subscriptions)
        ) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_downgrade')
          });
        }
        if (allowance_types > 1) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_allowance_types', { value: 1 })
          });
        }
        if (departmentCount > 2) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_departments', { value: 2 })
          });
        }
        if (calendar_syncs > 0) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_calendar_syncs', { value: 0 })
          });
        }
        if (webhooks > 0) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_webhooks', { value: 0 })
          });
        }
        if (moreThenOneManager) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_managers')
          });
        }
        if (moreThenOneApprover) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_approvers')
          });
        }

        await PaddleService.cancelSubscription(business_subscription_2.subscription_id);
      } else if (input.new_plan == 'small_team') {
        if (!hasBusinessSubscription(workspace.subscriptions) && !hasEnterpriseSubscription(workspace.subscriptions)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_downgrade')
          });
        }
        if (allowance_types > 1) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_allowance_types', { value: 2 })
          });
        }
        if (departmentCount > 4) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_departments', { value: 4 })
          });
        }
        if (calendar_syncs > 1) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_calendar_syncs', { value: 1 })
          });
        }
        if (webhooks > 0) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_webhooks', { value: 0 })
          });
        }
        if (moreThenOneManager) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_managers')
          });
        }
        if (moreThenOneApprover) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_approvers')
          });
        }

        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.BUSINESS.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.BUSINESS.yearly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.ENTERPRISE.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.ENTERPRISE.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);

          if (e) {
            if (e.price_id == paddle_v2_price_ids.BUSINESS.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.BUSINESS.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + '';
            if (e.price_id == paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.ENTERPRISE.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + '';

            await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
              items: items.filter((x) => x.quantity > 0),
              proration_billing_mode: 'prorated_immediately',
              on_payment_failure: 'apply_change'
            });
          }
        } else {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_downgrade')
          });
        }
      } else if (input.new_plan == 'business') {
        if (!hasEnterpriseSubscription(workspace.subscriptions)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_downgrade')
          });
        }

        if (departmentCount > 8) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_departments', { value: 8 })
          });
        }
        if (allowance_types > 4) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_allowance_types', { value: 1 })
          });
        }
        if (calendar_syncs > 5) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_calendar_syncs', { value: 5 })
          });
        }
        if (webhooks > 3) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_too_many_webhooks', { value: 3 })
          });
        }

        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.ENTERPRISE.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.ENTERPRISE.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);

          if (e) {
            if (e.price_id == paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.BUSINESS.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.ENTERPRISE.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.BUSINESS.yearly_price_id + '';

            await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
              items: items.filter((x) => x.quantity > 0),
              proration_billing_mode: 'prorated_immediately',
              on_payment_failure: 'apply_change'
            });
          }
        } else {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_downgrade')
          });
        }
      }

      return workspace;
    }),
  upgrade: protectedProcedure
    .input(
      z.object({
        new_plan: z.enum(['business', 'enterprise'])
      })
    )
    .mutation(async ({ input, ctx }) => {
      //NOTE - useTranslation in backend
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (workspace?.id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const business_subscription_2 = workspace.subscriptions.find((s) => s.provider == 'paddle_v2');
      if (!business_subscription_2) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_subscription_found')
        });
      }

      if (input.new_plan == 'business') {
        if (!hasSmalTeamSubscription(workspace.subscriptions)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_upgrade')
          });
        }

        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.SMALLTEAM.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.SMALLTEAM.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);

          if (e) {
            if (e.price_id == paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.BUSINESS.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.BUSINESS.yearly_price_id + '';

            await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
              items: items.filter((x) => x.quantity > 0),
              proration_billing_mode: 'prorated_immediately',
              on_payment_failure: 'apply_change'
            });
          }
        } else {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_upgrade')
          });
        }
      } else if (input.new_plan == 'enterprise') {
        if (!hasBusinessSubscription(workspace.subscriptions) && !hasSmalTeamSubscription(workspace.subscriptions)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_upgrade')
          });
        }

        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.BUSINESS.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.BUSINESS.yearly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.SMALLTEAM.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.SMALLTEAM.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);

          if (e) {
            if (e.price_id == paddle_v2_price_ids.BUSINESS.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.BUSINESS.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.ENTERPRISE.yearly_price_id + '';
            if (e.price_id == paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '')
              e.price_id = paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '';
            else if (e.price_id == paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + '')
              e.price_id = paddle_v2_price_ids.ENTERPRISE.yearly_price_id + '';

            await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
              items: items.filter((x) => x.quantity > 0),
              proration_billing_mode: 'prorated_immediately',
              on_payment_failure: 'apply_change'
            });
          }
        } else {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('wrong_plan_upgrade')
          });
        }
      }

      return workspace;
    }),
  change_department_subscription: protectedProcedure
    .input(
      z.object({
        quantity: z.number()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
        });
      }

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const business_subscription = getBusinessV1Subscription(workspace.subscriptions);

      const business_subscription_2 = workspace.subscriptions.find((s) => s.provider == 'paddle_v2');

      if (!business_subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_subscription_found')
        });
      }

      const UNLIMITED_DEPARTMENTS_ADDON = summarizeSubscriptions(workspace.subscriptions).addons.unlimited_departments;
      if (UNLIMITED_DEPARTMENTS_ADDON) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('already_unlimited')
        });
      }

      if (business_subscription_2) {
        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.DEPARTMENT_ADDON.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.DEPARTMENT_ADDON.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);
          if (e) {
            e.quantity = input.quantity;
          } else {
            items.push({
              price_id:
                sub.data.billing_cycle.interval == 'month'
                  ? paddle_v2_price_ids.DEPARTMENT_ADDON.monthly_price_id + ''
                  : paddle_v2_price_ids.DEPARTMENT_ADDON.yearly_price_id + '',
              quantity: input.quantity
            });
          }
        } else {
          items.push({
            price_id:
              sub.data.billing_cycle.interval == 'month'
                ? paddle_v2_price_ids.DEPARTMENT_ADDON.monthly_price_id + ''
                : paddle_v2_price_ids.DEPARTMENT_ADDON.yearly_price_id + '',
            quantity: input.quantity
          });
        }
        await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
          items: items.filter((x) => x.quantity > 0),
          proration_billing_mode: 'prorated_immediately',
          on_payment_failure: 'apply_change'
        });
      } else {
        const department_subscriptions = workspace?.subscriptions
          .filter((s) => s.subscription_plan_id == 'DEPARTMENTS_ADDON')
          .sort((a, b) => {
            a.unpaid = a.unpaid ? a.unpaid : 0;
            b.unpaid = b.unpaid ? b.unpaid : 0;
            return a.unpaid - b.unpaid;
          });

        if (input.quantity == department_subscriptions.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: ctx.t('quantity')
          });
        }
        const plans = await getPaddlePlans();
        let department_recuring_price = await getRecuringPrice(
          ctx.current_member.language,
          plans,
          business_subscription,
          paddle_config.products.DEPARTMENT_ADDON.yearly_plan_id,
          paddle_config.products.DEPARTMENT_ADDON.monthly_plan_id
        );
        let new_modifiers_sum = 0;
        let unpid_sum = 0;
        let one_time_credit_modifiers_sum = 0;

        const restPrice = await getPriceUntilNextPayment(
          ctx.current_member.language,
          plans,
          business_subscription,
          paddle_config.products.DEPARTMENT_ADDON.yearly_plan_id,
          paddle_config.products.DEPARTMENT_ADDON.monthly_plan_id
        );
        if (input.quantity > department_subscriptions.length) {
          for (let index = department_subscriptions.length; index < input.quantity; index++) {
            const options = {
              method: 'POST',
              url:
                (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                  ? 'https://sandbox-vendors.paddle.com/api'
                  : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
              data: {
                vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                subscription_id: parseInt(business_subscription.subscription_id),
                modifier_recurring: true,
                modifier_amount: department_recuring_price,
                modifier_description: ctx.t('departmentADDON')
              }
            };
            const response = await axios.request(options);
            if (response.data.success) {
              await ctx.prisma.subscription.create({
                data: {
                  status: 'active',
                  workspace_id: ctx.current_member.workspace_id,
                  provider: 'absentify',
                  customer_user_id: '',
                  subscription_id: business_subscription.subscription_id,
                  subscription_plan_id: 'DEPARTMENTS_ADDON',
                  currency: business_subscription.currency,
                  quantity: 1,
                  unit_price: department_recuring_price,
                  modifier_id: response.data.response.modifier_id + '',
                  unpaid: restPrice
                },
                select: { id: true }
              });
              new_modifiers_sum += department_recuring_price;
              unpid_sum += restPrice;
            } else {
              Sentry.captureException(response.data);
            }
          }
        } else {
          let currentDepertments = await ctx.prisma.department.count({
            where: { workspace_id: ctx.current_member.workspace_id }
          });
          if (currentDepertments > input.quantity + 4) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: ctx.t('You_have_to_delete_some_departments_first')
            });
          }

          for (let index = department_subscriptions.length; index > input.quantity; index--) {
            const subscription = department_subscriptions[index - 1];
            if (subscription) {
              const options = {
                method: 'POST',
                url:
                  (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                    ? 'https://sandbox-vendors.paddle.com/api'
                    : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/delete',
                data: {
                  vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                  vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                  modifier_id: subscription.modifier_id
                }
              };
              let response = await axios.request(options);
              if (response.data.success && subscription) {
                new_modifiers_sum += department_recuring_price * -1;
                if (!subscription.unpaid || subscription.unpaid == 0) {
                  const restPrice = await getPriceUntilNextPayment(
                    ctx.current_member.language,
                    plans,
                    business_subscription,
                    paddle_config.products.DEPARTMENT_ADDON.yearly_plan_id,
                    paddle_config.products.DEPARTMENT_ADDON.monthly_plan_id
                  );
                  const options = {
                    method: 'POST',
                    url:
                      (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                        ? 'https://sandbox-vendors.paddle.com/api'
                        : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
                    data: {
                      vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                      vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                      subscription_id: parseInt(business_subscription.subscription_id),
                      modifier_recurring: false,
                      modifier_amount: restPrice * -1,
                      modifier_description: ctx.t('departmentADDONCredit')
                    }
                  };
                  await axios.request(options);
                  one_time_credit_modifiers_sum += restPrice;
                }
                await ctx.prisma.subscription.delete({
                  where: { id: subscription.id }
                });
              } else {
                Sentry.captureException(response.data);
              }
            }
          }
        }
      }
      return;
    }),
  requestInvoice: protectedProcedure
    .input(
      z.object({
        transaction_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
        });
      }

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin') //`You are not an admin`
        });
      }

      const subscription = getSubscription(workspace.subscriptions);

      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_subscription_found')
        });
      }
      let transactions = await PaddleService.getPayments(subscription.customer_user_id);
      if (transactions.find((x) => x.transaction_id == input.transaction_id))
        return await PaddleService.getInvoiceUrl(input.transaction_id);
      return null;
    }),
  change_calendar_sync_subscription: protectedProcedure
    .input(
      z.object({
        quantity: z.number()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.current_member.workspace_id },
        select: defaultWorkspaceSelect
      });

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
        });
      }

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin') //`You are not an admin`
        });
      }

      const business_subscription = getBusinessV1Subscription(workspace.subscriptions);

      if (!business_subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('no_subscription_found')
        });
      }
      const business_subscription_2 = workspace.subscriptions.find((s) => s.provider == 'paddle_v2');
      if (business_subscription_2) {
        let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
        let items = sub.data.items.map((y) => {
          return { price_id: y.price.id, quantity: y.quantity };
        });
        const extingSubscription = sub.data.items.find(
          (x) =>
            x.price.product_id == paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_plan_id_v2 + '' ||
            x.price.product_id == paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_plan_id_v2 + ''
        );

        if (extingSubscription) {
          let e = items.find((x) => x.price_id == extingSubscription.price.id);
          if (e) {
            e.quantity = input.quantity;
          } else {
            if (input.quantity > 0)
              items.push({
                price_id:
                  sub.data.billing_cycle.interval == 'month'
                    ? paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_price_id + ''
                    : paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_price_id + '',
                quantity: input.quantity
              });
          }
        } else {
          if (input.quantity > 0)
            items.push({
              price_id:
                sub.data.billing_cycle.interval == 'month'
                  ? paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_price_id + ''
                  : paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_price_id + '',
              quantity: input.quantity
            });
        }
        await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
          items: items.filter((x) => x.quantity > 0),
          proration_billing_mode: 'prorated_immediately',
          on_payment_failure: 'apply_change'
        });
      } else {
        const calendar_sync_subscriptions = workspace?.subscriptions
          .filter((s) => s.subscription_plan_id == 'CALENDAR_SYNC_ADDON')
          .sort((a, b) => {
            a.unpaid = a.unpaid ? a.unpaid : 0;
            b.unpaid = b.unpaid ? b.unpaid : 0;
            return a.unpaid - b.unpaid;
          });

        if (input.quantity == calendar_sync_subscriptions.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: ctx.t('quantity')
          });
        }
        const plans = await getPaddlePlans();
        let recuring_price = await getRecuringPrice(
          ctx.current_member.language,
          plans,
          business_subscription,
          paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_plan_id,
          paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_plan_id
        );

        let new_modifiers_sum = 0;
        let unpid_sum = 0;
        let one_time_credit_modifiers_sum = 0;

        const restPrice = await getPriceUntilNextPayment(
          ctx.current_member.language,
          plans,
          business_subscription,
          paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_plan_id,
          paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_plan_id
        );
        if (input.quantity > calendar_sync_subscriptions.length) {
          for (let index = calendar_sync_subscriptions.length; index < input.quantity; index++) {
            const options = {
              method: 'POST',
              url:
                (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                  ? 'https://sandbox-vendors.paddle.com/api'
                  : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
              data: {
                vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                subscription_id: parseInt(business_subscription.subscription_id),
                modifier_recurring: true,
                modifier_amount: recuring_price,
                modifier_description: ctx.t('calendarSyncADDON')
              }
            };
            const response = await axios.request(options);
            if (response.data.success) {
              await ctx.prisma.subscription.create({
                data: {
                  status: 'active',
                  workspace_id: ctx.current_member.workspace_id,
                  provider: 'absentify',
                  customer_user_id: '',
                  subscription_id: business_subscription.subscription_id,
                  subscription_plan_id: 'CALENDAR_SYNC_ADDON',
                  currency: business_subscription.currency,
                  quantity: 1,
                  unit_price: recuring_price,
                  modifier_id: response.data.response.modifier_id + '',
                  unpaid: restPrice
                },
                select: { id: true }
              });
              new_modifiers_sum += recuring_price;
              unpid_sum += restPrice;
            } else {
              Sentry.captureException(response.data);
            }
          }
        } else {
          let calendarSyncSettings = await ctx.prisma.calendarSyncSetting.count({
            where: { workspace_id: ctx.current_member.workspace_id, deleted: false }
          });
          if (calendarSyncSettings > input.quantity + 1) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: ctx.t('You_have_to_delete_some_calendar_sync_first')
            });
          }

          for (let index = calendar_sync_subscriptions.length; index > input.quantity; index--) {
            const subscription = calendar_sync_subscriptions[index - 1];
            if (subscription) {
              const options = {
                method: 'POST',
                url:
                  (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                    ? 'https://sandbox-vendors.paddle.com/api'
                    : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/delete',
                data: {
                  vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                  vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                  modifier_id: subscription.modifier_id
                }
              };
              let response = await axios.request(options);
              if (response.data.success && subscription) {
                new_modifiers_sum += recuring_price * -1;
                if (!subscription.unpaid || subscription.unpaid == 0) {
                  const restPrice = await getPriceUntilNextPayment(
                    ctx.current_member.language,
                    plans,
                    business_subscription,
                    paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_plan_id,
                    paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_plan_id
                  );
                  const options = {
                    method: 'POST',
                    url:
                      (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                        ? 'https://sandbox-vendors.paddle.com/api'
                        : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
                    data: {
                      vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                      vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                      subscription_id: parseInt(business_subscription.subscription_id),
                      modifier_recurring: false,
                      modifier_amount: restPrice * -1,
                      modifier_description: ctx.t('calendarSyncADDONcredit')
                    }
                  };
                  await axios.request(options);
                  one_time_credit_modifiers_sum += restPrice;
                }
                await ctx.prisma.subscription.delete({
                  where: { id: subscription.id }
                });
              } else {
                Sentry.captureException(response.data);
              }
            }
          }
        }
      }
      return;
    }),
  change_manager_adon_subscription: protectedProcedure.mutation(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: defaultWorkspaceSelect
    });

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('nonExistentWorspace') + ctx.current_member.workspace_id
      });
    }

    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin') //`You are not an admin`
      });
    }

    const business_subscription = getBusinessV1Subscription(workspace.subscriptions);

    if (!business_subscription) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: ctx.t('no_subscription_found')
      });
    }
    const business_subscription_2 = workspace.subscriptions.find((s) => s.provider == 'paddle_v2');

    if (business_subscription_2) {
      let sub = await PaddleService.getSubscription(business_subscription_2.subscription_id);
      let items = sub.data.items.map((y) => {
        return { price_id: y.price.id, quantity: y.quantity };
      });
      const extingSubscription = sub.data.items.find(
        (x) =>
          x.price.product_id == paddle_config.products.MANAGER_ADDON.monthly_plan_id_v2 + '' ||
          x.price.product_id == paddle_config.products.MANAGER_ADDON.yearly_plan_id_v2 + ''
      );

      if (extingSubscription) {
        items = items.filter((x) => x.price_id != extingSubscription.price.id);
      } else {
        items.push({
          price_id:
            sub.data.billing_cycle.interval == 'month'
              ? paddle_v2_price_ids.MANAGER_ADDON.monthly_price_id + ''
              : paddle_v2_price_ids.MANAGER_ADDON.yearly_price_id + '',
          quantity: 1
        });
      }
      await PaddleService.updateSubscription(business_subscription_2.subscription_id, {
        items: items.filter((x) => x.quantity > 0),
        proration_billing_mode: 'prorated_immediately',
        on_payment_failure: 'apply_change'
      });
    } else {
      const manager_addon_subscription = workspace?.subscriptions.find(
        (s) => s.subscription_plan_id == 'MANAGER_ADDON'
      );

      const plans = await getPaddlePlans();
      let recuring_price = await getRecuringPrice(
        ctx.current_member.language,
        plans,
        business_subscription,
        paddle_config.products.MANAGER_ADDON.yearly_plan_id,
        paddle_config.products.MANAGER_ADDON.monthly_plan_id
      );

      let new_modifiers_sum = 0;
      let unpid_sum = 0;
      let one_time_credit_modifiers_sum = 0;

      const restPrice = await getPriceUntilNextPayment(
        ctx.current_member.language,
        plans,
        business_subscription,
        paddle_config.products.MANAGER_ADDON.yearly_plan_id,
        paddle_config.products.MANAGER_ADDON.monthly_plan_id
      );
      if (!manager_addon_subscription) {
        const options = {
          method: 'POST',
          url:
            (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
              ? 'https://sandbox-vendors.paddle.com/api'
              : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
          data: {
            vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
            subscription_id: parseInt(business_subscription.subscription_id),
            modifier_recurring: true,
            modifier_amount: recuring_price,
            modifier_description: ctx.t('managerADDON')
          }
        };
        const response = await axios.request(options);
        if (response.data.success) {
          await ctx.prisma.subscription.create({
            data: {
              status: 'active',
              workspace_id: ctx.current_member.workspace_id,
              provider: 'absentify',
              customer_user_id: '',
              subscription_id: business_subscription.subscription_id,
              subscription_plan_id: 'MANAGER_ADDON',
              currency: business_subscription.currency,
              quantity: 1,
              unit_price: recuring_price,
              modifier_id: response.data.response.modifier_id + '',
              unpaid: restPrice
            },
            select: { id: true }
          });
          new_modifiers_sum += recuring_price;
          unpid_sum += restPrice;
        } else {
          Sentry.captureException({
            vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
            subscription_id: parseInt(business_subscription.subscription_id),
            modifier_recurring: true,
            modifier_amount: recuring_price,
            modifier_description: ctx.t('managerADDON')
          });
          Sentry.captureException(response);
        }
      } else {
        let departments = await ctx.prisma.department.count({
          where: { workspace_id: ctx.current_member.workspace_id }
        });
        let memberDepartments = await ctx.prisma.memberDepartment.count({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            manager_type: 'Manager'
          }
        });
        if (departments > memberDepartments) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: ctx.t('you-still-have-departments-with-several-managers-please-remove-these-managers-first')
          });
        }

        let memberApprovers = await ctx.prisma.memberApprover.count({
          where: { workspace_id: ctx.current_member.workspace_id }
        });
        let member = await ctx.prisma.member.count({
          where: { workspace_id: ctx.current_member.workspace_id }
        });

        if (memberApprovers > member) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: ctx.t('you-still-have-users-with-several-approvers-remove-them-first')
          });
        }

        const options = {
          method: 'POST',
          url:
            (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
              ? 'https://sandbox-vendors.paddle.com/api'
              : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/delete',
          data: {
            vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
            vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
            modifier_id: manager_addon_subscription.modifier_id
          }
        };
        let response = await axios.request(options);
        if (response.data.success) {
          new_modifiers_sum += recuring_price * -1;
          if (!manager_addon_subscription.unpaid || manager_addon_subscription.unpaid == 0) {
            const restPrice = await getPriceUntilNextPayment(
              ctx.current_member.language,
              plans,
              business_subscription,
              paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_plan_id,
              paddle_config.products.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_plan_id
            );
            const options = {
              method: 'POST',
              url:
                (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
                  ? 'https://sandbox-vendors.paddle.com/api'
                  : 'https://vendors.paddle.com/api') + '/2.0/subscription/modifiers/create',
              data: {
                vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
                vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
                subscription_id: parseInt(business_subscription.subscription_id),
                modifier_recurring: false,
                modifier_amount: restPrice * -1,
                modifier_description: ctx.t('managerADDONcredit')
              }
            };
            await axios.request(options);
            one_time_credit_modifiers_sum += restPrice;
          }
          await ctx.prisma.subscription.delete({
            where: { id: manager_addon_subscription.id }
          });
        } else {
          Sentry.captureException(response.data);
        }
      }
    }
    return;
  })
});

interface PaddlePlan {
  id: number;
  name: string;
  billing_type: string;
  billing_period: number;
  initial_price: {
    USD: string;
    EUR: string;
    GBP: string;
    ARS: string;
    AUD: string;
    CAD: string;
    CHF: string;
    CZK: string;
    DKK: string;
    HKD: string;
    HUF: string;
    INR: string;
    ILS: string;
    JPY: string;
    KRW: string;
    MXN: string;
    NOK: string;
    NZD: string;
    PLN: string;
    RUB: string;
    SEK: string;
    SGD: string;
    THB: string;
    TRY: string;
    TWD: string;
    UAH: string;
  };
  recurring_price: {
    USD: string;
    EUR: string;
    GBP: string;
    ARS: string;
    AUD: string;
    CAD: string;
    CHF: string;
    CZK: string;
    DKK: string;
    HKD: string;
    HUF: string;
    INR: string;
    ILS: string;
    JPY: string;
    KRW: string;
    MXN: string;
    NOK: string;
    NZD: string;
    PLN: string;
    RUB: string;
    SEK: string;
    SGD: string;
    THB: string;
    TRY: string;
    TWD: string;
    UAH: string;
  };
  trial_days: number;
}

async function getPriceUntilNextPayment(
  language: string,
  plans: PaddlePlan[],
  business_subscription: {
    subscription_plan_id: string;
    currency: string;
    subscription_id: string;
  },
  yearly_plan_id: number,
  monthly_plan_id: number
) {
  let department_recuring_price = await getRecuringPrice(
    language,
    plans,
    business_subscription,
    yearly_plan_id,
    monthly_plan_id
  );
  const getT = ensureAvailabilityOfGetT();
  const t = await getT(language, 'backend');
  const businessPlan = plans.find((p) => p.id + '' == business_subscription.subscription_plan_id);
  if (!businessPlan) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: t('no_subscription_found')
    });
  }
  const current_subscriptionRetVal = await axios.request({
    method: 'POST',
    url:
      (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
        ? 'https://sandbox-vendors.paddle.com/api'
        : 'https://vendors.paddle.com/api') + '/2.0/subscription/users',
    data: {
      vendor_id: parseInt(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID + ''),
      vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE + '',
      subscription_id: parseInt(business_subscription.subscription_id)
    }
  });
  const next_payment = new Date(current_subscriptionRetVal.data.response[0].next_payment.date);

  var difference = next_payment.getTime() - new Date().getTime();

  var daysLeft = Math.ceil(difference / (1000 * 3600 * 24));
  const pricePerDay = department_recuring_price / (businessPlan.billing_type == 'year' ? 365 : 30);

  let restPrice = pricePerDay * daysLeft;
  if (restPrice > department_recuring_price) restPrice = department_recuring_price;

  return parseFloat(restPrice.toFixed(2));
}

async function getRecuringPrice(
  language: string,
  plans: PaddlePlan[],
  business_subscription: { subscription_plan_id: string; currency: string },
  yearly_plan_id: number,
  monthly_plan_id: number
) {
  const getT = ensureAvailabilityOfGetT();
  const t = await getT(language, 'backend');
  const businessPlan = plans.find((p) => p.id + '' == business_subscription.subscription_plan_id);
  if (!businessPlan) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: t('no_subscription_found')
    });
  }

  const plan = plans.find((p) => p.id == (businessPlan.billing_type == 'year' ? yearly_plan_id : monthly_plan_id));
  if (!plan) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: t('no_subscription_found')
    });
  }

  let recuring_price = '0.0';
  switch (business_subscription.currency) {
    case 'USD':
      recuring_price = plan.recurring_price['USD'];
      break;
    case 'EUR':
      recuring_price = plan.recurring_price['EUR'];
      break;
    case 'GBP':
      recuring_price = plan.recurring_price['GBP'];
      break;
    case 'ARS':
      recuring_price = plan.recurring_price['ARS'];
      break;
    case 'AUD':
      recuring_price = plan.recurring_price['AUD'];
      break;
    case 'CAD':
      recuring_price = plan.recurring_price['CAD'];
      break;
    case 'CHF':
      recuring_price = plan.recurring_price['CHF'];
      break;
    case 'CZK':
      recuring_price = plan.recurring_price['CZK'];
      break;
    case 'DKK':
      recuring_price = plan.recurring_price['DKK'];
      break;
    case 'HKD':
      recuring_price = plan.recurring_price['HKD'];
      break;
    case 'HUF':
      recuring_price = plan.recurring_price['HUF'];
      break;
    case 'INR':
      recuring_price = plan.recurring_price['INR'];
      break;
    case 'ILS':
      recuring_price = plan.recurring_price['ILS'];
      break;
    case 'JPY':
      recuring_price = plan.recurring_price['JPY'];
      break;
    case 'KRW':
      recuring_price = plan.recurring_price['KRW'];
      break;
    case 'MXN':
      recuring_price = plan.recurring_price['MXN'];
      break;
    case 'NOK':
      recuring_price = plan.recurring_price['NOK'];
      break;
    case 'NZD':
      recuring_price = plan.recurring_price['NZD'];
      break;
    case 'PLN':
      recuring_price = plan.recurring_price['PLN'];
      break;
    case 'RUB':
      recuring_price = plan.recurring_price['RUB'];
      break;
    case 'SEK':
      recuring_price = plan.recurring_price['SEK'];
      break;
    case 'SGD':
      recuring_price = plan.recurring_price['SGD'];
      break;
    case 'THB':
      recuring_price = plan.recurring_price['THB'];
      break;
    case 'TRY':
      recuring_price = plan.recurring_price['TRY'];
      break;
    case 'TWD':
      recuring_price = plan.recurring_price['TWD'];
      break;
    case 'UAH':
      recuring_price = plan.recurring_price['UAH'];
      break;
  }
  return parseFloat(recuring_price);
}

async function getPaddlePlans() {
  const plansRetVal = await axios.post(
    (process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true'
      ? 'https://sandbox-vendors.paddle.com/api'
      : 'https://vendors.paddle.com/api') + '/2.0/subscription/plans',
    {
      vendor_id: Number(process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID),
      vendor_auth_code: process.env.PADDLE_VENDOR_AUTH_CODE
    }
  );

  let plans: PaddlePlan[] = plansRetVal.data.response;
  return plans;
}
type PaddleReturnValue = {
  subscription_id: string;
  state: string;
  payment_information?: {
    payment_method: string;
    card_type: 'master' | 'visa' | 'american_express' | 'discover' | 'jcb' | 'maestro' | 'diners_club' | 'unionpay';
    last_four_digits: string;
    expiry_date: string;
  };
  next_payment?: {
    amount: number;
    currency: string;
    date: string;
  };
};
