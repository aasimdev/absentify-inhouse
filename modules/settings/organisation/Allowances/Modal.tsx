/* eslint-disable no-nested-ternary */
/* eslint-disable no-param-reassign */
import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Listbox, Switch, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import { classNames } from '~/lib/classNames';
import { AllowanceUnit } from '@prisma/client';
import { add, format } from 'date-fns';
import { InputPicker } from '@components/duration-select/duration-select';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Select from 'react-select';
import { formatDuration } from '~/helper/formatDuration';
import { getFiscalYearStartAndEndDatesUTC } from '~/lib/requestUtilities';

export default function Modal(props: {
  open: boolean;
  onClose: Function;
  value: null | RouterOutputs['allowance']['allTypes'][0];
}) {
  const { t, lang } = useTranslation('settings_organisation');
  const utils = api.useContext();
  const addAllowanceType = api.allowance.addAllowanceType.useMutation();
  const editAllowanceType = api.allowance.editAllowanceType.useMutation();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const cancelButtonRef = useRef(null);
  const {
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    getValues
  } = useForm<RouterInputs['allowance']['addAllowanceType'] | RouterInputs['allowance']['editAllowanceType']>();
  const { current_member, subscription } = useAbsentify();

  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);
  const getAbsenceQuotaText = (
    maxCarryForward: number,
    allowanceUnit: AllowanceUnit,
    monthsAfterFiscalYear: number
  ): string => {
    if (!workspace) return '';

    const fiscalYear = getFiscalYearStartAndEndDatesUTC(
      workspace.fiscal_year_start_month,
      new Date().getUTCFullYear() - 1
    );
    fiscalYear.lastDayOfYear.setUTCHours(0, 0, 0, 0);

    let carry_forward_deadline = new Date(
      Date.UTC(fiscalYear.lastDayOfYear.getUTCFullYear(), fiscalYear.lastDayOfYear.getUTCMonth(), 1, 0, 0, 0)
    );

    carry_forward_deadline = add(carry_forward_deadline, {
      months: monthsAfterFiscalYear
    });
    carry_forward_deadline.setUTCMonth(carry_forward_deadline.getUTCMonth() + 1, 0);

    const formatDate = (date: Date): string => {
      if (!current_member) return '';

      return format(
        date,
        current_member.date_format
          .replace('/yyyy', '')
          .replace('-yyyy', '')
          .replace('.yyyy', '')
          .replace(' yyyy', '')
          .replace('yyyy-', '')
          .replace('yyyy/', '')
          .replace('yyyy ', '')
          .replace('yyyy.', '')
      );
    };

    const maxCarryForwardFormatted = formatDuration(maxCarryForward, lang, allowanceUnit, false, t);
    const unit =
      allowanceUnit === 'hours'
        ? maxCarryForward === 1
          ? t('absencequota_hour')
          : t('absencequota_hours')
        : maxCarryForward === 1
        ? t('absencequota_day')
        : t('absencequota_days');
    const formattedCarryForwardDate = formatDate(
      monthsAfterFiscalYear === 0 ? fiscalYear.lastDayOfYear : carry_forward_deadline
    );

    if (monthsAfterFiscalYear === 0) {
      if (maxCarryForward === 0) {
        return t('no_unused_claims', { date: formattedCarryForwardDate });
      }
      return t('max_carry_forward_allowed', {
        maxCarryForward: maxCarryForwardFormatted,
        unit,
        date: formattedCarryForwardDate
      });
    } else {
      if (maxCarryForward === 0) {
        return t('full_contingent', { date: formattedCarryForwardDate });
      }
      return t('use_until', {
        date: formattedCarryForwardDate,
        maxCarryForward: maxCarryForwardFormatted,
        unit
      });
    }
  };

  useEffect(() => {
    if (subscription.business) {
      setHasValidSubscription(true);
      return;
    }

    if (subscription.enterprise > 0) {
      setHasValidSubscription(true);
      return;
    }
    if (subscription.small_team > 0) {
      setHasValidSubscription(true);
      return;
    }
    if (subscription.business_by_user > 0) {
      setHasValidSubscription(true);
      return;
    }
    setHasValidSubscription(false);
  }, [subscription]);
  const onSubmit: SubmitHandler<
    RouterInputs['allowance']['addAllowanceType'] | RouterInputs['allowance']['editAllowanceType']
  > = async (data: RouterInputs['allowance']['addAllowanceType'] | RouterInputs['allowance']['editAllowanceType']) => {
    if (!current_member) return;
    if (!data.id) {
      let d: RouterInputs['allowance']['addAllowanceType'] = data as RouterInputs['allowance']['addAllowanceType'];
      d.data.default_allowance_current_year = parseFloat(d.data.default_allowance_current_year as any);
      d.data.default_allowance_next_year = parseFloat(d.data.default_allowance_next_year as any);
      d.data.max_carry_forward = parseFloat(d.data.max_carry_forward as any);
      await addAllowanceType.mutateAsync(d, {
        onSuccess: async (allowanceType) => {
          await utils.allowance.allTypes.invalidate();
          await utils.leave_type.all.invalidate();
          await utils.member.all.invalidate();
          props.onClose(allowanceType);
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);
        }
      });
    } else {
      data.data.max_carry_forward = parseFloat(data.data.max_carry_forward as any);
      await editAllowanceType.mutateAsync(
        { id: data.id, data: data.data },
        {
          onSuccess: async (allowanceType) => {
            await utils.allowance.allTypes.invalidate();
            await utils.leave_type.all.invalidate();
            props.onClose(allowanceType);
            notifySuccess(t('Saved_successfully'));
          },
          onError: (error) => {
            notifyError(error.message);
          }
        }
      );
    }
  };
  useEffect(() => {
    if (props.value) {
      for (let index = 0; index < Object.keys(props.value).length; index += 1) {
        const element = Object.keys(props.value)[index];
        // @ts-ignore
        setValue(`data.${element}`, props.value[element]);
      }
      setValue('id', props.value.id);
    }
  }, []);
  if (!current_member) return null;

  const selectOptions = [
    { label: t('Days'), value: AllowanceUnit.days },
    { label: t('Hours'), value: AllowanceUnit.hours }
  ];
  return (
    <>
      {
        <Transition.Root show={props.open} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-30 overflow-y-auto"
            initialFocus={cancelButtonRef}
            onClose={() => {}}
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
                <div className="z-30 inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle dark:bg-teams_dark_mode">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                        <>
                          {props.value && t('allowanceType_edit_a_allowancetype')}{' '}
                          {!props.value && t('allowanceType_add_a_allowancetype')}
                        </>
                      </Dialog.Title>
                      <form className="divide-y divide-gray-200 dark:divide-teams_brand_border" onSubmit={handleSubmit(onSubmit)}>
                        <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                          <div className="sm:col-span-5">
                            <label htmlFor="allowance_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('allowances_Name')}
                            </label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                              <Controller
                                rules={{ required: true }}
                                control={control}
                                name="data.name"
                                render={({ field: { onChange, value } }) => (
                                  <input
                                    onChange={(val) => {
                                      onChange(val);
                                    }}
                                    value={value}
                                    disabled={addAllowanceType.isLoading || editAllowanceType.isLoading}
                                    type="text"
                                    name="allowance_name"
                                    className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200 dark:bg-transparent dark:border-teams_brand_border"
                                  />
                                )}
                              />
                            </div>
                            {errors.data?.name && <span className="text-sm text-red-400">{t('required')}</span>}
                          </div>
                          {!props.value && (
                            <div className="sm:col-span-5">
                              <label
                                htmlFor="ignore_allowance_limit"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                              >
                                {t('allowances_allowance_unit')}
                              </label>
                              <p className="mt-2 text-sm text-gray-500 dark:text-gray-200 " id="email-description">
                                {t('allowances_allowance_unit_description')}
                              </p>
                              <div className="mt-1 flex ">
                                <Controller
                                  control={control}
                                  defaultValue={AllowanceUnit.days}
                                  name="data.allowance_unit"
                                  render={({ field: { onChange, value } }) => (
                                    <Listbox
                                      value={selectOptions.find((x) => x.value === value)}
                                      onChange={(val) => {
                                        if (!val) return;
                                        if (val.value != getValues('data.allowance_unit')) {
                                          if (val.value == AllowanceUnit.days) {
                                            setValue(
                                              'data.max_carry_forward',
                                              parseFloat((getValues('data.max_carry_forward') / 60).toFixed(2))
                                            );
                                          } else {
                                            setValue(
                                              'data.max_carry_forward',
                                              getValues('data.max_carry_forward') * 60
                                            );
                                          }
                                        }

                                        onChange(val.value);
                                      }}
                                    >
                                      {({ open }) => (
                                        <>
                                          <Listbox.Label className="sr-only dark:text-gray-200">
                                            <p> {t('allowances_allowance_unit')}</p>{' '}
                                          </Listbox.Label>
                                          <div className="relative w-full">
                                            <div className="inline-flex w-full rounded-md border-gray-300 dark:bg-teams_dark_mode dark:text-gray-200">
                                              <div className="inline-flex w-full rounded-md border-gray-300">
                                                <Listbox.Button className="inline-flex w-full  items-center rounded-l-md border border-gray-300 bg-white py-2 pl-3 pr-4 text-gray-800 shadow-sm dark:bg-teams_dark_mode dark:text-gray-200 dark:border-teams_brand_border">
                                                  <div className="inline-flex">
                                                    <p className=" text-sm font-medium dark:text-gray-200">
                                                      {
                                                        selectOptions.find(
                                                          (x) => x.value === getValues('data.allowance_unit')
                                                        )?.label
                                                      }
                                                    </p>
                                                  </div>
                                                </Listbox.Button>
                                                <Listbox.Button className="inline-flex items-center rounded-l-none rounded-r-md border border-l-0 border-gray-300 bg-white p-2 text-sm font-medium text-black shadow-sm hover:bg-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-50 dark:bg-teams_dark_mode dark:text-gray-200 dark:border-teams_brand_border dark:focus:ring-0">
                                                  <span className="sr-only dark:text-gray-200"> {t('allowances_allowance_unit')}</span>
                                                  <ChevronDownIcon
                                                    className="h-5 w-5 text-gray-800 dark:text-teams_brand_border"
                                                    aria-hidden="true"
                                                  />
                                                </Listbox.Button>
                                              </div>
                                            </div>

                                            <Transition
                                              show={open}
                                              as={Fragment}
                                              leave="transition ease-in duration-100"
                                              leaveFrom="opacity-100"
                                              leaveTo="opacity-0"
                                            >
                                              <Listbox.Options className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-teams_brand_thead dark:text-gray-200 dark:divide-teams_brand_border">
                                                {selectOptions.map((option) => (
                                                  <Listbox.Option
                                                    key={option.label}
                                                    className={({ active }) =>
                                                      classNames(
                                                        hasValidSubscription
                                                          ? active
                                                            ? 'bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-teams_brand_thead dark:text-gray-200'
                                                            : ' text-gray-800 dark:text-gray-200'
                                                          : option.value !== 'days'
                                                          ? ' cursor-not-allowed bg-gray-100 text-gray-800 dark:bg-teams_brand_thead dark:text-gray-200 '
                                                          : ' ',
                                                        'cursor-pointer select-none p-4 text-sm'
                                                      )
                                                    }
                                                    disabled={hasValidSubscription ? false : option.value !== 'days'}
                                                    value={option}
                                                  >
                                                    {({ selected, active }) => (
                                                      <div
                                                        className={`flex flex-col ${
                                                          hasValidSubscription
                                                            ? ' '
                                                            : option.value !== 'days'
                                                            ? ' has-tooltip '
                                                            : ' '
                                                        } `}
                                                      >
                                                        <div className="flex justify-between">
                                                          <p className={selected ? 'font-semibold' : 'font-normal'}>
                                                            {option.label}
                                                          </p>
                                                          <span className=" stooltip -mt-14 -ml-4 w-11/12 rounded p-2 text-center shadow-custom bg-white">
                                                            <p className="dark:text-gray-200">{t('upgradeToSelectUnit')}</p>
                                                            {current_member?.is_admin && (
                                                              <Link
                                                                href="/settings/organisation/upgrade"
                                                                className="underline hover:text-blue-700 dark:text-gray-900"
                                                              >
                                                                {t('upgradeToSelectUnit2')}
                                                              </Link>
                                                            )}
                                                          </span>
                                                          {selected ? (
                                                            <span className={active ? 'text-black' : 'text-gray-300'}>
                                                              <CheckIcon className="h-5 w-5 dark:text-gray-200" aria-hidden="true" />
                                                            </span>
                                                          ) : null}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </Listbox.Option>
                                                ))}
                                              </Listbox.Options>
                                            </Transition>
                                          </div>
                                        </>
                                      )}
                                    </Listbox>
                                  )}
                                />
                              </div>
                              {(errors.data as { allowance_unit?: string })?.allowance_unit && (
                                <span className="text-sm text-red-400">{t('required')}</span>
                              )}
                            </div>
                          )}

                          <div className="sm:col-span-5 bg-white shadow rounded-lg p-4 mb-4 border border-gray-300 dark:bg-transparent dark:border-teams_brand_border">
                            <label htmlFor="max_carry_forward" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('allowances_max_carry_forward')}
                            </label>

                            <div className="mt-4">
                              <label htmlFor="max_carry_forward" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('max_days_to_carry_over')}
                              </label>
                              <div className="mt-1 flex rounded-md shadow-sm">
                                <Controller
                                  rules={{ required: true }}
                                  control={control}
                                  name="data.max_carry_forward"
                                  defaultValue={0}
                                  render={({ field: { onChange, value } }) => (
                                    <InputPicker
                                      unit={watch('data.allowance_unit')}
                                      value={value}
                                      onChange={(val) => {
                                        onChange(val);
                                      }}
                                      className = "w-full dark:bg-teams_dark_mode  dark:text-gray-200 rounded-md dark:border-teams_brand_border dark:focus:border-teams_brand_dark_550"
                                    />
                                  )}
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label
                                htmlFor="carry_forward_months_after_fiscal_year"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                              >
                                {t('months_after_fiscal_year')}
                              </label>
                              <div className="mt-1 flex rounded-md shadow-sm">
                                <Controller
                                  rules={{ required: true }}
                                  control={control}
                                  name="data.carry_forward_months_after_fiscal_year"
                                  defaultValue={0}
                                  render={({ field: { onChange, value } }) => (
                                    <Select
                                      value={{ value: value, label: `${value}` }}
                                      styles={{
                                        control: (base) => ({
                                          ...base,
                                          '*': {
                                            boxShadow: 'none !important'
                                          }
                                        })
                                      }}
                                      className="w-full my-react-select-container"
                                        classNamePrefix="my-react-select"
                                      onChange={(val) => {
                                        if (!val) return;
                                        onChange(val.value);
                                      }}
                                      options={[...Array(12)].map((_, index) => ({
                                        value: index,
                                        label: `${index}`
                                      }))}
                                    />
                                  )}
                                />
                              </div>
                            </div>

                            <div
                              className="mt-4 text-sm text-gray-700 dark:text-gray-200"
                              dangerouslySetInnerHTML={{
                                __html: getAbsenceQuotaText(
                                  watch('data.max_carry_forward'),
                                  watch('data.allowance_unit') as AllowanceUnit,
                                  watch('data.carry_forward_months_after_fiscal_year')
                                )
                              }}
                            />

                            {(errors.data as { max_carry_forward?: string })?.max_carry_forward && (
                              <span className="text-sm text-red-400">{t('required')}</span>
                            )}
                          </div>

                          <div className="sm:col-span-5">
                            <label htmlFor="ignore_allowance_limit" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('allowances_ignore_limit')}
                            </label>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-200" id="email-description">
                              {t('allowances_ignore_limit_description')}
                            </p>
                            <div className="mt-1 flex ">
                              <Controller
                                control={control}
                                defaultValue={false}
                                name="data.ignore_allowance_limit"
                                render={({ field: { onChange, value } }) => (
                                  <Switch
                                    checked={value}
                                    onChange={(val) => {
                                      onChange(val);
                                    }}
                                    disabled={addAllowanceType.isLoading || editAllowanceType.isLoading}
                                    className={classNames(
                                      value ? 'bg-teams_brand_600 dark:bg-teams_brand_foreground_bg dark' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_600 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                                    )}
                                  >
                                    <span className="sr-only"> {t('allowances_ignore_limit')}</span>

                                    <span
                                      className={classNames(
                                        value ? 'translate-x-5' : 'translate-x-0',
                                        'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          value
                                            ? 'opacity-0 duration-100 ease-out'
                                            : 'opacity-100 duration-200 ease-in',
                                          'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                                          <path
                                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span
                                        className={classNames(
                                          value
                                            ? 'opacity-100 duration-200 ease-in'
                                            : 'opacity-0 duration-100 ease-out',
                                          'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-teams_brand_600"
                                          fill="currentColor"
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                        </svg>
                                      </span>
                                    </span>
                                  </Switch>
                                )}
                              />
                            </div>
                            {(errors.data as { allowances_ignore_limit?: string })?.allowances_ignore_limit && (
                              <span className="text-sm text-red-400">{t('required')}</span>
                            )}
                          </div>
                          {!props.value && (
                            <>
                              <div className="sm:col-span-5">
                                <label
                                  htmlFor="default_allowance_current_year"
                                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                                >
                                  {t('allowances_default_allowance_current_year')}
                                </label>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-200" id="email-description">
                                  {t('allowances_default_allowance_current_year_description')}
                                </p>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                  <Controller
                                    rules={{ required: true }}
                                    control={control}
                                    name="data.default_allowance_current_year"
                                    defaultValue={0}
                                    render={({ field: { onChange, value } }) => (
                                      <InputPicker
                                        unit={watch('data.allowance_unit')}
                                        value={value}
                                        onChange={(val) => {
                                          onChange(val);
                                        }}
                                        className = "w-full dark:bg-teams_dark_mode dark:text-gray-200 dark:border-teams_brand_border dark:focus:border-teams_brand_dark_550 rounded-md"
                                      />
                                    )}
                                  />
                                </div>
                                {(errors.data as { default_allowance_current_year?: string })
                                  ?.default_allowance_current_year && (
                                  <span className="text-sm text-red-400">{t('required')}</span>
                                )}
                              </div>
                              <div className="sm:col-span-5">
                                <label
                                  htmlFor="default_allowance_next_year"
                                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                                >
                                  {' '}
                                  {t('allowances_default_default_allowance_next_year')}
                                </label>{' '}
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-200" id="email-description">
                                  {t('allowances_default_default_allowance_next_year_description')}
                                </p>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                  <Controller
                                    rules={{ required: true }}
                                    control={control}
                                    name="data.default_allowance_next_year"
                                    defaultValue={0}
                                    render={({ field: { onChange, value } }) => (
                                      <InputPicker
                                        unit={watch('data.allowance_unit')}
                                        value={value}
                                        onChange={(val) => {
                                          onChange(val);
                                        }}
                                        className = "w-full dark:bg-teams_dark_mode dark:text-gray-200 dark:border-teams_brand_border dark:focus:border-teams_brand_dark_550 rounded-md"
                                      />
                                    )}
                                  />
                                </div>
                                {(errors.data as { default_allowance_next_year?: string })
                                  ?.default_allowance_next_year && (
                                  <span className="text-sm text-red-400">{t('required')}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-4 flex justify-end p-4 sm:px-6">
                          <button
                            disabled={addAllowanceType.isLoading || editAllowanceType.isLoading}
                            onClick={(e) => {
                              e.preventDefault();
                              props.onClose();
                            }}
                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-teams_dark_mode dark:border dark:border-gray-200 dark:text-white"
                          >
                            {t('Cancel')}
                          </button>
                          <button
                            disabled={addAllowanceType.isLoading || editAllowanceType.isLoading}
                            type="submit"
                            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                          >
                            {(addAllowanceType.isLoading || editAllowanceType.isLoading) && (
                              <svg
                                className="-ml-1 mr-3 h-5 w-5 animate-spin"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth={4}
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            )}
                            {t('Save')}
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
      }
    </>
  );
}
