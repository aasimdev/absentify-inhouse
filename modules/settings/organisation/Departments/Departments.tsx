import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import useTranslation from 'next-translate/useTranslation';
import { useRouter } from 'next/router';
import { QuestionMarkCircleIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAbsentify } from '@components/AbsentifyContext';
import { api, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import ConfirmModal from '@components/confirmModal';

const Departments: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const { teamsMobile, subscription } = useAbsentify();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['department']['all'][0] | null>(null);
  const [valueForDelete, setValueForDelete] = useState<RouterOutputs['department']['all'][0] | null>(null);
  const router = useRouter();
  const utils = api.useContext();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: departments, refetch: refetchDepartments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const deleteDepartment = api.department.delete.useMutation();
  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);
  useEffect(() => {
    if (!workspace) return;
    if (!departments) return;

    if (subscription.addons.unlimited_departments) {
      setHasValidSubscription(true);
      return;
    }
    if (departments.length < 2) {
      setHasValidSubscription(true);
      return;
    }

    if (subscription.enterprise > 0) {
      setHasValidSubscription(true);
      return;
    } else if (subscription.business || subscription.business_by_user > 0 || subscription.small_team > 0) {
      const count = subscription.addons.departments;

      if (departments.length < count) {
        setHasValidSubscription(true);
        return;
      }
    }
    setHasValidSubscription(false);
  }, [workspace, departments, subscription]);

  function createManagerString(department: RouterOutputs['department']['all'][0]) {
    const items: string[] = [];
    const names: string[] = [];
    const x = department.members.filter((y) => y.manager_type != 'Member');
    const first = x.find((y) => y.predecessor_manager_id == null);
    if (first) {
      items.push(first.member_id);
      let n = first.member.name;
      if (n) names.push(n);
    }

    while (x.find((y) => y.predecessor_manager_id == items[items.length - 1])) {
      const next = x.find((y) => y.predecessor_manager_id == items[items.length - 1]);
      if (next) {
        items.push(next.member_id);
        let n = next.member.name;
        if (n) names.push(n);
      }
    }
    return names.join(', ');
  }
  const handleDelete = async (department: RouterOutputs['department']['all'][0] | null) => {
    if (!department) return;
    await deleteDepartment.mutateAsync(
      { id: department.id },
      {
        async onSuccess() {
          setTimeout(() => {
            refetchDepartments();
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
    <div className="divide-y divide-gray-200 lg:col-span-10">
      {/* Profile section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900">{t('departments_title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('departments_description')}</p>
        </div>
        <div className="mt-6 flex flex-col ">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-6">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        {t('departments_Department')}
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                      >
                        {t('departments_Boss')}
                      </th>
                      <th
                        scope="col"
                        className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                      >
                        {t('departments_Maximum_absent')}
                      </th>

                      <th
                        scope="col"
                        className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                      >
                        <div
                            className=""
                            data-tooltip-id="sync-tooltip"
                            data-tooltip-content={t('ad_teams_desc')}
                            data-tooltip-variant="light"
                          >
                            {t('ad_teams_sync_status')}
                          </div>
                          <ReactTooltip
                            id="sync-tooltip"
                            className="shadow-sm z-50 "
                            classNameArrow="shadow-sm"
                            place="top"
                            style={{
                              boxShadow: '0 0 10px rgba(0,0,0,.1)'
                            }}
                          />
                      </th>
                      <th scope="col" className="relative px-6 py-3"></th>
                      <th scope="col" className="relative px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {departments?.map((department) => (
                      <tr key={department.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {department.name}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 md:table-cell">
                          <p
                            className="w-20 truncate"
                            data-tooltip-id="department-tooltip"
                            data-tooltip-content={createManagerString(department)}
                            data-tooltip-variant="light"
                          >
                            {createManagerString(department)}
                          </p>
                          <ReactTooltip
                            id="department-tooltip"
                            className="shadow-sm z-50 "
                            classNameArrow="shadow-sm"
                            place="top"
                            style={{
                              boxShadow: '0 0 10px rgba(0,0,0,.1)'
                            }}
                          />
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 md:table-cell">
                          {department.maximum_absent == -1 && t('departments_No_limit')}
                          {department.maximum_absent == 1 && '1 ' + t('departments_User')}
                          {department.maximum_absent &&
                            department.maximum_absent > 1 &&
                            department.maximum_absent + ' ' + t('departments_Users')}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 md:table-cell">
                          {department.groupSyncSettings.length > 0 && workspace?.microsoft_groups_read_write_all
                          ? 
                          (<><div
                            className="w-20 truncate"
                            data-tooltip-id={`sync-tooltip${department.id}`}
                            data-tooltip-content={t('ad_teams_desc_check')}
                            data-tooltip-variant="light"
                          >
                            <CheckIcon width={20} className="self-center text-gray-400" />
                          </div>
                          <ReactTooltip
                            id={`sync-tooltip${department.id}`}
                            className="shadow-sm z-50 "
                            classNameArrow="shadow-sm"
                            place="top"
                            style={{
                              boxShadow: '0 0 10px rgba(0,0,0,.1)'
                            }}
                          /></>)
                          : (<><div
                            className="w-20 truncate"
                            data-tooltip-id={`sync-tooltip${department.id}`}
                            data-tooltip-content={t('ad_teams_desc_cross')}
                            data-tooltip-variant="light"
                          >
                            <XMarkIcon width={20} className="self-center text-gray-400"/>
                          </div>
                          <ReactTooltip
                            id={`sync-tooltip${department.id}`}
                            className="shadow-sm z-50 "
                            classNameArrow="shadow-sm"
                            place="top"
                            style={{
                              boxShadow: '0 0 10px rgba(0,0,0,.1)'
                            }}
                          /></>)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-medium">
                          <a
                            onClick={async (e) => {
                              e.preventDefault();
                              setValueForEdit(department);
                              setModalOpen(true);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-900"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                              setValueForDelete(department);
                            }}
                            className="cursor-pointer text-gray-300 hover:text-gray-900"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                                clipRule="evenodd"
                              />
                            </svg>{' '}
                            <span className="ml-2">{t('departments_new_department')}</span>
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
                              data-tooltip-content={t('department_limit_go_upgrade_description')}
                              data-tooltip-variant="light"
                            >
                              <QuestionMarkCircleIcon width={12} className="self-center" />
                            </span>

                            <span className="ml-2">{t('department_limit_go_upgrade') + ' ->'}</span>
                          </span>
                        </td>
                      )}
                      <ReactTooltip
                        id="depLimit-tooltip"
                        className="shadow-sm z-50 "
                        classNameArrow="shadow-sm"
                        place="top"
                        opacity={1}
                        style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                      />
                    </tr>
                  </tbody>
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
              await refetchDepartments();
              utils.member.all.invalidate();
            }
          }}
        ></Modal>
      )}
      {valueForDelete && (
        <ConfirmModal
          text={t('delete')}
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

export default Departments;
