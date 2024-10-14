import { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { type SubmitHandler, useForm, Controller } from 'react-hook-form';
import { api, type RouterInputs } from '~/utils/api';
import useTranslation from 'next-translate/useTranslation';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addMinutes } from 'date-fns';
import { notifySuccess, notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { useAbsentify } from '@components/AbsentifyContext';
import { CustomHeader } from "@components/CustomHeader";
export default function Add(props: { open: boolean; onClose: Function; year: number; public_holiday_id: string }) {
  const { t, lang } = useTranslation('settings_organisation');
  const cancelButtonRef = useRef(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    control
  } = useForm<RouterInputs['public_holiday_day']['add']>({
    defaultValues: {
      duration: 'FullDay'
    }
  });

  const utils = api.useContext();
  const addPublicHolidayDay = api.public_holiday_day.add.useMutation();
  const { current_member } = useAbsentify();
  const onSubmit: SubmitHandler<RouterInputs['public_holiday_day']['add']> = async (
    data: RouterInputs['public_holiday_day']['add']
  ) => {
    if (!current_member) return;
    data.public_holiday_id = props.public_holiday_id;

    data.date = addMinutes(data.date, data.date.getTimezoneOffset() * -1);

    const public_holiday = await addPublicHolidayDay.mutateAsync(data, {
      async onSuccess() {
        utils.public_holiday_day.all.invalidate();
        notifySuccess(t('Saved_successfully'));
      },
      onError(error) {
        notifyError(error.message);
      }
    });
    if (!public_holiday) {
      notifyError('Error');
      return;
    }
    props.onClose(true);
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
                    {t('Add_public_holiday_day')}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-gray-500">{t('Add_public_holiday_description')}</p>
                  <form className="divide-y divide-gray-200">
                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('Name')}
                        </label>
                        <div className="relative mt-1 rounded-md shadow-sm">
                          <input
                            {...register('name', { required: true })}
                            type="text"
                            name="name"
                            id="name"
                            autoComplete="name"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('Date')}
                        </label>
                        <div className="relative mt-1 rounded-md shadow-sm">
                          <Controller
                            control={control}
                            name="date"
                            rules={{
                              required: true,
                              validate: (value) => new Date(value).getFullYear() == props.year
                            }}
                            render={({ field }) => (
                              <DatePicker
                                renderCustomHeader={(props) => <CustomHeader {...props} />}
                                calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                                locale={lang}
                                dateFormat={current_member?.date_format}
                                className={
                                  errors.date
                                    ? 'block w-full rounded-md border-red-300 pr-10 text-red-900 placeholder-red-300 focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm'
                                    : 'block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm'
                                }
                                selected={field.value}
                                onChange={(date: Date) => field.onChange(date)}
                              />
                            )}
                          />

                          {errors.date?.type === 'validate' && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        {errors.date?.type === 'validate' && (
                          <p className="mt-2 text-sm text-red-600" id="email-error">
                            Date must be in year: {props.year}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                          {t('Duration')}
                        </label>
                        <div className="relative mt-1 rounded-md shadow-sm">
                          <Controller
                            control={control}
                            name="duration"
                            rules={{ required: true }}
                            render={({ field }) => (
                              <select
                                {...field}
                                className={
                                  errors.duration
                                    ? 'block w-full rounded-md border-red-300 pr-10 text-red-900 placeholder-red-300 focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm'
                                    : 'block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm'
                                }
                              >
                                <option value="Morning">{t('Morning')}</option>
                                <option value="Afternoon">{t('Afternoon')}</option>
                                <option value="FullDay">{t('FullDay')}</option>
                              </select>
                            )}
                          />
                          {errors.duration && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        {errors.duration && (
                          <p className="mt-2 text-sm text-red-600" id="duration-error">
                            {t('Duration_is_required')}
                          </p>
                        )}
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
                        type="button"
                        onClick={() => {
                          if (Object.keys(errors).length == 0) {
                            handleSubmit(onSubmit)();
                          }
                        }}
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {addPublicHolidayDay.isLoading && (
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
