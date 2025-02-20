
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useState } from 'react';

import { notifyError } from '~/helper/notify';

import { api, type RouterOutputs } from '~/utils/api';
import Loader from "./Loader";

export default function DeclineModal(props: {
  request: RouterOutputs['request']['toApprove'][0] | null;
  onClose: Function;
  t: any;
}) {
  
  const [reasonText, setReasonText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const utils = api.useContext();
  const declineRequest = api.request.declineRequest.useMutation();
  return (
    <Transition.Root show={props.request != null} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-30 overflow-y-auto"
        onClose={() => {}}
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
          <span
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          >
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
              <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                  onClick={() => {
                    props.onClose();
                  }}
                >
                  <span className="sr-only">{props.t('Close')}</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationCircleIcon
                    className="h-6 w-6 text-red-600"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {props.t('Decline_request')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <textarea
                      onChange={(e) => {
                        setReasonText(e.target.value);
                      }}
                      id="reason"
                      name="reason"
                      rows={3}
                      className="block w-full max-w-lg rounded-md border border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
                      defaultValue={''}
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      {props.t('Decline_request_reason_hint')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  disabled={loading}
                  type="button"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={async () => {
                    if (!props.request) return;
                    if (!props.request.approver.approver_member_id) return;
                    if (reasonText == '') {
                     notifyError(props.t('Reason_is_mandatory'));
                      return;
                    }
                    setLoading(true);

                    await declineRequest.mutateAsync(
                      {
                        id: props.request.request.id,
                        data: {
                          decline_reason: reasonText,
                          approver_uuid: props.request.approver.uuid,
                          approver_id: props.request.approver.approver_member_id,
                        },
                      },
                      {
                        async onSuccess() {
                          utils.request.allOfUserByDay.invalidate();
                          utils.member_allowance.byMember.invalidate();

                          props.onClose(null);
                        },
                        onError(error) {
                          notifyError( error.message);
                        },
                      }
                    );

                    setReasonText('');

                    setLoading(false);
                    props.onClose(null);
                  }}
                >
                  {loading && (
                    <div>
                      <Loader />
                    </div>
                  )}
                  {props.t('OK')}
                </button>
                <button
                  disabled={loading}
                  type="button"
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    props.onClose(props.request);
                  }}
                >
                  {props.t('Cancel')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
