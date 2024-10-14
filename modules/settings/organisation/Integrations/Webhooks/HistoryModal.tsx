import { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { useAbsentify } from '@components/AbsentifyContext';
import { format } from 'date-fns';
import { XMarkIcon } from '@heroicons/react/24/outline';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css'; // Optionales Theme

export default function HisotryModal(props: {
  onClose: Function;
  data:
    | {
        createdAt: Date;
        url: string;
        request_data: string;
        response_data: string;
      }[]
    | undefined;
}) {
  const cancelButtonRef = useRef(null);
  const { t } = useTranslation('settings_organisation');
  const { current_member } = useAbsentify();

  return (
    <Transition.Root show={props.data !== undefined} as={Fragment}>
      <Dialog as="div" className="fixed z-30 inset-0 overflow-auto" initialFocus={cancelButtonRef} onClose={() => {}}>
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:p-0">
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

          <div className="fixed inset-0 z-30 overflow-y-auto flex-grow">
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
                <div className="z-30 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block w-max">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      onClick={() => props.onClose()}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        {t('details')}
                      </Dialog.Title>
                    </div>
                  </div>
                  {props.data &&
                    props.data.map((value, i) => {
                      let requestData;
                      let responseData;

                      // Verarbeitung von requestData
                      try {
                        requestData = JSON.parse(value.request_data);
                      } catch (e) {
                        console.error('Invalid JSON in requestData', e);
                        requestData = value.request_data;
                      }

                      // Verarbeitung von responseData
                      try {
                        responseData = JSON.parse(value.response_data);
                      } catch (e) {
                        console.error('Invalid JSON in responseData', e);
                        responseData = value.response_data;
                      }

                      return (
                        <div key={value.url + i}>
                          <h2 className="py-2 text-base">
                            <b>{t('date')} </b>
                            {current_member && format(new Date(value.createdAt), current_member.long_datetime_format)}
                          </h2>
                          <h2 className="py-2 text-base break-all">
                            <b>{t('url')} </b>
                            {value?.url}
                          </h2>

                          <div>
                            {/* Anzeige von requestData */}
                            <div className="mt-2 rounded bg-gray-100 p-2">
                              <p className="font-semibold">{t('requestData')}</p>
                              {typeof requestData === 'object' && requestData !== null ? (
                                <div className="text-xs max-h-64 overflow-auto">
                                  <JSONPretty data={requestData} />
                                </div>
                              ) : (
                                <p className="text-xs break-all">{requestData}</p>
                              )}
                            </div>

                            {/* Anzeige von responseData */}
                            <div className="mt-1 rounded bg-gray-100 p-2">
                              <p className="font-semibold">{t('responseData')}</p>
                              {typeof responseData === 'object' && responseData !== null ? (
                                <div className="text-xs max-h-64 overflow-auto">
                                  <JSONPretty data={responseData} />
                                </div>
                              ) : (
                                <p className="text-xs break-all">{responseData}</p>
                              )}
                            </div>
                            <hr className="my-6 w-full" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
