import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Listbox, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { Controller, useForm } from 'react-hook-form';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { classNames } from 'lib/classNames';
import { notifySuccess } from '~/helper/notify';
import { useAbsentify } from '@components/AbsentifyContext';
interface Values {
  email: string;
  name: string;
  size: string;
  projectDescription: string;
  website: string;
  workspace_id: string;
}
export default function ContactSalesModal(props: { visible: boolean; onClose: Function }) {
  const cancelButtonRef = useRef(null);
  const { t } = useTranslation('upgrade');
  const [loading, setLoading] = useState(false);
  const { current_member } = useAbsentify();
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    getValues,
    setValue
  } = useForm<Values>();
  const companySizes = ['1-10', '10-100', '100-500'];
  useEffect(() => {
    setValue('size', '1-10');
  }, []);

  return (
    <Transition.Root show={props.visible} as={Fragment}>
      <Dialog as="div" className="relative z-30" initialFocus={cancelButtonRef} onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-30 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 ">
                  <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                    {t('contactSales')}
                  </Dialog.Title>
                </div>

                <div className="lg:col-span-2 mt-6">
                  <form
                    onSubmit={handleSubmit(async (values: Values) => {
                      if (!current_member) return;
                      (values.workspace_id = current_member.workspace_id),
                        await fetch('/api/contactUs', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                          },
                          body: JSON.stringify(values)
                        });

                      setLoading(true);
                      setTimeout(() => {
                        props.onClose(false);
                        notifySuccess(t('feedback'));
                      }, 2000);
                    })}
                    className="mt-2 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8"
                  >
                    <div className="col-span-2 sm:col-span-1 w-72 sm:w-auto">
                      <label htmlFor="email" className="block text-sm font-medium text-warm-gray-900">
                        {t('workEmail')}
                      </label>
                      <div className="mt-1">
                        <input
                          type="email"
                          placeholder="john@acme.com"
                          className={`py-2.5 px-4 block w-full shadow-sm text-warm-gray-900  border ${
                            errors.email ? 'border-red-400 focus:ring-red-400 ' : 'border-gray-300 focus:ring-blue-400 '
                          } rounded-md`}
                          {...register('email', { required: true })}
                        />
                        {errors.email && <span className="text-sm text-red-400">{t('required')}</span>}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label htmlFor="name" className="block text-sm font-medium text-warm-gray-900">
                        {t('name')}
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          id="name"
                          placeholder="John Carter"
                          className={`py-2.5 px-4 block w-full shadow-sm text-warm-gray-900  border ${
                            errors.name ? 'border-red-400 focus:ring-red-400 ' : 'border-gray-300 focus:ring-blue-400 '
                          } rounded-md`}
                          {...register('name', { required: true })}
                        />
                        {errors.name && <span className="text-sm text-red-400">{t('required')}</span>}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label htmlFor="website" className="block text-sm font-medium text-warm-gray-900">
                        {t('companyWebsite')}
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          id="website"
                          placeholder="www.example.com"
                          className={`py-2.5 px-4 block w-full shadow-sm text-warm-gray-900  border ${
                            errors.website
                              ? 'border-red-400 focus:ring-red-400 '
                              : 'border-gray-300 focus:ring-blue-400 '
                          } rounded-md`}
                          {...register('website', { required: true })}
                        />
                        {errors.website && <span className="text-sm text-red-400">{t('required')}</span>}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 ">
                      <label htmlFor={'CAMPANY SIZE'} className="block text-sm font-medium text-gray-700">
                        {t('campanySize')}
                      </label>
                      <Controller
                        rules={{ required: true }}
                        control={control}
                        name="size"
                        render={({ field: { onChange } }) => (
                          <Listbox value={getValues('size')} onChange={onChange}>
                            {({ open }) => (
                              <>
                                <div className="relative mt-2">
                                  <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-teams_brand_600 sm:text-sm sm:leading-6">
                                    <span className="block truncate">{getValues('size')}</span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                    </span>
                                  </Listbox.Button>

                                  <Transition
                                    show={open}
                                    as={Fragment}
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                  >
                                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                      {companySizes.map((companySize, i) => (
                                        <Listbox.Option
                                          key={companySize + i}
                                          className={({ active }) =>
                                            classNames(
                                              active ? 'bg-teams_brand_foreground_bg text-white' : 'text-gray-900',
                                              'relative cursor-default select-none py-2 pl-8 pr-4'
                                            )
                                          }
                                          value={companySize}
                                        >
                                          {({ selected, active }) => (
                                            <>
                                              <span
                                                className={classNames(
                                                  selected ? 'font-semibold' : 'font-normal',
                                                  'block truncate'
                                                )}
                                              >
                                                {companySize}
                                              </span>

                                              {selected ? (
                                                <span
                                                  className={classNames(
                                                    active ? 'text-white' : 'text-teams_brand_foreground_bg',
                                                    'absolute inset-y-0 left-0 flex items-center pl-1.5'
                                                  )}
                                                >
                                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                              ) : null}
                                            </>
                                          )}
                                        </Listbox.Option>
                                      ))}
                                    </Listbox.Options>
                                  </Transition>
                                </div>
                              </>
                            )}
                          </Listbox>
                        )}
                      />
                    </div>

                    <div className="sm:col-span-2 col-span-1 ">
                      <div className="flex justify-between">
                        <label htmlFor="projectDescription" className="block text-sm font-medium text-warm-gray-900">
                          {t('projectDescription')}
                        </label>
                      </div>
                      <div className="mt-1">
                        <textarea
                          rows={4}
                          id="projectDescription"
                          placeholder="..."
                          className={`py-2.5 px-4 block w-full shadow-sm text-warm-gray-900  border ${
                            errors.projectDescription
                              ? 'border-red-400 focus:ring-red-400 '
                              : 'border-gray-300 focus:ring-blue-400 '
                          } rounded-md`}
                          {...register('projectDescription', { required: true })}
                        />
                        {errors.projectDescription && <span className="text-sm text-red-400">{t('required')}</span>}
                      </div>
                    </div>
                    <div className="col-span-2 mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="sm:ml-4 ml-0 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white    bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_foreground_bg sm:w-auto"
                      >
                        {loading ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <g>
                              <rect x="11" y="1" width="2" height="5" opacity=".14" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(30 12 12)" opacity=".29" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(60 12 12)" opacity=".43" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(90 12 12)" opacity=".57" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(120 12 12)" opacity=".71" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(150 12 12)" opacity=".86" />
                              <rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" />
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                calcMode="discrete"
                                dur="0.75s"
                                values="0 12 12;30 12 12;60 12 12;90 12 12;120 12 12;150 12 12;180 12 12;210 12 12;240 12 12;270 12 12;300 12 12;330 12 12;360 12 12"
                                repeatCount="indefinite"
                              />
                            </g>
                          </svg>
                        ) : (
                          t('submit')
                        )}
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                        onClick={() => props.onClose()}
                        ref={cancelButtonRef}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
