import { addDays, addYears } from 'date-fns';
import type { NextPage } from 'next';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import Select from 'react-select';
import { hasValidSubscription } from 'lib/subscriptionHelper';
import { notifyAlert, notifyError, notifySuccess } from '~/helper/notify';
import { api } from '~/utils/api';
import Loader from '@components/calendar/Loader';

const Export: NextPage = () => {
  const { t, lang } = useTranslation('settings_organisation');

  const [loading, setLoading] = useState<boolean>(false);
  const { teamsMobile } = useAbsentify();
  const { current_member } = useAbsentify();
  const { handleSubmit, control, watch, setValue } = useForm<{
    year?: string;
    department?: string;
  }>();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  let validSubscription: boolean = false;
  if (workspace) {
    validSubscription = hasValidSubscription(workspace.subscriptions);
  }

  const exportData = async (year?: string) => {
    if (!year) return;
    setLoading(true);
    if (typeof umami !== 'undefined') {
      umami.track('Export', { year });
    }
    let yearValue = year.split(' ')[0];
    let monthValue = year.split(' ')[1];
    if (yearValue === 'specific_month') {
      notifyError(t('please_select'));
      setLoading(false);
      return;
    }

    const holidayDays = await fetch(
      `/api/export?year=${yearValue}&month=${monthValue}&department_id=${watch('department') ?? ''}`
    );

    if (holidayDays.status === 200) {
      const blob = await holidayDays.blob();
      const href = window.URL.createObjectURL(blob);
      location.href = href;
      notifySuccess(t('export_successfully'));
      setLoading(false);
    } else {
      notifyError(t('export_failes'));
      setLoading(false);
    }
  };
  const onSubmit: SubmitHandler<{ year?: string }> = (data) => {
    exportData(data.year);
  };
  if (!workspace) return <></>;

  const getYearLabel = (year: number) => {
    const start = new Date(year, workspace.fiscal_year_start_month, 1);
    const end = addDays(addYears(new Date(Date.UTC(year, workspace.fiscal_year_start_month, 1)), 1), -1);
    if (start.getMonth() == 0) {
      return year + '';
    } else if (watch('year') !== 'specific_month' && start.getMonth() !== 0) {
      return `${start.toLocaleString(lang, { month: 'long' })} ${start.getFullYear()} ${t('to')} ${end.toLocaleString(
        lang,
        { month: 'long' }
      )} ${end.getFullYear()}`;
    } else {
      return ` ${start.getFullYear()} `;
    }
  };
  const months = [
    { label: new Date(2023, 0, 5).toLocaleDateString(lang, { month: 'long' }), value: 0 },
    { label: new Date(2023, 1, 5).toLocaleDateString(lang, { month: 'long' }), value: 1 },
    { label: new Date(2023, 2, 5).toLocaleDateString(lang, { month: 'long' }), value: 2 },
    { label: new Date(2023, 3, 5).toLocaleDateString(lang, { month: 'long' }), value: 3 },
    { label: new Date(2023, 4, 5).toLocaleDateString(lang, { month: 'long' }), value: 4 },
    { label: new Date(2023, 5, 5).toLocaleDateString(lang, { month: 'long' }), value: 5 },
    { label: new Date(2023, 6, 5).toLocaleDateString(lang, { month: 'long' }), value: 6 },
    { label: new Date(2023, 7, 5).toLocaleDateString(lang, { month: 'long' }), value: 7 },
    { label: new Date(2023, 8, 5).toLocaleDateString(lang, { month: 'long' }), value: 8 },
    { label: new Date(2023, 9, 5).toLocaleDateString(lang, { month: 'long' }), value: 9 },
    { label: new Date(2023, 10, 5).toLocaleDateString(lang, { month: 'long' }), value: 10 },
    { label: new Date(2023, 11, 5).toLocaleDateString(lang, { month: 'long' }), value: 11 }
  ];
  const years: { label: string; value: string }[] = [
    {
      value: `${new Date().getFullYear() - 1}`,
      label: getYearLabel(new Date().getFullYear() - 1)
    },
    {
      value: `${new Date().getFullYear()}`,
      label: getYearLabel(new Date().getFullYear())
    },
    {
      value: `${new Date().getFullYear() + 1}`,
      label: getYearLabel(new Date().getFullYear() + 1)
    },
    {
      value: 'specific_month',
      label: t('specific_month')
    }
  ];
  function rearrangeArrayAtIndex(originalArray: any[], indexToMoveToEnd: number) {
    if (indexToMoveToEnd < 0 || indexToMoveToEnd >= originalArray.length) {
      //if index is out of range, return empty array
      return [];
    }
    const firstElements = originalArray.slice(0, indexToMoveToEnd + 1);
    return firstElements;
  }
  const monthsAccordingToFiscalYear = rearrangeArrayAtIndex(months, workspace?.fiscal_year_start_month - 1);
  const monthsWithYears = [
    ...months.slice(workspace?.fiscal_year_start_month).map((month) => ({
      value: `${new Date().getFullYear() - 1} ${month.value}`,
      label: `${month.label} ${getYearLabel(new Date().getFullYear() - 1)}`
    })),
    ...months.map((month) => ({
      value: `${new Date().getFullYear()} ${month.value}`,
      label: `${month.label} ${getYearLabel(new Date().getFullYear())}`
    })),

    ...months.map((month) => ({
      value: `${new Date().getFullYear() + 1} ${month.value}`,
      label: `${month.label} ${getYearLabel(new Date().getFullYear() + 1)}`
    })),
    ...monthsAccordingToFiscalYear.map((month) => ({
      value: `${new Date().getFullYear() + 2} ${month.value}`,
      label: `${month.label} ${getYearLabel(new Date().getFullYear() + 2)}`
    }))
  ];

  if (!current_member) return <></>;
  return (
    <form className=" divide-y divide-gray-200 lg:col-span-10" onSubmit={handleSubmit(onSubmit)}>
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900">{t('Export')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('Export_Description')}</p>
        </div>
        {teamsMobile ? (
          <div className="rounded-md bg-yellow-50 p-4 mt-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">{t('only_on_desktop')}</div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col w-full">
            <div className="mb-4">
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                {watch('year') === 'specific_month' || (watch('year') as string)?.length > 4 ? (
                  <>
                    <span
                      className="text-gray-500 cursor-pointer"
                      onClick={() => {
                        setValue('year', `${new Date().getFullYear()}`);
                      }}
                    >
                      {t('Year')}
                    </span>{' '}
                    | <span className="font-bold text-base"> {t('Month')} </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-base"> {t('Year')}</span> |{' '}
                    <span
                      className="text-gray-500 cursor-pointer"
                      onClick={() => {
                        if (validSubscription) {
                          setValue('year', 'specific_month');
                        } else {
                          notifyAlert(t('No_plan'));
                        }
                      }}
                    >
                      {t('Month')}
                    </span>
                  </>
                )}
              </label>
              <div>
                {watch('year') === 'specific_month' && validSubscription ? (
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="year"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        menuIsOpen={watch('year') === 'specific_month'}
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important',
                              cursor: 'pointer'
                            }
                          })
                        }}
                        value={value ? years.find((x) => x.value === value) : undefined}
                        className="w-80"
                        onChange={(val) => {
                          onChange(val?.value);
                        }}
                        options={monthsWithYears}
                      />
                    )}
                  />
                ) : (
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    defaultValue={`${new Date().getFullYear()}`}
                    name="year"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important',
                              cursor: 'pointer'
                            }
                          })
                        }}
                        value={value ? years.find((x) => x.value === value) : undefined}
                        className="w-80"
                        onChange={(val) => {
                          if (val?.value === 'specific_month' && !validSubscription) {
                            onChange(years[0]?.value);
                            notifyAlert(t('No_plan'));
                            return;
                          }
                          onChange(val?.value);
                        }}
                        options={years}
                      />
                    )}
                  />
                )}
              </div>
            </div>

            {departments && (
              <div className="mb-4">
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="font-bold text-base">{t('department')}</span>
                </label>
                <div>
                  <Controller
                    rules={{ required: false }}
                    control={control}
                    name="department"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        styles={{
                          menuPortal: (base) => ({
                            ...base,
                            zIndex: 9999
                          }),
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important',
                              cursor: 'pointer'
                            }
                          })
                        }}
                        menuPortalTarget={document.body}
                        options={[
                          { id: '', name: t('All_departments') },
                          ...departments.map((dept) => ({ id: dept.id, name: dept.name }))
                        ]}
                        getOptionLabel={(option) => option.name}
                        getOptionValue={(option) => option.id}
                        value={
                          value
                            ? departments.find((dept) => dept.id === value) || { id: '', name: t('All_departments') }
                            : { id: '', name: t('All_departments') }
                        }
                        className="w-80"
                        onChange={(selectedOption) => {
                          if (!validSubscription) {
                            notifyAlert(t('No_plan'));
                            onChange(null); // Sets the value to zero
                            return;
                          }
                          onChange(selectedOption?.id);
                        }}
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {!teamsMobile && (
        <div className="mt-4 flex justify-end p-4 sm:px-6">
          <button
            type="submit"
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
          >
            {loading && (
              <div className="-ml-1 mr-3">
                <Loader />
              </div>
            )}
            {t('Export')}
          </button>
        </div>
      )}
    </form>
  );
};

export default Export;
