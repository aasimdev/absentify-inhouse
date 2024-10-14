// Static configuration for Enterprise product IDs
export const paddle_enterprise_ids = [
  '38107', // Development monthly plan ID
  '798296', // Production monthly plan ID
  '38108', // Development yearly plan ID
  '798297', // Production yearly plan ID
  'pro_01he561d2qkksws9png0cbdj0j', // V2 IDs, for both monthly and yearly Development
  'pro_01hha6tbj159771a4xey57saj6' // V2 IDs, for both monthly and yearly Production
];

// Static configuration for Business product IDs
export const paddle_small_team_ids = [
  'pro_01hq0dxywb2aq27528rqktpq0x', // Development V2 monthly and yearly plan ID
  'pro_01hpvxajjgdrcbvv4zg0jynrm9' // Production V2 monthly and yearly plan ID
];
// Static configuration for Business product IDs
export const paddle_business_ids = [
  'pro_01hq0dm4gza10gx94qd19mtfwn', // Development V2 monthly and yearly plan ID
  'pro_01hpvxg25751jtjahsmt67g6qb' // Production V2 monthly and yearly plan ID
];
// Static configuration for Business old product IDs
export const paddle_business_ids_v1 = [
  '30634', // Development monthly plan ID
  '776197', // Production monthly plan ID
  '30648', // Development yearly plan ID
  '776198', // Production yearly plan ID
  'pro_01he55r39vjbsmvy259823jzh8', // Development V2 monthly and yearly plan ID
  'pro_01hd1cbbwya3f6sa9yqh4tfryp' // Production V2 monthly and yearly plan ID
];

// Static configuration for Department Addon product IDs
export const paddle_department_addon_ids = [
  '30635', // Development monthly plan ID
  '776199', // Production monthly plan ID
  '30649', // Development yearly plan ID
  '776200', // Production yearly plan ID
  'pro_01he55xxvzcy8kkqc3449740h0', // V2 IDs, for both monthly and yearly Development
  'pro_01hha6q5scdyn0zqnv3hazz17y', // V2 IDs, for both monthly and yearly Production
  'DEPARTMENTS_ADDON'
];

// Static configuration for Shared Outlook Calendar Sync Addon product IDs
export const paddle_shared_outlook_calendar_sync_addon_ids = [
  '30636', // Development monthly plan ID
  '776201', // Production monthly plan ID
  '30650', // Development yearly plan ID
  '776202', // Production yearly plan ID
  'pro_01he5632ymcx06qty7xsasbs1n', // V2 IDs, for both monthly and yearly Development
  'pro_01hha6f19rds9vr7y2a0kx74pn', // V2 IDs, for both monthly and yearly Production
  'CALENDAR_SYNC_ADDON'
];

// Static configuration for Manager Addon product IDs
export const paddle_manager_addon_ids = [
  '30637', // Development monthly plan ID
  '776203', // Production monthly plan ID
  '30651', // Development yearly plan ID
  '776204', // Production yearly plan ID
  'pro_01he55zqy4h5aysw76akrjps0a', // Development V2 monthly and yearly plan ID
  'pro_01hd1darzx9pnrxkscjv2ga5xp', // Production V2 monthly and yearly plan ID
  'MANAGER_ADDON'
];
type PlanType =
  | 'ENTERPRISE'
  | 'BUSINESS'
  | 'BUSINESS_V1'
  | 'SMALLTEAM'
  | 'DEPARTMENT_ADDON'
  | 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON'
  | 'MANAGER_ADDON'
  | 'REPRESENTATIVE_LOGIC_ADDON'
  | 'UNLIMITED_DEPARTMENTS_ADDON';
export const planIds: { [key: string]: PlanType } = {
  '38107': 'ENTERPRISE',
  '798296': 'ENTERPRISE',
  '38108': 'ENTERPRISE',
  '798297': 'ENTERPRISE',
  pro_01he561d2qkksws9png0cbdj0j: 'ENTERPRISE',
  pro_01hha6tbj159771a4xey57saj6: 'ENTERPRISE',
  pro_01hq0dxywb2aq27528rqktpq0x: 'SMALLTEAM',
  pro_01hpvxajjgdrcbvv4zg0jynrm9: 'SMALLTEAM',
  pro_01hq0dm4gza10gx94qd19mtfwn: 'BUSINESS',
  pro_01hpvxg25751jtjahsmt67g6qb: 'BUSINESS',
  '30634': 'BUSINESS_V1',
  '776197': 'BUSINESS_V1',
  '30648': 'BUSINESS_V1',
  '776198': 'BUSINESS_V1',
  pro_01he55r39vjbsmvy259823jzh8: 'BUSINESS_V1',
  pro_01hd1cbbwya3f6sa9yqh4tfryp: 'BUSINESS_V1',
  '30635': 'DEPARTMENT_ADDON',
  '776199': 'DEPARTMENT_ADDON',
  '30649': 'DEPARTMENT_ADDON',
  '776200': 'DEPARTMENT_ADDON',
  pro_01he55xxvzcy8kkqc3449740h0: 'DEPARTMENT_ADDON',
  pro_01hha6q5scdyn0zqnv3hazz17y: 'DEPARTMENT_ADDON',
  DEPARTMENTS_ADDON: 'DEPARTMENT_ADDON',
  '30636': 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  '776201': 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  '30650': 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  '776202': 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  pro_01he5632ymcx06qty7xsasbs1n: 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  pro_01hha6f19rds9vr7y2a0kx74pn: 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  CALENDAR_SYNC_ADDON: 'SHARED_OUTLOOK_CALENDAR_SYNC_ADDON',
  '30637': 'MANAGER_ADDON',
  '776203': 'MANAGER_ADDON',
  '30651': 'MANAGER_ADDON',
  '776204': 'MANAGER_ADDON',
  pro_01he55zqy4h5aysw76akrjps0a: 'MANAGER_ADDON',
  pro_01hd1darzx9pnrxkscjv2ga5xp: 'MANAGER_ADDON',
  MANAGER_ADDON: 'MANAGER_ADDON'
};

export function getPlanName(subscription_plan_id: string): string {
  const planName = planIds[subscription_plan_id];
  return planName ? planName : 'Unknown plan ID';
}
export const paddle_config = {
  products: {
    ENTERPRISE: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 38107
          : 798296,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 38108
          : 798297,
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he561d2qkksws9png0cbdj0j'
          : 'pro_01hha6tbj159771a4xey57saj6',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he561d2qkksws9png0cbdj0j'
          : 'pro_01hha6tbj159771a4xey57saj6'
    },
    BUSINESS_V1: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30634
          : 776197,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30648
          : 776198,
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55r39vjbsmvy259823jzh8'
          : 'pro_01hd1cbbwya3f6sa9yqh4tfryp',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55r39vjbsmvy259823jzh8'
          : 'pro_01hd1cbbwya3f6sa9yqh4tfryp'
    },
    BUSINESS: {
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01hq0dm4gza10gx94qd19mtfwn'
          : 'pro_01hpvxg25751jtjahsmt67g6qb',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01hq0dm4gza10gx94qd19mtfwn'
          : 'pro_01hpvxg25751jtjahsmt67g6qb'
    },
    SMALLTEAM: {
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01hq0dxywb2aq27528rqktpq0x'
          : 'pro_01hpvxajjgdrcbvv4zg0jynrm9',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01hq0dxywb2aq27528rqktpq0x'
          : 'pro_01hpvxajjgdrcbvv4zg0jynrm9'
    },
    DEPARTMENT_ADDON: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30635
          : 776199,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30649
          : 776200,
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55xxvzcy8kkqc3449740h0'
          : 'pro_01hha6q5scdyn0zqnv3hazz17y',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55xxvzcy8kkqc3449740h0'
          : 'pro_01hha6q5scdyn0zqnv3hazz17y'
    },
    SHARED_OUTLOOK_CALENDAR_SYNC_ADDON: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30636
          : 776201,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30650
          : 776202,
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he5632ymcx06qty7xsasbs1n'
          : 'pro_01hha6f19rds9vr7y2a0kx74pn',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he5632ymcx06qty7xsasbs1n'
          : 'pro_01hha6f19rds9vr7y2a0kx74pn'
    },
    MANAGER_ADDON: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30637
          : 776203,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30651
          : 776204,
      monthly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55zqy4h5aysw76akrjps0a'
          : 'pro_01hd1darzx9pnrxkscjv2ga5xp',
      yearly_plan_id_v2:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'pro_01he55zqy4h5aysw76akrjps0a'
          : 'pro_01hd1darzx9pnrxkscjv2ga5xp'
    },
    REPRESENTATIVE_LOGIC_ADDON: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30638
          : 776205,
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 30652
          : 776206
    },
    UNLIMITED_DEPARTMENTS_ADDON: {
      monthly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'UNLIMITED_DEPARTMENTS_ADDON'
          : 'UNLIMITED_DEPARTMENTS_ADDON',
      yearly_plan_id:
        process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
          ? 'UNLIMITED_DEPARTMENTS_ADDON'
          : 'UNLIMITED_DEPARTMENTS_ADDON'
    }
  }
};

export const paddle_v2_price_ids = {
  ENTERPRISE: {
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he5620g7rkbc1x938py6a8gc'
        : 'pri_01hha6zbs59x5q44hdftygyvzk',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he562hzp44erx1wng6zbxb1w'
        : 'pri_01hha6zxzd767bh235rh94e0pc'
  },
  BUSINESS: {
    monthly_price_id_v1:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he55vp6mwgd3b8daktn64n39'
        : 'pri_01hd1cg9vq05m9c6evjdek0r3w',
    yearly_price_id_v1:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he55x92y9zm6t0dhnjxh2pn6'
        : 'pri_01hd1cd8bx7tskh07jpnzj0r4w',
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01hq0dn70k1swtgfw2sxzphzct'
        : 'pri_01hpvxgv0pa0dgraf38kpm4pv9',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01hq0dp0gbbtf0e0f24ve7cdr4'
        : 'pri_01hpvyx3bmc3xkkkmwxkqrkpsp'
  },
  SMALL_TEAM: {
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01hq0dyh55j0tt4qhxvfnk20kv'
        : 'pri_01hpvxd3rgx2npw9cyd6wm952c',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01hq0dz41p5qstn3t8xd9hz5f6'
        : 'pri_01hpvxeq17dqx250hn2ea2ntm1'
  },
  DEPARTMENT_ADDON: {
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he55yvps1rtg2rrnvq7s7wr3'
        : 'pri_01hha6rh8yp0z3ndpbcya1ccza',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he55zbwq73bpph2n4f068zdg'
        : 'pri_01hha6s18e0ja9cwb9ttd38jwz'
  },
  SHARED_OUTLOOK_CALENDAR_SYNC_ADDON: {
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he563szkxj0hxk4gyj50rrx5'
        : 'pri_01hha6j3q7kw4mk29am6nsztny',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he564bhy7nfpwm0bvw75c9q6'
        : 'pri_01hha6jrzy3bhc4k0yyzwcdk59'
  },
  MANAGER_ADDON: {
    monthly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he5607fbr88ab1jwg58wzd15'
        : 'pri_01hd1dcg1n495hvfmrvwe7jmv8',
    yearly_price_id:
      process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
        ? 'pri_01he560zsac0ers2r5vm46wbbz'
        : 'pri_01hd1dbqwms8tznvqgsq78gnw5'
  }
};
