import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from "next-translate/useTranslation";

type Props = {
  isOpen: boolean;
  continueModal: () => void;
  billingInfoModal: () => void;
}

function BillingInfoModal({isOpen, continueModal, billingInfoModal}: Props) {
  const { t } = useTranslation('upgrade');
  return (
    <div>
      <Transition show={isOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="relative z-30"
          onClose={() => {}}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-teams_brand_dark_100 shadow-xl rounded">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                  {t('billing_info')}
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-md text-gray-500 dark:text-gray-200">
                    {t('billing_info_desc')}
                  </p>
                </div>
                <div className="flex mt-4 justify-end">
                <div className="mr-4">
                  <button
                    type="button"
                    onClick={continueModal}
                    className="inline-flex p-2 w-full items-center py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 hover:bg-gray-100 dark:hover:bg-transparent"
                  >
                    {t('continue')}
                  </button>
                </div>
                <div className="">
                  <button
                    type="button"
                    onClick={billingInfoModal}
                    className="inline-flex p-2 w-full items-center  py-2 border border-white text-sm font-medium rounded-md shadow-sm text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:bg-teams_brand_dark_300 dark:border-teams_brand_dark_300"
                  >
                    {t('update_billing_info')}
                  </button>
                </div>
                </div>
              </div>
            </Transition.Child>
          </div>
          </div>
        </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default BillingInfoModal;
