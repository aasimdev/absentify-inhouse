import { Fragment, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import useTranslation from 'next-translate/useTranslation';
import Loader from "./calendar/Loader";

type Props = {
  text: string | JSX.Element;
  handleCallback: (() => void | Promise<void>) | null;
  onClose: () => void;
}

export default function ConfirmModal({text, handleCallback, onClose }: Props) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const cancelButtonRef = useRef(null);
  if(!handleCallback) return <></>;
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" initialFocus={cancelButtonRef} onClose={() => {}}>
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

        <div className="fixed inset-0 z-40 w-screen overflow-y-auto">
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 w-80 sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      {text}
                    </Dialog.Title>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-teams_brand_foreground_bg px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus:ring-teams_brand_500 sm:col-start-2"
                    onClick={async (e) => {
                      setLoading(true);
                      e.preventDefault();
                      await handleCallback();
                      setLoading(false);
                      onClose();
                    }}
                  >
                   {loading && (
                      <div className="mx-3">
                        <Loader />
                      </div>
                    )}
                    {t('confirm')}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                    }}
                    ref={cancelButtonRef}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
