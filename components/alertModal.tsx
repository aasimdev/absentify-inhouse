import { Fragment, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import useTranslation from 'next-translate/useTranslation';
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
type Props = {
  text: string;
  onClose: () => void;
}

export default function AlertModal({text, onClose }: Props) {
  const { t } = useTranslation('common');
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
              <Dialog.Panel className=" bg-white relative transform overflow-hidden rounded-lg text-left shadow-xl transition-all sm:my-8 w-80 sm:p-6">
                <div className="p-4">
        <div className="flex">
        <div className="flex-shrink-0 pt-1">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex flex-col justify-center align-middle">
          <h3 className="text-lg font-semibold text-gray-900">{t('Attention_needed')}</h3>
          <div className="mt-2 text-md font-semibold text-gray-900">
            <p className="mb-4">
               {text}
            </p>
          </div>
          <button
            type="button"
            className="mr-6 inline-flex w-20 self-center justify-center rounded-md bg-teams_brand_foreground_bg px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus:ring-teams_brand_500 sm:col-start-2"
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            {t('OK')}
          </button>
        </div>
      </div>
    </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
