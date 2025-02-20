import { Fragment, useRef, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';

import { api } from '~/utils/api';
import { notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';

export function JoinModal(props: { onClose: Function }) {
  const { t } = useTranslation('signup');

  const [loading, setLoading] = useState<boolean>(false);
  const { data: invitation } = api.register.checkIfInvitationExists.useQuery();
  const { data: workspace } = api.register.findWorkspaceByMicrosoftTenantId.useQuery();
  const sendInvationReminder = api.register.sendInvationReminder.useMutation();

  const { data: session } = api.user.session.useQuery(undefined, {
    staleTime: 6000
  });

  const sendInformation = async () => {
    if (!workspace) return;
    if (!session?.id) return;

    await sendInvationReminder.mutateAsync(
      {
        workspace_id: workspace.id,
        user_name: session.name + '',
        email: session.email + ''
      },
      {
        onSuccess: async () => {
          location.href = location.origin + '/api/auth/signout';
          props.onClose(true);
        },
        onError: (error: any) => {
          setLoading(false);

          notifyError(error.message);
        }
      }
    );
  };
  useEffect(() => {
    if (invitation) {
      location.reload();
    }
  }, [invitation]);
  const cancelButtonRef = useRef(null);

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed z-30 inset-0 overflow-y-auto" initialFocus={cancelButtonRef} onClose={() => {}}>
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

          {/* This element is to trick the browser into centering the modal contents. */}
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
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <QuestionMarkCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
                    {t('No_invitation_found')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">{t('No_invitation_found_description')}</p>
                    <p className="text-sm text-gray-500 mt-6">
                      {t('No_invitation_tipp') + ' ' + session?.email}
                    </p>
                  </div>
                  {workspace && workspace.name != '' && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {t('email_found_description')}
                        <span className="text-teams_brand_600 font-bold">{' ' + workspace?.name}</span>.
                        {' ' + t('email_found_description2')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                {workspace && workspace.name != '' && (
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-teams_brand_foreground_bg text-base font-medium text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:col-start-2 sm:text-sm"
                    onClick={() => {
                      setLoading(true);
                      sendInformation();
                    }}
                  >
                    {loading && (
                      <div className="-ml-1 mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('inform_administrators')}
                  </button>
                )}
                {workspace?.name == '' && (
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-teams_brand_foreground_bg text-base font-medium text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:col-start-2 sm:text-sm"
                    onClick={() => {
                      props.onClose(false);
                    }}
                  >
                    {t('Ok')}
                  </button>
                )}
                {workspace?.name !== '' && (
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:mt-0 sm:col-start-1 sm:text-sm dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                    onClick={() => {
                      props.onClose(false);
                    }}
                    ref={cancelButtonRef}
                  >
                    {t('Cancel')}
                  </button>
                )}
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
