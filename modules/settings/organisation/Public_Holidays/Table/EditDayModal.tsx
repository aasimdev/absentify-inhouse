import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import Loader from '@components/calendar/Loader';
import Select from 'react-select';
import { RouterOutputs, api } from '~/utils/api';

type Props = {
  holiday: RouterOutputs['public_holiday_day']['byId'];
  onClose: () => void;
  handleEditDay: (
    holiday: RouterOutputs['public_holiday_day']['byId'] | null,
    customName: string,
    language: string
  ) => Promise<void>;
};

export default function EditDayModal({ holiday, onClose, handleEditDay }: Props) {
  const { t } = useTranslation('settings_organisation');
  const [language, setLanguage] = useState('en');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: publicHolidayLanguage, refetch: refetchPublicHolidayDaysLanguage } =
    api.public_holiday_day.getAllLanguages.useQuery({ public_holiday_day_id: holiday.id }, { staleTime: 60000 });
  const languageOptions = [
    { label: t('English'), value: 'en' },
    { label: t('German'), value: 'de' },
    { label: t('French_not_community'), value: 'fr' },
    { label: t('Hungarian_not_community'), value: 'hu' },
    { label: t('Italian_not_community'), value: 'it' },
    { label: t('Polish_not_community'), value: 'pl' },
    { label: t('Portuguese_not_community'), value: 'pt' },
    { label: t('Russian_not_community'), value: 'ru' },
    { label: t('Spanish_not_community'), value: 'es' },
    { label: t('Turkish_not_community'), value: 'tr' },
    { label: t('Ukrainian_not_community'), value: 'uk' }
  ];
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!publicHolidayLanguage || publicHolidayLanguage.length === 0) return;
    const name = publicHolidayLanguage.find((lang) => lang.language === language)?.name;
    if (!name) return;
    setCustomName(name);
  }, [publicHolidayLanguage, language]);

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
              <Dialog.Panel className="relative transform rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 w-auto sm:p-6 dark:bg-teams_brand_tbody">
                <div>
                  <div className="mt-1 text-start sm:mt-1 mb-4">
                    <Dialog.Title as="h1" className=" text-lg font-bold  text-gray-900 dark:text-gray-200">
                      {t('public_holiday_day')}
                    </Dialog.Title>
                    <span className="text-base font-normal leading-6 text-gray-900 dark:text-gray-200">
                      {t('public_holiday_day_desc')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center">
                    <div className="text-base font-normal leading-6 text-gray-900 w-24 dark:text-gray-200">{t('language')}</div>
                    <div className="w-60">
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                        value={languageOptions.find((x) => x.value === language)}
                        onChange={(val) => {
                          if (val && val.value) setLanguage(val.value);
                        }}
                        options={languageOptions}
                        
                        className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="text-base font-normal leading-6 text-gray-900 w-24 dark:text-gray-200">{t('name')}</div>
                    <div className="flex mt-1 rounded-md shadow-sm">
                      <input
                        type="text"
                        name="name"
                        id="name"
                        autoComplete="name"
                        value={customName}
                        onChange={(e) => {
                          setCustomName(e.target.value);
                        }}
                        className="block w-60 min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_tbody dark:border-teams_brand_border dark:text-gray-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-12">
                  <button
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                    }}
                    ref={cancelButtonRef}
                    className="inline-flex w-24 justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      await handleEditDay(holiday, customName, language);
                      await refetchPublicHolidayDaysLanguage();
                      setLoading(false);
                    }}
                    className="ml-5 w-24 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                  >
                    {loading && (
                      <div className="mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('Save')}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
