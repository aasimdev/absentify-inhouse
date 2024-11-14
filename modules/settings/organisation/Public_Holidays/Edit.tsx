import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { api, type RouterInputs } from '~/utils/api';
import useTranslation from 'next-translate/useTranslation';
import Table from './Table/Table';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import { type PublicHoliday } from '@prisma/client';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { useAbsentify } from '@components/AbsentifyContext';

export default function Edit(props: { open: boolean; onClose: Function; value: PublicHoliday }) {
  const { t } = useTranslation('settings_organisation');
  const utils = api.useContext();
  const { current_member } = useAbsentify();
  const [tabs, setTabs] = useState<{ name: number; current: boolean; add: boolean }[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const cancelButtonRef = useRef(null);
  const { data: publicHolidayDays, refetch: refetchPublicHolidayDays } = api.public_holiday_day.all.useQuery(
    { public_holiday_id: props.value.id },
    {
      staleTime: 60000
    }
  );
  const addnewYearPublicHoliday = api.public_holiday.add_new_year.useMutation();
  const editPublicHoliday = api.public_holiday.edit.useMutation();
  useEffect(() => {
    if (!publicHolidayDays) return;
    if (publicHolidayDays.length == 0) return;
    const currentYear = new Date().getFullYear();
    const t = [];
    for (let index = 0; index < publicHolidayDays.length; index++) {
      const element = publicHolidayDays[index];
      if (element && t.findIndex((x) => x.name == element.year) == -1) {
        t.push({
          name: element.year,
          current: element.year == currentYear,
          add: false
        });
      }
    }

    if (t.filter((x) => x.current).length == 0 && t.length > 0 && t[0]) {
      t[0].current = true;
    }
    if (!year) {
      const last = t[t.length - 1];
      const filterdT = t.filter((x) => x.current)[0];
      if (last && filterdT) {
        setYear(filterdT.name);
        t.push({ name: last.name + 1, current: false, add: true });
        setTabs(t);
      }
    }
  }, [publicHolidayDays]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<RouterInputs['public_holiday']['edit']['data']>();
  useEffect(() => {
    setValue('name', props.value.name);
  }, []);

  const onSubmit: SubmitHandler<RouterInputs['public_holiday']['edit']['data']> = async (
    data: RouterInputs['public_holiday']['edit']['data']
  ) => {
    if (!current_member) return;
    data.workspace_id = current_member?.workspace_id + '';
    await editPublicHoliday.mutateAsync(
      { id: props.value.id, data: data },
      {
        async onSuccess() {
          utils.public_holiday.all.invalidate();
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );

    props.onClose();
    notifySuccess(t('Saved_successfully'));
  };

  const changeCurrentTab = async (tab: { name: number; current: boolean; add: boolean }) => {
    if (tab.add && props.value.country_code) {
      await addnewYearPublicHoliday.mutateAsync(
        { id: props.value.id, year: tab.name },
        {
          async onSuccess() {
            await refetchPublicHolidayDays();
            tab.add = false;
            tabs.push({ name: tab.name + 1, current: false, add: true });
            const ta = tabs.map((y) => {
              y.current = tab.name == y.name;

              return y;
            });
            const current = ta.filter((x) => x.current)[0];
            if (current) {
              setYear(current.name);
              setTabs(ta);
            }
          },
          onError(error) {
            notifyError(error.message);
          }
        }
      );
    } else {
      const ta = tabs.map((y) => {
        y.current = tab.name == y.name;

        return y;
      });

      const current = ta.filter((x) => x.current)[0];
      if (current) {
        setYear(current.name);
        setTabs(ta);
      }
    }
  };

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-30 overflow-y-auto"
        initialFocus={cancelButtonRef}
        onClose={() => {
          props.onClose();
        }}
      >
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
            <div className="z-30 inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle dark:bg-teams_brand_tbody">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                    {t('Update_public_holiday')}
                  </Dialog.Title>

                  <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                    <div className="sm:col-span-5">
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('departments_Name')}
                      </label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                          {...register('name', { required: true })}
                          type="text"
                          name="name"
                          id="name"
                          autoComplete="name"
                          className="block w-full min-w-0 flex-grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200 dark:bg-teams_brand_tbody dark:border-teams_brand_border"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="sm:hidden">
                      <label htmlFor="tabs" className="sr-only">
                        {t('Select_a_tab')}
                      </label>
                      {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
                      <select
                        onChange={async (x) => {
                          const selectedTab = tabs.find((y) => y.name + '' == x.target.value);
                          if (selectedTab) await changeCurrentTab(selectedTab);
                        }}
                        id="tabs"
                        name="tabs"
                        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200 dark:bg-teams_brand_tbody"
                        defaultValue={tabs.find((tab) => tab.current)?.name}
                      >
                        {tabs.map((tab) => (
                          <option key={tab.name} className='dark:text-gray-200 dark:bg-teams_brand_tbody'>{tab.add ? <PlusCircleIcon className="h-4" /> : tab.name} </option>
                        ))}
                      </select>
                    </div>
                    <div className="hidden sm:block">
                      <div className="border-b border-gray-200 dark:border-teams_brand_border">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                          {tabs.map((tab) => (
                            <a
                              onClick={async () => {
                                await changeCurrentTab(tab);
                              }}
                              key={tab.name}
                              className={classNames(
                                tab.current
                                  ? 'border-teams_brand_500 text-teams_brand_600'
                                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                'cursor-pointer whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium dark:text-gray-200 dark:bg-teams_brand_tbody'
                              )}
                              aria-current={tab.current ? 'page' : undefined}
                            >
                              {tab.add && !addnewYearPublicHoliday.isLoading ? (
                                <PlusCircleIcon className="mt-1 h-4 dark:text-gray-200" />
                              ) : (
                                tab.name
                              )}
                              {tab.add && addnewYearPublicHoliday.isLoading && (
                                <div className="-ml-1 mr-3">
                                  <Loader />
                                </div>
                              )}
                            </a>
                          ))}
                        </nav>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <Table year={year ?? new Date().getFullYear()} public_holiday={props.value} />
                  </div>
                  <div className="mt-4 flex justify-end px-4 py-4 sm:px-6">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        props.onClose();
                      }}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
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
                      className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                    >
                      {addnewYearPublicHoliday.isLoading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}
                      {t('Save')}
                    </button>
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
