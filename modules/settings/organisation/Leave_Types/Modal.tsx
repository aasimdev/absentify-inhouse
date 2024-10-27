import { Dialog, Listbox, Switch, Transition } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { LeaveUnit, OutlookShowAs, SyncEnabled } from '@prisma/client';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Select from 'react-select';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { notifyAlert, notifyError, notifySuccess } from '~/helper/notify';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import Loader from '@components/calendar/Loader';
import { classNames } from '~/lib/classNames';
import Link from 'next/link';
import { isDayUnit, isHourUnit } from '~/lib/DateHelper';
import { useDarkSide } from '@components/ThemeContext';

export default function Modal(props: {
  open: boolean;
  onClose: Function;
  value: null | RouterOutputs['leave_type']['all'][0];
}) {
  
  const [theme] = useDarkSide();
  const { t } = useTranslation('settings_organisation');
  const { current_member, subscription } = useAbsentify();
  const cancelButtonRef = useRef(null);
  const syncEnabledValues = [
    {
      name: t(SyncEnabled.All),
      id: SyncEnabled.All
    },
    {
      name: t(SyncEnabled.OnlyApproved),
      id: SyncEnabled.OnlyApproved
    },
    {
      name: t(SyncEnabled.Disabled),
      id: SyncEnabled.Disabled
    }
  ];
  const outlookShowAsSelectValues = [
    { name: t(OutlookShowAs.free), id: OutlookShowAs.free },
    { name: t(OutlookShowAs.busy), id: OutlookShowAs.busy },
    { name: t(OutlookShowAs.oof), id: OutlookShowAs.oof },
    { name: t(OutlookShowAs.tentative), id: OutlookShowAs.tentative },
    {
      name: t(OutlookShowAs.workingElsewhere),
      id: OutlookShowAs.workingElsewhere
    }
  ];

  const [leaveUnitSelectValues, setLeaveUnitSelectValues] = useState<
    {
      name: string;
      id: LeaveUnit;
    }[]
  >([
    {
      name: t('Leave_unit_days'),
      id: LeaveUnit.days
    },
    {
      name: t('Leave_unit_half_days'),
      id: LeaveUnit.half_days
    },
    {
      name: t('Leave_unit_hours'),
      id: LeaveUnit.hours
    },
    {
      name: t('Leave_unit_30_minutes'),
      id: LeaveUnit.minutes_30
    },
    {
      name: t('Leave_unit_15_minutes'),
      id: LeaveUnit.minutes_15
    },
    {
      name: t('Leave_unit_10_minutes'),
      id: LeaveUnit.minutes_10
    },
    {
      name: t('Leave_unit_5_minutes'),
      id: LeaveUnit.minutes_5
    }
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    getValues
  } = useForm<RouterInputs['leave_type']['edit']['data']>();

  const utils = api.useContext();
  const addLeaveType = api.leave_type.add.useMutation();
  const editLeaveType = api.leave_type.edit.useMutation();

  const { data: allowancesTypes } = api.allowance.allTypes.useQuery(undefined, {
    staleTime: 60000
  });

  const { data: isDynamics365CategoryAvailable } = api.leave_type.isDynamics365CategoryAvailable.useQuery(undefined, {
    staleTime: 60000
  });

  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);

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

  type AddLeaveTypeInput = RouterInputs['leave_type']['add'];
  type EditLeaveTypeInput = RouterInputs['leave_type']['edit'];

  const onAddSubmit: SubmitHandler<AddLeaveTypeInput> = async (data) => {
    if (!data.icon) data.icon = 'NoIcon';
    if (!data.color) data.color = '#22194D';

    data.position = 999;

    await addLeaveType.mutateAsync(data, {
      onError: (error) => {
        notifyError(error.message);
      },
      onSuccess: async (leave_type) => {
        // refetches leavetypes after a department is added
        await utils.leave_type.all.invalidate();
        await utils.allowance.allTypes.invalidate();

        props.onClose(leave_type);
        notifySuccess(t('Saved_successfully'));
      }
    });
  };

  const onEditSubmit: SubmitHandler<EditLeaveTypeInput> = async (data) => {
    await editLeaveType.mutateAsync(
      {
        id: data.id,
        data: data.data
      },
      {
        async onSuccess(leave_type) {
          // refetches leavetypes after a department is added
          await utils.leave_type.all.invalidate();
          await utils.allowance.allTypes.invalidate();

          props.onClose(leave_type);
          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  const onSubmit: SubmitHandler<RouterInputs['leave_type']['edit']['data']> = async (
    data: RouterInputs['leave_type']['edit']['data']
  ) => {
    if (!current_member) return;
    if (!data.outlook_synchronization_show_as) {
      data.outlook_synchronization_show_as = OutlookShowAs.oof;
    }

    if (!data.outlook_synchronization_subject) {
      data.outlook_synchronization_subject = null;
    }

    if (!data.reason_mandatory) {
      data.reason_hint_text = null;
    } else if (data.reason_mandatory && (!data.reason_hint_text || data.reason_hint_text.trim().length === 0)) {
      data.reason_hint_text = t('Reason_placeholder');
    }
    if (data.name != undefined) data.name = data.name.trim();

    if (data.allowance_type_id) {
      if (allowancesTypes?.find((x) => x.id === data.allowance_type_id)?.allowance_unit == 'days') {
        if (isHourUnit(data.leave_unit)) data.leave_unit = 'days';
      } else if (allowancesTypes?.find((x) => x.id === data.allowance_type_id)?.allowance_unit == 'hours') {
        if (isDayUnit(data.leave_unit)) data.leave_unit = 'hours';
      }
    }

    if (props.value?.id) {
      await onEditSubmit({ id: props.value.id, data } as EditLeaveTypeInput);
    } else {
      await onAddSubmit(data as AddLeaveTypeInput);
    }
  };
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });

  useEffect(() => {
    if (props.value)
      for (let index = 0; index < Object.keys(props.value).length; index += 1) {
        const element = Object.keys(props.value)[index];
        // @ts-ignore
        setValue(element, props.value[element]);
      }
  }, []);
  const watchMandatory = watch('reason_mandatory');
  const watchHintText = watch('reason_hint_text');

  useEffect(() => {
    if (watchMandatory && (!watchHintText || watchHintText?.trim().length === 0)) {
      setValue('reason_hint_text', t('Reason_placeholder'));
    }
  }, [watchMandatory]);

  const allowanceTypeId = watch('allowance_type_id');
  const leaveUnit = watch('leave_unit');

  useEffect(() => {
    if (allowanceTypeId) {
      if (allowancesTypes?.find((x) => x.id === allowanceTypeId)?.allowance_unit == 'days') {
        setLeaveUnitSelectValues([
          {
            name: t('Leave_unit_days'),
            id: LeaveUnit.days
          },
          {
            name: t('Leave_unit_half_days'),
            id: LeaveUnit.half_days
          }
        ]);
        if (isHourUnit(leaveUnit)) {
          setValue('leave_unit', 'days');

          notifyAlert(t('Leave_unit_changed_to', { unit: t('Days') }));
        }
      } else if (allowancesTypes?.find((x) => x.id === allowanceTypeId)?.allowance_unit == 'hours') {
        setLeaveUnitSelectValues([
          {
            name: t('Leave_unit_hours'),
            id: LeaveUnit.hours
          },
          {
            name: t('Leave_unit_30_minutes'),
            id: LeaveUnit.minutes_30
          },
          {
            name: t('Leave_unit_15_minutes'),
            id: LeaveUnit.minutes_15
          },
          {
            name: t('Leave_unit_10_minutes'),
            id: LeaveUnit.minutes_10
          },
          {
            name: t('Leave_unit_5_minutes'),
            id: LeaveUnit.minutes_5
          }
        ]);
        if (isDayUnit(leaveUnit)) {
          notifyAlert(t('Leave_unit_changed_to', { unit: t('Hours') }));
          setValue('leave_unit', 'hours');
        }
      }
    } else {
      setLeaveUnitSelectValues([
        {
          name: t('Leave_unit_days'),
          id: LeaveUnit.days
        },
        {
          name: t('Leave_unit_half_days'),
          id: LeaveUnit.half_days
        },
        {
          name: t('Leave_unit_hours'),
          id: LeaveUnit.hours
        },
        {
          name: t('Leave_unit_30_minutes'),
          id: LeaveUnit.minutes_30
        },
        {
          name: t('Leave_unit_15_minutes'),
          id: LeaveUnit.minutes_15
        },
        {
          name: t('Leave_unit_10_minutes'),
          id: LeaveUnit.minutes_10
        },
        {
          name: t('Leave_unit_5_minutes'),
          id: LeaveUnit.minutes_5
        }
      ]);
    }
  }, [allowanceTypeId, leaveUnit, allowancesTypes]);

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-30 overflow-y-auto" initialFocus={cancelButtonRef} onClose={() => {}}>
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
            <div className="z-30 inline-block overflow-hidden  bg-white px-4 pt-5 pb-4 text-left align-bottom rounded-lg shadow-xl transition-all transform sm:align-middle sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-teams_brand_dark_100">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                    <>
                      {props.value && t('Leave_types_Dialog_Edit_title')}{' '}
                      {!props.value && t('Leave_types_Dialog_title')}
                    </>
                  </Dialog.Title>
                  <form className="divide-y divide-gray-200 dark:divide-gray-500 dark:text-gray-200" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mt-6 flex flex-col lg:flex-row">
                      <div className="grow space-y-6">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 ">
                            {t('Leave_types_Name')}
                          </label>
                          <div className="mt-1">
                            <input
                              {...register('name', {
                                required: true,
                                maxLength: {
                                  value: 255,
                                  message: t('maxLength_reached')
                                }
                              })}
                              type="text"
                              name="name"
                              id="name"
                              autoComplete="name"
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200"
                            />
                            {errors.name?.message && (
                              <div className="mt-2 inline-flex">
                                <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                                <p className=" ml-2 text-sm text-red-600">{errors.name?.message}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="minimum_daily_absence" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            {t('Outlook_sync_setting')}
                          </label>
                          <div className="mt-1">
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="sync_option"
                              defaultValue={SyncEnabled.All}
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
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  // menuPortalTarget={document.body}
                                  value={syncEnabledValues.find((x) => x.id === value)}
                                  className="w-full my-react-select-container"
                                  classNamePrefix="my-react-select"
                                  onChange={(val) => {
                                    if (val) onChange(val.id);
                                  }}
                                  getOptionLabel={(option) => `${option.name}`}
                                  getOptionValue={(option) => option.id}
                                  options={syncEnabledValues}
                                />
                              )}
                            />
                          </div>
                        </div>
                        {workspace?.microsoft_calendars_read_write === 'ACTIVATED' &&
                          watch('sync_option') !== 'Disabled' && (
                            <div>
                              <div className="text-sm inline-flex font-medium text-gray-700 mb-2 pl-2">
                                {t('Outlook_Synchronization_Settings')}{' '}
                                <span
                                  className="ml-1 flex items-center cursor-pointer"
                                  data-tooltip-id="outSync-tooltip"
                                  data-tooltip-content={t('Outlook_Synchronization_Settings_Description')}
                                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                >
                                  <QuestionMarkCircleIcon height={12} />
                                </span>
                                <ReactTooltip
                                  id="outSync-tooltip"
                                  className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                  classNameArrow="shadow-sm"
                                  place="top"
                                  style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                />
                              </div>
                              <div className="border-solid border-gray-300 border p-2 rounded-md">
                                <div className="mb-6">
                                  <label
                                    htmlFor="outlook_synchronization_show_as"
                                    className="inline-flex text-sm font-medium text-gray-700"
                                  >
                                    {t('Outlook_synchronization_show_as')}{' '}
                                    <span
                                      className="ml-1 flex items-center cursor-pointer"
                                      data-tooltip-id="outSync-tooltip"
                                      data-tooltip-content={t('Outlook_Calendar_entry_show_as_Description')}
                                      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                    >
                                      <QuestionMarkCircleIcon height={12} />
                                    </span>
                                    <ReactTooltip
                                      id="outSync-tooltip"
                                      className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                      classNameArrow="shadow-sm"
                                      place="top"
                                      style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                    />
                                  </label>
                                  <div className="mt-1">
                                    <Controller
                                      rules={{ required: true }}
                                      control={control}
                                      name="outlook_synchronization_show_as"
                                      defaultValue={OutlookShowAs.oof}
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
                                                boxShadow: 'none !important'
                                              }
                                            })
                                          }}
                                          // menuPortalTarget={document.body}
                                          value={outlookShowAsSelectValues.find((x) => x.id === value)}
                                          className="w-full my-react-select-container"
                                          classNamePrefix="my-react-select"
                                          onChange={(val) => {
                                            if (val) onChange(val.id);
                                          }}
                                          getOptionLabel={(option) => `${option.name}`}
                                          getOptionValue={(option) => option.id}
                                          options={outlookShowAsSelectValues}
                                        />
                                      )}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label htmlFor="name" className="inline-flex text-sm font-medium text-gray-700">
                                    {t('EventSubject')}{' '}
                                    <span
                                      className="ml-1 flex items-center cursor-pointer"
                                      data-tooltip-id="outSync-tooltip"
                                      data-tooltip-content={t('Event_Subject_Description_Outlook')}
                                      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                    >
                                      <QuestionMarkCircleIcon height={12} />
                                    </span>
                                    <ReactTooltip
                                      id="outSync-tooltip"
                                      className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                      classNameArrow="shadow-sm"
                                      place="top"
                                      style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                    />
                                  </label>
                                  <div className="mt-1">
                                    <input
                                      {...register('outlook_synchronization_subject', {
                                        required: false,
                                        maxLength: {
                                          value: 255,
                                          message: t('maxLength_reached')
                                        }
                                      })}
                                      type="text"
                                      name="outlook_synchronization_subject"
                                      id="outlook_synchronization_subject"
                                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100"
                                    />
                                    {errors.outlook_synchronization_subject?.message && (
                                      <div className="mt-2 inline-flex">
                                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                                        <p className=" ml-2 text-sm text-red-600">
                                          {errors.outlook_synchronization_subject?.message}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isDynamics365CategoryAvailable && (
                                  <div>
                                    <Switch.Group as="li" className="flex items-center justify-between py-4">
                                      <div className="flex flex-col">
                                        <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                          {t('Categorize_as_Tracked_To_Dynamics_365_in_Outlook')}
                                        </Switch.Label>
                                        <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                          {t('Categorize_as_Tracked_To_Dynamics_365_in_Outlook_description')}
                                        </Switch.Description>
                                      </div>
                                      <Controller
                                        defaultValue={false}
                                        control={control}
                                        name="sync_to_outlook_as_dynamics_365_tracked"
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
                                                value ? 'translate-x-5' : 'translate-x-0',
                                                'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                              )}
                                            />
                                          </Switch>
                                        )}
                                      />
                                    </Switch.Group>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        {workspace?.microsoft_calendars_read_write !== 'ACTIVATED' &&
                          watch('sync_option') !== 'Disabled' && (
                            <div className="text-sm block font-medium text-gray-700 mb-2 pl-2 dark:text-gray-200">
                              {t('iCal_Synchronization_Settings')}{' '}
                              <div className="border-solid border-gray-300 border p-2 rounded-md mt-2 -ml-2">
                                <div className="mb-6">
                                  <label
                                    htmlFor="iCal_event_show_as"
                                    className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200"
                                  >
                                    {t('iCal_synchronization_show_as')}{' '}
                                    <span
                                      className="ml-1 flex items-center cursor-pointer"
                                      data-tooltip-id="outSync-tooltip"
                                      data-tooltip-content={t('iCal_entry_show_as_Description')}
                                      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                    >
                                      <QuestionMarkCircleIcon height={12} />
                                    </span>
                                    <ReactTooltip
                                      id="outSync-tooltip"
                                      className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200 "
                                      classNameArrow="shadow-sm"
                                      place="top"
                                      opacity={1}
                                      style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                    />
                                  </label>
                                  <div className="mt-1">
                                    <Controller
                                      rules={{ required: true }}
                                      control={control}
                                      name="outlook_synchronization_show_as"
                                      defaultValue={OutlookShowAs.oof}
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
                                                boxShadow: 'none !important'
                                              }
                                            })
                                          }}
                                          // menuPortalTarget={document.body}
                                          value={outlookShowAsSelectValues.find((x) => x.id === value)}
                                          
                                          className="w-full my-react-select-container"
                                          classNamePrefix="my-react-select"
                                          onChange={(val) => {
                                            if (val) onChange(val.id);
                                          }}
                                          getOptionLabel={(option) => `${option.name}`}
                                          getOptionValue={(option) => option.id}
                                          options={outlookShowAsSelectValues}
                                        />
                                      )}
                                    />
                                  </div>
                                </div>
                                <div className="mb-6">
                                  <label htmlFor="name" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {t('EventSubject')}{' '}
                                    <span
                                      className="ml-1 flex items-center cursor-pointer"
                                      data-tooltip-id="ical-tooltip"
                                      data-tooltip-content={t('Event_Subject_Description_iCal')}
                                      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                    >
                                      <QuestionMarkCircleIcon height={12} />
                                    </span>
                                    <ReactTooltip
                                      id="ical-tooltip"
                                      place="top"
                                      className="shadow z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                      classNameArrow="shadow-sm"
                                      opacity={1}
                                      style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                    />
                                  </label>
                                  <div className="mt-1">
                                    <input
                                      {...register('outlook_synchronization_subject', {
                                        required: false,
                                        maxLength: {
                                          value: 255,
                                          message: t('maxLength_reached')
                                        }
                                      })}
                                      type="text"
                                      name="outlook_synchronization_subject"
                                      id="outlook_synchronization_subject"
                                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-100"
                                    />
                                    {errors.outlook_synchronization_subject?.message && (
                                      <div className="mt-2 inline-flex">
                                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                                        <p className=" ml-2 text-sm text-red-600">
                                          {errors.outlook_synchronization_subject?.message}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        <ul role="list" className="mt-2">
                          <div className="text-sm block font-medium text-gray-700 mb-2 pl-2 dark:text-gray-200">
                            {t('Leave_types_Deduct_from_allowance')}{' '}
                            <div className="border-solid border-gray-300 border p-2 rounded-md mt-2 -ml-2">
                              <Switch.Group as="li" className="flex items-center justify-between py-4">
                                <div className="flex flex-col">
                                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                    {t('Leave_types_Deduct_from_allowance')}
                                  </Switch.Label>
                                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                    {t('Leave_types_Deduct_from_allowance_description')}
                                  </Switch.Description>
                                </div>
                                <Controller
                                  defaultValue={false}
                                  control={control}
                                  name="take_from_allowance"
                                  render={({ field: { onChange, value } }) => (
                                    <Switch
                                      checked={value}
                                      onChange={(val: boolean) => {
                                        onChange(val);
                                        if (val == false) {
                                          setValue('allowance_type_id', null);
                                          setValue('ignore_public_holidays', false);
                                          setValue('ignore_schedule', false);
                                        }
                                        if (val == true && allowancesTypes)
                                          setValue('allowance_type_id', allowancesTypes[0]?.id);
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

                              {watch('take_from_allowance') == true && (
                                <div>
                                  <Switch.Group as="li" className="flex items-center justify-between py-4">
                                    <div className="flex flex-col">
                                      <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                        {t('Leave_types_ignore_public_holidays')}
                                      </Switch.Label>
                                      <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                        {t('Leave_types_ignore_public_holidays_description')}
                                      </Switch.Description>
                                    </div>
                                    <Controller
                                      control={control}
                                      defaultValue={false}
                                      name="ignore_public_holidays"
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
                                              value ? 'translate-x-5' : 'translate-x-0',
                                              'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                            )}
                                          />
                                        </Switch>
                                      )}
                                    />
                                  </Switch.Group>
                                  <Switch.Group as="li" className="flex items-center justify-between py-4">
                                    <div className="flex flex-col">
                                      <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                        {t('Leave_types_ignore_schedule')}
                                      </Switch.Label>
                                      <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                        {t('Leave_types_ignore_schedule_description')}
                                      </Switch.Description>
                                    </div>
                                    <Controller
                                      control={control}
                                      defaultValue={false}
                                      name="ignore_schedule"
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
                                              value ? 'translate-x-5' : 'translate-x-0',
                                              'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                            )}
                                          />
                                        </Switch>
                                      )}
                                    />
                                  </Switch.Group>
                                </div>
                              )}
                              {allowancesTypes &&
                                allowancesTypes.length > 1 &&
                                watch('take_from_allowance') == true && (
                                  <div>
                                    <label
                                      htmlFor="allowance_type_id"
                                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                                    >
                                      {t('take_from_allowance_type')}
                                    </label>
                                    <div className="mt-1">
                                      <Controller
                                        rules={{ required: true }}
                                        control={control}
                                        name="allowance_type_id"
                                        defaultValue={allowancesTypes[0]?.id}
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
                                                  boxShadow: 'none !important'
                                                }
                                              })
                                            }}
                                            // menuPortalTarget={document.body}
                                            value={allowancesTypes.find((x) => x.id === value)}
                                           
                                            className="w-full my-react-select-container"
                                            classNamePrefix="my-react-select"
                                            onChange={(val) => {
                                              if (val) onChange(val.id);
                                            }}
                                            getOptionLabel={(option) => `${option.name} (${t(option.allowance_unit)})`}
                                            getOptionValue={(option) => option.id}
                                            options={allowancesTypes}
                                          />
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>

                          <div className="mt-4">
                            <label htmlFor="leave_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('Leave_types_leave_unit')}
                            </label>
                            <div className="mt-1">
                              <Controller
                                // className ="dark:bg-teams_brand_dark_100"
                                rules={{ required: true }}
                                control={control}
                                name="leave_unit"
                                defaultValue={LeaveUnit.half_days}
                                render={({ field: { onChange, value } }) => (
                                  <Listbox
                                    value={
                                      leaveUnitSelectValues.find((x) => x.id === value) ||
                                      leaveUnitSelectValues.find((x) => x.id === 'half_days')
                                    }
                                    onChange={(val) => {
                                      if (val) onChange(val.id);
                                    }}
                                  >
                                    {({ open }) => (
                                      <>
                                        <Listbox.Label className="sr-only dark:text-gray-200 dark:bg-teams_brand_dark_100">
                                          <p> {t('Leave_types_leave_unit')}</p>{' '}
                                        </Listbox.Label>
                                        <div className="relative w-full">
                                          <div className="inline-flex w-full rounded-md border-gray-300 ">
                                            <div className="inline-flex w-full rounded-md border-gray-300">
                                              <Listbox.Button className="inline-flex w-full  items-center rounded-l-md border border-gray-300 bg-white dark:bg-teams_brand_dark_100 py-2 pl-3 pr-4 text-gray-800 shadow-sm dark:text-gray-200">
                                                <div className="inline-flex">
                                                  <p className=" text-sm font-medium dark:text-gray-200">
                                                    {
                                                      leaveUnitSelectValues.find(
                                                        (x) => x.id === getValues('leave_unit')
                                                      )?.name
                                                    }
                                                  </p>
                                                </div>
                                              </Listbox.Button>
                                              <Listbox.Button className="inline-flex items-center rounded-l-none rounded-r-md border border-l-0 border-gray-300 bg-white p-2 text-sm font-medium text-black shadow-sm hover:bg-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-50 dark:bg-teams_brand_dark_100 dark:text-gray-100">
                                                <span className="sr-only dark:text-gray-200"> {t('Leave_types_leave_unit')}</span>
                                                <ChevronDownIcon className="h-5 w-5 text-gray-800 dark:text-gray-200" aria-hidden="true" />
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
                                            <Listbox.Options className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                                              {leaveUnitSelectValues.map((option) => (
                                                <Listbox.Option
                                                  key={option.name}
                                                  className={({ active }) =>
                                                    classNames(
                                                      'cursor-pointer select-none p-4 text-sm',
                                                      hasValidSubscription
                                                        ? active
                                                          ? 'bg-gray-100 text-gray-800 dark:text-gray-200'
                                                          : 'text-gray-800 dark:text-gray-400'
                                                        : option.id !== 'days' && option.id !== 'half_days'
                                                        ? 'cursor-not-allowed bg-gray-100 text-gray-800'
                                                        : ''
                                                    )
                                                  }
                                                  disabled={
                                                    !hasValidSubscription &&
                                                    option.id !== 'days' &&
                                                    option.id !== 'half_days'
                                                  }
                                                  value={option}
                                                >
                                                  {({ selected, active }) => (
                                                    <div
                                                      className={`flex flex-col ${
                                                        !hasValidSubscription &&
                                                        option.id !== 'days' &&
                                                        option.id !== 'half_days'
                                                          ? ' has-tooltip '
                                                          : ' '
                                                      } `}
                                                    >
                                                      <div className="flex justify-between">
                                                        <p className={selected ? 'font-semibold' : 'font-normal'}>
                                                          {option.name}
                                                        </p>
                                                        <span className=" stooltip -mt-14 -ml-4 w-11/12 rounded p-2 text-center shadow-custom bg-white">
                                                          <p>{t('upgradeToSelectUnit')}</p>
                                                          {current_member?.is_admin && (
                                                            <Link
                                                              href="/settings/organisation/upgrade"
                                                              className="underline hover:text-blue-700"
                                                            >
                                                              {t('upgradeToSelectUnit2')}
                                                            </Link>
                                                          )}
                                                        </span>
                                                        {selected ? (
                                                          <span className={active ? 'text-black dark:text-gray-200' : 'text-gray-300'}>
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
                          </div>
                          <Switch.Group as="li" className="flex items-center justify-between py-4">
                            <div className="flex flex-col">
                              <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                {t('Leave_types_Requires_approval')}
                              </Switch.Label>
                              <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                {t('Leave_types_Requires_approval_description')}
                              </Switch.Description>
                            </div>
                            <Controller
                              control={control}
                              defaultValue={false}
                              name="needs_approval"
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
                                      value ? 'translate-x-5' : 'translate-x-0',
                                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                    )}
                                  />
                                </Switch>
                              )}
                            />
                          </Switch.Group>
                          <Switch.Group as="li" className="flex items-center justify-between py-4">
                            <div className="flex flex-col">
                              <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                {t('Reason_Mandatory')}
                              </Switch.Label>
                              <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                {t('Reason_Mandatory_Description')}
                              </Switch.Description>
                            </div>
                            <Controller
                              control={control}
                              defaultValue={false}
                              name="reason_mandatory"
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
                                      value ? 'translate-x-5' : 'translate-x-0',
                                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                    )}
                                  />
                                </Switch>
                              )}
                            />
                          </Switch.Group>
                          {watch('reason_mandatory') == true && (
                            <div>
                              <label htmlFor="name" className=" inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('reason_hint_text')}{' '}
                                <span
                                  className=" flex items-center cursor-pointer"
                                  data-tooltip-id="outSync-tooltip"
                                  data-tooltip-content={t('reason_hint_text_description')}
                                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                >
                                  <QuestionMarkCircleIcon height={12} className="ml-1" />
                                </span>
                                <ReactTooltip
                                  id="reason_hint_text"
                                  className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                  classNameArrow="shadow-sm"
                                  place="top"
                                  style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                />
                              </label>
                              <input
                                {...register('reason_hint_text', {
                                  required: false,
                                  maxLength: {
                                    value: 250,
                                    message: t('maxLength_reached')
                                  }
                                })}
                                defaultValue={t('Reason_placeholder')}
                                type="text"
                                name="reason_hint_text"
                                id="reason_hint_text"
                                className="w-full mt-1 rounded-md border border-gray-300 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200"
                              />
                              {errors.reason_hint_text?.message && (
                                <div className="mt-2 inline-flex">
                                  <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                                  <p className=" ml-2 text-sm text-red-600">{errors.reason_hint_text?.message}</p>
                                </div>
                              )}
                            </div>
                          )}
                          <Switch.Group as="li" className="flex items-center justify-between py-4">
                            <div className="flex flex-col">
                              <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                {t('Leave_types_Include_in_maximum_absent')}
                              </Switch.Label>
                              <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                {t('Leave_types_Include_in_maximum_absent_description')}
                              </Switch.Description>
                            </div>
                            <Controller
                              control={control}
                              defaultValue={false}
                              name="maximum_absent"
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
                                      value ? 'translate-x-5' : 'translate-x-0',
                                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                    )}
                                  />
                                </Switch>
                              )}
                            />
                          </Switch.Group>

                          <Switch.Group as="li" className="flex items-center justify-between py-4">
                            <div className="flex flex-col">
                              <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                                {t('Leave_types_privacy')}
                              </Switch.Label>
                              <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                                {t('Leave_types_privacy_description')}
                              </Switch.Description>
                            </div>
                            <Controller
                              control={control}
                              defaultValue={false}
                              name="privacy_hide_leavetype"
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
                                      value ? 'translate-x-5' : 'translate-x-0',
                                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                    )}
                                  />
                                </Switch>
                              )}
                            />
                          </Switch.Group>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end p-4 sm:px-6">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          props.onClose();
                        }}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        type="submit"
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_600 dark:text-gray-200"
                      >
                        {addLeaveType.isLoading ||
                          (editLeaveType.isLoading && (
                            <div className="-ml-1 mr-3">
                              <Loader />
                            </div>
                          ))}
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
  );
}
