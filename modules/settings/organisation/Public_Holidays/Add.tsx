import Loader from '@components/calendar/Loader';
import { Dialog, Transition } from '@headlessui/react';
import { countries } from 'lib/countries';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';

import { notifyError, notifySuccess } from '~/helper/notify';

import { api, type RouterInputs } from '~/utils/api';

export default function Add(props: { open: boolean; onClose: Function }) {
  const { t } = useTranslation('settings_organisation');
  const { current_member } = useAbsentify();
  const utils = api.useContext();
  const addPublicHoliday = api.public_holiday.add.useMutation();
  const cancelButtonRef = useRef(null);
  const { register, handleSubmit, watch, control } = useForm<RouterInputs['public_holiday']['add']>();

  const watchCountryCode = watch('country_code');
  const [counties, setCounties] = useState<
    {
      code: string;
      name: string;
      languages: string[];
    }[]
  >([]);

  useEffect(() => {
    let subdivisions: {
      code: string;
      name: string;
      languages: string[];
    }[] = [];
    const country = countries.find((x) => x.code === watchCountryCode);
    if (country) subdivisions = country.subdivisions;

    setCounties(subdivisions);
  }, [watchCountryCode]);

  const onSubmit: SubmitHandler<RouterInputs['public_holiday']['add']> = async (
    data: RouterInputs['public_holiday']['add']
  ) => {
    if (current_member) {
      data.workspace_id = `${current_member?.workspace_id}`;

      const PUBLIC_HOLIDAY = await addPublicHoliday.mutateAsync(data, {
        async onSuccess() {
          utils.public_holiday.all.invalidate();
        },
        onError(error) {
          notifyError(error.message);
        }
      });

      if (!PUBLIC_HOLIDAY) {
        notifyError('Error');
        return;
      }

      props.onClose(PUBLIC_HOLIDAY);
      notifySuccess(t('Saved_successfully'));
    }
  };

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
            <Dialog.Overlay className="fixed inset-0 bg-gray-500/75 transition-opacity" />
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
            <div className="z-30 inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {t('Add_public_holiday')}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-gray-500">{t('Add_public_holiday_description')}</p>
                  <form className="divide-y divide-gray-200" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('departments_Name')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            {...register('name', { required: true })}
                            type="text"
                            name="name"
                            id="name"
                            autoComplete="name"
                            className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('Country')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          {countries && (
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="country_code"
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    menuPortal: (base) => ({
                                      ...base,
                                      zIndex: 9999
                                    }),
                                    control: (base) => ({
                                      ...base,
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  menuPortalTarget={document.body}
                                  value={value ? countries.find((x) => x.code === value) : undefined}
                                  className="w-full"
                                  getOptionLabel={(option) => `${t(option.code)}`}
                                  getOptionValue={(option) => option.code}
                                  onChange={(val) => {
                                    if (val) {
                                      onChange(val.code);
                                    }
                                  }}
                                  options={countries}
                                />
                              )}
                            />
                          )}
                        </div>
                      </div>

                      {counties.length > 0 && (
                        <div className="sm:col-span-5">
                          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                            {t('County')}
                          </label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="county_code"
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    menuPortal: (base) => ({
                                      ...base,
                                      zIndex: 9999
                                    }),

                                    control: (base) => ({
                                      ...base,
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  menuPortalTarget={document.body}
                                  value={value ? counties.find((x) => x.code === value) : undefined}
                                  className="w-full"
                                  getOptionLabel={(option) => `${option.name}`}
                                  getOptionValue={(option) => option.code}
                                  onChange={(val) => {
                                    if (val) {
                                      onChange(val.code);
                                    }
                                  }}
                                  options={counties}
                                />
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end p-4 sm:px-6">
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
                        {addPublicHoliday.isLoading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Save')}
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
