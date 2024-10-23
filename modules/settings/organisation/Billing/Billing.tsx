import { NextPage } from 'next';
import useTranslation from 'next-translate/useTranslation';
import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import { format } from 'date-fns';
import { notifyError } from '~/helper/notify';
import Button from '../Upgrade/Button';
import UpdateBillingInfoModal from '../Upgrade/UpgradeModal/UpdateBillingInfoModal';

const SvgVisa = (props: { className?: string; style: React.CSSProperties | undefined }) =>
  React.createElement(
    'div',
    {
      className: props.className,
      style: props.style
    },
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 125.43 78.39" {...props}>
      <g data-name="Layer 2">
        <g data-name="Layer 1">
          <rect width={125.43} height={78.39} rx={4.18} ry={4.18} fill="#3957a7" />
          <path
            d="M57.72 50.97h-6.13l3.83-23.53h6.13l-3.83 23.53zM46.44 27.44 40.6 43.62l-.69-3.48-2.06-10.58a2.63 2.63 0 0 0-2.91-2.12h-9.66l-.11.4a22.81 22.81 0 0 1 6.41 2.69L36.9 51h6.39L53 27.44zM94.63 51h5.63l-4.9-23.53h-4.93a2.81 2.81 0 0 0-2.83 1.75L78.46 51h6.39l1.27-3.49h7.8zm-6.74-8.32 3.22-8.81 1.81 8.81zm-8.95-9.58.87-5.1a17.71 17.71 0 0 0-5.51-1C71.26 27 64 28.35 64 34.81c0 6.08 8.48 6.15 8.48 9.35s-7.6 2.62-10.11.6l-.91 5.29a17.11 17.11 0 0 0 6.91 1.33c4.18 0 10.49-2.17 10.49-8.06 0-6.12-8.55-6.69-8.55-9.35s6.01-2.32 8.63-.87z"
            fill="#fff"
          />
          <path
            d="m39.91 40.14-2.06-10.58a2.63 2.63 0 0 0-2.91-2.12h-9.66l-.11.4a23.73 23.73 0 0 1 9.09 4.56 18.39 18.39 0 0 1 5.65 7.74z"
            fill="#f9a533"
          />
        </g>
      </g>
    </svg>
  );
const Billing: NextPage = () => {
  const { t } = useTranslation('billing');
  const { current_member, subscription } = useAbsentify();
  const { data: payments } = api.subscription.payments.useQuery(undefined, { staleTime: 60000 });
  const [upgradeInfo, setUpgradeInfo] = useState<'smallTeamPlan' | 'enterprisePlan' | 'businessPlan' | null>(null);
  const [updateBillingInfoModalVisible, setUpdateBillingInfoModalVisible] = useState(false);
  const { data: subscription_details } = api.subscription.subscription_details.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: update_url } = api.subscription.getUpdateUrl.useQuery(undefined, { staleTime: 60000 });
  const requestInvoice = api.subscription.requestInvoice.useMutation();
  const closeUpdate = () => {
    setUpdateBillingInfoModalVisible(false);
  };

  const BillingList: React.FC<{
    children: ReactNode;
    cost: string;
    url: string;
    transaction_id?: string;
  }> = (props) => {
    if (props.url == 'request' && props.transaction_id) {
      return (
        <li className="flex px-2 py-3 justify-between border-b border-surface-10 last:border-b-0">
          <span className="min-w-20  text-sm">{props.cost}</span>
          <time className=" text-sm" dateTime="2022-06-23 09:46" title="23 Jun, 2022 at 9:46 AM">
            {props.children}
          </time>
          <p className="text-sm text-blue-400 hover:text-blue-500">
            <a
              className="transition-color duration-200 cursor-pointer"
              onClick={async () => {
                await requestInvoice.mutateAsync(
                  {
                    transaction_id: props.transaction_id + ''
                  },
                  {
                    async onSuccess(link) {
                      if (link) location.href = link;
                      else notifyError('Error');
                    },
                    onError(error) {
                      notifyError(error.message);
                    }
                  }
                );
              }}
              rel="noopener"
            >
              {t('Download')}
            </a>
          </p>
        </li>
      );
    }
    return (
      <li className="flex px-2 py-3 justify-between border-b border-surface-10 last:border-b-0">
        <span className="min-w-20  text-sm">{props.cost}</span>
        <time className=" text-sm" dateTime="2022-06-23 09:46" title="23 Jun, 2022 at 9:46 AM">
          {props.children}
        </time>
        <p className="text-sm text-blue-400 hover:text-blue-500">
          <a className="transition-color duration-200 " href={props.url} rel="noopener" target="_blank">
            {t('Download')}
          </a>
        </p>
      </li>
    );
  };
  return (
    <div className="divide-y divide-gray-200 lg:col-span-10 min-h-screen">
      <div className="flex py-6 md:py-6 flex-col w-full px-6 md:px-6">
        <div className="flex flex-col space-y-10">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="font-semibold text-2xl dark:text-white">{t('tittle')}</h1>
            </div>
            <p className="text-subtitle text-sm dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <div>
            <div className="flex flex-col space-y-3">
              <h3 className=" text-base font-medium dark:text-gray-200">{t('current')}</h3>
              {!subscription.has_valid_subscription && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('selectedPlan', {
                      interpolation: { escapeValue: false },
                      plan: 'Free'
                    })
                  }}
                />
              )}

              {subscription.business && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('selectedPlan', {
                      interpolation: { escapeValue: false },
                      plan: 'Business'
                    })
                  }}
                />
              )}

              {subscription.enterprise > 0 && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('selectedPlan', {
                      interpolation: { escapeValue: false },
                      plan: subscription.enterprise + ' x Enterprise'
                    })
                  }}
                />
              )}

              {subscription.small_team > 0 && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('selectedPlan', {
                      interpolation: { escapeValue: false },
                      plan: subscription.small_team + ' x Small Team'
                    })
                  }}
                />
              )}

              {subscription.business_by_user > 0 && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('selectedPlan', {
                      interpolation: { escapeValue: false },
                      plan: subscription.business_by_user + ' x Business'
                    })
                  }}
                />
              )}

              {subscription?.status == 'paused' && <p className="text-sm dark:text-gray-400">{t('selectedPlan_paused')}</p>}

              {subscription?.status == 'past_due' && <p className="text-sm dark:text-gray-400">{t('selectedPlan_past_due')}</p>}

              {current_member && subscription?.status == 'deleted' && subscription.cancellation_effective_date && (
                <p className="text-sm dark:text-gray-400">
                  {t('selectedPlan_deleted', {
                    date: format(subscription.cancellation_effective_date, current_member.date_format)
                  })}
                </p>
              )}

              {workspace && subscription.addons.unlimited_departments && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('eBAddon', {
                      interpolation: { escapeValue: false },
                      plan: 'Early Bird'
                    })
                  }}
                />
              )}
              {workspace && subscription.business && subscription.addons.departments - 4 > 0 && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('countDepartmentAddon', {
                      interpolation: { escapeValue: false },
                      count: subscription.addons.departments - 4
                    })
                  }}
                />
              )}
              {workspace && subscription.business && subscription.addons.calendar_sync - 1 > 0 && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('calendar_sync', {
                      number: subscription.addons.calendar_sync - 1,
                      interpolation: { escapeValue: false },
                      plan: 'calendar_sync'
                    })
                  }}
                />
              )}
              {workspace && subscription.business && subscription.addons.multi_manager && (
                <p
                  className="text-sm dark:text-gray-400"
                  dangerouslySetInnerHTML={{
                    __html: t('multi_manager', {
                      interpolation: { escapeValue: false },
                      plan: 'multi_manager'
                    })
                  }}
                />
              )}
              {subscription?.status == 'pending' && <p className="text-sm"> {t('selectedPlan_pending')} </p>}
              <Link href="/settings/organisation/upgrade" legacyBehavior>
                <p className="text-sm text-teams_brand_foreground_bg hover:text-teams_brand_border_1 cursor-pointer dark:text-teams_brand_border_1">
                  {t('upgrade')} --{'>'}
                </p>
              </Link>
            </div>
            {subscription_details &&
              subscription &&
              subscription.status !== 'deleted' &&
              subscription.provider == 'paddle' &&
              current_member &&
              subscription_details.map((x) => (
                <div key={x.subscription_id}>
                  {x.state != 'deleted' && x.payment_information && (
                    <>
                      <hr className="flex w-full text-element-0 mt-12 mb-8 dark:border-gray-400" />
                      <div className="flex flex-col space-y-3">
                        <h3 className="text-base font-medium">{t('Payement_details')}</h3>
                        {x.next_payment && (
                          <p
                            className="text-sm"
                            dangerouslySetInnerHTML={{
                              __html: t('Your_next_billing_date_is', {
                                interpolation: { escapeValue: false },
                                days: Math.ceil(
                                  (new Date(x.next_payment.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                                ),
                                date: format(new Date(x.next_payment.date), current_member.date_format)
                              })
                            }}
                          />
                        )}

                        <div className="flex items-start">
                          <div className="mr-4 svg-icon inline-flex mt-2 shrink-0 text-sm transition-colors">
                            {x.payment_information.card_type == 'visa' && <SvgVisa style={{ width: 50 }} />}
                            {/*  {x.payment_information.card_type == 'american_express' && <Amex style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'diners_club' && <DinersClub style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'discover' && <Discover style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'jcb' && <Jcb style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'maestro' && <Maestro style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'master' && <Mastercard style={{ width: 50 }} />}
                            {x.payment_information.card_type == 'unionpay' && <UnionPay style={{ width: 50 }} />}
                            {x.payment_information.payment_method == 'paypal' && <Paypal style={{ width: 50 }} />} */}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm">
                              <strong className="text-sm">
                                {x.payment_information.card_type == 'visa' && 'Visa'}
                                {x.payment_information.card_type == 'american_express' && 'American Express'}
                                {x.payment_information.card_type == 'diners_club' && 'Diners Club'}
                                {x.payment_information.card_type == 'discover' && 'Discover'}
                                {x.payment_information.card_type == 'jcb' && 'JCB'}
                                {x.payment_information.card_type == 'maestro' && 'Maestro'}
                                {x.payment_information.card_type == 'master' && 'Mastercard'}
                                {x.payment_information.card_type == 'unionpay' && 'UnionPay'}
                                {x.payment_information.payment_method == 'paypal' && 'PayPal'}
                                {x.payment_information.payment_method !== 'paypal' &&
                                  ' ' + t('ending_in') + ' ' + x.payment_information.last_four_digits}
                              </strong>
                            </p>
                            {x.payment_information.payment_method !== 'paypal' && (
                              <p className="text-sm">{t('Expires') + ' ' + x.payment_information.expiry_date}</p>
                            )}
                          </div>
                          {true && (
                            <Button
                              disabled={false}
                              onClick={() => window.open(update_url, '_blank')}
                              className="inline-flex w-1/3 sm:w-1/5 mt-4 items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                            >
                              {t('update_method')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

            {subscription.provider === 'paddle_v2' && (
              <>
                <Button
                  disabled={false}
                  onClick={() => {
                    setUpdateBillingInfoModalVisible(true);
                    setUpgradeInfo('enterprisePlan');
                  }}
                  className="inline-flex w-1/3 sm:w-1/5 mt-4 items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                >
                  {t('update_billing_info')}
                </Button>
              </>
            )}
            {subscription_details &&
              subscription &&
              subscription.status !== 'deleted' &&
              subscription.provider == 'paddle_v2' &&
              current_member &&
              subscription_details.map((x) => (
                <div key={x.subscription_id}>
                  {x.state != 'deleted' && (
                    <>
                      <hr className="flex w-full text-element-0 mt-12 mb-8 dark:border-gray-400" />
                      <div className="flex flex-col space-y-3">
                        <h3 className="text-base font-medium">{t('Payement_details')}</h3>
                        {x.next_payment && (
                          <p
                            className="text-sm"
                            dangerouslySetInnerHTML={{
                              __html: t('Your_next_billing_date_is', {
                                interpolation: { escapeValue: false },
                                days: Math.ceil(
                                  (new Date(x.next_payment.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                                ),
                                date: format(new Date(x.next_payment.date), current_member.date_format)
                              })
                            }}
                          />
                        )}

                        <div className="flex items-start">
                          {update_url && (
                            <a
                              target="_blank"
                              href={update_url}
                              className="ml-4 outline-none cursor-pointer text-blue-400 hover:text-blue-500 text-sm"
                              role="button"
                              tabIndex={0}
                              aria-label={t('Update_card')}
                            >
                              {t('Update')}
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            <hr className="flex w-full text-element-0 mt-12 mb-8 dark:border-gray-400" />
            <div className="flex flex-col space-y-3">
              <h3 className="font-medium text-base dark:text-gray-200">{t('history')}</h3>
              {!payments && <p className="text-sm dark:text-gray-400">{t('defaultHistory')} </p>}
              {payments?.length == 0 && <p className="text-sm dark:text-gray-400">{t('defaultHistory')} </p>}
              {payments && current_member && (
                <ol className="w-64 ">
                  {payments.map((payment) => (
                    <BillingList
                      key={payment.id}
                      url={payment.receipt_url}
                      transaction_id={payment.transaction_id}
                      cost={' ' + payment.currency + ' ' + payment.amount.toLocaleString(current_member.language)}
                    >
                      {format(new Date(payment.payout_date), current_member.date_format)}{' '}
                    </BillingList>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
        {updateBillingInfoModalVisible && (
          <>
            <UpdateBillingInfoModal
              isOpen={updateBillingInfoModalVisible}
              closeUpdate={closeUpdate}
              upgradeInfo={upgradeInfo}
            />
          </>
        )}
      </div>
    </div>
  );
};
export default Billing;
