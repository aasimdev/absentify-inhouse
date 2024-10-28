import { Switch } from '@headlessui/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Display, TimeFormat } from '@prisma/client';
import { format } from 'date-fns';
import { classNames } from 'lib/classNames';
import type { NextPage } from 'next';
import useTranslation from 'next-translate/useTranslation';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { api, RouterInputs } from '~/utils/api';
import ScheduleBox from '../../../components/schedules/ScheduleBox';
import timezones from '../../../helper/timezones';
import CrowdinTrans from '../CrowdinTrans';
import { notifyError, notifySuccess } from '~/helper/notify';
import { createLogo } from '@components/layout/base';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { hasEnterpriseSubscription } from 'lib/subscriptionHelper';
import Loader from '@components/calendar/Loader';
import { dateFormats } from "~/helper/dateFormats";
import { useDarkSide } from '@components/ThemeContext';

type Combined = { id: string } & RouterInputs['workspace']['edit']['data'];
const General: NextPage = () => {
  const [theme] = useDarkSide();
  const { t, lang } = useTranslation('settings_organisation');
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch
  } = useForm<Combined>();
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

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFavicon, setPreviewFavicon] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const [imageRatioSquare, setImageRatioSquare] = useState<boolean | null>(null);
  const default_Show = [
    { label: t('Show_logo_company_name'), value: Display.ShowLogoAndName },
    { label: t('Show_logo_only'), value: Display.ShowLogo }
  ];
  const changedTimezones = useMemo(
    () => [...timezones, { name: t('Search_for'), tzCode: '__SEARCH_FOR__' }],
    [timezones]
  );
  const GLOBAL_LANGUAGEVALUE = watch('global_language');
  const utils = api.useContext();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });

  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, { staleTime: 60000 });
  const editWorkspace = api.workspace.edit.useMutation();
  const deleteImage = api.workspace.deleteImage.useMutation();
  const updateRatio = api.workspace.changeImageRatio.useMutation();
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
  const default_Name_Format = [
    { label: t('Microsoft_DisplayName'), value: 'Microsoft_DisplayName' },
    { label: t('First_name'), value: 'First' },
    { label: t('Last_name'), value: 'Last' },
    { label: t('First_name_last_name'), value: 'FirstLast' },
    { label: t('Last_name_first_name'), value: 'LastFirst' }
  ];

  const onRefreshGeneralScheduleHandler = async () => {
    await utils.member.all.invalidate();
    await utils.workspace_schedule.current.invalidate();
  };

  const onSubmit: SubmitHandler<Combined> = async (data) => {
    if(data.global_timezone === '__SEARCH_FOR__') {
      data.global_timezone = workspace?.global_timezone ?? 'Pacific/Midway';
    }
    try {
      await editWorkspace.mutateAsync(
        {
          id: data.id,
          data
        },
        {
          async onSuccess() {
            await utils.workspace.current.invalidate();

            notifySuccess(t('Saved_successfully'));
          },
          onError(error: any) {
            notifyError(error.message);
          }
        }
      );
    } catch (error: any) {
      notifyError(error.message);
    }
  };
  const handleRatioChange = async () => {
    try {
      if (!workspace || imageRatioSquare === null) return;
      const response = await updateRatio.mutateAsync(
        {
          id: workspace.id,
          company_logo_ratio_square: !imageRatioSquare
        },
        {
          async onSuccess() {
            await utils.workspace.current.invalidate();

            notifySuccess(t('Saved_successfully'));
          },
          onError(error: any) {
            notifyError(error.message);
          }
        }
      );
    } catch (error: any) {
      notifyError(error.message);
    }
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setImageLoading(true);
      let file: File | null = null;
      if (event?.target.files?.[0]) {
        file = event.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      });
      setImageLoading(false);
      if (response.ok) {
        notifySuccess(t('Uploaded_successfully'));
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
    } catch (error: any) {
      notifyError(error.message);
    }
  };

  const handleFaviconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setFaviconLoading(true);
      let file: File | null = null;
      if (event?.target.files?.[0]) {
        file = event.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewFavicon(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
      if (!file) return;
      const formData = new FormData();
      formData.append('type', 'favicon');
      formData.append('file', file);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      });
      setFaviconLoading(false);
      if (response.ok) {
        notifySuccess(t('Uploaded_successfully'));
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
    } catch (error: any) {
      notifyError(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      setPreviewImage(null);
      if (!workspace) return;
      await deleteImage.mutateAsync(
        {
          id: workspace?.id,
          type: 'logo'
        },
        {
          async onSuccess() {
            await utils.workspace.current.invalidate();

            notifySuccess(t('Deleted_successfully'));
          },
          onError(error: any) {
            notifyError(error.message);
          }
        }
      );
    } catch (error: any) {
      notifyError(error.message);
    }
  };

  const handleDeleteFavicon = async () => {
    try {
      setPreviewFavicon(null);
      setFaviconLoading(true);
      if (!workspace) return;
      await deleteImage.mutateAsync(
        {
          id: workspace?.id,
          type: 'favicon'
        },
        {
          async onSuccess() {
            await utils.workspace.current.invalidate();

            notifySuccess(t('Deleted_successfully'));
          },
          onError(error: any) {
            notifyError(error.message);
          }
        }
      );
      setFaviconLoading(false);
    } catch (error: any) {
      notifyError(error.message);
    }
  };

  useEffect(() => {
    if (workspace) {
      for (let index = 0; index < Object.keys(workspace).length; index += 1) {
        const element = Object.keys(workspace)[index];
        // @ts-ignore
        setValue(element, workspace[element]);
      }
      setImageRatioSquare(workspace.company_logo_ratio_square);
    }
  }, [workspace]);

  let enterprisePlan = null;
  if (workspace) {
    enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
  }


  const logo = createLogo(workspace?.company_logo_url, workspace?.company_logo_ratio_square ? '256x256' : '400x80');
  return (
    <form className="divide-y divide-gray-200 dark:divide-gray-500 lg:col-span-10 dark:bg-teams_brand_dark_100" onSubmit={handleSubmit(onSubmit)}>
      {/* Workspace section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{t('Workspace_settings')}</h2>
        </div>
        {enterprisePlan ? (
          <>
            <div className="mt-6">
              <div className="text-md font-medium text-gray-900 dark:text-white">{t('Company')}</div>
              <div className="shrink-0 flex items-center mt-6 sm:flex-row flex-col">
                <div className="h-24">
                  {!previewImage && !logo ? (
                    <div className="flex items-center">
                      <label htmlFor="file-upload" className="cursor cursor-pointer">
                        <div
                          className={classNames(
                            imageRatioSquare ? 'w-24 h-24' : 'sm:w-96 w-44 h-20',
                            'flex items-center justify-center',
                            'border border-gray-300',
                            'group',
                            'hover:bg-gray-300 dark:hover:bg-teams_brand_dark_400 dark:hover:text-gray-200'
                          )}
                        >
                          <span className="group-hover:hidden flex items-center justify-center text-sm text-gray-400">
                            {t('Logo_not_set')}
                          </span>
                          <span className="hidden group-hover:flex items-center justify-center text-sm text-black">
                            {t('Upload')}
                          </span>
                        </div>
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".jpg, .jpeg, .png, .webp, .svg"
                        onChange={(e: any) => handleImageChange(e)}
                        style={{ display: 'none' }}
                      />
                    </div>
                  ) : (
                    <div className="relative group">
                      {deleteImage.isLoading ||
                        imageLoading ||
                        (updateRatio.isLoading && (
                          <div className="absolute w-6 h-6 left-full transform -translate-x-2/4 -translate-y-2/4 z-10">
                            <Loader />
                          </div>
                        ))}
                      {!deleteImage.isLoading && !imageLoading && !updateRatio.isLoading && (
                        <button
                          type="button"
                          className="absolute w-6 h-6 left-full transform -translate-x-2/4 -translate-y-2/4"
                          onClick={handleDelete}
                        >
                          <svg
                            className=" hidden group-hover:block"
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="white"
                            stroke="#000"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      )}
                      <img
                        src={previewImage ? previewImage : logo ? logo : '/icon.png'}
                        alt="absentify"
                        className={classNames(imageRatioSquare ? ' w-24 h-24' : 'w-60 h-20')}
                      />
                    </div>
                  )}
                </div>
                <button type="button" onClick={handleRatioChange} className="flex flex-col ml-6">
                  <div className="flex items-center">
                    <div className="text-sm font-normal text-blue-500 sm:mt-0 mt-4 ">
                      {imageRatioSquare ? t('switch_landscape_layout') : t('switch_square_layout')}
                    </div>
                    <ArrowPathIcon color="#1874f0" className=" w-3 h-3 ml-1 sm:mt-0 mt-4" />
                  </div>
                  <div className="text-sm font-normal text-gray-500">
                    {imageRatioSquare ? t('recomended_size_400x80px') : t('recomended_size_256x256px')}
                  </div>
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-col lg:flex-row">
              <div className="grow space-y-6">
                <div>
                  <label htmlFor="aria-example-input" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t('Display')}
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <Controller
                      rules={{ required: true }}
                      control={control}
                      name="display_logo"
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
                          value={default_Show.find((x) => x.value === value)}
                          
                          className="w-full my-react-select-container"
                          classNamePrefix="my-react-select"

                          onChange={(val) => {
                            onChange(val?.value);
                          }}
                          options={default_Show}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col lg:flex-row">
              <div className="grow space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    
                    {t('Company_name')}
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      {...register('name', { required: true })}
                      type="text"
                      name="name"
                      autoComplete="name"
                      className="block w-full min-w-0 grow  rounded border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:border-teams_brand_dark_400 dark:bg-teams_brand_dark_100 dark:text-gray-200"
                    />
                  </div>{' '}
                  {errors.name && <span>{t('This_field_is_required')}</span>}
                </div>
              </div>
            </div>
            <div className="mt-6 text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('Favicon')}
              <div className="h-11 w-11 mt-3">
                {!workspace?.favicon_url && !previewFavicon ? (
                  <div className="flex items-center">
                    <label htmlFor="file-upload-favicon dark:text-gray-200" className="cursor cursor-pointer">
                      <div
                        className={classNames(
                          'w-11 h-11',
                          'flex items-center justify-center',
                          'border border-gray-300 dark:border-gray-500',
                          'group',
                          'hover:bg-gray-300 dark:hover:bg-teams_brand_dark_400 dark:hover:text-gray-200'
                        )}
                      >
                        <span className="group-hover:flex group-hover:text-black items-center justify-center text-xs text-gray-400 dark:text-gray-200">
                          {t('Upload')}
                        </span>
                      </div>
                    </label>
                    <input
                      id="file-upload-favicon"
                      type="file"
                      accept=".jpg, .jpeg, .png, .webp, .svg"
                      onChange={(e: any) => handleFaviconChange(e)}
                      style={{ display: 'none' }}
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    {faviconLoading && (
                      <div className="absolute w-6 h-6 left-full transform -translate-x-2/4 -translate-y-2/4 z-10">
                        <Loader />
                      </div>
                    )}
                    {!faviconLoading && (
                      <button
                        type="button"
                        className="absolute w-6 h-6 left-full transform -translate-x-2/4 -translate-y-2/4"
                        onClick={handleDeleteFavicon}
                      >
                        <svg
                          className=" hidden group-hover:block"
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="white"
                          stroke="#000"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </button>
                    )}
                    <img
                      src={
                        previewFavicon ? previewFavicon : workspace?.favicon_url ? workspace?.favicon_url : '/icon.png'
                      }
                      alt="absentify"
                      className=" w-11 h-11"
                    />
                  </div>
                )}
              </div>
              <div className="mt-1 text-sm font-normal text-gray-500 dark:text-gray-200">{t('recommended_size_96x96')}</div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col lg:flex-row">
            <div className="grow space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('Company_name')}
                </label>
                
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    {...register('name', { required: true })}
                    type="text"
                    name="name"
                    autoComplete="name"
                    className="block w-full min-w-0 grow  rounded border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-white dark:border-teams_brand_dark_400"
                  />
                </div>{' '}
                {errors.name && <span>{t('This_field_is_required')}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_Time_zone')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm ring-transparent">
                <Controller
                  control={control}
                  rules={{ required: true }}
                  name="global_timezone"
                  render={({ field: { onChange, value } }) => (
                    <Select
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
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
                        setValue('global_timezone', '__SEARCH_FOR__');
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
              </div>{' '}
              {errors.global_timezone && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_language')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Default_Settings_Description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip"
                  className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm ring-transparent">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="global_language"
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
              </div>{' '}
              <div className=" text-center text-sm dark:text-gray-200">
                {languageOptions.find((x) => x.value === GLOBAL_LANGUAGEVALUE)?.community && (
                  <CrowdinTrans lang={GLOBAL_LANGUAGEVALUE ?? "en"} />
                )}
              </div>
              {errors.global_language && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Fiscal_year_starts_month')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Fiscal_year_starts_month_description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  className="shadow z-50"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm ring-transparent">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="fiscal_year_start_month"
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
                      value={value ? months.find((x) => x.value === value) : months.find((x) => x.value === 0)}
                  className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                      onChange={async (val) => {
                        onChange(val?.value);
                      }}
                      options={months}
                    />
                  )}
                />
              </div>{' '}
              {errors.fiscal_year_start_month && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_date_format')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Default_Settings_Description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip"
                  className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="global_date_format"
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
              </div>{' '}
              {errors.global_date_format && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_time_format')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Default_Settings_Description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip"
                  className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="global_time_format"
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
              </div>{' '}
              {errors.global_time_format && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_week_start')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Default_Settings_Description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip"
                  className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="global_week_start"
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
                      value={weekStartData.find((x) => x.value === value)}
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
              {errors.global_week_start && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <label htmlFor="aria-example-input" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Default_Name_Format')}
                <span
                  className="ml-1 flex items-center cursor-pointer"
                  data-tooltip-id="questionM-tooltip"
                  data-tooltip-content={t('Default_Name_Format_Description')}
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                >
                  <QuestionMarkCircleIcon height={12} />
                </span>
                <ReactTooltip
                  id="questionM-tooltip"
                  className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                  classNameArrow="shadow-sm"
                  place="top"
                  style={{ width: '360px' }}
                />
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Controller
                  rules={{ required: true }}
                  control={control}
                  name="global_name_format"
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
                      value={default_Name_Format.find((x) => x.value === value)}
                       className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                      onChange={(val) => {
                        onChange(val?.value);
                      }}
                      options={default_Name_Format}
                    />
                  )}
                />
              </div>{' '}
              {errors.global_name_format && <span> {t('This_field_is_required')}</span>}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col lg:flex-row">
          <div className="grow space-y-6">
            <div>
              <Switch.Group as="li" className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Global_Display_calendar_weeks')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500  dark:text-gray-400">
                    {t('Global_Display_calendar_weeks_description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="global_display_calendar_weeks"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      checked={value}
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
                          value ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
              <label htmlFor="aria-example-input" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('Business_hours')}
              </label>
              <div className="mt-1 flex ">
                {workspaceSchedule && (
                  <ScheduleBox
                    showState={false}
                    enableEdit={true}
                    mode="workspace_schedules"
                    key={workspaceSchedule.id}
                    schedule={workspaceSchedule}
                    state="current" 
                    onInvalidate={onRefreshGeneralScheduleHandler} 
                    isLoading={false}                  
                    />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy section */}
      <div className="divide-y divide-gray-200 pt-6 dark:divide-gray-500">
        <div className="px-4 sm:px-6">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{t('Privacy')}</h2>
            <p className="mt-1 text-sm text-gray-500"></p>
          </div>
          <ul role="list" className="mt-2 divide-y divide-gray-200">
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                  {t('Other_departments')}
                </Switch.Label>
                <Switch.Description className="text-sm text-gray-500 dark:text-gray-400">
                  {t('Other_departments_description')}
                </Switch.Description>
              </div>
              <Controller
                control={control}
                name="privacy_show_otherdepartments"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value}
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
                        value ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                )}
              />
            </Switch.Group>
          </ul>
          <ul role="list" className="mt-2 divide-y divide-gray-200">
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                  {t('Calendar_view')}
                </Switch.Label>
                <Switch.Description className="text-sm text-gray-500 dark:text-gray-400">
                  {t('Calendar_view_description')}
                </Switch.Description>
              </div>
              <Controller
                control={control}
                name="privacy_show_calendarview"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value}
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
                        value ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                )}
              />
            </Switch.Group>
          </ul>
          <ul role="list" className="mt-2 divide-y divide-gray-200 ">
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                  {t('absences_in_the_past')}
                </Switch.Label>
                <Switch.Description className="text-sm text-gray-500 dark:text-gray-400">
                  {t('absences_in_the_past_description')}
                </Switch.Description>
              </div>
              <Controller
                control={control}
                name="privacy_show_absences_in_past"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value}
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
                        value ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                )}
              />
            </Switch.Group>
          </ul>
          <Switch.Group as="li" className="flex items-center justify-between py-4">
            <div className="flex flex-col">
              <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                {t('Manager_cancel_request_in_the_past')}
              </Switch.Label>
              <Switch.Description className="text-sm text-gray-500 dark:text-gray-400">
                {t('Manager_cancel_request_in_the_past_description')}
              </Switch.Description>
            </div>
            <Controller
              control={control}
              name="allow_manager_past_request_cancellation"
              render={({ field: { onChange, value } }) => (
                <Switch
                  checked={value}
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
                      value ? 'translate-x-5 dark:bg-[#242424]' : 'translate-x-0 dark:bg-[#BBBBBB]',
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              )}
            />
          </Switch.Group>
        </div>
        <div className="mt-4 flex justify-end p-4 sm:px-6">
          <button
            type="submit"
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-offset-0 dark:bg-teams_brand_dark_300 dark:text-gray-200 dark:ring-0"
          >
            {editWorkspace.isLoading && (
              <div className="-ml-1 mr-3">
                <Loader />
              </div>
            )}
            {t('Save')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default General;
