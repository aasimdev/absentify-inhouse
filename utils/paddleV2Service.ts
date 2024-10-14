import { AxiosResponse } from 'axios';
import { HttpClient } from './http-client';
import { paddle_v2_price_ids } from '~/helper/paddle_config';

interface UpdateSubscriptionData {
  proration_billing_mode:
    | 'prorated_immediately'
    | 'prorated_next_billing_period'
    | 'full_immediately'
    | 'full_next_billing_period'
    | 'do_not_bill';
  items: { price_id: string; quantity?: number }[];
  on_payment_failure: 'prevent_change' | 'apply_change';
}

interface PaddleApiResponse {
  data: PaddleProduct[];
  meta?: MetaData;
}
export interface PaddleProduct {
  id: string;
  name: string;
  tax_category: string;
  description: string;
  image_url: string;
  custom_data: CustomData;
  status: string;
  created_at: string;
  prices: Price[];
}

export interface PreviewData {
  data: {
    status: string;
    collection_mode: "automatic" | "manual";
    currency_code: string;
    immediate_transaction: {
      totals: {
        total: number;
        currency_code: string;
      };
    };
    update_summary: {
      result: {
        action: 'credit' | 'charge';
        amount: number;
        currency_code: string;
      };
    };
  };
}

interface SubscriptionItem {
  id: number;
  subscriptionId: string;
  quantity: number;
  status: string;
  nextBilledAt?: Date;
  previouslyBilledAt?: Date;
  priceId: string;
  productId: string;
  unitPrice: number;
  billingCycleInterval: string;
  billingCycleFrequency: number;
  createdAt?: Date;
  updatedAt?: Date;
}
interface PaddleSubscription {
  id: number;
  subscriptionId: string;
  workspaceId: string;
  customerId: string;
  status: string;
  startedAt?: Date;
  pausedAt?: Date | null;
  canceledAt?: Date | null;
  firstBilledAt?: Date;
  nextBilledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  currentBillingStartsAt?: Date;
  currentBillingEndsAt?: Date;
  cancelationEffectiveDate?: Date | null;
  currencyCode: string;
  subscriptionItems?: SubscriptionItem[];
}

interface CustomData {
  description: string;
  order: string;
  title: string;
  type: string;
  purchaseMultiple?: string;
  modalTitle: string;
  modalDescription: string;
}
interface Price {
  id: string;
  product_id: string;
  description: string;
  name: string | null;
  billing_cycle: {
    interval: string;
    frequency: number;
  };
  trial_period: null | any;
  tax_mode: string;
  unit_price: {
    amount: string;
    currency_code: string;
  };
  unit_price_overrides: any[];
  custom_data: null | any;
  status: string;
  quantity: {
    minimum: number;
    maximum: number;
  };
}

interface MetaData {
  request_id: string;
  pagination: {
    per_page: number;
    next: string;
    has_more: boolean;
    estimated_total: number;
  };
}
interface FormattedData {
  subscriptions: FormattedPaddleProduct[];
  addons: FormattedPaddleProduct[];
}

interface FormattedPaddleProduct {
  id: string;
  name: string;
  tax_category: string;
  description: string;
  image_url: string;
  custom_data: CustomData;
  status: string;
  created_at: string;
  prices: Price[];
}
interface FormattedUnitTotalsResponse {
  data: {
    details: {
      line_items: LineItem[];
    };
  };
  meta: {
    request_id: string;
  };
}

export interface LineItem {
  price: {
    id: string;
  };
  unit_totals: {
    total: string;
  };
  formatted_totals: {
    total: string;
  };
  totals: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
  };
  product: {
    id: string;
    custom_data: {
      type: string;
    };
  };
}

interface BillingCycle {
  frequency: number;
  interval: string;
}

interface Price {
  id: string;
  product_id: string;
  description: string;
  tax_mode: string;
  billing_cycle: BillingCycle;
  trial_period: null | any;
  unit_price: {
    amount: string;
    currency_code: string;
  };
}

interface SubscriptionItem1 {
  status: string;
  quantity: number;
  recurring: boolean;
  created_at: string;
  updated_at: string;
  previously_billed_at: string;
  next_billed_at: string;
  trial_dates: null | any;
  price: Price;
  billing_cycle: BillingCycle;
}

interface BillingPeriod {
  starts_at: string;
  ends_at: string;
}

interface CustomData {
  rewardful: string;
  workspace_id: string;
}

interface ManagementUrls {
  update_payment_method: string;
  cancel: string;
}

interface SubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  address_id: string;
  business_id: null | string;
  currency_code: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  first_billed_at: string;
  next_billed_at: string;
  paused_at: null | string;
  canceled_at: null | string;
  collection_mode: string;
  billing_details: null | any;
  current_billing_period: BillingPeriod;
  billing_cycle: BillingCycle;
  scheduled_change: null | any;
  items: SubscriptionItem1[];
  custom_data: CustomData;
  management_urls: ManagementUrls;
  discount: null | any;
}

interface SubscriptionResponse {
  data: SubscriptionData;
  meta: {
    request_id: string;
  };
}

export class PaddleService {
  private static readonly baseUrl: string =
    process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
  private static readonly apiKey: string = process.env.PADDLE_VENDOR_AUTH_CODE || '';

  private static async sendAuthorizedRequest<T>(url: string, method: string, data?: any): Promise<AxiosResponse<T>> {
    const headers = {
      Authorization: `Bearer ${PaddleService.apiKey}`
    };

    if (method === 'GET') {
      console.log(`${PaddleService.baseUrl}${url}`);
      return HttpClient.get(`${PaddleService.baseUrl}${url}`, headers);
    } else if (method === 'POST') {
      return HttpClient.post(`${PaddleService.baseUrl}${url}`, data, headers);
    } else if (method === 'PATCH') {
      return HttpClient.patch(`${PaddleService.baseUrl}${url}`, data, headers);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
  }

  static async updateSubscription(subscriptionId: string, body: UpdateSubscriptionData): Promise<PaddleProduct> {
    const response = await PaddleService.sendAuthorizedRequest<PaddleProduct>(
      `/subscriptions/${subscriptionId}`,
      'PATCH',
      body
    );
    return response.data;
  }
  static async previewUpdateSubscription(subscriptionId: string, body: UpdateSubscriptionData): Promise<PreviewData> {
    const response = await PaddleService.sendAuthorizedRequest<PreviewData>(
      `/subscriptions/${subscriptionId}/preview`,
      'PATCH',
      body
    );
    return response.data;
  }

  static async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    const response = await PaddleService.sendAuthorizedRequest<SubscriptionResponse>(
      `/subscriptions/${subscriptionId}`,
      'GET'
    );
    return response.data;
  }

  static async getProducts(): Promise<PaddleApiResponse> {
    const response = await PaddleService.sendAuthorizedRequest<PaddleApiResponse>(
      `/products?include=prices&status=active`,
      'GET'
    );
    return response.data;
  }

  static async getPricingPreview(
    items: { price_id: string; quantity: number }[],
    customerIPAddress: string
  ): Promise<FormattedUnitTotalsResponse> {
    const response = await PaddleService.sendAuthorizedRequest<FormattedUnitTotalsResponse>(
      `/pricing-preview`,
      'POST',
      {
        items,
        customer_ip_address: customerIPAddress
      }
    );
    return response.data;
  }

  static async cancelSubscription(subscriptionId: string): Promise<PaddleProduct> {
    const response = await PaddleService.sendAuthorizedRequest<PaddleProduct>(
      `/subscriptions/${subscriptionId}/cancel`,
      'POST',
      {
        effective_from: 'next_billing_period'
      }
    );
    return response.data;
  }

  static async getUpdateUrl(subscriptionId: string): Promise<string | null> {
    const response = await PaddleService.sendAuthorizedRequest<{
      data: {
        management_urls: { update_payment_method: string; cancel: string };
      };
    }>(`/subscriptions/${subscriptionId}`, 'GET');
    if (response.data.data.management_urls) return response.data.data.management_urls.update_payment_method;
    return null;
  }

  static async getCancelUrl(subscriptionId: string): Promise<string | null> {
    const response = await PaddleService.sendAuthorizedRequest<{
      data: {
        management_urls: { update_payment_method: string; cancel: string };
      };
    }>(`/subscriptions/${subscriptionId}`, 'GET');
    if (response.data.data.management_urls) return response.data.data.management_urls.cancel;
    return null;
  }

  static async getInvoiceUrl(transaction_id: string): Promise<string> {
    return (
      await PaddleService.sendAuthorizedRequest<{
        data: { url: string };
      }>(`/transactions/${transaction_id}/invoice`, 'GET')
    ).data.data.url;
  }

  static async getPayments(customer_id: string): Promise<
    {
      id: string;
      subscription_id: string;
      amount: number;
      currency: string;
      payout_date: string;
      is_paid: boolean;
      is_one_off_charge: boolean;
      receipt_url: string;
      transaction_id: string;
    }[]
  > {
    const response = await PaddleService.sendAuthorizedRequest<{
      data: {
        id: string;
        currency_code: string;
        subscription_id: string;
        billed_at: string;
        details: { totals: { total: number } };
      }[];
    }>(`/transactions?customer_id=${customer_id}`, 'GET');

    let d: {
      id: string;
      subscription_id: string;
      amount: number;
      currency: string;
      payout_date: string;
      is_paid: boolean;
      is_one_off_charge: boolean;
      receipt_url: string;
      transaction_id: string;
    }[] = [];

    for (let index = 0; index < response.data.data.length; index++) {
      const element = response.data.data[index];
      if (!element) continue;
      d.push({
        amount: element.details.totals.total / 100,
        currency: element.currency_code,
        id: element.id,
        is_one_off_charge: false,
        is_paid: true,
        payout_date: element.billed_at,
        receipt_url: 'request',
        subscription_id: element.subscription_id,
        transaction_id: element.id
      });
    }

    return d;
  }

  static async updatPrices(): Promise<null> {
    let list = [
      {
        price_id: paddle_v2_price_ids.BUSINESS.monthly_price_id_v1,
        price: 25
      },
      {
        price_id: paddle_v2_price_ids.BUSINESS.yearly_price_id_v1,
        price: 264
      },
      {
        price_id: paddle_v2_price_ids.BUSINESS.monthly_price_id,
        price: 1.7
      },
      {
        price_id: paddle_v2_price_ids.BUSINESS.yearly_price_id,
        price: 14.28
      },

      {
        price_id: paddle_v2_price_ids.SMALL_TEAM.yearly_price_id,
        price: 6.3
      },
      {
        price_id: paddle_v2_price_ids.SMALL_TEAM.monthly_price_id,
        price: 0.75
      },
      {
        price_id: paddle_v2_price_ids.ENTERPRISE.monthly_price_id,
        price: 3
      },
      {
        price_id: paddle_v2_price_ids.ENTERPRISE.yearly_price_id,
        price: 30
      },
      {
        price_id: paddle_v2_price_ids.DEPARTMENT_ADDON.monthly_price_id,
        price: 10
      },
      {
        price_id: paddle_v2_price_ids.DEPARTMENT_ADDON.yearly_price_id,
        price: 108
      },
      {
        price_id: paddle_v2_price_ids.MANAGER_ADDON.monthly_price_id,
        price: 25
      },
      {
        price_id: paddle_v2_price_ids.MANAGER_ADDON.yearly_price_id,
        price: 264
      },
      {
        price_id: paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_price_id,
        price: 5
      },
      {
        price_id: paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_price_id,
        price: 54
      }
    ];
    for (let index = 0; index < list.length; index++) {
      const element = list[index];
      if (!element) continue;
      const response = await PaddleService.sendAuthorizedRequest<{ data: { unit_price: { amount: number } } }>(
        `/prices/${element.price_id}`,
        'GET'
      );
      element.price = response.data.data.unit_price.amount;
    }

    for (let index = 0; index < list.length; index++) {
      const element = list[index];
      if (!element) continue;
      let pricing = {
        AUD: 37,
        CAD: 33,
        NOK: 250,
        CHF: 30,
        GBP: 25,
        EUR: 25
      };

      if (element.price == 2500) {
        pricing = {
          AUD: 37,
          CAD: 33,
          NOK: 250,
          CHF: 30,
          GBP: 25,
          EUR: 25
        };
      } else if (element.price == 3000) {
        pricing = {
          AUD: 48,
          CAD: 42,
          NOK: 320,
          CHF: 36,
          GBP: 30,
          EUR: 30
        };
      } else if (element.price == 300) {
        pricing = {
          AUD: 5,
          CAD: 4.5,
          NOK: 35,
          CHF: 3.5,
          GBP: 3,
          EUR: 3
        };
      } else if (element.price == 75) {
        pricing = { AUD: 1.25, CAD: 1.15, NOK: 8.75, CHF: 1, GBP: 0.75, EUR: 0.75 };
      } else if (element.price == 170) {
        pricing = { AUD: 2.8, CAD: 2.55, NOK: 20, CHF: 2, GBP: 1.7, EUR: 1.7 };
      } else if (element.price == 630) {
        pricing = { AUD: 10.5, CAD: 9.66, NOK: 73.5, CHF: 8.4, GBP: 6.3, EUR: 6.3 };
      } else if (element.price == 1428) {
        pricing = { AUD: 23.5, CAD: 21.42, NOK: 168, CHF: 16.8, GBP: 14.28, EUR: 14.28 };
      } else if (element.price == 26400) {
        pricing = {
          AUD: 396,
          CAD: 360,
          NOK: 2700,
          CHF: 312,
          GBP: 264,
          EUR: 264
        };
      } else if (element.price == 5400) {
        pricing = {
          AUD: 82,
          CAD: 72,
          NOK: 600,
          CHF: 54,
          GBP: 54,
          EUR: 54
        };
      } else if (element.price == 500) {
        pricing = {
          AUD: 8,
          CAD: 7,
          NOK: 55,
          CHF: 5,
          GBP: 5,
          EUR: 5
        };
      } else if (element.price == 10800) {
        pricing = {
          AUD: 165,
          CAD: 145,
          NOK: 1192,
          CHF: 156,
          GBP: 108,
          EUR: 108
        };
      } else if (element.price == 1000) {
        pricing = {
          AUD: 15,
          CAD: 13,
          NOK: 110,
          CHF: 15,
          GBP: 10,
          EUR: 10
        };
      }

      await PaddleService.sendAuthorizedRequest<PaddleProduct>(`/prices/${element.price_id}`, 'PATCH', {
        unit_price_overrides: [
          {
            country_codes: ['AU'],
            unit_price: {
              amount: pricing.AUD * 100 + '',
              currency_code: 'AUD'
            }
          },
          {
            country_codes: ['CA'],
            unit_price: {
              amount: Math.round(pricing.CAD * 100) + '',
              currency_code: 'CAD'
            }
          },
          {
            country_codes: ['NO'],
            unit_price: {
              amount: pricing.NOK * 100 + '',
              currency_code: 'NOK'
            }
          },
          {
            country_codes: ['CH'],
            unit_price: {
              amount: pricing.CHF * 100 + '',
              currency_code: 'CHF'
            }
          },
          {
            country_codes: ['GB'],
            unit_price: {
              amount: pricing.GBP * 100 + '',
              currency_code: 'GBP'
            }
          },
          {
            country_codes: [
              'AT',
              'BE',
              'CY',
              'EE',
              'FI',
              'FR',
              'DE',
              'GR',
              'IE',
              'IT',
              'LV',
              'LT',
              'LU',
              'MT',
              'NL',
              'PT',
              'SK',
              'SI',
              'ES',
              'HR'
            ],
            unit_price: {
              amount: pricing.EUR * 100 + '',
              currency_code: 'EUR'
            }
          }
        ]
      });
    }

    return null;
  }
}
