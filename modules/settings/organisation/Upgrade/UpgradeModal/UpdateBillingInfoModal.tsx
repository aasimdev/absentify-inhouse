import React, { useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { SubmitHandler, useForm, useFieldArray, Controller } from 'react-hook-form';
import { RouterInputs, api } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import { isEmailValid } from '~/helper/isEmailValid';
import Loader from '@components/calendar/Loader';
import CountryCodeComboBox from './CountryCodeComboBox';
import { countries } from '~/lib/countries';
import { useAbsentify } from '@components/AbsentifyContext';

type Props = {
  isOpen: boolean;
  closeUpdate: () => void;
  successModal?: (
    customer_id: string,
    address_id: string,
    business_id: string,
    plan: 'smallTeamPlan' | 'enterprisePlan' | 'businessPlan'
  ) => void;
  upgradeInfo: 'smallTeamPlan' | 'enterprisePlan' | 'businessPlan' | null;
};

function UpdateBillingInfoModal({ isOpen, closeUpdate, successModal, upgradeInfo }: Props) {
  const { t } = useTranslation('upgrade');
  const { data: countryData } = api.register.getCountry.useQuery(undefined, { staleTime: 60000 });
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const [defaultCode, setDefaultCode] = useState<{ code: string; name: string } | null>(null);
  const countryCodes = countries.map((country) => ({ code: country.code, name: country.name }));
  const { current_member } = useAbsentify();
  const { data: getpaddleBilingInformation, refetch: refetchBillingInfo } =
    api.subscription.getpaddleBilingInformation.useQuery();
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue
  } = useForm<RouterInputs['subscription']['editBillingInfo']>();
  useEffect(() => {
    if (getpaddleBilingInformation) {
      Object.keys(getpaddleBilingInformation).forEach((key) => {
        //@ts-ignore
        const fieldData = getpaddleBilingInformation[key];

        if (typeof fieldData === 'object' && fieldData !== null) {
          Object.keys(fieldData).forEach((subKey) => {
            const value = fieldData[subKey as keyof typeof fieldData];
            //@ts-ignore
            setValue(`${key}.${subKey}`, value);
          });
        } else {
          //@ts-ignore
          setValue(key, fieldData);
        }
      });
      const country_code = countries.find(
        (country) => country.code === getpaddleBilingInformation.addressParams.country_code
      );
      if (country_code) {
        setValue('addressParams.country_code', country_code.code);
        setDefaultCode({ code: country_code.code, name: country_code.name });
      }
    } else {
      if (countryData) {
        const country_code = countries.find((country) => country.code === countryData.country_code2);
        if (country_code) {
          setValue('addressParams.country_code', country_code.code);
          setDefaultCode({ code: country_code.code, name: country_code.name });
        }
      }
      if (workspace) {
        setValue('businessParams.name', workspace.name);
      }

      if (current_member) {
        current_member.email && setValue('member.email', current_member.email);
        setValue('member.name', current_member.name);
      }
    }
  }, [countryData, workspace, current_member, getpaddleBilingInformation]);

  const editBillingInfo = api.subscription.editBillingInfo.useMutation();

  const onSubmit: SubmitHandler<RouterInputs['subscription']['editBillingInfo']> = async (data) => {
    if (!upgradeInfo) {
      notifyError(t('plan_not_chosed'));
      return;
    }
    for (const key of Object.keys(data)) {
      //@ts-ignore
      if (typeof data[key] === 'string' && data[key].trim() === '') data[key] = null;
    }

    const result = await editBillingInfo.mutateAsync(
      {
        ...data
      },
      {
        async onSuccess() {
          refetchBillingInfo();
          notifySuccess(t('saved_success'));
        },
        onError(error) {
          notifyError(error.message);
          return;
        }
      }
    );

    successModal && successModal(result.customer_id, result.address_id, result.business_id, upgradeInfo);
    closeUpdate();
  };

  return (
    <div>
      <Transition show={isOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-30" onClose={() => {}}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <div className="inline-block max-w-3xl w-1/2 1md:w-1/3 p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-teams_brand_dark_100  shadow-xl rounded">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                      {t('billing_info')}
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)}>
                      <div className="mb-4">
                        <p className="block text-md font-medium text-gray-700 py-2 dark:text-gray-200">{t('customer')}</p>
                        <hr className=" py-2 dark:border-gray-400"></hr>
                        <label htmlFor="member_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('email')}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register('member.email', {
                            required: t('required'),
                            validate: (value) => {
                              if (!value) {
                                return t('required');
                              }
                              return isEmailValid(value) || t('email_not_valid');
                            }
                          })}
                          type="text"
                          className={`w-full rounded-md border ${
                            errors?.member?.email ? 'border-red-500' : 'border-gray-300'
                          } shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400 `}
                        />
                        {errors?.member?.email && (
                          <p className="mt-2 text-sm text-red-500">{errors.member.email.message}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('customer_name')}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register('member.name', { required: t('required') })}
                          type="text"
                          className={`w-full rounded-md border ${
                            errors?.member?.name ? 'border-red-500' : 'border-gray-300'
                          } shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400`}
                        />
                        {errors?.member?.name && (
                          <p className="mt-2 text-sm text-red-500">{errors?.member?.name.message}</p>
                        )}
                      </div>
                      <p className="block text-md font-medium text-gray-700 pb-2 dark:text-gray-200">{t('business')}</p>
                      <hr className=" py-2 dark:border-gray-400"></hr>
                      <>
                        <div className="mb-4">
                          <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('business_name')}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register('businessParams.name', { required: t('required') })}
                            type="text"
                            className={`w-full rounded-md border ${
                              errors?.businessParams?.name ? 'border-red-500' : 'border-gray-300'
                            } shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400`}
                          />
                          {errors?.businessParams?.name && (
                            <p className="mt-2 text-sm text-red-500">{errors.businessParams.name.message}</p>
                          )}
                        </div>
                        <div className="mb-4">
                          <label htmlFor="tax_identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('tax')}
                          </label>
                          <input
                            {...register('businessParams.tax_identifier')}
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400"
                          />
                        </div>
                        <div className="mb-4">
                          <p className="block text-md font-medium text-gray-700 pb-2 dark:text-gray-200">{t('address')}</p>
                          <hr className=" py-2 dark:border-gray-400"></hr>
                          <label htmlFor="country_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('country_code')}
                            <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            rules={{ required: true }}
                            control={control}
                            name="addressParams.country_code"
                            render={({ field: { onChange } }) => (
                              <CountryCodeComboBox
                                onChange={onChange}
                                countries={countryCodes}
                                value={defaultCode}
                                error={!!errors?.addressParams?.country_code}
                              />
                            )}
                          />
                          {errors?.addressParams?.country_code && (
                            <p className="mt-2 text-sm text-red-500">{t('required')}</p>
                          )}
                        </div>
                        <div className="mb-4">
                          <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('postal_code')}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register('addressParams.postal_code', { required: t('required') })}
                            type="text"
                            className={`w-full rounded-md border ${
                              errors?.addressParams?.postal_code ? 'border-red-500' : 'border-gray-300'
                            } shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400`}
                          />
                          {errors?.addressParams?.postal_code && (
                            <p className="mt-2 text-sm text-red-500">{errors.addressParams.postal_code.message}</p>
                          )}
                        </div>
                        <div className="mb-4">
                          <label htmlFor="first_line" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('address_first_line')}
                          </label>
                          <input
                            {...register('addressParams.first_line')}
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400"
                          />
                        </div>
                        <div className="mb-4">
                          <label htmlFor="second_line" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('address_second_line')}
                          </label>
                          <input
                            {...register('addressParams.second_line')}
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400"
                          />
                        </div>
                        <div className="mb-4">
                          <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('city')}
                          </label>
                          <input
                            {...register('addressParams.city')}
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400"
                          />
                        </div>
                        <div className="mb-4">
                          <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('region')}
                          </label>
                          <input
                            {...register('addressParams.region')}
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400" 
                          />
                        </div>
                      </>

                      <div className="flex mt-4 justify-end">
                        <div className="mr-4">
                          <button
                            type="button"
                            onClick={closeUpdate}
                            className="inline-flex p-2 w-full items-center py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 hover:bg-gray-100 dark:hover:bg-transparent"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                        <div className="">
                          <button
                            type="submit"
                            className="inline-flex p-2 w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_300 dark:border-teams_brand_dark_300" 
                          >
                            {editBillingInfo.isLoading && (
                              <div className="mr-2">
                                <Loader />
                              </div>
                            )}
                            {t('save')}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default UpdateBillingInfoModal;
