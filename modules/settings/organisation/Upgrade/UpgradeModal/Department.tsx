import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import useTranslation from 'next-translate/useTranslation';
import { api, type RouterInputs } from '~/utils/api';
import { getPrice, getPriceByName } from 'lib/getPrice';
import { currencies } from 'helper/common-currency';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { useAbsentify } from '@components/AbsentifyContext';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { PricePreviewResponse } from '@paddle/paddle-js';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export default function UpgradeModalDepartment(props: { open: boolean; onClose: Function }) {
  const { t } = useTranslation('upgrade');
  const changeDepartmentSubscription = api.subscription.change_department_subscription.useMutation();
  const { subscription, current_member, paddleInstance } = useAbsentify();
  const [priceLabel, setPriceLabel] = useState('');
  const cancelButtonRef = useRef(null);
  const { data: workspace, refetch: refetchWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!workspace) return;
    setValue('quantity', 0);

    if (!subscription.business) {
      props.onClose();
      return;
    }
    setValue('quantity', subscription.addons.departments - 4);
  }, [subscription]);

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    getValues
  } = useForm<RouterInputs['subscription']['change_department_subscription']>();

  const onSubmit: SubmitHandler<RouterInputs['subscription']['change_department_subscription']> = async (
    data: RouterInputs['subscription']['change_department_subscription']
  ) => {
    if (!current_member || !workspace) return;

    if (subscription.addons.departments == data.quantity) return;
    setIsLoading(true);
    await changeDepartmentSubscription.mutateAsync(
      { quantity: parseInt(data.quantity + '') },
      {
        onSuccess: async () => {
          await waitForChange();
        },
        onError: (error) => {
          notifyError(error.message);
        }
      }
    );
  };

  const { data: paddlePrices }: UseQueryResult<PricePreviewResponse, Error> = useQuery(
    ['getPaddlePrices'],
    () => getPrice(paddleInstance),
    { staleTime: 300000, enabled: paddleInstance != null }
  ); // 5 min

  useEffect(() => {
    if (!paddlePrices || !subscription.business) return;

    let priceLabel = '';
    if (subscription.billing_cycle_interval == 'month') {
      let depPartPrice = getPriceByName(paddlePrices, false, 'DEPARTMENT_ADDON');
      priceLabel =
        currencies[(paddlePrices.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
        (Number(depPartPrice?.totals.subtotal) / 100) * getValues('quantity') +
        ' / ' +
        t('Month');
    } else {
      let depPartPrice = getPriceByName(paddlePrices, true, 'DEPARTMENT_ADDON');
      priceLabel =
        currencies[(paddlePrices.data.currencyCode as 'USD' | 'EUR') ?? 'USD']?.symbol +
        (Number(depPartPrice?.totals.subtotal) / 100) * getValues('quantity') +
        ' / ' +
        t('Year');
    }
    setPriceLabel(priceLabel);
  }, [watch('quantity')]);

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-30 overflow-y-auto" initialFocus={cancelButtonRef} onClose={() => {}}>
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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
          <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
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
            <div className="z-30 inline-block transform overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {t('Change_department_quantity')}
                  </Dialog.Title>

                  <form className="divide-y divide-gray-200" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('Quantity_description')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <div className="relative flex flex-grow items-stretch focus-within:z-10">
                              <input
                                type="number"
                                {...register('quantity', { required: true })}
                                className="block w-full rounded-none rounded-l-md border-gray-300 pl-10 focus:border-teams_brand_foreground_bg focus:ring-teams_brand_foreground_bg sm:text-sm"
                              />
                            </div>
                            <p className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:border-teams_brand_foreground_bg focus:outline-none focus:ring-1 focus:ring-teams_brand_foreground_bg">
                              <span>{priceLabel}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end px-4 py-4 sm:px-6">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          props.onClose();
                        }}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        type="submit"
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {isLoading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Change')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
