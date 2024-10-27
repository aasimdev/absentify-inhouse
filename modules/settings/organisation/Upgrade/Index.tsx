import { Switch } from '@headlessui/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { currencies } from '../../../../helper/common-currency';
import { classNames } from 'lib/classNames';
import { NextPage } from 'next';
import useTranslation from 'next-translate/useTranslation';
import { useState, useEffect } from 'react';
import { paddle_v2_price_ids } from 'helper/paddle_config';
import { api } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import { format } from 'date-fns';
import Button from './Button';
import Plan from './Plan';
import Addon from './AddOn';
import { SubscriptionStatus as PrismaSubscriptionStatus } from '@prisma/client';
import { notifyError, notifySuccess } from '~/helper/notify';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import MyForm2 from '../ContactSalesModal';
import Loader from '@components/calendar/Loader';
import AlertModal from '@components/alertModal';
import { getPrice, getPriceByName } from '~/lib/getPrice';
import { PricePreviewResponse } from '@paddle/paddle-js';
import ConfirmModal from '@components/confirmModal';
import BillingInfoModal from './UpgradeModal/BillingInfoModal';
import UpdateBillingInfoModal from './UpgradeModal/UpdateBillingInfoModal';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { Features } from './Features';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { useDarkSide } from '@components/ThemeContext';
const Upgrade: NextPage = () => {
  const { t } = useTranslation('upgrade');
  const [visible, setVisible] = useState(false);
  const [billingInfoVisible, setBillingInfoVisible] = useState(false);
  const [updateBillingInfoModalVisible, setUpdateBillingInfoModalVisible] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<'smallTeamPlan' | 'enterprisePlan' | 'businessPlan' | null>(null);
  const { current_member, subscription, in_teams, paddleInstance, in_sharePoint } = useAbsentify();
  const downgrade = api.subscription.downgrade.useMutation();
  const upgrade = api.subscription.upgrade.useMutation();
  const [toggleEnabled, settoggleEnabled] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState(false);
  const router = useRouter();
  const { data: workspace, refetch: refetchWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });

  const { data: membersCount } = api.member.count.useQuery(
    { status: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
    {
      staleTime: 60000
    }
  );
  const { data: paddleBillingDetails } = api.subscription.getpaddleBillingDetails.useQuery(undefined, {
    staleTime: 60000
  });

  const [downgradeButton, setDownGradeButton] = useState<'small_team' | 'business' | 'free' | null>();
  const [upgradeButton, setUpgradeButton] = useState<'business' | 'enterprise' | null>();
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    freePlan: {
      status:
        | PrismaSubscriptionStatus
        | 'canceled'
        | 'upgrade'
        | 'cancellation_effective_date'
        | 'downgrade'
        | 'contactSales';
    };
    smallTeamPlan: {
      status:
        | PrismaSubscriptionStatus
        | 'canceled'
        | 'upgrade'
        | 'cancellation_effective_date'
        | 'downgrade'
        | 'contactSales';
    };
    businessPlan: {
      status:
        | PrismaSubscriptionStatus
        | 'canceled'
        | 'downgrade'
        | 'upgrade'
        | 'cancellation_effective_date'
        | 'contactSales';
    };
    enterprisePlan: {
      status: PrismaSubscriptionStatus | 'canceled' | 'upgrade' | 'cancellation_effective_date' | 'contactSales';
    };
    unlimitedDepartmentsAddon: boolean;
  }>({
    freePlan: { status: 'upgrade' },
    smallTeamPlan: { status: 'upgrade' },
    businessPlan: { status: 'upgrade' },
    enterprisePlan: { status: 'upgrade' },
    unlimitedDepartmentsAddon: false
  });
  const features = Features();
  const TooltipContent = (props: { content: JSX.Element; className: string; id: string; text: string }) => {
    return (
      <>
        <span
          className={props.className}
          data-tooltip-id={props.id}
          data-tooltip-content={props.text}
          data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
        >
          {props.content}
        </span>
        <ReactTooltip
          id={props.id}
          place="top"
          className="shadow z-50"
          classNameArrow="shadow-sm"
          opacity={1}
          style={{ width: '360px' }}
        />
      </>
    );
  };

  useEffect(() => {
    if (!workspace) return;
    if (workspace.old_pricing) {
      router.push('/settings/organisation/upgrade/v1');
    }

    if (
      subscription.business == false &&
      subscription.small_team == 0 &&
      subscription.business_by_user == 0 &&
      subscription.enterprise == 0
    ) {
      setSubscriptionStatus({
        freePlan: { status: 'upgrade' },
        smallTeamPlan: { status: 'upgrade' },
        businessPlan: { status: 'upgrade' },
        enterprisePlan: {
          status: 'upgrade'
        },
        unlimitedDepartmentsAddon: false
      });
      return;
    }

    if (subscription.small_team > 0) {
      setSubscriptionStatus({
        freePlan: { status: subscription.status == 'deleted' ? 'cancellation_effective_date' : 'downgrade' },
        smallTeamPlan: { status: subscription.status ?? 'upgrade' },
        businessPlan: { status: subscription.status == 'deleted' ? 'contactSales' : 'upgrade' },
        enterprisePlan: { status: subscription.status == 'deleted' ? 'contactSales' : 'upgrade' },
        unlimitedDepartmentsAddon: subscription.addons.unlimited_departments ? true : false
      });
      return;
    }

    if (subscription.business_by_user > 0) {
      setSubscriptionStatus({
        freePlan: { status: subscription.status == 'deleted' ? 'cancellation_effective_date' : 'downgrade' },
        smallTeamPlan: {
          status: subscription.status == 'deleted' ? 'contactSales' : 'downgrade'
        },
        businessPlan: { status: subscription.status ?? 'upgrade' },
        enterprisePlan: { status: subscription.status == 'deleted' ? 'contactSales' : 'upgrade' },
        unlimitedDepartmentsAddon: subscription.addons.unlimited_departments ? true : false
      });
      return;
    }

    if (subscription.enterprise > 0) {
      setSubscriptionStatus({
        freePlan: { status: subscription.status == 'deleted' ? 'cancellation_effective_date' : 'downgrade' },
        smallTeamPlan: {
          status: subscription.status == 'deleted' ? 'contactSales' : 'downgrade'
        },
        businessPlan: {
          status: subscription.status == 'deleted' ? 'contactSales' : 'downgrade'
        },
        enterprisePlan: {
          status: subscription.status ?? 'contactSales'
        },
        unlimitedDepartmentsAddon: false
      });
      return;
    }
  }, [workspace, subscription]);

  const { data: paddlePrices }: UseQueryResult<PricePreviewResponse, Error> = useQuery(
    ['getPaddlePrices'],
    () => getPrice(paddleInstance),
    { staleTime: 300000, enabled: paddleInstance != null }
  );

  const Spacer: React.FC<{ width: string }> = (props) => {
    return <hr className={`${props.width} flex my-5 dark:border-gray-500`}></hr>;
  };

  const paddleCheckout = (plan: 'smallTeamPlan' | 'enterprisePlan' | 'businessPlan') => {
    if (!workspace) return;
    if (!paddleInstance) return;
    if (!current_member) return;
    if (!membersCount) return;
    if (!current_member.email) return;
    if (in_teams || in_sharePoint) {
      if (typeof umami !== 'undefined') {
        if (plan == 'enterprisePlan') {
          umami.track('Subscribe_Enterprise_In_Teams_Open_App');
        } else {
          umami.track('Subscribe_Business_In_Teams_Open_App');
        }
      }
      setShowAlert(true);
      return;
    }

    const referral = window.Rewardful && window.Rewardful.referral;

    if (typeof umami !== 'undefined') {
      if (plan == 'enterprisePlan') {
        umami.track('Subscribe_Enterprise_In_Teams_Open_App');
      } else {
        umami.track('Subscribe_Business_In_Teams_Open_App');
      }
    }

    let customer: { email: string } | { id: string; address: { id: string }; business: { id: string } } = {
      email: current_member.email
    };
    if (
      paddleBillingDetails &&
      paddleBillingDetails.address_id &&
      paddleBillingDetails.business_id &&
      subscription.provider === 'paddle_v2'
    ) {
      customer = {
        id: paddleBillingDetails.customer_id,
        address: {
          id: paddleBillingDetails.address_id
        },
        business: {
          id: paddleBillingDetails.business_id
        }
      };
    }

    let items = [
      {
        priceId: toggleEnabled
          ? paddle_v2_price_ids.ENTERPRISE.yearly_price_id + ''
          : paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '',
        quantity: membersCount
      }
    ];
    if (plan == 'smallTeamPlan') {
      items = [
        {
          priceId: toggleEnabled
            ? paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + ''
            : paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '',
          quantity: membersCount
        }
      ];
    } else if (plan == 'businessPlan') {
      items = [
        {
          priceId: toggleEnabled
            ? paddle_v2_price_ids.BUSINESS.yearly_price_id + ''
            : paddle_v2_price_ids.BUSINESS.monthly_price_id + '',
          quantity: membersCount
        }
      ];
    }

    paddleInstance.Checkout.open({
      items,
      settings: { showAddTaxId: true, locale: current_member.language, allowLogout: false },
      customer,
      customData: {
        workspace_id: workspace.id,
        rewardful: JSON.stringify({ referral: referral })
      }
    });
  };

  const getBusinessButton = () => {
    if (!workspace || !current_member)
      return (
        <div className="-ml-1 mr-3">
          <Loader />
        </div>
      );
    if (subscriptionStatus.businessPlan.status === 'contactSales') {
      return (
        <Button
          disabled={false}
          onClick={() => {
            setVisible(true);
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_300 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:focus:ring-teams_brand_dark_300 dark:border-teams_brand_dark_300"
        >
          {t('contactSales')}
        </Button>
      );
    }
    if (subscriptionStatus.businessPlan.status === 'paused')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_300"
          >
            {t('paused')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_subscription_has_been_paused')}
          />
        </div>
      );
    if (subscriptionStatus.businessPlan.status === 'upgrade')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
            onClick={() => {
              if (!subscription.status) {
                setBillingInfoVisible(true);
                setUpgradeInfo('businessPlan');
                return;
              }

              setUpgradeButton('business');
            }}
          >
            {t('upgrade')}
          </Button>
        </div>
      );
    if (subscriptionStatus.businessPlan.status === 'downgrade')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg  hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
            onClick={() => {
              setDownGradeButton('business');
            }}
          >
            {t('downgrade')}
          </Button>
        </div>
      );
    if (subscriptionStatus.businessPlan.status === 'past_due')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('past_due')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_payment_is_overdue')}
          />
        </div>
      );
    if (subscriptionStatus.businessPlan.status === 'active' || subscriptionStatus.businessPlan.status === 'trialing')
      return (
        <Button
          disabled={false}
          className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
        >
          {t('currentplan')}
        </Button>
      );
    if (subscriptionStatus.businessPlan.status == 'deleted' && subscription?.cancellation_effective_date)
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
          >
            {t('currentplan')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('back_to_free_plan_tooltip', {
              date: format(subscription.cancellation_effective_date, current_member?.date_format)
            })}
          />
        </div>
      );

    return (
      <>
        <Button
          disabled={false}
          onClick={() => {
            setBillingInfoVisible(true);
            setUpgradeInfo('businessPlan');
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
        >
          {t('upgrade')}
        </Button>
      </>
    );
  };
  const getFreeButton = () => {
    if (!workspace)
      return (
        <div className="-ml-1 mr-3">
          <Loader />
        </div>
      );
    if (!current_member)
      return (
        <div className="-ml-1 mr-3">
          <Loader />
        </div>
      );
    if (subscriptionStatus.freePlan.status === 'contactSales') {
      return (
        <Button
          disabled={false}
          onClick={() => {
            setVisible(true);
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
        >
          {t('contactSales')}
        </Button>
      );
    }
    if (subscriptionStatus.freePlan.status == 'downgrade')
      return (
        <Button
          disabled={false}
          onClick={() => {
            setDownGradeButton('free');
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
        >
          {t('downgrade') + ' (' + t('Cancel') + ')'}
        </Button>
      );
    if (
      subscriptionStatus.freePlan.status == 'cancellation_effective_date' &&
      subscription?.cancellation_effective_date
    )
      return (
        <div className="flex">
          <Button
            disabled={true}
            className="inline-flex cursor-not-allowed w-full items-center px-3 py-2.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('plan_active_in_days', {
              days: Math.ceil(
                (subscription.cancellation_effective_date.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
              )
            })}
          </Button>{' '}
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={''}
            id={'upgrade-tooltip'}
            text={t('back_to_free_plan_tooltip', {
              date: format(subscription.cancellation_effective_date, current_member.date_format)
            })}
          />
        </div>
      );
    return (
      <Button
        disabled={false}
        className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
      >
        {t('currentplan')}
      </Button>
    );
  };
  const getSmallTeamButton = () => {
    if (!workspace || !current_member)
      return (
        <div className="-ml-1 mr-3">
          <Loader />
        </div>
      );
    if (subscriptionStatus.smallTeamPlan.status === 'downgrade')
      return (
        <div className="flex">
          <Button
            disabled={false}
            onClick={() => {
              setDownGradeButton('small_team');
            }}
            className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_600 dark:text-gray-200 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:border-teams_brand_dark_300"
          >
            {t('downgrade')}
          </Button>
        </div>
      );
    if (subscriptionStatus.smallTeamPlan.status === 'contactSales') {
      return (
        <Button
          disabled={false}
          onClick={() => {
            setVisible(true);
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_600 dark:text-gray-200 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:border-teams_brand_dark_300"
        >
          {t('contactSales')}
        </Button>
      );
    }
    if (subscriptionStatus.smallTeamPlan.status === 'paused')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('paused')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_subscription_has_been_paused')}
          />
        </div>
      );
    if (subscriptionStatus.smallTeamPlan.status === 'past_due')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('past_due')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_payment_is_overdue')}
          />
        </div>
      );
    if (subscriptionStatus.smallTeamPlan.status === 'active' || subscriptionStatus.smallTeamPlan.status === 'trialing')
      return (
        <Button
          disabled={false}
          className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
        >
          {t('currentplan')}
        </Button>
      );
    if (subscriptionStatus.smallTeamPlan.status == 'deleted' && subscription?.cancellation_effective_date)
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
          >
            {t('currentplan')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('back_to_free_plan_tooltip', {
              date: format(subscription.cancellation_effective_date, current_member?.date_format)
            })}
          />
        </div>
      );

    return (
      <>
        <Button
          disabled={false}
          onClick={() => {
            setBillingInfoVisible(true);
            setUpgradeInfo('smallTeamPlan');
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_600 dark:text-gray-200 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
        >
          {t('upgrade')}
        </Button>
      </>
    );
  };

  const successModal = (
    customer_id: string,
    address_id: string,
    business_id: string,
    plan: 'smallTeamPlan' | 'enterprisePlan' | 'businessPlan'
  ) => {
    if (!workspace) return;
    if (!paddleInstance) return;
    if (!current_member) return;
    if (!current_member.email) return;
    if (plan == 'enterprisePlan') {
      if (!membersCount) return;
      if (in_teams || in_sharePoint) {
        if (typeof umami !== 'undefined') {
          umami.track('Subscribe_Enterprise_In_Teams_Open_App');
        }
        setShowAlert(true);
        return;
      }
      const referral = window.Rewardful && window.Rewardful.referral;

      if (typeof umami !== 'undefined') {
        umami.track('Subscribe_Enterprise_Open_Paddle_Checkout');
      }
      paddleInstance.Checkout.open({
        items: [
          {
            priceId: toggleEnabled
              ? paddle_v2_price_ids.ENTERPRISE.yearly_price_id + ''
              : paddle_v2_price_ids.ENTERPRISE.monthly_price_id + '',
            quantity: membersCount
          }
        ],
        settings: { showAddTaxId: true, locale: current_member.language, allowLogout: false },
        customer: {
          id: customer_id,
          address: {
            id: address_id
          },
          business: {
            id: business_id
          }
        },
        customData: {
          workspace_id: workspace.id,
          rewardful: JSON.stringify({ referral: referral })
        }
      });
    } else if (plan == 'smallTeamPlan') {
      if (in_teams || in_sharePoint) {
        if (typeof umami !== 'undefined') {
          umami.track('Subscribe_Business_In_Teams_Open_App');
        }
        setShowAlert(true);
        return;
      }
      const referral = window.Rewardful && window.Rewardful.referral;

      if (typeof umami !== 'undefined') {
        umami.track('Subscribe_Business_Open_Paddle_Checkout');
      }
      paddleInstance.Checkout.open({
        items: [
          {
            priceId: toggleEnabled
              ? paddle_v2_price_ids.SMALL_TEAM.yearly_price_id + ''
              : paddle_v2_price_ids.SMALL_TEAM.monthly_price_id + '',
            quantity: membersCount
          }
        ],
        settings: { showAddTaxId: true, locale: current_member.language, allowLogout: false },
        customer: {
          id: customer_id,
          address: {
            id: address_id
          },
          business: {
            id: business_id
          }
        },
        customData: {
          workspace_id: workspace.id,
          rewardful: JSON.stringify({ referral: referral })
        }
      });
    } else {
      if (in_teams || in_sharePoint) {
        if (typeof umami !== 'undefined') {
          umami.track('Subscribe_Business_In_Teams_Open_App');
        }
        setShowAlert(true);
        return;
      }
      const referral = window.Rewardful && window.Rewardful.referral;

      if (typeof umami !== 'undefined') {
        umami.track('Subscribe_Business_Open_Paddle_Checkout');
      }
      paddleInstance.Checkout.open({
        items: [
          {
            priceId: toggleEnabled
              ? paddle_v2_price_ids.BUSINESS.yearly_price_id + ''
              : paddle_v2_price_ids.BUSINESS.monthly_price_id + '',
            quantity: membersCount
          }
        ],
        settings: { showAddTaxId: true, locale: current_member.language, allowLogout: false },
        customer: {
          id: customer_id,
          address: {
            id: address_id
          },
          business: {
            id: business_id
          }
        },
        customData: {
          workspace_id: workspace.id,
          rewardful: JSON.stringify({ referral: referral })
        }
      });
    }
  };

  const continueModal = () => {
    setBillingInfoVisible(false);
    if (upgradeInfo != null) paddleCheckout(upgradeInfo);
  };
  const billingInfoModal = () => {
    setBillingInfoVisible(false);
    setUpdateBillingInfoModalVisible(true);
  };
  const closeUpdate = () => {
    setUpdateBillingInfoModalVisible(false);
  };

  const getEnterpriseButton = () => {
    if (!workspace || !current_member)
      return (
        <div className="-ml-1 mr-3">
          <Loader />
        </div>
      );
    if (subscriptionStatus.enterprisePlan.status === 'contactSales') {
      return (
        <Button
          disabled={false}
          onClick={() => {
            setVisible(true);
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
        >
          {t('contactSales')}
        </Button>
      );
    }
    if (subscriptionStatus.enterprisePlan.status === 'upgrade')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_600 dark:text-gray-200"
            onClick={() => {
              if (!subscription.status) {
                setBillingInfoVisible(true);
                setUpgradeInfo('enterprisePlan');
                return;
              }

              setUpgradeButton('enterprise');
            }}
          >
            {t('upgrade')}
          </Button>
        </div>
      );
    if (subscriptionStatus.enterprisePlan.status === 'pending') {
      return (
        <Button
          disabled={true}
          className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
        >
          {t('waiting_for_Microsoft_to_activate_your_subscription')}
        </Button>
      );
    }

    if (subscriptionStatus.enterprisePlan.status === 'paused')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('paused')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_subscription_has_been_paused')}
          />
        </div>
      );
    if (subscriptionStatus.enterprisePlan.status === 'past_due')
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {t('past_due')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('your_payment_is_overdue')}
          />
        </div>
      );
    if (
      subscriptionStatus.enterprisePlan.status === 'active' ||
      subscriptionStatus.enterprisePlan.status === 'trialing'
    )
      return (
        <Button
          disabled={false}
          className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
        >
          {t('currentplan')}
        </Button>
      );
    if (subscription?.cancellation_effective_date)
      return (
        <div className="flex">
          <Button
            disabled={false}
            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 dark:bg-teams_dark_mode_core dark:text-gray-200"
          >
            {t('currentplan')}
          </Button>
          <TooltipContent
            content={<QuestionMarkCircleIcon width={12} className="self-center" />}
            className={'ml-1 flex items-center cursor-pointer'}
            id={'sub-tooltip'}
            text={t('back_to_free_plan_tooltip', {
              date: format(subscription.cancellation_effective_date, current_member.date_format)
            })}
          />
        </div>
      );

    return (
      <>
        <Button
          disabled={false}
          onClick={() => {
            if (!workspace) return;
            if (!paddleInstance) return;
            if (!current_member) return;
            if (!current_member.email) return;
            if (in_teams || in_sharePoint) {
              if (typeof umami !== 'undefined') {
                umami.track('Subscribe_Business_In_Teams_Open_App');
              }
              setShowAlert(true);
              return;
            }
            const referral = window.Rewardful && window.Rewardful.referral;

            if (typeof umami !== 'undefined') {
              umami.track('Subscribe_Business_Open_Paddle_Checkout');
            }
            let customer: { email: string } | { id: string; address: { id: string }; business: { id: string } } = {
              email: current_member.email
            };
            if (
              paddleBillingDetails &&
              paddleBillingDetails.address_id &&
              paddleBillingDetails.business_id &&
              subscription.provider === 'paddle_v2'
            ) {
              customer = {
                id: paddleBillingDetails.customer_id,
                address: {
                  id: paddleBillingDetails.address_id
                },
                business: {
                  id: paddleBillingDetails.business_id
                }
              };
            }
            paddleInstance.Checkout.open({
              items: [
                {
                  priceId: toggleEnabled
                    ? paddle_v2_price_ids.BUSINESS.yearly_price_id_v1 + ''
                    : paddle_v2_price_ids.BUSINESS.monthly_price_id_v1 + '',
                  quantity: 1
                }
              ],
              settings: { showAddTaxId: true, locale: current_member.language, allowLogout: false },
              customer,
              customData: {
                workspace_id: workspace.id,
                rewardful: JSON.stringify({ referral: referral })
              }
            });
          }}
          className="inline-flex w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_300 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:border-teams_brand_dark_300"
        >
          {t('upgrade')}
        </Button>
      </>
    );
  };
  const downgradeHandler = async () => {
    if (!workspace) return;

    try {
      if (downgradeButton == 'free') {
        if (!paddleInstance) {
          await downgrade.mutateAsync({ new_plan: 'free' });
          await waitForChange(true);
          return;
        }
        if (subscription.provider !== 'paddle' && subscription.provider !== 'paddle_v2') {
          await downgrade.mutateAsync({ new_plan: 'free' });
          await waitForChange(true);
          return;
        }
        if (subscription.subscription_id == '') {
          await downgrade.mutateAsync({ new_plan: 'free' });
          await waitForChange(true);
          return;
        }

        paddleInstance.Retain.initCancellationFlow({
          subscriptionId: subscription.subscription_id
        }).then(async (x) => {
          console.log(x);
          if (x.status == 'chose_to_cancel') {
            await downgrade.mutateAsync({ new_plan: 'free' });
            await waitForChange(true);
          } else if (x.status == 'error') {
            notifyError(t('error_downgrading_subscription'));
          }
        });

        return;
      }
      if (downgradeButton == 'small_team') {
        await downgrade.mutateAsync({ new_plan: 'small_team' });
        await waitForChange(true);
        return;
      }
      if (downgradeButton == 'business') {
        await downgrade.mutateAsync({ new_plan: 'business' });
        await waitForChange(true);
        return;
      }
    } catch (error) {
      console.error('An error has occurred:', error);
      notifyError(error + '');
    }
  };
  let oldSubscription = '';
  const waitForChange = async (downgrade: boolean) => {
    if (oldSubscription == '') oldSubscription = JSON.stringify(subscription);
    let s = await refetchWorkspace();

    if (s.data && JSON.stringify(summarizeSubscriptions(s.data.subscriptions)) != oldSubscription) {
      if (downgrade) notifySuccess(t('downgrade_success'));
      else notifySuccess(t('upgrade_success'));
    } else {
      setTimeout(waitForChange, 1000);
    }
  };
  const upgradeHanlder = async () => {
    if (!workspace) return;

    try {
      if (upgradeButton == 'business') {
        await upgrade.mutateAsync({ new_plan: 'business' });
        await waitForChange(false);
        return;
      }
      if (upgradeButton == 'enterprise') {
        await upgrade.mutateAsync({ new_plan: 'enterprise' });
        await waitForChange(false);
        return;
      }
    } catch (error) {
      console.error('An error has occurred:', error);
      notifyError(error + '');
    }
  };

  const Toggle = () => {
    return (
      <div className="w-1/2">
        <Switch
          checked={toggleEnabled}
          onChange={() => {
            settoggleEnabled(!toggleEnabled);
          }}
          className={classNames(
            toggleEnabled
              ? 'bg-teams_brand_foreground_bg dark:bg-teams_brand_dark_300 dark:ring-teams_brand_dark_300'
              : 'bg-gray-400 dark:bg-transparent dark:ring-white',
            'relative inline-flex flex-shrink-0 h-6 lg:w-11 border-2  w-10  border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none dark:ring-1 dark:ring-offset-0'
          )}
        >
          <span className="sr-only">Use setting</span>
          <span
            aria-hidden="true"
            className={classNames(
              toggleEnabled ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
              'pointer-events-none inline-block lg:h-5  mt-0.5 lg:mt-0 h-4 lg:w-5 w-4 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
            )}
          />
        </Switch>
      </div>
    );
  };
  const smallTeamPlan = getPriceByName(paddlePrices, toggleEnabled, 'SMALL_TEAM');
  const businessPlan = getPriceByName(paddlePrices, toggleEnabled, 'BUSINESS');
  const enterprisePlan = getPriceByName(paddlePrices, toggleEnabled, 'ENTERPRISE');

  const [theme] = useDarkSide();

  return (
    <>
      <div className="divide-y divide-gray-200 lg:col-span-10 min-h-screen">
        <div className="flex py-6 md:py-6 flex-col w-full px-6 md:px-6">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold dark:text-white">{t('upgrade')}</h1>
            </div>

            <div className="flex flex-col space-y-10">
              <div className="flex flex-col sm:flex-row justify-between">
                <p className="text-sm">
                  <span className="block text-sm mt-2 dark:text-gray-400">{t('vat_description_1')}</span>
                </p>
                {subscription.business == false &&
                  subscription.small_team == 0 &&
                  subscription.business_by_user == 0 &&
                  subscription.enterprise == 0 && (
                    <div className="flex items-center mt-2 sm:mt-0 mr-auto sm:mr-0 flex-row space-x-2">
                      <label
                        className="cursor-pointer leading-none text-center text-sm w-72 dark:text-gray-400"
                        htmlFor="cycle-year"
                      >
                        {t('payAnnually')} ({t('saveUpTo')})
                      </label>
                      <Toggle></Toggle>
                    </div>
                  )}
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex flex-wrap -mr-2 ">
                  <Plan
                    enterprise={false}
                    title={t('free')}
                    price={0}
                    button={getFreeButton()}
                    onClick={() => {}}
                    toggleEnabled={toggleEnabled}
                    minUsers={1}
                    perUser={false}
                  ></Plan>
                  <Plan
                    enterprise={false}
                    onClick={() => {}}
                    title={t('smallTeam')}
                    noCurrencyCode={true}
                    saving={
                      currencies[(paddlePrices?.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
                      Number(smallTeamPlan?.totals.subtotal) / 100 +
                      ' '
                    }
                    price={
                      smallTeamPlan
                        ? toggleEnabled
                          ? Number(smallTeamPlan.totals.subtotal) / 100 / 12
                          : Number(smallTeamPlan.totals.subtotal) / 100
                        : 0
                    }
                    button={getSmallTeamButton()}
                    toggleEnabled={toggleEnabled}
                    minUsers={1}
                    perUser={true}
                  ></Plan>
                  <Plan
                    enterprise={false}
                    onClick={() => {}}
                    title={t('startup')}
                    noCurrencyCode={true}
                    saving={
                      currencies[(paddlePrices?.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
                      Number(businessPlan?.totals.subtotal) / 100 +
                      ' '
                    }
                    price={
                      businessPlan
                        ? toggleEnabled
                          ? Number(businessPlan.totals.subtotal) / 100 / 12
                          : Number(businessPlan.totals.subtotal) / 100
                        : 0
                    }
                    button={getBusinessButton()}
                    toggleEnabled={toggleEnabled}
                    minUsers={1}
                    perUser={true}
                  ></Plan>
                  <Plan
                    enterprise={false}
                    onClick={() => {}}
                    title={t('enterprise')}
                    noCurrencyCode={true}
                    saving={
                      currencies[(paddlePrices?.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
                      Number(enterprisePlan?.totals.subtotal) / 100 +
                      ' '
                    }
                    price={
                      enterprisePlan
                        ? toggleEnabled
                          ? Number(enterprisePlan.totals.subtotal) / 100 / 12
                          : Number(enterprisePlan.totals.subtotal) / 100
                        : 0
                    }
                    button={getEnterpriseButton()}
                    toggleEnabled={toggleEnabled}
                    minUsers={1}
                    perUser={true}
                  ></Plan>
                  {visible && <MyForm2 visible={visible} onClose={(c: boolean) => setVisible(c)}></MyForm2>}
                  {billingInfoVisible && (
                    <BillingInfoModal
                      isOpen={billingInfoVisible}
                      continueModal={continueModal}
                      billingInfoModal={billingInfoModal}
                    />
                  )}
                  {updateBillingInfoModalVisible && (
                    <UpdateBillingInfoModal
                      isOpen={updateBillingInfoModalVisible}
                      closeUpdate={closeUpdate}
                      successModal={successModal}
                      upgradeInfo={upgradeInfo}
                    />
                  )}
                </div>
              </div>

              <Spacer width={'w-full'} />
              {/** Addons*/}

              {subscriptionStatus.unlimitedDepartmentsAddon && (
                <>
                  <div className="flex flex-col space-y-5">
                    <h2 className="text-xl font-semibold">{t('powerUpAddOns')}</h2>
                    <div className="flex flex-wrap -mr-2">
                      <Addon
                        title={'🐥 ' + t('earlyBird') + ' 🐥'}
                        price={0}
                        button={
                          <Button
                            disabled={true}
                            className="inline-flex w-full items-center cursor-not-allowed py-2 border border-gray-100 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100"
                          >
                            {t('remove')}
                          </Button>
                        }
                      >
                        <div className=" mx-auto">
                          <p
                            className={` truncate text-xs  h-auto lg:w-40 w-40 cursor-pointer `}
                            data-tooltip-id="addOn-tooltip"
                            data-tooltip-content={t('addOn5Descript')}
                            data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                          >
                            {t('addOn5Descript')}
                          </p>
                          <ReactTooltip
                            id="addOn-tooltip"
                            className="shadow z-50 text-xs"
                            classNameArrow="shadow-sm"
                            place="bottom"
                            style={{ width: '360px' }}
                          />
                        </div>
                      </Addon>
                    </div>
                  </div>
                  <hr className="flex w-full text-element-0 my-5"></hr>{' '}
                </>
              )}
              {/** Core features*/}
              <div className="flex flex-col space-y-5">
                <h2 className="text-xl font-bold dark:text-gray-200">{t('coreFeatures')}</h2>
                <div className="flex relative lg:justify-center">
                  <div className="flex flex-col overflow-x-auto overflow-scroll-fixed -mr-10 lg:mr-0">
                    <div className="flex flex-row lg:space-x-2" style={{ paddingLeft: '200px' }}>
                      <div
                        className="flex justify-start absolute -left-px pl-px z-10 bg-white bg-surface-0 py-3 shrink-0 h-full dark:bg-transparent"
                        style={{ width: '220px' }}
                      >
                        {' '}
                      </div>
                      <div
                        className="flex justify-center text-sm font-medium py-3 shrink-0 dark:text-gray-200"
                        style={{ width: '210px' }}
                      >
                        {t('free')}
                      </div>
                      <div
                        className="flex justify-center text-sm font-medium py-3 shrink-0 dark:text-gray-200"
                        style={{ width: '210px' }}
                      >
                        {t('smallTeam')}
                      </div>
                      <div
                        className="flex justify-center text-sm font-medium py-3 shrink-0 dark:text-gray-200"
                        style={{ width: '210px' }}
                      >
                        {t('startup')}
                      </div>
                      <div
                        className="flex justify-center text-sm font-medium py-3 shrink-0 dark:text-gray-200"
                        style={{ width: '210px' }}
                      >
                        {t('enterprise')}
                      </div>
                    </div>
                    {features.map((feature, i) => (
                      <div
                        key={feature && feature.name + i}
                        className="flex flex-row lg:space-x-2 space-x-0"
                        style={{ paddingLeft: '200px' }}
                      >
                        <div
                          className="flex justify-between absolute -left-px  pl-px   z-10 bg-white text-sm font-bold py-2  shrink-0 dark:bg-transparent"
                          style={{ width: '220px' }}
                        >
                          <div>
                            <p className="dark:text-gray-200"> {feature && t(feature.name)}</p>
                          </div>{' '}
                          <div className="px-2 pl-0 cursor-pointer ">
                            <span
                              className="ml-1 flex items-center cursor-pointer dark:text-gray-200"
                              data-tooltip-id="feature-tooltip"
                              data-tooltip-content={feature && feature.tooltip}
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                ></path>
                              </svg>{' '}
                            </span>
                          </div>
                        </div>
                        <div
                          className="flex justify-center bg-gray-100 py-4 shrink-0 text-xs text-center dark:bg-teams_brand_dark_100"
                          style={{ width: '210px' }}
                        >
                          {feature && feature.free}
                        </div>
                        <div
                          className="flex justify-center bg-gray-100 py-4 shrink-0 text-xs text-center dark:bg-teams_brand_dark_100"
                          style={{ width: '210px' }}
                        >
                          {feature && feature.smallteam}
                        </div>
                        <div
                          className="flex justify-center bg-gray-100 py-4 shrink-0 text-xs text-center dark:bg-teams_brand_dark_100"
                          style={{ width: '210px' }}
                        >
                          {feature && feature.startup}
                        </div>
                        <div
                          className="flex justify-center bg-gray-100 py-4 shrink-0 text-xs text-center dark:bg-teams_brand_dark_100"
                          style={{ width: '210px' }}
                        >
                          {feature && feature.enterprise}
                        </div>
                      </div>
                    ))}
                    <ReactTooltip
                      id="feature-tooltip"
                      className="shadow z-50"
                      classNameArrow="shadow-sm"
                      place="top"
                      opacity={1}
                      style={{ width: '360px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAlert && (
        <AlertModal
          text={t('Not_in_Teams')}
          onClose={() => {
            window.open('https://app.absentify.com', '_blank');
            setShowAlert(false);
          }}
        />
      )}
      {downgradeButton && (
        <ConfirmModal
          text={t('downgrade')}
          handleCallback={downgradeHandler}
          onClose={() => {
            setDownGradeButton(null);
          }}
        />
      )}
      {upgradeButton && (
        <ConfirmModal
          text={t('upgrade')}
          handleCallback={upgradeHanlder}
          onClose={() => {
            setUpgradeButton(null);
          }}
        />
      )}
    </>
  );
};

export default Upgrade;
