import { useAbsentify } from '@components/AbsentifyContext';
import Loader from '@components/calendar/Loader';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useState } from 'react';
import { notifyError, notifySuccess } from '~/helper/notify';
import { api } from '~/utils/api';
type Props = {
  text: string;
  description: string;
};
export default function NoAccessAlertDialog({ text, description }: Props) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const { current_member } = useAbsentify();
  const sendAdminMail = api.member.send_admin_mail_from_inactive_user.useMutation();
  const { data: updateUrl } = api.subscription.getUpdateUrl.useQuery();
  const handler = async () => {
    setLoading(true);
    await sendAdminMail.mutateAsync(undefined, {
      async onSuccess() {
        setLoading(false);
        notifySuccess(t('Send_successfully'));
      },
      onError(error) {
        notifyError(error.message);
        setLoading(false);
      }
    });
  };
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-30 overflow-y-auto" onClose={() => {}}>
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
            <div className="inline-block overflow-hidden transform rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex flex-col">
                <div
                  className="mx-auto flex mb-4 h-12 w-12 shrink-0 items-center self-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"
                  onClick={() => {
                    location.href = location.origin + '/api/auth/signout';
                  }}
                >
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {t(text)}
                  </Dialog.Title>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      {description !== 'Inactive_subscription_description' && t(description)}
                      {description === 'Inactive_subscription_description' &&
                        (current_member?.is_admin
                          ? t('Inactive_subscription_description_admin')
                          : t('Inactive_subscription_description_user'))}
                    </p>
                  </div>
                </div>
                {text === 'Inactive_account' && description === 'Inactive_account_description' && (
                  <button
                    disabled={loading}
                    onClick={handler}
                    className="ml-5 mt-6 inline-flex self-end rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                  >
                    {loading && (
                      <div className="-ml-1 mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('Send_email')}
                  </button>
                )}
                {text === 'Inactive_subscription' &&
                  description === 'Inactive_subscription_description' &&
                  current_member?.is_admin &&
                  updateUrl && (
                    <a
                      href={updateUrl}
                      className="ml-5 mt-6 inline-flex self-end rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                    >
                      {t('redirect')}
                    </a>
                  )}
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
