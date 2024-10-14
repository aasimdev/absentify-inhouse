import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Transition } from '@headlessui/react';
import ExclamationCircleIcon from '@heroicons/react/24/outline/ExclamationCircleIcon';
import { TimeFormat } from '@prisma/client';
import { countries } from 'lib/countries';
import useTranslation from 'next-translate/useTranslation';
import { event } from 'nextjs-google-analytics';
import { lintrk } from 'nextjs-linkedin-insight-tag';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import Select from 'react-select';
import type { RouterInputs } from '~/utils/api';
import { api } from '~/utils/api';
import timezones from '../../helper/timezones';
import { notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import CrowdinTrans from "@modules/settings/CrowdinTrans";
import { dateFormats } from "~/helper/dateFormats";

export default function RegisterModal(props: { onClose: Function }) {
  const { t, lang } = useTranslation('signup');
  const [loading, setLoading] = useState<boolean>(false);
  const { in_teams } = useAbsentify();
  const cancelButtonRef = useRef(null);
  const { data: invitation } = api.register.checkIfInvitationExists.useQuery();
  const { data: ipData } = api.register.getCountry.useQuery(undefined, {
    staleTime: 60000
  });
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue
  } = useForm<RouterInputs['register']['register']>();

  useEffect(() => {
    if (!ipData) return;

    const defaultDataValues: defaultDataValues = getDefaultSettingsFromLocation(ipData);
    for (const key in defaultDataValues) {
      if (defaultDataValues.hasOwnProperty(key)) {
        //@ts-ignore
        setValue(key as keyof defaultDataValues, defaultDataValues[key]);
      }
    }
  }, [ipData]);
  useEffect(() => {
    if (invitation) {
      location.reload();
    }
  }, [invitation]);
  const watchCountryCode = watch('country_code');

  const [counties, setCounties] = useState<
    {
      code: string;
      name: string;
      languages: string[];
    }[]
  >([]);
  const registerWorkspace = api.register.register.useMutation();
  const { data: session } = api.user.session.useQuery(undefined, {
    staleTime: 6000
  });
  const timeFormats: { label: string; value: string }[] = [
    { label: t('24_hour'), value: TimeFormat.H24 },
    { label: t('12_hour'), value: TimeFormat.H12 }
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

  const Error = () => {
    return (
      <div className="mt-2 inline-flex">
        <div className="pointer-events-none relative inset-y-0  right-0 flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
        </div>
        <span className="px-2 text-sm text-red-500">{t('This_field_is_required')}</span>
      </div>
    );
  };
  const weekStartData = [
    { label: t('Sunday'), value: '0' },
    { label: t('Monday'), value: '1' },
    { label: t('Tuesday'), value: '2' },
    { label: t('Wednesday'), value: '3' },
    { label: t('Thursday'), value: '4' },
    { label: t('Friday'), value: '5' },
    { label: t('Saturday'), value: '6' }
  ];

  const onSubmit: SubmitHandler<RouterInputs['register']['register']> = async (
    data: RouterInputs['register']['register']
  ) => {
    setLoading(true);
    const requiredFields: (keyof Partial<RouterInputs['register']['register']>)[] = ['country_code', 'name', 'global_date_format', 'global_time_format', 'global_week_start', 'global_timezone'];
    const invalidFields = requiredFields.filter(field => !data[field] || (data[field] as string)?.trim() === '');
    if(invalidFields.length > 0) {
      notifyError(t('invalid_fields') + invalidFields.join(', '));
      setLoading(false);
      return;
    }

    if(!data.language) data.language = lang;
    await registerWorkspace.mutateAsync(
      {
        country_code: data.country_code,
        county_code: data.county_code ? data.county_code : null,
        language: data.language,
        name: data.name,
        global_date_format: data.global_date_format,
        global_time_format: data.global_time_format,
        global_week_start: data.global_week_start,
        global_timezone: data.global_timezone,
        fiscal_year_start_month: data.fiscal_year_start_month,
        referrer: in_teams ? 'teams' : localStorage.getItem('absentify_referrer'),
        gclid: localStorage.getItem('gclid')
      },
      {
        onSuccess: async () => {
          if (typeof umami !== 'undefined') umami.track('RegisterACompany');
          
          event('RegisterACompany', {
            category: 'RegisterACompany',
            label: 'RegisterACompany'
          });
          if (typeof window.lintrk === 'function') lintrk('track', { conversion_id: 11795426 });

          const microsoft_ms_teams_tab_config = localStorage.getItem('microsoft-ms-teams-tab-config');
          if (microsoft_ms_teams_tab_config == '1') localStorage.removeItem('microsoft-ms-teams-tab-config');
          location.href =
            microsoft_ms_teams_tab_config == '1' ? location.origin + '/microsoft/ms-teams/tab/config' : location.origin;
          location.href = location.origin + '/api/auth/refresh';
          return;
        },
        onError: (error) => {
          notifyError(error.message);

          setLoading(false);
          return;
        }
      }
    );
  };
  useEffect(() => {
    if(!lang) return;
    setValue('language', lang);
  },[])

  useEffect(() => {
    let subdivisions: {
      code: string;
      name: string;
      languages: string[];
    }[] = [];
    const country = countries.find((x) => x.code === watchCountryCode);
    if (country) subdivisions = country.subdivisions;

    setCounties(subdivisions);
    if(subdivisions[0]?.code) {
      setValue('county_code', subdivisions[0].code);
    }

    if (ipData && ipData.state_code) {
      if (subdivisions.find((x) => x.code === ipData.state_code)) {
        setValue('county_code', ipData.state_code);
      }
    }
  }, [watchCountryCode]);

  useEffect(() => {
    if (!session?.orgName) return;
    setValue('name', session.orgName);
  }, [session]);

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-30 overflow-y-auto"
        initialFocus={cancelButtonRef}
        onClose={() => {
          if (!loading) props.onClose();
        }}
      >
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
            <Dialog.Overlay className="fixed inset-0 bg-gray-500/75 transition-opacity" />
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
            <div className="z-30 inline-block overflow-visible px-4 pt-5 pb-4 text-left align-bottom bg-white rounded-lg shadow-xl transition-all transform sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {t('Register_a_new_company')}
                  </Dialog.Title>
                  <form className="divide-y divide-gray-200" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                          {t('Company_name')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            {...register('name', { required: true })}
                            type="text"
                            name="name"
                            autoComplete="name"
                            className={`block w-full min-w-0 grow  rounded-md ${
                              errors.name
                                ? ' border-red-500 focus:border-red-400 focus:ring-red-200'
                                : ' border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 '
                            }   sm:text-sm`}
                          />
                        </div>{' '}
                        {errors.name && <Error />}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="country_name" className="block text-sm font-medium text-gray-700">
                          {t('Country')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          {countries && (
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="country_code"
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    control: (baseStyles) => ({
                                      ...baseStyles,
                                      borderColor: errors.country_code ? 'red' : 'lightGrey',
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  value={value ? countries.find((x) => x.code === value) : undefined}
                                  className="w-full"
                                  getOptionLabel={(option) => `${t(option.code)}`}
                                  getOptionValue={(option) => option.code}
                                  onChange={(val) => {
                                    if (val) {
                                      onChange(val.code);
                                    }
                                  }}
                                  options={countries}
                                />
                              )}
                            />
                          )}
                        </div>
                        {errors.country_code && <Error />}
                      </div>
                      {counties.length > 0 && (
                        <div className="sm:col-span-5">
                          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                            {t('County')}
                          </label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="county_code"
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    control: (baseStyles) => ({
                                      ...baseStyles,
                                      borderColor: errors.county_code ? 'red' : 'lightGrey',
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  value={value ? counties.find((x) => x.code === value) : undefined}
                                  className="w-full"
                                  getOptionLabel={(option) => `${option.name}`}
                                  getOptionValue={(option) => option.code}
                                  onChange={(val) => {
                                    if (val) {
                                      onChange(val.code);
                                    }
                                  }}
                                  options={counties}
                                />
                              )}
                            />
                          </div>
                          {errors.county_code && <Error />}
                        </div>
                      )}

                    <div className="sm:col-span-5">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        {t('language')}
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
                              className="w-full"
                              onChange={async (val) => {
                                onChange(val?.value);
                              }}
                              options={languageOptions}
                            />
                          )}
                        />
                      </div>
                      <div className=" text-center text-sm">
                        {languageOptions.find((x) => x.value === watch('language'))?.community && <CrowdinTrans lang={watch('language')} />}
                      </div>
                      {errors.language && <span>{t('This_field_is_required')}</span>}
                      </div>

                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Default_Time_zone')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <Controller
                            control={control}
                            rules={{ required: true }}
                            name="global_timezone"
                            render={({ field: { onChange, value } }) => (
                              <Select
                                styles={{
                                  menuPortal: (base) => ({
                                    ...base,
                                    zIndex: 9999
                                  }),

                                  control: (baseStyles) => ({
                                    ...baseStyles,
                                    borderColor: errors.global_timezone ? 'red' : 'lightGrey',
                                    '*': {
                                      boxShadow: 'none !important'
                                    }
                                  })
                                }}
                                menuPortalTarget={document.body}
                                value={timezones.find((x) => x.tzCode === value)}
                                className="w-full"
                                onChange={(val) => {
                                  if (val) onChange(val.tzCode);
                                }}
                                getOptionLabel={(option) => `${option.name}`}
                                getOptionValue={(option) => option.tzCode}
                                options={timezones}
                              />
                            )}
                          />
                        </div>
                        {errors.global_timezone && <Error />}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Default_date_format')}
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
                                className="w-full"
                                onChange={(val) => {
                                  onChange(val?.value);
                                }}
                                options={dateFormats}
                              />
                            )}
                          />
                        </div>
                        {errors.global_date_format && <Error />}
                      </div>

                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Default_week_start')}
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
                                className="w-full"
                                onChange={(val) => {
                                  onChange(val?.value);
                                }}
                                options={weekStartData}
                              />
                            )}
                          />
                        </div>
                        {errors.global_week_start && <Error />}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Default_time_format')}
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
                                className="w-full"
                                onChange={(val) => {
                                  onChange(val?.value);
                                }}
                                options={timeFormats}
                              />
                            )}
                          />
                        </div>
                        {errors.global_time_format && <Error />}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Fiscal_year_starts_month')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <Controller
                            rules={{
                              validate: (value) => (value !== null && value !== undefined) || 'This field is required'
                            }}
                            control={control}
                            defaultValue={0}
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
                                value={
                                  value ? months.find((x) => x.value === value) : months.find((x) => x.value === 0)
                                }
                                className="w-full "
                                onChange={async (val) => {
                                  onChange(val?.value);
                                }}
                                options={months}
                              />
                            )}
                          />
                        </div>
                        {errors.fiscal_year_start_month && <Error />}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end p-4 sm:px-6">
                      <button
                        disabled={loading}
                        onClick={(e) => {
                          e.preventDefault();
                          props.onClose();
                        }}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        disabled={loading}
                        type="submit"
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {loading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Setup')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
type WeekStartDay = 'sun' | 'sat' | 'mon';

function weekStartLocale(locale: string): WeekStartDay {
  const parts = locale.match(
    /^([a-z]{2,3})(?:-([a-z]{3})(?=$|-))?(?:-([a-z]{4})(?=$|-))?(?:-([a-z]{2}|\d{3})(?=$|-))?/i
  );
  return weekStart(parts?.[4] || null, parts?.[1] || null);
}
function weekStart(region: string | null, language: string | null): WeekStartDay {
  const regionSat: string[] | null = 'AEAFBHDJDZEGIQIRJOKWLYOMQASDSY'.match(/../g);
  const regionSun: string[] | null =
    'AGARASAUBDBRBSBTBWBZCACNCODMDOETGTGUHKHNIDILINJMJPKEKHKRLAMHMMMOMTMXMZNINPPAPEPHPKPRPTPYSASGSVTHTTTWUMUSVEVIWSYEZAZW'.match(
      /../g
    );
  const languageSat: string[] = ['ar', 'arq', 'arz', 'fa'];
  const languageSun: string[] | null =
    'amasbndzengnguhehiidjajvkmknkolomhmlmrmtmyneomorpapssdsmsnsutatethtnurzhzu'.match(/../g);
  return region
    ? regionSun?.includes(region)
      ? 'sun'
      : regionSat?.includes(region)
      ? 'sat'
      : 'mon'
    : languageSun?.includes(language ?? 'en')
    ? 'sun'
    : languageSat.includes(language ?? 'en')
    ? 'sat'
    : 'mon';
}

function getDateFormatString(locale: string) {
  const formatObj = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(Date.now());

  return formatObj
    .map((obj) => {
      switch (obj.type) {
        case 'day':
          return 'dd';

        case 'month':
          return 'MM';

        case 'year':
          return 'yyyy';

        default:
          return obj.value;
      }
    })
    .join('');
}

function getTimeFormatString(locale: string) {
  const formatObj = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',

    minute: 'numeric',

    second: 'numeric'
  }).formatToParts(Date.now());

  return formatObj

    .map((obj) => {
      switch (obj.type) {
        case 'hour':
          return 'HH';

        case 'minute':
          return 'MM';

        case 'second':
          return 'SS';

        default:
          return obj.value;
      }
    })

    .join('');
}
export interface IpDataInterface {
  country_code2: string;
  languages: string;
  time_zone: {
    name: string;
  };
}

const getCountry = (ipData: IpDataInterface) => {
  const foundCountry = countries.find((country) => country.code === ipData.country_code2)?.code;
  return foundCountry || null;
};

export interface defaultDataValues {
  global_date_format: string;
  global_time_format: string;
  global_week_start: string;
  global_timezone: string;
  country_code: string | null;
}

export const getDefaultSettingsFromLocation = (ipData: IpDataInterface | null): defaultDataValues => {
  let language = ipData?.languages ? ipData.languages.slice(0, 2) : 'en';

  let date_format = getDateFormatString(language);
  const mapDateFormats = dateFormats.map(format => format.value);
  if(!mapDateFormats.includes(date_format)) {
    date_format = 'dd.MM.yyyy'
  }

  const time_format =
    getTimeFormatString(language).endsWith('AM') || getTimeFormatString(language).endsWith('PM')
      ? TimeFormat.H12
      : TimeFormat.H24;

  let week_start = weekStartLocale(language) == 'mon' ? '1' : '0';

  let timezone = timezones.find((x) => x.tzCode === ipData?.time_zone.name)
    ? timezones.find((x) => x.tzCode === ipData?.time_zone.name)?.tzCode
    : 'Europe/Amsterdam';
  let global_country = null;
  if (ipData) {
    global_country = getCountry(ipData);

    const mapedConutries = countries.map(country => country.code);
    if(typeof global_country === 'string' && !mapedConutries.includes(global_country)) {
      global_country = null;
    }
  }

  return {
    global_date_format: date_format,
    global_time_format: time_format,
    global_week_start: week_start,
    global_timezone: timezone as string,
    country_code: global_country ?? null
  };
};
