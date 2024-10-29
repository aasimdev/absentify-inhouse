import { TimeFormat } from '@prisma/client';
import { format } from 'date-fns';
import type { NextPage } from 'next';
import setLanguage from 'next-translate/setLanguage';
import useTranslation from 'next-translate/useTranslation';
import React, { useEffect, useMemo } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { Switch } from '@headlessui/react';

import { api, RouterInputs, type RouterOutputs } from '~/utils/api';

import CrowdinTrans from '../CrowdinTrans';
import timezones from 'helper/timezones';
import { notifyError, notifySuccess } from '~/helper/notify';
import { classNames } from '~/lib/classNames';
import Loader from '@components/calendar/Loader';
import { dateFormats } from "~/helper/dateFormats";
type Combined = { id: string } & RouterInputs['member']['editProfile']['data'];
const General: NextPage = () => {
  const { t } = useTranslation('settings_profile');
  const { data: member, refetch: refetchUser } = api.member.current.useQuery(undefined, { staleTime: 60000 });
  const editProfile = api.member.editProfile.useMutation();

  const changedTimezones = useMemo(
    () => [...timezones, { name: t('Search_for'), tzCode: '__SEARCH_FOR__' }],
    [timezones]
  );

  const languageOptions = [
    { label: t('English'), value: 'en', community: false },
    { label: t('German'), value: 'de', community: false },
    { label: t('French'), value: 'fr', community: true },
    { label: t('Hungarian'), value: 'hu', community: true },
    { label: t('Italian'), value: 'it', community: true },
    { label: t('Polish'), value: 'pl', community: true },
    { label: t('Portuguese'), value: 'pt', community: true },
    { label: t('Russian'), value: 'ru', community: true },
    { label: t('Spanish'), value: 'es', community: true },
    { label: t('Turkish'), value: 'tr', community: true },
    { label: t('Ukrainian'), value: 'uk', community: true }
  ];
  const timeFormats: { label: string; value: string }[] = [
    { label: t('24_hour'), value: TimeFormat.H24 },
    { label: t('12_hour'), value: TimeFormat.H12 }
  ];

  const weekStartData = [
    { label: t('Sunday'), value: '0' },
    { label: t('Monday'), value: '1' },
    { label: t('Tuesday'), value: '2' },
    { label: t('Wednesday'), value: '3' },
    { label: t('Thursday'), value: '4' },
    { label: t('Friday'), value: '5' },
    { label: t('Saturday'), value: '6' }
  ];

  const {
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<Combined>();
  const lang = watch('language');

  const onSubmit: SubmitHandler<Combined> = async (data) => {
    if(data.timezone === '__SEARCH_FOR__') {
      data.timezone = member?.timezone ?? 'Pacific/Midway';
    }
    await editProfile.mutateAsync(
      {
        id: data.id,
        data: {
          email_notif_bday_anniv_remind: data.email_notif_bday_anniv_remind,
          email_notif_weekly_absence_summary: data.email_notif_weekly_absence_summary,
          email_notifications_updates: data.email_notifications_updates,
          email_ical_notifications: data.email_ical_notifications,
          language: data.language,
          date_format: data.date_format ? data.date_format : 'MM/dd/yyyy',
          time_format: data.time_format ? data.time_format : TimeFormat.H24,
          week_start: data.week_start ? data.week_start : '0',
          timezone: data.timezone,
          display_calendar_weeks: data.display_calendar_weeks,
          notifications_receiving_method: data.notifications_receiving_method
        }
      },
      {
        async onSuccess() {
          localStorage.setItem('redirect_after_login', location.origin + '/settings/profile');

          notifySuccess(t('Saved_successfully'));
          location.href = location.origin + '/api/auth/refresh';
        },
        onError(editError) {
          notifyError(editError.message);
        }
      }
    );
  };

  useEffect(() => {
    if (member) {
      for (let index = 0; index < Object.keys(member).length; index += 1) {
        const element = Object.keys(member)[index];
        // @ts-ignore
        setValue(element, member[element]);
      }
    }
  }, [member]);

  return (
    <form className="min-h-screen divide-y divide-gray-200 lg:col-span-9" onSubmit={handleSubmit(onSubmit)}>
      {/* Workspace section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Display')}</h2>
        </div>

        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Language')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="language"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          '*': {
                            boxShadow: 'none !important'
                          }
                        })
                      }}
                      value={value ? languageOptions.find((x) => x.value === value) : undefined}
                      
                      className="w-full my-react-select-container"
                      classNamePrefix="my-react-select"
                      onChange={async (val) => {
                        onChange(val?.value);
                      }}
                      options={languageOptions}
                    />
                  )}
                />
              </div>
              <div className=" text-center text-sm dark:text-gray-200">
                {languageOptions.find((x) => x.value === lang)?.community && <CrowdinTrans lang={lang ?? 'en'} />}
              </div>
              {errors.language && <span>{t('This_field_is_required')}</span>}
            </div>
            <div>
              {' '}
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Time_zone')}
              </label>
              <div className="flex mt-1 rounded-md shadow-sm">
                <Controller
                  control={control}
                  rules={{ required: true }}
                  name="timezone"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          '*': {
                            boxShadow: 'none !important'
                          }
                        })
                      }}
                      // menuPortalTarget={document.body}
                      value={changedTimezones.find((x) => x.tzCode === value)}
                      
                      className="w-full my-react-select-container"
                      classNamePrefix="my-react-select"
                      onMenuOpen={() => {
                        setValue('timezone', '__SEARCH_FOR__');
                      }}
                      onChange={(val) => {
                        if (val) onChange(val.tzCode);
                      }}
                      getOptionLabel={(option) => `${option.name}`}
                      getOptionValue={(option) => option.tzCode}
                      options={changedTimezones}
                    />
                  )}
                />
              </div>
              {errors.timezone && <span>{t('This_field_is_required')}</span>}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('DateFormat')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="date_format"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          '*': {
                            boxShadow: 'none !important'
                          }
                        })
                      }}
                      value={value ? dateFormats.find((x) => x.value === value) : undefined}
                      className="w-full my-react-select-container"
                      classNamePrefix="my-react-select"
                      onChange={(val) => {
                        onChange(val?.value);
                      }}
                      options={dateFormats}
                    />
                  )}
                />
              </div>
              {errors.date_format && <span>{t('This_field_is_required')}</span>}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('TimeFormat')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="time_format"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          '*': {
                            boxShadow: 'none !important'
                          }
                        })
                      }}
                      value={value ? timeFormats.find((x) => x.value === value) : undefined}
                      className="w-full my-react-select-container"
                      classNamePrefix="my-react-select"
                      onChange={(val) => {
                        onChange(val?.value);
                      }}
                      options={timeFormats}
                    />
                  )}
                />
              </div>
              {errors.time_format && <span>{t('This_field_is_required')}</span>}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('WeekStart')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="week_start"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        control: (base) => ({
                          ...base,
                          '*': {
                            boxShadow: 'none !important'
                          }
                        })
                      }}
                      value={value ? weekStartData.find((x) => x.value === value) : undefined}
                      className="w-full my-react-select-container"
                      classNamePrefix="my-react-select"
                      onChange={(val) => {
                        onChange(val?.value);
                      }}
                      options={weekStartData}
                    />
                  )}
                />
              </div>
              {errors.week_start && <span>{t('This_field_is_required')}</span>}
            </div>
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                  {t('Display_calendar_weeks')}
                </Switch.Label>
                <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                  {t('Display_calendar_weeks_description')}
                </Switch.Description>
              </div>
              <Controller
                control={control}
                name="display_calendar_weeks"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value}
                    onChange={(val: boolean) => {
                      onChange(val);
                    }}
                    className={classNames(
                      value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                      'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        value ? 'translate-x-5' : 'translate-x-0',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                )}
              />
            </Switch.Group>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end p-4 sm:px-6">
        <button
          type="submit"
          className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200"
        >
          {editProfile.isLoading && (
            <div className="-ml-1 mr-3">
              <Loader />
            </div>
          )}
          {t('Save')}
        </button>
      </div>
    </form>
  );
};

export default General;
