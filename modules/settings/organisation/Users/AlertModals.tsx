import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import Loader from '@components/calendar/Loader';
import DatePicker from 'react-datepicker';
import { useAbsentify } from '@components/AbsentifyContext';
import { CustomHeader } from '@components/CustomHeader';
import { addMinutes } from 'date-fns'; // Import your date manipulation function
import { notifyError, notifySuccess } from '~/helper/notify';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { api } from '~/utils/api';
import { Status } from '@prisma/client';

export function UnarchiveUserAlert(props: { usersToUnarchive: defaultMemberSelectOutput[]; onClose: Function; actionTypeClicked: Function}) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pause, setPause] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalUsers = props.usersToUnarchive.length;
  const editMember = api.member.edit.useMutation();
  const utils = api.useContext();
  const handleUnarchive = async () => {
    setLoading(true);
    for (let i = currentIndex; i < props.usersToUnarchive.length; i++) {
      const user = props.usersToUnarchive[i];
      if (user) {
        setProgress(((i + 1) / totalUsers) * 100);
        await editMember.mutateAsync(
          {
            id: user.id,
            data: {
              status: Status.INACTIVE
            }
          },
          {
            onSuccess: async () => {
              setCurrentIndex(i + 1);
            },
            onError: (error) => {
              notifyError(
                <p
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: error.message
                  }}
                />
              );
              if(totalUsers == 1){
                setLoading(false);
                props.onClose();
              }
              setPause(true);
              setCurrentIndex(i + 1);
            }
          }
        );
        setPause(false);
      }
    }
    utils.member.all.invalidate();
    notifySuccess(t('Unarchived_successfully'));
    setLoading(false);
    props.onClose();
    props.actionTypeClicked(true);
  };
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={() => {}}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
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

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
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
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-teams_brand_dark_100">
              <div className="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_100 dark:text-gray-200"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  <span className="sr-only">{t('Close')}</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">
                    {t('unarchive_User_Title', { count: totalUsers })}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-2 dark:text-gray-200">
                      {t('unarchive_User_Description', {
                        count: totalUsers,
                        number: totalUsers
                      })}
                    </p>
                  </div>
                  {loading && totalUsers > 1 && (
                    <div className="mb-4 mt-6 relative">
                      <div className="w-full bg-teams_brand_100 rounded-full h-3 relative">
                        <div className="bg-teams_brand_450 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-semibold dark:text-gray-200">
                          {(currentIndex + 1) + '/' + totalUsers}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_450 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleUnarchive}
                  disabled={loading && !pause}
                >
                  {loading && (
                    <div className="-ml-1 mr-3">
                      <Loader />
                    </div>
                  )}
                  {pause && totalUsers > 1 ? t('Continue') : t('Unarchive')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:mt-0 sm:w-auto sm:text-sm dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export function ActivateUsersAlert(props: { usersToActivate: defaultMemberSelectOutput[]; onClose: Function; actionTypeClicked: Function }) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pause, setPause] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalUsers = props.usersToActivate.length;
  const editMember = api.member.edit.useMutation();
  const utils = api.useContext();
  const handleActivate = async (e: any) => {
    setLoading(true);
    e.preventDefault();
    const notInactiveUsers = props.usersToActivate.find((user) => user.status === Status.ACTIVE);
    if (notInactiveUsers) {
      notifyError(t('only_inactive_users_can_be_activated'));
      setLoading(false);
      return;
    }
    for (let i = currentIndex; i < totalUsers; i++) {
      const user = props.usersToActivate[i];
      if (user) {
        setProgress(((i + 1) / totalUsers) * 100);
        await editMember.mutateAsync(
          {
            id: user.id,
            data: {
              status: Status.ACTIVE
            }
          },
          {
            onSuccess: async () => {
              setCurrentIndex(i + 1);
            },
            onError: (error) => {
              notifyError(
                <p
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: error.message
                  }}
                />
              );
              if (totalUsers == 1) {
                setLoading(false);
                props.onClose();
              }
              setPause(true);
              setCurrentIndex(i + 1);
            }
          }
        );
        setPause(false);
      }
    }
    utils.member.all.invalidate();
    notifySuccess(t('Activated_successfully'));
    setLoading(false);
    props.onClose();
    props.actionTypeClicked(true);
  };
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={() => {}}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
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

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
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
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-teams_brand_dark_100">
              <div className="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_100 dark:text-gray-200"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  <span className="sr-only">{t('Close')}</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">
                    {t('activate_User_Title', { count: totalUsers })}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-2 dark:text-gray-200">
                      {t('activate_User_Description', {
                        count: totalUsers,
                        number: totalUsers
                      })}
                    </p>
                  </div>
                  {loading && props.usersToActivate.length > 1 && (
                    <div className="mb-4 mt-6 relative">
                      <div className="w-full bg-teams_brand_100 rounded-full h-3 relative">
                        <div className="bg-teams_brand_450 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-semibold  dark:text-gray-200">
                          {(currentIndex + 1) + '/' + totalUsers}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_450 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleActivate}
                  disabled={loading && !pause}
                >
                  {loading && (
                    <div className="-ml-1 mr-3">
                      <Loader />
                    </div>
                  )}{' '}
                  {pause && totalUsers > 1 ? t('Continue') : t('Activate')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export function ArchiveUserAlert(props: { usersToArchive: defaultMemberSelectOutput[]; onClose: Function ; actionTypeClicked: Function}) {
  const { t, lang } = useTranslation('users');
  const { current_member } = useAbsentify();
  const [loading, setLoading] = useState(false);
  const [employment_end_date, setEmployment_end_date] = useState(new Date());
  const [pause, setPause] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const utils = api.useContext();
  const archiveMember = api.member.archive.useMutation();
  const totalUsers = props.usersToArchive.length;
  const handleArchive = async () => {
    setLoading(true);
    if (!employment_end_date || isNaN(employment_end_date.getTime())) {
      notifyError(t('invalid_Date'));
      setLoading(false);
      return;
    }
    for (let i = currentIndex; i < totalUsers; i++) {
      const user = props.usersToArchive[i];
      if (user) {
        const adjustedEndDate = addMinutes(employment_end_date, employment_end_date.getTimezoneOffset() * -1);
        setProgress(((i + 1) / totalUsers) * 100);
        await archiveMember.mutateAsync(
          {
            id: user.id,
            data: {
              status: Status.ARCHIVED,
              workspace_id: user.workspace_id,
              employment_end_date: adjustedEndDate
            }
          },
          {
            onSuccess: async () => {
              setProgress(((i + 1) / totalUsers) * 100);
              setCurrentIndex(i + 1);
            },
            onError: (error) => {
              notifyError(
                <p
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: error.message
                  }}
                />
              );
              if (totalUsers == 1) {
                setLoading(false);
                props.onClose();
              }
              setPause(true);
              setCurrentIndex(i + 1);
            }
          }
        );
        setPause(false);
      }
    }
    utils.member.all.invalidate();
    notifySuccess(t('Archived_successfully'));
    setLoading(false);
    props.onClose();
    props.actionTypeClicked(true);
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={() => {}}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
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

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
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
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-teams_brand_dark_100 ">
              <div className="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500  dark:bg-teams_brand_dark_100 dark:text-gray-200"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  <span className="sr-only">{t('Close')}</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">
                    {t('Archive_User_Title', { count: totalUsers })}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-2 dark:text-gray-200">{t('Archive_User_Description')}</p>
                    <p className="text-sm text-gray-500 mb-2 dark:text-gray-200">
                      {t('Are_you_sure_you_want_to_archive_this_account', {
                        count: totalUsers,
                        number: totalUsers
                      })}
                    </p>
                    <p className="text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">{t('please_select_endDate')}</p>
                    <DatePicker
                      renderCustomHeader={(props) => <CustomHeader {...props} />}
                      calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                      locale={lang}
                      dateFormat={current_member?.date_format}
                      className={
                        'block z-30 rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white'
                      }
                      required
                      selected={employment_end_date}
                      onChange={(date) => setEmployment_end_date(date as Date)}
                    />
                  </div>
                  {loading && totalUsers > 1 && (
                    <div className="mt-6 mb-4 relative">
                      <div className="w-full bg-teams_brand_100 rounded-full h-3  relative">
                        <div className="bg-teams_brand_450 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-semibold">
                          {(currentIndex + 1) + '/' + totalUsers}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleArchive}
                  disabled={loading && !pause}
                >
                  {loading && !pause && (
                    <div className="-ml-1 mr-3">
                      <Loader />
                    </div>
                  )}
                  {pause && totalUsers > 1 ? t('Continue') : t('Archive')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export function DeleteUserAlert(props: { usersToDelete: defaultMemberSelectOutput[]; onClose: Function; actionTypeClicked: Function }) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pause, setPause] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalUsers = props.usersToDelete.length;
  const deleteMember = api.member.delete.useMutation();
  const utils = api.useContext();
  const handleDelete = async () => {
    setLoading(true);
    for (let i = currentIndex; i < totalUsers; i++) {
      const user = props.usersToDelete[i];
      if (user) {
        setProgress(((i + 1) / totalUsers) * 100);
        await deleteMember.mutateAsync(
          { id: user.id },
          {
            onSuccess: async () => {
              setCurrentIndex(i + 1);
            },
            onError: (error) => {
              notifyError(
                <p
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: error.message
                  }}
                />
              );
              if (totalUsers == 1) {
                setLoading(false);
                props.onClose();
              }
              setPause(true);
              setCurrentIndex(i + 1);
            }
          }
        );
        setPause(false);
      }
    }
     utils.member.all.invalidate();
    notifySuccess(t('Deleted_successfully'));
    setLoading(false);
    props.onClose();
    props.actionTypeClicked(true);
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed z-30 inset-0 overflow-y-auto" onClose={() => {}}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
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

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
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
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-teams_brand_dark_100">
              <div className="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_100 dark:text-gray-200"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  <span className="sr-only">{t('Close')}</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900  dark:text-gray-200">
                    {t('Delete_User', { count: totalUsers })}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500  dark:text-gray-200">
                      {t('Delete_User_Description', {
                        count: totalUsers,
                        number: totalUsers
                      })}
                    </p>
                  </div>
                  {loading && totalUsers > 1 && (
                    <div className="mb-4 mt-6 relative">
                      <div className="w-full bg-teams_brand_100 rounded-full h-3 relative">
                        <div className="bg-teams_brand_450 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-semibold  dark:text-gray-200">
                          {(currentIndex +1) + '/' + totalUsers}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDelete}
                  disabled={loading && !pause}
                >
                  {loading && (
                    <div className="-ml-1 mr-3">
                      <Loader />
                    </div>
                  )}{' '}
                  {pause && totalUsers > 1 ? t('Continue') : t('Delete')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    props.onClose(false);
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}