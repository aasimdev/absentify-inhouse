import type { NextPage } from 'next';
import { Fragment, useEffect, useRef, useState } from 'react';
import useTranslation from 'next-translate/useTranslation';
import { useRouter } from 'next/router';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { api, type RouterOutputs } from '~/utils/api';
import CustomModal from './Modal/Index';
import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Transition } from '@headlessui/react';
import { notifyError, notifySuccess } from '~/helper/notify';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import Loader from '@components/calendar/Loader';
import { useDarkSide } from '@components/ThemeContext';

const CalendarSync: NextPage = () => {
  const [theme] = useDarkSide();
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [deletemodalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const { subscription } = useAbsentify();
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['calendar_sync_setting']['all'][0] | null>(null);
  const [valueForDelete, setValueForDelete] = useState<RouterOutputs['calendar_sync_setting']['all'][0] | null>(null);

  const utils = api.useContext();
  const router = useRouter();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: calendarSyncSettings, refetch: refetch_calendarSyncSettings } = api.calendar_sync_setting.all.useQuery(
    undefined,
    { staleTime: 60000 }
  );
  const calendarSyncSettingDelete = api.calendar_sync_setting.delete.useMutation();
  const [limitReached, setLimitReached] = useState<boolean>(false);
  useEffect(() => {
    if (!workspace) return;
    if (!calendarSyncSettings) return;

    if (subscription.enterprise > 0) {
      return;
    } else if (subscription.business || subscription.small_team > 0 || subscription.business_by_user > 0) {
      const count = subscription.addons.calendar_sync;
      if (calendarSyncSettings.length < count) {
        return;
      } else {
        setLimitReached(true);
      }
    }
  }, [workspace, calendarSyncSettings, subscription]);

  const Modal = (props: {
    open: boolean;
    onClose: Function;
    value: null | RouterOutputs['calendar_sync_setting']['all'][0];
  }) => {
    const cancelButtonRef = useRef(null);

    return (
      <Transition.Root show={props.open} as={Fragment}>
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

          <div className="fixed inset-0 z-10 overflow-y-auto">
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-teams_brand_dark_100">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="py-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                        {t('CalSyncRemove')}
                      </Dialog.Title>
                      <div className="mt-2 py-2">
                        <p
                          className="text-sm text-gray-500 dark:text-gray-200"
                          dangerouslySetInnerHTML={{
                            __html: t('CalSyncRemoveSubTitle', {
                              interpolation: { escapeValue: false },

                              value: props.value?.name
                            })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={
                        //deleteHandler
                        async (e) => {
                          e.preventDefault();
                          setLimitReached(false);
                          await calendarSyncSettingDelete.mutateAsync(
                            { id: props.value?.id as string },
                            {
                              async onSuccess() {
                                setTimeout(() => {
                                  utils.calendar_sync_setting.all.invalidate();
                                  notifySuccess(t('Deleted_successfully'));
                                  props.onClose(false);
                                }, 500);
                              },
                              onError(error) {
                                notifyError(error.message);
                                props.onClose(false);
                              }
                            }
                          );
                        }
                      }
                    >
                      {calendarSyncSettingDelete.isLoading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}

                      {t('yes_remove')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
                      onClick={() => {
                        props.onClose(false);
                      }}
                      ref={cancelButtonRef}
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  };
  return (
    <div className="divide-y divide-gray-200 lg:col-span-10">
      {/* Profile section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('calendar_sync_title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('calendar_sync_description')}</p>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="-my-2 overflow-x-auto md:w-full w-auto">
            <div className="inline-block min-w-full py-2 align-middle px-2 lg:px-3">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500 ">
                  <thead className="bg-gray-50 dark:divide-gray-500 dark:bg-teams_brand_dark_100">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                      >
                        {t('Name')}
                      </th>
                      <th
                        scope="col"
                        className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                      >
                        {t('description')}
                      </th>

                      {/*  <th
                        scope="col"
                        className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase hidden md:table-cell"
                      >
                        {t('logs')}
                      </th> */}
                      <th scope="col" className="relative px-6 py-3 "></th>
                      <th scope="col" className="relative px-6 py-3 "></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500 ">
                    {calendarSyncSettings?.map((calendar_sync_setting) => (
                      <tr key={calendar_sync_setting.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                          {calendar_sync_setting.name}
                        </td>
                        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 md:table-cell dark:text-gray-200">
                          <div
                            className="w-20 truncate pt-1"
                            data-tooltip-id="cssdes-tooltip"
                            data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                            data-tooltip-content={calendar_sync_setting.description}
                          >
                            {calendar_sync_setting.description}
                          </div>
                        </td>
                        {/*  <td>
                          <button
                            className="ml-6 border px-2 rounded-lg text-sm"
                            onClick={() => {
                              setVisible(true);
                              setValueToShow(calendar_sync_setting);
                            }}
                          >
                            Details
                          </button>
                        </td> */}

                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <a
                            onClick={async (e) => {
                              e.preventDefault();
                              setValueForEdit(calendar_sync_setting);
                              setModalOpen(true);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-900 dark:text-gray-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 dark:text-gray-200"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </a>
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <a
                            onClick={async (e) => {
                              e.preventDefault();
                              setDeleteModalOpen(true);
                              setValueForDelete(calendar_sync_setting);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-900 dark:text-gray-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 dark:text-gray-200"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      {workspace && calendarSyncSettings && !limitReached && (
                        <td
                          className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200"
                          colSpan={8}
                          onClick={(e) => {
                            e.preventDefault();
                            setValueForEdit(null);
                            setModalOpen(true);
                          }}
                        >
                          <div className="flex">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 dark:text-gray-200"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                                clipRule="evenodd"
                              />
                            </svg>{' '}
                            <span className="ml-2 dark:text-gray-200">{t('sharedCalendars_new_sharedCalendar')}</span>
                          </div>
                        </td>
                      )}
                      {workspace && calendarSyncSettings && limitReached && (
                        <td
                          className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-teams_brand_foreground_bg"
                          colSpan={8}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push('/settings/organisation/upgrade');
                          }}
                        >
                          <div className="flex">
                            <div
                              className=" ml-2 flex items-center "
                              data-tooltip-id="cssdes-tooltip"
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              data-tooltip-content={t('calendar_sync_limit_go_upgrade_description')}
                            >
                              <QuestionMarkCircleIcon width={12} className="self-center" />
                            </div>
                            <span className="ml-2 dark:text-gray-200">{t('calendar_sync_limit_go_upgrade') + ' ->'}</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  </tbody>
                  <ReactTooltip
                    id="cssdes-tooltip"
                    className="z-50 shadow-sm dark:text-gray-200 dark:bg-teams_dark_mode_core"
                    classNameArrow="shadow-sm"
                    place="top"
                    opacity={1}
                    style={{ maxWidth: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                  />
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deletemodalOpen && (
        <Modal
          open={deletemodalOpen}
          value={valueForDelete}
          onClose={async (refresh: boolean) => {
            setDeleteModalOpen(false);
            if (refresh) {
              await refetch_calendarSyncSettings();
            }
          }}
        ></Modal>
      )}

      {modalOpen && (
        <CustomModal
          open={modalOpen}
          value={valueForEdit}
          onClose={async (refresh: boolean) => {
            setModalOpen(false);
            if (refresh) {
              await refetch_calendarSyncSettings();
            }
          }}
        ></CustomModal>
      )}

      {/* {session && valueToShow && (
        <Modal width="55rem" height="auto" {...bindings}>
          <Modal.Title>{t('details')}</Modal.Title>

          <Modal.Content>
            <div key={valueToShow.id}>
              <h2 className="text-base  py-2">
                <b>{t('Name')}</b>
                {format(value?.createdAt as Date, session.user.long_datetime_format)} 
                {valueToShow.name}
              </h2>
              <h2 className="text-base py-2 ">
                <b className="">{t('date')}</b>
               {format(value?.createdAt as Date, session.user.long_datetime_format)} 
                {format(valueToShow.createdAt as Date, session.user.long_datetime_format)}
              </h2>
              <div>
                <div className="p-2 bg-gray-100 mt-2 rounded">
                  <p className="font-semibold">{t('requestData')}</p>
                  <pre className="text-sm">{JSON.stringify(JSON.parse(valueToShow.calendarSyncSettingDepart as string), null, 2)}</pre>
                </div>
                <div className="p-2 bg-gray-100 mt-1 rounded">
                  <p className="font-semibold">{t('responseData')} </p>
                  <pre className="text-sm">{JSON.stringify(JSON.parse(value.response_data as string), null, 2)}</pre>
                </div>
                <hr className="w-full  my-6" />
              </div> 
            </div>
          </Modal.Content>
        </Modal>
      )} */}
    </div>
  );
};

export default CalendarSync;
