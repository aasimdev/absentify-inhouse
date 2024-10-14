import { Paddle, PricePreviewResponse } from '@paddle/paddle-js';
import { LineItem } from '@paddle/paddle-js/types/price-preview/price-preview';
import { paddle_v2_price_ids } from '~/helper/paddle_config';

export const getPrice = async (paddleInstance: Paddle | null) => {
  if (!paddleInstance) return;

  let ip = await fetch('https://api.ipify.org?format=json');

  if (!ip.ok) return;

  let ipAddress = await ip.json();

  const prices = await paddleInstance.PricePreview({
    items: [
      {
        priceId: paddle_v2_price_ids.BUSINESS.monthly_price_id_v1,
        quantity: 1
      },
      { priceId: paddle_v2_price_ids.BUSINESS.yearly_price_id_v1, quantity: 1 },
      {
        priceId: paddle_v2_price_ids.BUSINESS.monthly_price_id,
        quantity: 1
      },
      { priceId: paddle_v2_price_ids.BUSINESS.yearly_price_id, quantity: 1 },
      {
        priceId: paddle_v2_price_ids.SMALL_TEAM.monthly_price_id,
        quantity: 1
      },
      { priceId: paddle_v2_price_ids.SMALL_TEAM.yearly_price_id, quantity: 1 },
      {
        priceId: paddle_v2_price_ids.ENTERPRISE.monthly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.ENTERPRISE.yearly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.DEPARTMENT_ADDON.monthly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.MANAGER_ADDON.monthly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.DEPARTMENT_ADDON.yearly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_price_id,
        quantity: 1
      },
      {
        priceId: paddle_v2_price_ids.MANAGER_ADDON.yearly_price_id,
        quantity: 1
      }
    ],
    customerIpAddress: ipAddress.ip
  });

  return prices;
};

export const getPriceByName = (
  prices: PricePreviewResponse | undefined,
  yearly: boolean,
  name:
    | 'FREE'
    | 'ENTERPRISE'
    | 'BUSINESS'
    | 'SMALL_TEAM'
    | 'BUSINESS_V1'
    | 'DEPARTMENT_ADDON'
    | 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON'
    | 'MANAGER_ADDON'
) => {
  if (!prices) return;

  if (name == 'FREE') {
    let x = prices.data.details.lineItems.find(
      (price) => price.price.id == paddle_v2_price_ids.ENTERPRISE.yearly_price_id
    );
    if (!x) return;

    let z = JSON.parse(JSON.stringify(x)) as LineItem;

    z.formattedTotals.subtotal = z.formattedTotals.discount;
    z.formattedTotals.total = z.formattedTotals.discount;
    z.unitTotals.subtotal = z.unitTotals.discount;
    z.unitTotals.total = z.unitTotals.discount;
    z.totals.subtotal = z.totals.discount;
    return z;
  }

  if (yearly) {
    if (name == 'ENTERPRISE') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.ENTERPRISE.yearly_price_id
      );
    } else if (name == 'BUSINESS') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.BUSINESS.yearly_price_id
      );
    } else if (name == 'SMALL_TEAM') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.SMALL_TEAM.yearly_price_id
      );
    } else if (name == 'BUSINESS_V1') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.BUSINESS.yearly_price_id_v1
      );
    } else if (name == 'DEPARTMENT_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.DEPARTMENT_ADDON.yearly_price_id
      );
    } else if (name == 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.yearly_price_id
      );
    } else if (name == 'MANAGER_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.MANAGER_ADDON.yearly_price_id
      );
    }
  } else {
    if (name == 'ENTERPRISE') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.ENTERPRISE.monthly_price_id
      );
    } else if (name == 'BUSINESS') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.BUSINESS.monthly_price_id
      );
    } else if (name == 'SMALL_TEAM') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.SMALL_TEAM.monthly_price_id
      );
    } else if (name == 'BUSINESS_V1') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.BUSINESS.monthly_price_id_v1
      );
    } else if (name == 'DEPARTMENT_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.DEPARTMENT_ADDON.monthly_price_id
      );
    } else if (name == 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.SHARED_OUTLOOK_CALENDAR_SYNC_ADDON.monthly_price_id
      );
    } else if (name == 'MANAGER_ADDON') {
      return prices.data.details.lineItems.find(
        (price) => price.price.id == paddle_v2_price_ids.MANAGER_ADDON.monthly_price_id
      );
    }
  }
};
