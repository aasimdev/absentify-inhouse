import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import useTranslation from 'next-translate/useTranslation';
import { useRouter } from 'next/router';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useAbsentify } from '@components/AbsentifyContext';
import { api, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { Switch } from '@headlessui/react';
import { classNames } from '~/lib/classNames';
import { Icon } from '@components/Icon';
import ConfirmModal from '@components/confirmModal';
import { useDarkSide } from '@components/ThemeContext';

const AllowancesPage: NextPage = () => {
  const [theme] = useDarkSide();
  const { t } = useTranslation('settings_organisation');
  const { teamsMobile, subscription } = useAbsentify();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['allowance']['allTypes'][0] | null>(null);
  const [valueForDelete, setValueForDelete] = useState<RouterOutputs['allowance']['allTypes'][0] | null>(null);
  const router = useRouter();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: allowancesTypes, refetch: refetchAllowanceTypes } = api.allowance.allTypes.useQuery(undefined, {
    staleTime: 60000
  });
  const utils = api.useContext();
  const deleteAllowanceType = api.allowance.deleteAllowanceType.useMutation();
  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);
  useEffect(() => {
    if (!workspace) return;
    if (!allowancesTypes) return;

    if (allowancesTypes.length < 1) {
      setHasValidSubscription(true);
      return;
    }

    if (subscription.enterprise > 0) {
      setHasValidSubscription(true);
      return;
    } else if (subscription.small_team || subscription.small_team > 0) {
      const count = subscription.addons.allowance_types;

      if (allowancesTypes.length < count) {
        setHasValidSubscription(true);
        return;
      }
    } else if (subscription.business || subscription.business_by_user > 0) {
      const count = subscription.addons.allowance_types;

      if (allowancesTypes.length < count) {
        setHasValidSubscription(true);
        return;
      }
    }
    setHasValidSubscription(false);
  }, [workspace, allowancesTypes, subscription]);
  const handleDelete = async (allowancesType: RouterOutputs['allowance']['allTypes'][0]) => {
    await deleteAllowanceType.mutateAsync(
      { id: allowancesType.id },
      {
        async onSuccess() {
          setTimeout(() => {
            refetchAllowanceTypes();
            utils.member.all.invalidate();
            notifySuccess(t('Deleted_successfully'));
          }, 500);
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  return (
    <div className="divide-y divide-gray-200 lg:col-span-10 dark:divide-gray-500">
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('allowances_title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('allowances_description')}</p>
        </div>
        <div className="mt-6 flex flex-col shadow rounded-lg">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-6">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-6 rounded-lg" >
              <div className=" border-b border-gray-200 dark:border-0 shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500 dark:bg-teams_brand_dark_100 dark:rounded-lg">
                  <thead className="bg-gray-50 dark:bg-teams_brand_dark_100 rounded-lg">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                      >
                        {t('allowances_Name')}
                      </th>{' '}
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                      >
                        {t('allowances_leave_types')}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                      >
                        {t('allowances_ignore_limit')}
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                      >
                        {t('allowances_allowance_unit_2')}
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                      ></th>
                      <th scope="col" className="relative px-6 py-3"></th>
                      <th scope="col" className="relative px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-500  bg-white cursor-default dark:bg-teams_brand_dark_100">
                    {allowancesTypes?.map((allowancesType) => (
                      <tr key={allowancesType.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                            <p  className="w-20 2xl:w-auto max-w-56  truncate"
                              data-tooltip-id="index-allowance-tooltip"
                              data-tooltip-content={allowancesType.name}
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                            >{allowancesType.name}
                            </p> 
                         </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                          {allowancesType.leave_types.map((leaveType, index) => (
                            <div
                              key={index}
                              className={`flex items-center mb-2 ${leaveType.deleted ? 'line-through' : ''}`}
                            >
                              {leaveType.icon !== 'NoIcon' && (
                                <div className="w-4 mr-2"
                                data-tooltip-id="index-allowance-tooltip"
                                data-tooltip-content={leaveType.name}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                >
                                  <Icon className="" width="4" color={leaveType.color} name={leaveType.icon} />
                                </div>
                              )}
                              {leaveType.icon === 'NoIcon' && (
                                <div
                                  style={{ backgroundColor: leaveType.color }}
                                  className="mr-2 mt-0.5 h-4 w-4 rounded-sm"
                                  data-tooltip-id="index-allowance-tooltip"
                                data-tooltip-content={leaveType.name}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                ></div>
                              )}
                              <span className="hidden md:table-cell" >{leaveType.name}</span>
                            </div>
                          ))}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                          <Switch
                            checked={allowancesType.ignore_allowance_limit}
                            className={classNames(
                              allowancesType.ignore_allowance_limit ? 'bg-teams_brand_600 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                              'relative inline-flex h-6 w-11 flex-shrink-0  rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-default dark:ring-1 dark:ring-offset-0'
                            )}
                          >
                            <span className="sr-only"> {t('allowances_ignore_limit')}</span>
                            <span
                              className={classNames(
                                allowancesType.ignore_allowance_limit ? 'translate-x-5' : 'translate-x-0',
                                'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                              )}
                            >
                              <span
                                className={classNames(
                                  allowancesType.ignore_allowance_limit
                                    ? 'opacity-0 duration-100 ease-out'
                                    : 'opacity-100 duration-200 ease-in',
                                  'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                )}
                                aria-hidden="true"
                              >
                                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                                  <path
                                    d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                              <span
                                className={classNames(
                                  allowancesType.ignore_allowance_limit
                                    ? 'opacity-100 duration-200 ease-in'
                                    : 'opacity-0 duration-100 ease-out',
                                  'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                )}
                                aria-hidden="true"
                              >
                                <svg className="h-3 w-3 text-teams_brand_600" fill="currentColor" viewBox="0 0 12 12">
                                  <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                </svg>
                              </span>
                            </span>
                          </Switch>
                        </td>
                        <td className="hidden md:table-cell whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                          {allowancesType.allowance_unit === 'days' && t('allowances_allowance_unit_days')}
                          {allowancesType.allowance_unit === 'hours' && t('allowances_allowance_unit_hours')}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-medium">
                          <a
                            onClick={async (e) => {
                              e.preventDefault();
                              setValueForEdit(allowancesType);
                              setModalOpen(true);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-200"
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
                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-medium">
                          <a
                            onClick={() => {
                              setValueForDelete(allowancesType);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-900"
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
                      {workspace && hasValidSubscription && (
                        <td
                          className="cursor-pointer whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900"
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
                            <span className="ml-2  dark:text-gray-200">{t('allowance_new_allowancetype')}</span>
                          </div>
                        </td>
                      )}
                      {workspace && !hasValidSubscription && !teamsMobile && (
                        <td
                          className="cursor-pointer whitespace-nowrap px-3 py-4 text-sm font-medium text-teams_brand_foreground_bg"
                          colSpan={8}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push('/settings/organisation/upgrade');
                          }}
                        >
                          <span className="flex">
                            <span
                              className="ml-2 flex items-center cursor-pointer"
                              data-tooltip-id="depLimit-tooltip"
                              data-tooltip-content={t('allowance_limit_go_upgrade_description')}
                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                            >
                              <QuestionMarkCircleIcon width={12} className="self-center dark:text-gray-200" />
                            </span>

                            <span className="ml-2 dark:text-gray-200">{t('allowance_limit_go_upgrade') + ' ->'}</span>
                          </span>
                        </td>
                      )}
                      <ReactTooltip
                        id="depLimit-tooltip"
                        className="shadow-sm z-50 dark:text-gray-200 dark:teams_dark_mode_core"
                        classNameArrow="shadow-sm"
                        place="top"
                        opacity={1}
                        style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                      />
                    </tr>
                  </tbody>
                  <ReactTooltip
                          id="index-allowance-tooltip"
                          className="shadow-sm z-50 dark:text-gray-200 dark:teams_dark_mode_core"
                          classNameArrow="shadow-sm"
                          place="top"
                          style={{
                            boxShadow: '0 0 10px rgba(0,0,0,.1)'
                          }}
                        />
                </table>
              </div>
            </div>
          </div>
        </div>{' '}
      </div>

      {modalOpen && (
        <Modal
          open={modalOpen}
          value={valueForEdit}
          onClose={async (refresh: boolean) => {
            setModalOpen(false);
            if (refresh) {
              await refetchAllowanceTypes();
            }
          }}
        ></Modal>
      )}
      {valueForDelete && (
        <ConfirmModal
          text={t('Delete')}
          handleCallback={() => {
            handleDelete(valueForDelete);
          }}
          onClose={() => {
            setValueForDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default AllowancesPage;
