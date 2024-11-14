import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { dateToIsoDate } from 'lib/DateHelper';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Fragment } from 'react';
import { type RouterOutputs } from '~/utils/api';

export default function PublicHolidayDetailsModal(props: {
  public_holiday_day: RouterOutputs['public_holiday_day']['byId'];
  onClose: Function;
}) {
  const { t } = useTranslation('calendar');

  const { current_member } = useAbsentify();
  if (!props.public_holiday_day) return <></>;
  if (!current_member) return <></>;
  return (
    <Transition.Root show={props.public_holiday_day != null} as={Fragment}>
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
            <div className="z-30 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6 dark:bg-teams_brand_tbody">
              <div className="">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{props.public_holiday_day.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-200">
                  {t('Public_Holiday')} - {props.public_holiday_day.name}
                </p>
              </div>
              <div className="border-t border-gray-200 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-gray-200 dark:border-gray-100">
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 ">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Date')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-300">
                      {format(dateToIsoDate(props.public_holiday_day.date), current_member.date_format)}
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 ">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Take_from_allowance')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-300">{t('No')}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex justify-end sm:mt-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    props.onClose();
                  }}
                  className="inline-flex justify-end rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
