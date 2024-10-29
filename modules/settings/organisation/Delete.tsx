import type { NextPage } from 'next';
import { useState } from 'react';
import useTranslation from 'next-translate/useTranslation';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { api } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import { notifyError } from '~/helper/notify';
import { DeletionModal } from './DeletionModal/DeletionModal';
import Loader from '@components/calendar/Loader';
import AlertModal from '@components/alertModal';

const Delete: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const deleteWOrkspace = api.workspace.delete.useMutation();
  const [showAlert, setShowAlert] = useState(false);
  const [deletionModal, setDeletionModal] = useState(false);
  const handleCloseModal = () => {
    setDeletionModal(false);
  };
  const handleConfirm = async (lastText: string, options: Array<string>) => {
    if (!current_member) return;
    setDeletionModal(false);
    setLoading(true);
    const finalOptions = lastText.trim().length > 0 ? [...options, lastText] : options;
    await deleteWOrkspace.mutateAsync(
      {
        id: current_member?.workspace_id + '',
        options: finalOptions
      },
      {
        onSuccess: async () => {
          if (typeof umami !== 'undefined') {
            umami.track('DeleteAccount', {
              account_size: membersCount ?? 0
            });
          }
          location.href = location.origin + '/api/auth/signout';
        },
        onError: (error) => {
          notifyError(error.message);

          setLoading(false);
        }
      }
    );
  };

  const [loading, setLoading] = useState<boolean>(false);
  const { data: membersCount } = api.member.count.useQuery(
    {
      status: ['ACTIVE', 'ARCHIVED', 'INACTIVE']
    },
    {
      staleTime: 60000
    }
  );
  const { in_teams, in_sharePoint, current_member } = useAbsentify();
  return (
    <>
      <div className="divide-y divide-gray-200 dark:divide-gray-500 lg:col-span-10">
        <div className="px-4 sm:px-6">
          <div className="inline-block w-full max-w-lg transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom transition-all sm:my-8 sm:p-6 sm:align-middle dark:bg-teams_brand_dark_100">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Delete_company_account')}</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-200">{t('Delete_company_account_description1')}</p>
                  <p className="font-bold text-red-600 dark:text-gray-200">{t('Delete_company_account_description2')}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                onClick={async () => {
                  if (!current_member) return;
                  if (in_teams || in_sharePoint) {
                    setShowAlert(true);
                    return;
                  }
                  setDeletionModal(true);
                }}
                disabled={loading}
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {loading && (
                  <div className="-ml-1 mr-3">
                    <Loader />
                  </div>
                )}
                {t('Delete_company_account')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAlert && (
        <AlertModal
          text={t('Delete_in_Teams')}
          onClose={() => {
            window.open(location.href.replace('teams.absentify', 'app.absentify'), '_blank');
            setShowAlert(false);
          }}
        />
      )}
      {deletionModal && <DeletionModal onClose={handleCloseModal} onConfirm={handleConfirm} />}
    </>
  );
};

export default Delete;
