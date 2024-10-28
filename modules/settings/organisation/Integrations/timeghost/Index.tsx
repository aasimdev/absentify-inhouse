import type { NextPage } from 'next';
import { Fragment, useEffect, useRef, useState } from 'react';
import useTranslation from 'next-translate/useTranslation';
import { api, type RouterOutputs } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import { paddle_config } from 'helper/paddle_config';
import { Dialog, Transition, Switch } from '@headlessui/react';
import { notifyError, notifySuccess } from '~/helper/notify';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import Loader from '@components/calendar/Loader';
import CustomModal from './Modal/Index';
import ExclamationTriangleIcon from '@heroicons/react/24/solid/ExclamationTriangleIcon';
import { classNames } from '~/lib/classNames';
import { TimeghostService } from '~/lib/timeghostService';
import { useDarkSide } from '@components/ThemeContext';

const TimeghostSync: NextPage = () => {
  
  const [theme] = useDarkSide();
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [deletemodalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [valueForDelete, setValueForDelete] = useState<any | null>(null);
  const [deleteSyncInPast, setDeleteSyncInPast] = useState<boolean>(false);
  const utils = api.useContext();
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['timeghost_sync_setting']['all'][0] | null>(null);
  const [leaveTypeName, setLeaveTypeName] = useState<string | undefined>(undefined);
  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const {
    data: timeghostSyncSettings,
    refetch: refetch_timeghostSyncSettings,
    isLoading: timeghostSyncSettings_loading
  } = api.timeghost_sync_setting.all.useQuery(undefined, { staleTime: 60000 });

  const CustomLoading = () => {
    return (
      <>
        <div className="h-8 bg-gray-700 animate-pulse rounded m-2"></div>
        <div className="h-8 bg-gray-700 animate-pulse rounded  m-2"></div>
      </>
    );
  };
  const timeghostSyncSettingDelete = api.timeghost_sync_setting.delete.useMutation();
  const Modal = (props: {
    open: boolean;
    onClose: Function;
    value: null | RouterOutputs['timeghost_sync_setting']['all'][0];
  }) => {
    const cancelButtonRef = useRef(null);
    const deleteHandler = async (e: { preventDefault: () => void }) => {
      e.preventDefault();
      if (!props.value) return;
      await timeghostSyncSettingDelete.mutateAsync(
        {
          id: props.value.id,
          leave_type_ids: props.value.timeghostSyncSettingLeaveTypes.map((x) => x.leave_type.id),
          department_ids: props.value.timeghostSyncSettingDepartments.map((x) => x.department.id),
          deleteSyncInPast
        },
        {
          async onSuccess() {
            setTimeout(() => {
              utils.timeghost_sync_setting.all.invalidate();
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
      setDeleteSyncInPast(false);
    };

    const SyncedTimeEntryRemainsAfterDeletion: React.FC<{ leaveTypeName: string }> = (props) => {
      return (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <div className="text-sm text-yellow-700 relative">
                <p
                  className="text-sm text-gray-500"
                  dangerouslySetInnerHTML={{
                    __html: deleteSyncInPast
                      ? t('info_text_tg_sync_time_entry_deletion', {
                          interpolation: { escapeValue: false },
                          value: props.leaveTypeName
                        })
                      : t('info_text_tg_sync_future_time_entry_deletion', {
                          interpolation: { escapeValue: false },
                          value: props.leaveTypeName
                        })
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="py-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                        {t('timeghostSyncRemoveTitle')}
                      </Dialog.Title>
                      <div className="mt-2 py-2">
                        {props.value && (
                          <p
                            className="text-sm text-gray-500 dark:text-gray-200"
                            dangerouslySetInnerHTML={{
                              __html: t('timeghostSyncRemoveSubtitle', {
                                interpolation: { escapeValue: false },

                                value: props.value.name
                              })
                            }}
                          />
                        )}
                      </div>
                      <Switch.Group as="div" className="flex items-center my-3">
                        <Switch
                          checked={deleteSyncInPast}
                          onChange={setDeleteSyncInPast}
                          className={classNames(
                            deleteSyncInPast ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_300 dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                            'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={classNames(
                              deleteSyncInPast ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                        </Switch>
                        <Switch.Label as="span" className="ml-3 text-sm">
                          <span className="font-medium text-gray-900 dark:text-gray-200">{t('delete_timeghost_all_past_syncs')}</span>
                        </Switch.Label>
                      </Switch.Group>
                    </div>
                  </div>
                  {leaveTypeName && <SyncedTimeEntryRemainsAfterDeletion leaveTypeName={leaveTypeName} />}

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={deleteHandler}
                    >
                      {timeghostSyncSettingDelete.isLoading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}

                      {t('yes_remove')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
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
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('timeghost_sync_title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('timeghost_sync_description')}</p>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row ">
          <div className="-my-2 overflow-x-auto  md:w-full w-auto">
            <div className="inline-block min-w-full py-2 align-middle px-0.5 ">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500 ">
                  <thead className="bg-gray-50 dark:bg-teams_brand_dark_100">
                    <tr>
                      <th
                        scope="col"
                        className="xl:px-6 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                      >
                        {t('Name')}
                      </th>
                      <th
                        scope="col"
                        className="hidden xl:px-6 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                      >
                        {t('description')}
                      </th>

                      <th
                        scope="col"
                        className=" xl:px-6 px-3 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase hidden md:table-cell dark:text-gray-200"
                      >
                        {t('leave_type')}
                      </th>
                      <th
                        scope="col"
                        className="xl:px-6 px-3 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase hidden md:table-cell dark:text-gray-200"
                      >
                        {t('department')}
                      </th>
                      <th scope="col" className="relative px-6 py-3 "></th>
                      <th scope="col" className="relative px-6 py-3 "></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                    {!timeghostSyncSettings_loading && timeghostSyncSettings && leave_types && departments ? (
                      timeghostSyncSettings.filter((tgSetting) => !tgSetting.deleted).map((timeghostSyncSetting) => (
                        <tr key={timeghostSyncSetting.id}>
                          <td className="whitespace-nowrap xl:px-6 px-3 py-4 text-sm font-medium text-gray-90dark:text-gray-2000">
                          <div
                              className="w-24 2xl:w-auto max-w-36  truncate pt-1"
                              data-tooltip-id="cssdes-tooltip"
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              data-tooltip-content={timeghostSyncSetting.name}
                            >
                              {timeghostSyncSetting.name}
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap xl:px-6 px-3 py-4 text-sm text-gray-500 md:table-cell dark:text-gray-200">
                            <div
                              className="w-24  2xl:w-auto max-w-36 truncate pt-1"
                              data-tooltip-id="cssdes-tooltip"
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              data-tooltip-content={timeghostSyncSetting.description}
                            >
                              {timeghostSyncSetting.description}
                            </div>
                          </td>
                          <td className="hidden md:table-cell whitespace-nowrap xl:px-6 px-3 py-4 text-left text-sm text-gray-500 dark:text-gray-200">
                            <div
                              className="w-24 2xl:w-auto max-w-36 truncate pt-1"
                              data-tooltip-id="cssdes-tooltip"
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              data-tooltip-content={TimeghostService.getLeaveTypeNames(
                                timeghostSyncSetting,
                                leave_types
                              )}
                            >
                              {TimeghostService.getLeaveTypeNames(timeghostSyncSetting, leave_types)}
                            </div>
                          </td>

                          <td className=" hidden md:table-cell whitespace-nowrap xl:px-6 px-3 py-4 text-left text-sm text-gray-500 dark:text-gray-200">
                            <div
                              className="w-24 2xl:w-auto max-w-36 truncate pt-1"
                              data-tooltip-id="cssdes-tooltip"
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              data-tooltip-content={TimeghostService.getDepartmentNames(
                                timeghostSyncSetting,
                                departments
                              )}
                            >
                              {TimeghostService.getDepartmentNames(timeghostSyncSetting, departments)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap xl:px-6 px-3 py-4 text-right text-sm font-medium dark:text-gray-200">
                            <a
                              onClick={async (e) => {
                                e.preventDefault();
                                setModalOpen(true);
                                setValueForEdit(timeghostSyncSetting);
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
                          <td className="whitespace-nowrap xl:px-6 px-3 py-4 text-right text-sm font-medium dark:text-gray-200">
                            <a
                              onClick={async (e) => {
                                e.preventDefault();
                                setDeleteModalOpen(true);
                                setValueForDelete(timeghostSyncSetting);
                                setLeaveTypeName(TimeghostService.getLeaveTypeNames(timeghostSyncSetting, leave_types));
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
                      ))
                    ) : (
                      <tr>
                        {' '}
                        <td colSpan={8}>
                          <CustomLoading />
                        </td>
                      </tr>
                    )}

                    <tr>
                      {workspace && (
                        <td
                          className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900"
                          colSpan={8}
                          onClick={(e) => {
                            e.preventDefault();
                            setModalOpen(true);
                          }}
                        >
                          <div className="flex"
                              onClick={(e) => {
                                e.preventDefault();
                                setValueForEdit(null);
                              }}
                          >
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
                            <span
                              className="ml-2 dark:text-gray-200"
                            >
                              {t('Add_timeghost_sync')}
                            </span>
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
                    style={{ maxWidth: '300px', opacity: 1, boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
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
              await refetch_timeghostSyncSettings();
            }
          }}
        ></Modal>
      )}

      {modalOpen && (
        <CustomModal
          open={modalOpen}
          value={valueForEdit}
          onClose={async (refresh: boolean) => {
            setValueForEdit(null);
            setModalOpen(false);
            if (refresh) {
              await refetch_timeghostSyncSettings();
            }
          }}
        ></CustomModal>
      )}
    </div>
  );
};

export default TimeghostSync;
