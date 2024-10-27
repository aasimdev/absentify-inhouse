import 'react-datepicker/dist/react-datepicker.css';
import timezones from 'helper/timezones';
import { Switch } from '@headlessui/react';
import { addMinutes } from 'date-fns';
import { classNames } from 'lib/classNames';
import { dateToIsoDate } from 'lib/DateHelper';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { createName } from '~/utils/createName';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';

import ProfileImage from '../../../../../components/layout/components/ProfileImage';
import SetEmailModal from './SetEmailModal';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { Status, TimeFormat } from '@prisma/client';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CustomHeader } from '@components/CustomHeader';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import CrowdinTrans from '@modules/settings/CrowdinTrans';
import { dateFormats } from '~/helper/dateFormats';

export default function Profile(props: { onClose: Function; currentMember: defaultMemberSelectOutput }) {
  const { t, lang } = useTranslation('users');
  const utils = api.useContext();
  const [loading, setLoading] = useState<boolean>(false);
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
    clearErrors
  } = useForm<EditMemberType>();
  type StatusMember = {
    invite_mail_sent: boolean;
    archived: boolean;
  };
  type EditMemberType = StatusMember & RouterInputs['member']['edit']['data'];
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: PUBLIC_HOLIDAYS } = api.public_holiday.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: adminIds, refetch: refetchAdminIds } = api.member.adminIds.useQuery(undefined, { staleTime: 60000 });
  const editMember = api.member.edit.useMutation();
  const editProfile = api.member.editProfile.useMutation();
  const { current_member } = useAbsentify();
  const language = watch('language');
  const weekStartData = [
    { label: t('Sunday'), value: '0' },
    { label: t('Monday'), value: '1' },
    { label: t('Tuesday'), value: '2' },
    { label: t('Wednesday'), value: '3' },
    { label: t('Thursday'), value: '4' },
    { label: t('Friday'), value: '5' },
    { label: t('Saturday'), value: '6' }
  ];
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
  const changedTimezones = useMemo(
    () => [...timezones, { name: t('Search_for'), tzCode: '__SEARCH_FOR__' }],
    [timezones]
  );
  const timeFormats: { label: string; value: string }[] = [
    { label: t('24_hour'), value: TimeFormat.H24 },
    { label: t('12_hour'), value: TimeFormat.H12 }
  ];
  const onSubmit: SubmitHandler<EditMemberType> = async (data: EditMemberType) => {
    setLoading(true);

    if (!props.currentMember?.id) {
      setLoading(false);
      notifyError('Error');
      return;
    }

    if (data.timezone === '__SEARCH_FOR__') {
      data.timezone = props.currentMember.timezone ?? 'Pacific/Midway';
    }

    if (data.birthday) {
      data.birthday = addMinutes(data.birthday, data.birthday.getTimezoneOffset() * -1);
    }

    if (data.employment_start_date) {
      data.employment_start_date = addMinutes(
        data.employment_start_date,
        data.employment_start_date.getTimezoneOffset() * -1
      );
    }
    if (!data.employment_end_date) {
      data.employment_end_date = null;
    } else if (data.employment_end_date) {
      data.employment_end_date = addMinutes(
        data.employment_end_date,
        data.employment_end_date.getTimezoneOffset() * -1
      );
    }

    if (props.currentMember.status === Status.INACTIVE && data.invite_mail_sent && data.archived) {
      setLoading(false);
      notifyError(t('cant_be_archived&active'));
      return;
    }

    if (data.invite_mail_sent && !data.archived) {
      data.status = Status.ACTIVE;
    } else if (data.archived) {
      data.status = Status.ARCHIVED;
    } else {
      if (props.currentMember.status === Status.ARCHIVED && !data.archived) {
        data.status = Status.ACTIVE;
      } else {
        data.status = Status.INACTIVE;
      }
    }

    data.workspace_id = props.currentMember.workspace_id;

    if (
      (data.name && data.name.trim().length > 0) ||
      (data.name && data.name !== props.currentMember.name) ||
      (data.last_name && data.last_name.trim().length > 0) ||
      (data.last_name && data.last_name !== props.currentMember.lastName) ||
      (data.first_name && data.first_name.trim().length > 0) ||
      (data.first_name && data.first_name !== props.currentMember.firstName)
    ) {
      if (props.currentMember.email) {
        data.name = createName(
          workspace?.global_name_format,
          data.first_name,
          data.last_name,
          data.name,
          props.currentMember.email
        );
      }
    }
    //update member
    await editMember.mutateAsync(
      {
        id: props.currentMember.id,
        data
      },
      {
        onSuccess: async () => {
          await refetchAdminIds();
          utils.member.all.invalidate();
          props.onClose();
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);

          setLoading(false);
        }
      }
    );
    //update members profile
    await editProfile.mutateAsync(
      {
        id: props.currentMember.id,
        data: {
          ...props.currentMember,
          language: data.language as string,
          date_format: data.date_format ? data.date_format : 'MM/dd/yyyy',
          time_format: data.time_format ? data.time_format : TimeFormat.H24,
          week_start: data.week_start ? data.week_start : '0',
          timezone: data.timezone as string,
          display_calendar_weeks: data.display_calendar_weeks as boolean
        }
      },
      {
        async onSuccess() {
          if (current_member && current_member.id === props.currentMember.id) {
            localStorage.setItem('redirect_after_login', location.origin + '/settings/organisation/users');
            location.href = location.origin + '/api/auth/refresh';
          }
        },
        onError(editError) {
          notifyError(editError.message);
        }
      }
    );
  };

  useEffect(() => {
    if (props.currentMember) {
      const memberDepartmentIds = props.currentMember.departments
        .map((department) => department.department?.id)
        .filter((x) => x != null);
      if (memberDepartmentIds.length > 0) setValue('member_department_ids', memberDepartmentIds);
      setValue('public_holiday_id', props.currentMember.public_holiday_id);
      setValue('is_admin', props.currentMember.is_admin);
      setValue('archived', props.currentMember.status === Status.ARCHIVED);
      setValue('custom_id', props.currentMember.custom_id);
      setValue('birthday', props.currentMember.birthday ? dateToIsoDate(props.currentMember.birthday) : null);
      setValue(
        'employment_start_date',
        props.currentMember.employment_start_date ? dateToIsoDate(props.currentMember.employment_start_date) : null
      );
      setValue(
        'employment_end_date',
        props.currentMember.employment_end_date ? dateToIsoDate(props.currentMember.employment_end_date) : null
      );
      setValue('invite_mail_sent', props.currentMember.status === 'ACTIVE');
      setValue('name', props.currentMember.name);
      setValue('first_name', props.currentMember.firstName);
      setValue('last_name', props.currentMember.lastName);
      setValue('timezone', props.currentMember.timezone ?? 'Pacific/Midway');
      setValue('display_calendar_weeks', props.currentMember.display_calendar_weeks);
      setValue('language', props.currentMember.language);
      setValue('date_format', props.currentMember.date_format);
      setValue('time_format', props.currentMember.time_format);
      setValue('week_start', props.currentMember.week_start);
    }
  }, [props.currentMember]);

  function getLastYearDate(): Date {
    const today = new Date();       
    const lastYearDate = new Date(today);

    lastYearDate.setFullYear(today.getFullYear() - 1);

    return lastYearDate;
}

function getIn10YearsDate(): Date {
    const today = new Date();
    const in10YearsDate = new Date(today);

    in10YearsDate.setFullYear(today.getFullYear() + 10);

    return in10YearsDate;
}

  const isLastAdmin = (): boolean => {
    if (!props.currentMember?.is_admin) return false;
    if (!adminIds) return true;
    return adminIds.length <= 1;
  };
  return (
    <form className="divide-y divide-gray-200 lg:col-span-9 dark:bg-teams_brand_dark_600 dark:divide-gray-200" onSubmit={handleSubmit(onSubmit)}>
      {/* Profile section */}
      <div className="py-6 px-4 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">{t('Profile')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('Profile_Description')}</p>
        </div>
        {props.currentMember.status === Status.INACTIVE && (
          <div className="rounded-md bg-yellow-50 p-4 mt-2">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">{t('attention_needed')}</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{t('attention_needed_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row">
          <div className="grow space-y-2  lg:space-y-6 ">
            <>
              <div className="flex justify-center sm:justify-start ">
                <div className="pr-2 dark:text-gray-200">
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
                    {t('first_name')}
                  </label>
                  {props.currentMember?.email &&
                    props.currentMember.status === 'ACTIVE' &&
                    props.currentMember?.firstName}
                  {(!props.currentMember?.email || props.currentMember.status !== 'ACTIVE') && (
                    <div className="mt-2 mb-4 mr-0 sm:mr-4 dark:text-gray-200">
                      <input
                        {...register('first_name', { required: false })}
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200"
                      />
                    </div>
                  )}
                </div>
                <div className="dark:text-gray-200">
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
                    {t('last_name')}
                  </label>
                  {props.currentMember?.email &&
                    props.currentMember.status === 'ACTIVE' &&
                    props.currentMember?.lastName}
                  {(!props.currentMember?.email || props.currentMember.status !== 'ACTIVE') && (
                    <div className="mt-2 mr-0 sm:mr-4 mb-4 dark:text-gray-200">
                      <input
                        {...register('last_name', { required: false })}
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className=" flex flex-col items-center sm:block dark:text-gray-200">
                <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
                  {t('display_name')}
                </label>
                {props.currentMember?.email && props.currentMember.status === 'ACTIVE' && props.currentMember.name}
                {(!props.currentMember?.email || props.currentMember.status !== 'ACTIVE') && (
                  <div className="mt-2 mb-4 w-[184px] dark:text-gray-200">
                    <input
                      {...register('name', { required: false })}
                      type="text"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200"
                    />
                  </div>
                )}
              </div>
            </>
            <div className="">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
                {t('Email')}
              </label>
              <div className="mt-1 flex justify-center sm:justify-start dark:text-gray-200">
                {props.currentMember?.email ?? (
                  <p
                    onClick={() => {
                      setShowEmailModal(true);
                    }}
                    className="cursor-pointer text-sm text-blue-500 underline dark:text-gray-200"
                  >
                    {t('set_email')}
                  </p>
                )}

                {!props.currentMember.microsoft_user_id && (
                  <p
                    onClick={() => {
                      setShowEmailModal(true);
                    }}
                    className="ml-2 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </p>
                )}
              </div>
            </div>
          </div>

          {props.currentMember?.has_cdn_image && (
            <div className="mt-6 grow lg:mt-0 lg:ml-6 lg:shrink-0 lg:grow-0">
              <div className="mt-1">
                <div className="flex items-center ">
                  <div
                    className="inline-block h-40 w-40 shrink-0 overflow-hidden rounded-full mx-auto"
                    aria-hidden="true"
                  >
                    <ProfileImage member={props.currentMember} tailwindSize="40" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 sm:col-span-6">
            <label htmlFor="Custom_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('Custom_id')}
            </label>
            <input
              {...register('custom_id', { required: false })}
              type="text"
              maxLength={30}
              placeholder={t('Custom_id_placeholder')}
              className="block w-full mt-1 rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:border-teams_brand_dark_400 dark:bg-transparent dark:text-white"
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <label htmlFor="Birthday" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('Birthday')}
            </label>
            <Controller
              control={control}
              name="birthday"
              render={({ field }) => (
                <DatePicker
                  renderCustomHeader={(props) => <CustomHeader {...props} />}
                  calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                  locale={lang}
                  maxDate={getLastYearDate()} 
                  dateFormat={current_member?.date_format}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:border-teams_brand_dark_400 dark:bg-transparent dark:text-white"
                  selected={field.value}
                  onChange={(date: Date) => field.onChange(date)}
                  wrapperClassName="w-full"
                />
              )}
            />
          </div>
          <div
            className={classNames(
              watch('archived') ? 'col-span-12 sm:col-span-4' : 'col-span-12 sm:col-span-6',
              ' self-end'
            )}
          >
            <label htmlFor="EmploymentStartDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('EmploymentStartDate')}
            </label>
            <Controller
              control={control}
              name="employment_start_date"
              render={({ field }) => (
                <DatePicker
                  renderCustomHeader={(props) => <CustomHeader {...props} />}
                  calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                  maxDate={getIn10YearsDate()}
                  locale={lang}
                  dateFormat={current_member?.date_format}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:border-teams_brand_dark_400 dark:bg-transparent dark:text-white"
                  selected={field.value}
                  onChange={(date: Date) => field.onChange(date)}
                  wrapperClassName="w-full"
                />
              )}
            />
          </div>{' '}
          {watch('archived') && (
            <div
              className={classNames(
                watch('archived') ? 'col-span-12 sm:col-span-4' : 'col-span-12 sm:col-span-6',
                ' self-end'
              )}
            >
              <label htmlFor="please_select_endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('please_select_endDate')}
              </label>
              <Controller
                control={control}
                name="employment_end_date"
                render={({ field }) => (
                  <DatePicker
                    renderCustomHeader={(props) => <CustomHeader {...props} />}
                    calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                    locale={lang}
                    dateFormat={current_member?.date_format}
                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:border-teams_brand_dark_400 dark:bg-transparent dark:text-white"
                    selected={field.value}
                    required
                    onChange={(date: Date) => {
                      field.onChange(date);
                      clearErrors('employment_end_date');
                    }}
                  />
                )}
              />
            </div>
          )}
          <div
            className={classNames(
              watch('archived') ? 'col-span-12 sm:col-span-4' : 'col-span-12 sm:col-span-6',
              ' self-end'
            )}
          >
            <label htmlFor="Public_holidays" className="block text-sm font-medium text-gray-700 mb-1 dark:border-teams_brand_dark_400 dark:bg-transparent dark:text-white">
              {t('Public_holidays')}
            </label>
            {PUBLIC_HOLIDAYS && (
              <Controller
                rules={{ required: true }}
                control={control}
                name="public_holiday_id"
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
                    value={value ? PUBLIC_HOLIDAYS.find((x) => x.id === value) : null}
                    onChange={(val) => {
                      onChange(val?.id);
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={PUBLIC_HOLIDAYS}
                     className="w-full my-react-select-container"
                    classNamePrefix="my-react-select"
                  />
                )}
              />
            )}
          </div>
          <div className="col-span-12">
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('department')}
            </label>

            {departments && (
              <Controller
                rules={{ required: true }}
                control={control}
                name="member_department_ids"
                render={({ field: { onChange, value } }) => (
                  <Select
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderColor: errors.member_department_ids ? '#Ef4444' : base.borderColor, //text-red-500
                        '*': {
                          boxShadow: 'none !important'
                        }
                      })
                    }}
                    isMulti
                    value={value ? departments.filter((x) => value.includes(x.id)) : undefined}
                    onChange={(val) => {
                      if (val) onChange(val.map((x) => x.id));
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={departments}
                     className="w-full my-react-select-container"
                    classNamePrefix="my-react-select"
                  />
                )}
              />
            )}
            {errors.member_department_ids && <p className="text-xs text-red-500 pt-1">{t('This_is_required')}</p>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-12 gap-6">
         
         
          <div className='col-span-12 sm:col-span-6'>
            <label htmlFor="DateFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <div className='col-span-12 sm:col-span-6'>
            <label htmlFor="TimeFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <div className='col-span-12 sm:col-span-6'>
            <label htmlFor="weekstart" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <div className='col-span-12 sm:col-span-6'>
            {' '}
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
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
          <div className="col-span-12 ">
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
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
            <div className=" text-center text-sm">
              {languageOptions.find((x) => x.value === language)?.community && <CrowdinTrans lang={language ?? 'en'} />}
            </div>
            {errors.language && <span>{t('This_field_is_required')}</span>}
          </div>
         
          <div className="col-span-12">
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-100" passive>
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
                    checked={value as boolean}
                    onChange={(val: boolean) => {
                      onChange(val);
                    }}
                    className={classNames(
                      value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_300 dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
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
      {/* Privacy section */}
      <div className=" divide-y divide-gray-200 dark:divide-gray-500">
        {(!isLastAdmin() ||
          props.currentMember.status === Status.ARCHIVED ||
          props.currentMember.status === Status.INACTIVE) && (
          <div className="px-4 sm:px-6">
            <ul role="list" className="mt-2 divide-y divide-gray-200 dark:divide-gray-500">
              <div className="sm:col-span-5">
                <div className="mt-1 flex ">
                  <Switch.Group as="li" className="flex items-center justify-between py-4">
                    <div className="flex flex-col">
                      <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-100" passive>
                        {t('inactive_user_toggle')}
                      </Switch.Label>
                      <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                        {t('inactive_user_toggle_desc') + ' '}
                        <a
                          className="underline"
                          href={
                            lang == 'de'
                              ? 'https://support.absentify.com/de/article/wie-erhalten-mitarbeiter-ohne-versendete-einladungs-e-mail-zugang-zu-absentify-1bth3sz/'
                              : 'https://support.absentify.com/en/article/how-do-employees-access-absentify-if-no-invitation-email-was-sent-1r9kr5w/'
                          }
                          target="_blank"
                        >
                          {t('read_more')}
                        </a>
                      </Switch.Description>
                    </div>
                    <Controller
                      defaultValue={true}
                      control={control}
                      name="invite_mail_sent"
                      render={({ field: { onChange, value } }) => (
                        <Switch
                          checked={value ?? undefined}
                          onChange={(val: boolean) => {
                            onChange(val);
                          }}
                          className={classNames(
                            value ? 'bg-teams_brand_500' : 'bg-gray-200',
                            'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:text-gray-200 bg-teams_brand_dark_500'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={classNames(
                              value ? 'translate-x-5' : 'translate-x-0',
                              'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:text-gray-200'
                            )}
                          />
                        </Switch>
                      )}
                    />
                  </Switch.Group>
                </div>
              </div>
              <Switch.Group as="li" className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                    {t('Administrator')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500">
                    {t('Administrator_Description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="is_admin"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      disabled={(() => {
                        if (props.currentMember.status === Status.ARCHIVED) return false;
                        return isLastAdmin();
                      })()}
                      checked={value}
                      onChange={(val: boolean) => {
                        onChange(val);
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500' : 'bg-gray-200',
                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:text-gray-200'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-ou t'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>

              <Switch.Group as="li" className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                    {t('Archive_User')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500">
                    {t('Archive_User_Description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="archived"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      disabled={(() => {
                        if (props.currentMember.status === Status.ARCHIVED) return false;
                        return isLastAdmin();
                      })()}
                      checked={value}
                      onChange={(val: boolean) => {
                        onChange(val);
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500' : 'bg-gray-200',
                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:text-gray-200'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out dark:text-gray-200'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            </ul>
          </div>
        )}
        <div className="mt-4 flex justify-end p-4 sm:px-6">
          <button
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              props.onClose(false);
            }}
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
          >
            {t('Cancel')}
          </button>
          <button
            disabled={loading}
            type="submit"
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_600 dark:text-gray-200"
          >
            {editMember.isLoading && (
              <div className="-ml-1 mr-3">
                <Loader />
              </div>
            )}
            {t('Save')}
          </button>
        </div>
      </div>
      {showEmailModal && (
        <SetEmailModal
          member_id={props.currentMember.id}
          open={showEmailModal}
          email={props.currentMember.email ?? null}
          onClose={() => {
            props.onClose();
            setShowEmailModal(false);
          }}
        />
      )}
    </form>
  );
}