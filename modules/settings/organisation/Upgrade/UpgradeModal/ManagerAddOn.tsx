import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { api } from '~/utils/api';
import { getPrice, getPriceByName } from 'lib/getPrice';
import { currencies } from 'helper/common-currency';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { useAbsentify } from '@components/AbsentifyContext';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { PricePreviewResponse } from '@paddle/paddle-js';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export default function UpgradeModalManagerAddOn(props: { open: boolean; onClose: Function }) {
  const { t } = useTranslation('upgrade');
  const changeManagerAddonSubscription = api.subscription.change_manager_adon_subscription.useMutation();
  const [alreadyEnabled, setAlreadyEnabled] = useState(false);
  const [priceLabel, setPriceLabel] = useState('');
  const cancelButtonRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const { subscription, paddleInstance } = useAbsentify();
  const { data: workspace, refetch: refetchWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: paddlePrices }: UseQueryResult<PricePreviewResponse, Error> = useQuery(
    ['getPaddlePrices'],
    () => getPrice(paddleInstance),
    { staleTime: 300000, enabled: paddleInstance != null }
  ); // 5 min
  useEffect(() => {
    if (!workspace) return;
    if (!paddlePrices) return;

    if (!subscription.business) {
      props.onClose();
      return;
    }

    setAlreadyEnabled(subscription.addons.multi_manager);

    let priceLabel = '';
    if (subscription.billing_cycle_interval == 'month') {
      let part = getPriceByName(paddlePrices, false, 'MANAGER_ADDON');
      priceLabel =
        currencies[(paddlePrices.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
        (Number(part?.totals.subtotal) / 100) * 1 +
        ' / ' 
        +t('Month');
    } else {
      let part = getPriceByName(paddlePrices, true, 'MANAGER_ADDON');
      priceLabel =
        currencies[(paddlePrices.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
        (Number(part?.totals.subtotal) / 100) * 1 +
        ' / ' +
        t('Year');
    }
    setPriceLabel(priceLabel);
  }, [subscription, workspace, paddlePrices]);
  let oldSubscription = '';
  const waitForChange = async () => {
    if (oldSubscription == '') oldSubscription = JSON.stringify(subscription);
    let s = await refetchWorkspace();

    if (s.data && JSON.stringify(summarizeSubscriptions(s.data.subscriptions)) != oldSubscription) {
      setIsLoading(false);
      props.onClose();
      notifySuccess(t('Change_to_the_contract_successfully_made'));
    } else {
      setTimeout(waitForChange, 1000);
    }
  };

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog as="div" className="overflow-y-auto fixed inset-0 z-30" initialFocus={cancelButtonRef} onClose={() => {}}>
        <div className="flex justify-center items-end px-4 pt-4 pb-20 min-h-screen text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="z-30 inline-block overflow-visible px-4 pt-5 pb-4 text-left align-bottom bg-white rounded-lg shadow-xl transition-all transform sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {(alreadyEnabled ? t('disable') : t('enable')) + ' ' + t('more-than-one-approver-add-on')}
                  </Dialog.Title>

                  <div className="divide-y divide-gray-200 dark:divide-teams_brand_border">
                    <div className="grid grid-cols-1 gap-x-4 gap-y-6 mt-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-4">
                          {t('addOn3Descript')}
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end px-4 py-4 mt-4 sm:px-6">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          props.onClose();
                        }}
                        className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        onClick={async () => {
                          setIsLoading(true);
                          await changeManagerAddonSubscription.mutateAsync(undefined, {
                            onSuccess: async () => {
                              await waitForChange();
                            },
                            onError: (error) => {
                              notifyError(error.message);
                            }
                          });
                        }}
                        className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                      >
                        {isLoading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {alreadyEnabled ? t('disable') : t('enable') + ' (' + priceLabel + ')'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
