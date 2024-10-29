import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Switch, Transition } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select, { MultiValue } from 'react-select';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import AlertModal from '@components/alertModal';
import { useDarkSide } from '@components/ThemeContext';

export default function Modal(props: {
  open: boolean;
  onClose: Function;
  value: null | RouterOutputs['calendar_sync_setting']['all'][0];
}) {
  const { t } = useTranslation('settings_organisation');
  const utils = api.useContext();
  const addMode = !props.value;
  const editMode = props.value;
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    getValues,
    setValue,
    setError,
    clearErrors
  } = useForm<RouterInputs['calendar_sync_setting']['add']>();
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });

  const [departmentIds, setDepartmentIds] = useState<string[]>([]);

  const handleSelectChange = (val: MultiValue<{ id: string; name: string }>) => {
    if (departments) {
      if (val && val.some((option) => option.id === 'select-all')) {
        if (departmentIds.length === departments.length) {
          setDepartmentIds([]);
        } else {
          setDepartmentIds(departments.map((department) => department.id));
        }
      } else {
        setDepartmentIds(val ? val.map((x) => x.id) : []);
      }
    }
  };

  const customOptions: { id: string; name: string }[] =
    departmentIds.length === departments?.length
      ? [...departments] || []
      : [{ id: 'select-all', name: t('select_all') }, ...(departments || [])];

  const selectedValues = departments
    ?.filter((department) => departmentIds.includes(department.id))
    .map((department) => ({ id: department.id, name: department.name }));

  const { data: CALENDAR_SYNC_SETTING } = api.calendar_sync_setting.all.useQuery(undefined, { staleTime: 60000 });
  const [leaveTypeSwitches, setLeaveTypeSwitches] = useState<
    Array<{
      id: string;
      bool: boolean;
      only_approved: boolean;
      sync_as_name: string;
      leave_type: {
        name: string;
        id: string;
        outlook_synchronization_subject: string | null;
      };
    }>
  >([]);
  const { subscription } = useAbsentify();

  const { data: LEAVE_TYPES } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const [hasLeaveTypesError, setHasLeaveTypesError] = useState<boolean>(false);
  const addSharedcalendarSetting = api.calendar_sync_setting.add.useMutation();
  const editSharedcalendarSetting = api.calendar_sync_setting.edit.useMutation();
  const { data: MICROSOFT_CALENDARS, isLoading: ISLOADING_CALENDARS } =
    api.calendar_sync_setting.microsoft_calendar.useQuery(undefined, {});
  const { data: microsoft_group_calendars, isLoading: ISLOADING_GROUP_CALENDARS } =
    api.calendar_sync_setting.microsoft_group_calendars.useQuery(undefined, {});

  const SnycCalendarMessageFreePlan = () => {
    return (
      <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-teams_brand_50 py-5 px-6 text-left ">
        <div className="w-full text-sm dark:text-gray-200">
          {`${t('calendar_sync_setting_message')} `}
          <Link href="/settings/organisation/upgrade" className="transition-color underline duration-200 dark:text-gray-200">
            {t('Integrations_description_available_in_plan_2')}
          </Link>
        </div>
      </div>
    );
  };
  const EditMessageEmailSync = () => {
    return (
      <>
        {editMode && watch('calendar_sync_type') === 'ical_email' && (
          <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-yellow-100 py-5 px-6 text-left dark:bg-teams_brand_dark_100 dark:divide-gray-500 dark:text-gray-200 ">
            <div className="w-full text-sm dark:text-gray-200">{t('calendar_sync_setting_email_sync_message')}</div>
          </div>
        )}
        {addMode && watch('calendar_sync_type') === 'ical_email' && (
          <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-yellow-100 py-5 px-6 text-left dark:bg-teams_brand_dark_100">
            <div className="w-full text-sm dark:text-gray-200">{t('calendar_sync_setting_email_sync_add_message')}</div>
          </div>
        )}
      </>
    );
  };
  const { data: workspace, isLoading: isLoadingWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const [countStep, setCountStep] = useState<number>(0);
  const [msCalendarState, setMsCalendarState] = useState<boolean>(false);
  const [departmendIdState, setDepartmendIdState] = useState<boolean>(false);
  const [nextButtonState, setNextButtonState] = useState<boolean>(false);
  const [calendarIdState, setCalendarIdState] = useState<boolean>(false);
  const [saveButtonState, setSaveButtonState] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState(false);

  const calendarTypes: Array<{ name: string; type: string }> = [
    { name: t('Outlook_shared_calendar'), type: 'outlook_calendar' },
    { name: t('iCal'), type: 'ical_email' },
    { name: t('Outlook_group_calendar'), type: 'outlook_group_calendar' }
  ];
  const { current_member, in_teams } = useAbsentify();
  const onSubmitCalendarSyncSetting: SubmitHandler<RouterInputs['calendar_sync_setting']['add']> = async (
    data: RouterInputs['calendar_sync_setting']['add']
  ) => {
    if (!current_member) return;
    if (!LEAVE_TYPES) return;
    data.workspace_id = `${current_member?.workspace_id}`;
    data.calendar_id = getValues('calendar_sync_type') == 'ical_email' ? '' : data.calendar_id;
    data.calendar_name = getValues('calendar_sync_type') == 'ical_email' ? '' : data.calendar_name;
    data.email = getValues('calendar_sync_type') !== 'ical_email' ? null : data.email;
    data.token_member_id = getValues('calendar_sync_type') == 'outlook_group_calendar' ? current_member.id : null;

    if (!data.calendar_microsoft_user_id) {
      data.calendar_microsoft_user_id = current_member.microsoft_user_id;
    }
    if (!data.calendar_microsoft_tenant_id) {
      data.calendar_microsoft_tenant_id = current_member.microsoft_tenantId;
    }
    data.leave_types = leaveTypeSwitches
      .filter((x) => x.bool)
      .map((leave_type) => {
        return {
          id: leave_type.id,
          sync_as_name: leave_type.sync_as_name,
          leave_type: leave_type.leave_type,
          only_approved: leave_type.only_approved
        };
      });

    data.department_ids = departmentIds;

    if (addMode) {
      await addSharedcalendarSetting.mutateAsync(data, {
        onSuccess: async (calendar_sync_setting) => {
          await utils.calendar_sync_setting.all.invalidate();
          props.onClose(calendar_sync_setting);
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);
        }
      });
    } else if (editMode) {
      await editSharedcalendarSetting.mutateAsync(
        { id: editMode.id, data },
        {
          onSuccess: async (calendar_sync_setting) => {
            await utils.calendar_sync_setting.all.invalidate();
            props.onClose(calendar_sync_setting);
            notifySuccess(t('Saved_successfully'));
          },
          onError: (error) => {
            notifyError(error.message);
          }
        }
      );
    }
  };
  const isValidEmail = (email: string | null) =>
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      email as string
    );

  useEffect(() => {
    if (!leaveTypeSwitches) return;
    setHasLeaveTypesError(!leaveTypeSwitches.some((x) => x.bool === true));
  }, [leaveTypeSwitches, hasLeaveTypesError]);

  useEffect(() => {
    if (!LEAVE_TYPES) return;
    if (editMode) setDepartmentIds(editMode.calendarSyncSettingDepartments.map((x) => x.department.id));
    if (addMode && departments && departments[0]) setDepartmentIds([departments[0].id]);
    const vals = LEAVE_TYPES.map((leave_type) => ({
      id: leave_type.id,
      bool: false,
      only_approved: false,
      sync_as_name: leave_type.outlook_synchronization_subject
        ? leave_type.outlook_synchronization_subject
        : leave_type.name,
      leave_type
    }));

    if (editMode) {
      for (let index = 0; index < editMode.calendarSyncSettingLeaveTypes.length; index += 1) {
        const element = editMode.calendarSyncSettingLeaveTypes[index];
        if (element) {
          const f = vals.find((val) => val.id === element.leave_type.id);
          if (f) {
            f.bool = true;
            f.only_approved = element.only_approved;
            f.sync_as_name = element.sync_as_name;
          }
        }
      }
    }
    setLeaveTypeSwitches(vals);
  }, [LEAVE_TYPES, editMode, departments]);

  useEffect(() => {
    if (!workspace) return;
    setMsCalendarState(workspace.microsoft_calendars_read_write === 'ACTIVATED');
  }, [workspace]);

  useEffect(() => {
    setCalendarIdState(
      countStep === 1 &&
        (watch('calendar_id') === '' || watch('calendar_id') === undefined) &&
        watch('calendar_sync_type') === 'outlook_calendar'
    );
  }, [countStep, watch('calendar_sync_type'), watch('calendar_id')]);

  useEffect(() => {
    if (!isLoadingWorkspace || !ISLOADING_CALENDARS)
      setNextButtonState(
        calendarIdState || (countStep === 1 && !MICROSOFT_CALENDARS && msCalendarState) || departmendIdState
      );
  }, [calendarIdState, countStep, msCalendarState, departmendIdState, isLoadingWorkspace, ISLOADING_CALENDARS]);

  useEffect(() => {
    setSaveButtonState(
      countStep === 3 &&
        subscription.has_valid_subscription &&
        !hasLeaveTypesError &&
        !leaveTypeSwitches.some((x) => x.sync_as_name === '') &&
        !calendarIdState
    );
  }, [countStep, hasLeaveTypesError, subscription.has_valid_subscription, leaveTypeSwitches]);

  useEffect(() => {
    if (!departmentIds) return;
    setDepartmendIdState(countStep === 2 && departmentIds?.length === 0);
  }, [countStep, departmentIds]);

  useEffect(() => {
    if (calendarTypes && calendarTypes[0]) {
      setValue(
        'calendar_sync_type',
        editMode
          ? editMode?.calendar_sync_type
          : (calendarTypes[0].type as 'outlook_calendar' | 'ical_email' | 'outlook_group_calendar')
      );
    }
    if (editMode) {
      if (editMode.calendar_sync_type === 'outlook_calendar') {
        setValue('calendar_name', editMode.calendar_name);
        setValue('calendar_microsoft_user_id', editMode.calendar_microsoft_user_id);
        setValue('calendar_microsoft_tenant_id', editMode.calendar_microsoft_tenant_id);
        setValue('calendar_id', editMode.calendar_id);
      } else if (editMode.calendar_sync_type === 'ical_email') {
        setValue('email', editMode.email);
      } else if (editMode.calendar_sync_type === 'outlook_group_calendar') {
        setValue('calendar_name', editMode.calendar_name);
        setValue('calendar_microsoft_user_id', editMode.calendar_microsoft_user_id);
        setValue('calendar_microsoft_tenant_id', editMode.calendar_microsoft_tenant_id);
        setValue('calendar_id', editMode.calendar_id);
      }
    }
  }, [editMode]);

  useEffect(() => {
    if (editMode) {
      if (watch('calendar_sync_type') === 'outlook_calendar' && CALENDAR_SYNC_SETTING) {
        const calName = CALENDAR_SYNC_SETTING.filter((x) => x.id === editMode?.id)[0];
        if (calName) {
          setValue('calendar_name', CALENDAR_SYNC_SETTING ? calName.calendar_name : '');
          setValue('calendar_id', CALENDAR_SYNC_SETTING ? calName.calendar_id : '');
        }
      }

      if (watch('calendar_sync_type') === 'ical_email') {
        setValue('calendar_name', '');
        setValue('calendar_id', '');
      }
    }
  }, [editMode, watch('calendar_sync_type')]);

  useEffect(() => {
    if (addMode) {
      if (watch('calendar_sync_type') === 'outlook_calendar') {
        setValue('calendar_name', '');
        setValue('calendar_id', '');
      }

      if (watch('calendar_sync_type') === 'ical_email') {
        setValue('calendar_name', '');
        setValue('calendar_id', '');
      }
      if (watch('calendar_sync_type') === 'outlook_group_calendar') {
        setValue('calendar_name', '');
        setValue('calendar_id', '');
      }
    }
  }, [watch('calendar_sync_type')]);

  const [steps, setSteps] = useState<{ id: string; name: string; status: 'current' | 'upcoming' | 'complete' }[]>([
    {
      id: t('Step', { number: 1 }),
      name: t('calendar_sync_setting_modal'),
      status: 'current'
    },
    { id: t('Step', { number: 2 }), name: t('Calendar_choice'), status: 'upcoming' },
    {
      id: t('Step', { number: 3 }),
      name: t('calendar_sync_Departments'),
      status: 'upcoming'
    },
    {
      id: t('Step', { number: 4 }),
      name: t('Config_Leave_types'),
      status: 'upcoming'
    }
  ]);
  const generateRandomState = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0]!.toString(36);
  };

  const generateMicrosoftLoginUrl = () => {
    const host = window.location.host; // z.B. "localhost:3000"
    const protocol = window.location.protocol; // z.B. "http:"

    let redirectUri = `${protocol}//${host}/api/auth/group_delegated`;
    let state = generateRandomState();

    const baseUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION + '',
      scope: 'openid email profile offline_access Group.ReadWrite.All',
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state
    });

    return `${baseUrl}?${params.toString()}`;
  };
  
 const [theme] = useDarkSide();
  return (
    <Transition.Root show={props.open} as={Fragment}>
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
            <div className="inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-4xl sm:p-6 sm:align-middle dark:bg-teams_brand_dark_100">
              <Dialog.Title as="h3" className="py-6 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                {editMode ? t('Edit_calendar_sync') : t('Add_calendar_sync')}
              </Dialog.Title>
              <nav aria-label="Progress ">
                <ol role="list" className="mt-4 space-y-4 md:flex md:space-y-0 md:space-x-8">
                  {steps.map((step) => (
                    <li key={step.name} className="md:flex-1">
                      {step.status === 'complete' ? (
                        <span className="group flex flex-col border-l-4 border-teams_brand_foreground_bg py-2 pl-4  md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                          <span className="text-xs font-semibold uppercase tracking-wide text-teams_brand_foreground_bg ">
                            {step.id}
                          </span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      ) : step.status === 'current' ? (
                        <span
                          className="flex flex-col border-l-4 border-teams_brand_foreground_bg py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0"
                          aria-current="step"
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-teams_brand_foreground_bg ">
                            {step.id}
                          </span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      ) : (
                        <span className="group flex flex-col border-l-4 border-gray-200 py-2 pl-4  md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{step.id}</span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>{' '}
              <div className="mt-5 border-t border-gray-200"></div>
              {steps[0] && steps[0].status === 'current' && (
                <div className="mt-5  bg-white dark:bg-teams_brand_dark_100">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                          {t('calendar_sync_setting_modal')}
                        </h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-200">
                          <p> {t('calendar_sync_modal_description')}</p>
                        </div>
                      </div>
                      <div className="sEm:ml-6 mt-5 sm:mt-0 sm:flex sm:shrink-0 sm:items-center"></div>
                    </div>
                  </div>
                  <form className="divide-y divide-gray-200 pl-0 lg:pl-4" onSubmit={() => {}}>
                    <div className="mt-6 mb-10 grid grid-cols-1 content-center gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block pb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('calendar_sync_modal_name')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <Controller
                            control={control}
                            name="name"
                            defaultValue={editMode ? editMode.name : undefined}
                            render={({ field: { onChange } }) => (
                              <input
                                {...register('name', { required: true })}
                                type="text"
                                autoComplete="name"
                                className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200 dark:bg-teams_brand_dark_100"
                                onChange={(val) => onChange(val.target.value)}
                              />
                            )}
                          />
                        </div>

                        {errors.name && (
                          <div className="mt-2 inline-flex">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                            <p className=" mr-4 text-sm text-red-600">{errors.name.message}</p>
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block pb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('description')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <Controller
                            control={control}
                            name="description"
                            defaultValue={editMode ? editMode.description : undefined}
                            render={({ field: { onChange } }) => (
                              <input
                                {...register('description', { required: true })}
                                type="text"
                                autoComplete="description"
                                className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200"
                                onChange={(val) => onChange(val.target.value)}
                              />
                            )}
                          />
                        </div>

                        {errors.description && (
                          <div className="mt-2 inline-flex">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />
                            <p className=" mr-4 text-sm text-red-600">{errors.description.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!subscription.has_valid_subscription && (
                      <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-teams_brand_50 py-5 px-6 text-left ">
                        <div className="w-full text-sm dark:text-gray-200">
                          {`${t('calendar_sync_setting_message')} `}
                          <Link
                            href="/settings/organisation/upgrade"
                            className="transition-color underline duration-200 "
                          >
                            {t('Integrations_description_available_in_plan_2')}
                          </Link>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              )}
              {steps[1] && steps[1].status === 'current' && (
                <div className="mt-6 mb-10 px-4 sm:px-6 lg:px-8 lg:pr-20">
                  <div className="pb-4 sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Calendar_choice')}</h3>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{t('Calendar_choice_descript')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm"></div>

                    {current_member &&
                      editMode &&
                      editMode.calendar_microsoft_user_id === current_member.microsoft_user_id && (
                        <Controller
                          rules={{ required: true }}
                          name="calendar_sync_type"
                          control={control}
                          defaultValue={editMode.calendar_sync_type}
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
                              isDisabled={true}
                              value={calendarTypes?.find((x) => x.type === value)}
                              getOptionLabel={(option) => option.name}
                              getOptionValue={(option) => option.type}
                              onChange={(val) => {
                                onChange(val?.type);
                              }}
                              options={calendarTypes}
                              className="w-full my-react-select-container"
                              classNamePrefix="my-react-select"
                            />
                          )}
                        />
                      )}
                    {current_member && addMode && (
                      <Controller
                        rules={{ required: true }}
                        name="calendar_sync_type"
                        control={control}
                        defaultValue={calendarTypes[0] && (calendarTypes[0].type as 'outlook_calendar' | 'ical_email')}
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
                            value={calendarTypes?.find((x) => x.type === value)}
                            getOptionLabel={(option) => option.name}
                            getOptionValue={(option) => option.type}
                            onChange={(val) => {
                              onChange(val?.type);
                            }}
                            options={calendarTypes}
                            className="w-full my-react-select-container"
                            classNamePrefix="my-react-select"
                          />
                        )}
                      />
                    )}
                    {/* outlook_calendar */}
                    {getValues('calendar_sync_type') === 'outlook_calendar' &&
                    MICROSOFT_CALENDARS &&
                    current_member &&
                    MICROSOFT_CALENDARS.length > 0 &&
                    workspace?.microsoft_calendars_read_write === 'ACTIVATED' ? (
                      <div className="mt-4">
                        <p>
                          {editMode &&
                            current_member &&
                            editMode.calendar_microsoft_user_id !== current_member.microsoft_user_id && (
                              <div>
                                <p className='dark:text-gray-200'>{t('Calendar_was_selected_by_another_user_and_cannot_be_changed')}</p>
                                <p className='dark:text-gray-200'>{watch('calendar_name')}</p>
                              </div>
                            )}
                        </p>
                        {editMode &&
                          current_member &&
                          editMode.calendar_microsoft_user_id === current_member.microsoft_user_id && (
                            <Select
                              styles={{
                                control: (base) => ({
                                  ...base,
                                  '*': {
                                    boxShadow: 'none !important'
                                  }
                                })
                              }}
                              
                              defaultValue={
                                CALENDAR_SYNC_SETTING?.filter((x) => x.id === editMode?.id)[0]?.calendar_id
                                  ? MICROSOFT_CALENDARS.find((x) => x.id === getValues('calendar_id'))
                                  : MICROSOFT_CALENDARS.find((x) => x.id === editMode?.calendar_id)
                              }
                              options={MICROSOFT_CALENDARS}
                              getOptionLabel={(option) => `${option.name} (${t('Owner')}: ${option.owner.name})`}
                              getOptionValue={(option) => option.id}
                              onChange={(val) => {
                                if (val?.id) {
                                  setValue('calendar_id', val.id);
                                  setValue('calendar_name', `${val.name} (${t('Owner')}: ${val.owner.name})`);
                                  setValue('calendar_microsoft_user_id', current_member.microsoft_user_id);
                                  setValue('calendar_microsoft_tenant_id', current_member.microsoft_tenantId);
                                }
                              }}

                              className="w-full my-react-select-container"
                              classNamePrefix="my-react-select"
                            />
                          )}

                        {addMode && (
                          <Select
                            styles={{
                              control: (base) => ({
                                ...base,
                                '*': {
                                  boxShadow: 'none !important'
                                }
                              })
                            }}
                            defaultValue={MICROSOFT_CALENDARS.find((x) => x.id === getValues('calendar_id'))}
                            options={MICROSOFT_CALENDARS}
                            getOptionLabel={(option) => `${option.name} (${t('Owner')}: ${option.owner.name})`}
                            getOptionValue={(option) => option.id}
                            onChange={(val) => {
                              if (val?.id) {
                                setValue('calendar_id', val.id);
                                setValue('calendar_name', `${val.name} (${t('Owner')}: ${val.owner.name})`);
                                setValue('calendar_microsoft_user_id', current_member.microsoft_user_id);
                                setValue('calendar_microsoft_tenant_id', current_member.microsoft_tenantId);
                                setNextButtonState(false);
                              }
                            }}
                            className="w-full my-react-select-container"
                            classNamePrefix="my-react-select"
                          />
                        )}
                      </div>
                    ) : getValues('calendar_sync_type') === 'outlook_calendar' &&
                      MICROSOFT_CALENDARS &&
                      MICROSOFT_CALENDARS.length === 0 &&
                      workspace?.microsoft_calendars_read_write === 'ACTIVATED' ? (
                      <p className="mt-2 pl-2 dark:text-gray-200">{t('You_need_write_permission')}</p>
                    ) : getValues('calendar_sync_type') === 'outlook_calendar' &&
                      workspace?.microsoft_calendars_read_write !== 'ACTIVATED' ? (
                      <p className="mt-2 pl-2 dark:text-gray-200">
                        <Link
                          href={'/settings/organisation/microsoft'}
                          className="text-red-500 underline cursor-pointer"
                        >
                          {`${t('first_inherit_permission_outlook')}->`}
                        </Link>
                      </p>
                    ) : (
                      <>
                        {isLoadingWorkspace ||
                          (ISLOADING_CALENDARS && (
                            <div className="p-4">
                              <div className="-ml-1 mr-3">
                                <Loader />
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                    {/* outlook_group_calendar */}

                    {getValues('calendar_sync_type') === 'outlook_group_calendar' &&
                    microsoft_group_calendars &&
                    current_member &&
                    microsoft_group_calendars.groups.length > 0 &&
                    microsoft_group_calendars.valid_token == true ? (
                      <div className="mt-4">
                        <p>
                          {editMode &&
                            current_member &&
                            editMode.calendar_microsoft_user_id !== current_member.microsoft_user_id && (
                              <div>
                                <p className='dark:text-gray-200'>{t('Calendar_was_selected_by_another_user_and_cannot_be_changed')}</p>
                                <p className='dark:text-gray-200'>{watch('calendar_name')}</p>
                              </div>
                            )}
                        </p>
                        {editMode &&
                          current_member &&
                          editMode.calendar_microsoft_user_id === current_member.microsoft_user_id && (
                            <Select
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
                              defaultValue={
                                CALENDAR_SYNC_SETTING?.filter((x) => x.id === editMode?.id)[0]?.calendar_id
                                  ? microsoft_group_calendars.groups.find((x) => x.id === getValues('calendar_id'))
                                  : microsoft_group_calendars.groups.find((x) => x.id === editMode?.calendar_id)
                              }
                              options={microsoft_group_calendars.groups}
                              getOptionLabel={(option) => `${option.displayName}`}
                              getOptionValue={(option) => option.id}
                              onChange={(val) => {
                                if (val?.id) {
                                  setValue('calendar_id', val.id);
                                  setValue('calendar_name', `${val.displayName}`);
                                  setValue('calendar_microsoft_user_id', current_member.microsoft_user_id);
                                  setValue('calendar_microsoft_tenant_id', current_member.microsoft_tenantId);
                                }
                              }}
                            />
                          )}

                        {addMode && (
                          <Select
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
                            defaultValue={microsoft_group_calendars.groups.find(
                              (x) => x.id === getValues('calendar_id')
                            )}
                            options={microsoft_group_calendars.groups}
                            getOptionLabel={(option) => `${option.displayName} `}
                            getOptionValue={(option) => option.id}
                            onChange={(val) => {
                              if (val?.id) {
                                setValue('calendar_id', val.id);
                                setValue('calendar_name', `${val.displayName} `);
                                setValue('calendar_microsoft_user_id', current_member.microsoft_user_id);
                                setValue('calendar_microsoft_tenant_id', current_member.microsoft_tenantId);
                                setNextButtonState(false);
                              }
                            }}
                          />
                        )}
                      </div>
                    ) : getValues('calendar_sync_type') === 'outlook_group_calendar' &&
                      microsoft_group_calendars &&
                      microsoft_group_calendars.valid_token == true ? (
                      <p className="mt-2 pl-2 dark:text-gray-200">{t('You_need_write_permission_group')}</p>
                    ) : getValues('calendar_sync_type') === 'outlook_group_calendar' &&
                      microsoft_group_calendars &&
                      microsoft_group_calendars.valid_token == false ? (
                      <p className="mt-2 pl-2 dark:text-gray-200">
                        {in_teams ? (
                          <a
                            onClick={(e) => {
                              e.preventDefault();
                              setAlertModal(true);
                            }}
                            className="text-red-500 underline cursor-pointer dark:text-gray-200"
                          >
                            {`${t('no_permission_group')}->`}
                          </a>
                        ) : (
                          <a
                            href={generateMicrosoftLoginUrl()}
                            target="_blank"
                            className="text-red-500 underline cursor-pointer dark:text-gray-200"
                          >
                            {`${t('no_permission_group')}->`}
                          </a>
                        )}
                      </p>
                    ) : (
                      <>
                        {isLoadingWorkspace ||
                          (ISLOADING_GROUP_CALENDARS && (
                            <div className="p-4">
                              <div className="-ml-1 mr-3">
                                <Loader />
                              </div>
                            </div>
                          ))}
                      </>
                    )}

                    {/* ical_email */}
                    {watch('calendar_sync_type') === 'ical_email' ? (
                      <div className="mt-6 ">
                        <label htmlFor="email" className="mb-3 block dark:text-gray-200">
                          {t('Email')}
                        </label>
                        <Controller
                          control={control}
                          name="email"
                          defaultValue={editMode ? (editMode.email as string) : ''}
                          render={({ field: { onChange } }) => (
                            <input
                              {...register('email')}
                              type="text"
                              onChange={(val) => onChange(val.target.value)}
                              className="block w-full rounded-md border-gray-300 dark:text-gray-200 dark:bg-teams_brand_dark_100"
                            />
                          )}
                        />
                        {errors.email && (
                          <div className="mt-2 inline-flex">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                            <p className=" mr-4 text-sm text-red-600">{errors.email.message}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <></>
                    )}
                  </div>
                  {!subscription.has_valid_subscription && <SnycCalendarMessageFreePlan />}
                  <EditMessageEmailSync />
                </div>
              )}
              {steps[2] && steps[2].status === 'current' && (
                <div className="mt-6 mb-10 w-80 px-4 sm:px-6 lg:w-auto lg:pr-20 lg:pl-8">
                  <div className="pb-4 sm:flex sm:items-center ">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('calendar_sync_Departments')}</h3>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{t('calendar_sync_Departments_descrip')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      {customOptions && (
                        <Select
                          styles={{
                            control: (base) => ({
                              ...base,
                              '*': {
                                boxShadow: 'none !important'
                              }
                            })
                          }}
                          isMulti
                          value={selectedValues}
                          className="w-full my-react-select-container"
                          classNamePrefix="my-react-select"
                          name="department_ids"
                          onChange={(val) => {
                            if (val) {
                              handleSelectChange(val);
                            }
                          }}
                          getOptionLabel={(option) => `${option.name}`}
                          getOptionValue={(option) => option.id}
                          options={customOptions}
                        />
                      )}
                    </div>
                  </div>
                  {!subscription.has_valid_subscription && <SnycCalendarMessageFreePlan />}
                  <EditMessageEmailSync />
                </div>
              )}
              {steps[3] && steps[3].status === 'current' && (
                <div className="mt-5  bg-white dark:bg-teams_brand_dark_100">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:flex-col ">
                      <div className="py-4">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Config_Leave_types')}</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-200">
                          <p>{t('config_leave_types_description')}</p>
                        </div>
                      </div>
                      <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500 ">
                          <thead className="rounded-sm bg-gray-50 dark:bg-teams_brand_dark_100">
                            <tr>
                              <th
                                scope="col"
                                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200"
                              >
                                {t('leaveType_name')}
                              </th>
                              <th scope="col" className=" py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                                {t('leaveType_show_as')}
                              </th>

                              <th
                                scope="col"
                                className="relative py-3.5 pl-3 pr-4 text-left text-sm font-semibold text-gray-900 sm:pr-6 dark:text-gray-200"
                              >
                                <div className="flex dark:text-gray-200">
                                  {t('Activated')}
                                  <span
                                    className="ml-1 flex items-center cursor-pointer"
                                    data-tooltip-id="questionM-tooltip"
                                    data-tooltip-content={t('active_tooltip')}
                                    data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                  >
                                    <QuestionMarkCircleIcon height={12} />
                                  </span>
                                  <ReactTooltip
                                    id="questionM-tooltip"
                                    className="shadow z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
                                    classNameArrow="shadow-sm"
                                    place="top"
                                    style={{ width: '360px' }}
                                  />
                                </div>
                              </th>

                              <th
                                scope="col"
                                className="relative py-3.5 pl-3 pr-4 text-left text-sm font-semibold text-gray-900 sm:pr-6 dark:text-gray-200"
                              >
                                <div className="flex">
                                  {t('only_approved')}
                                  <span
                                    className="ml-1 flex items-center cursor-pointer"
                                    data-tooltip-id="questionM-tooltip"
                                    data-tooltip-content={t('onlyApproved_tooltip')}
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
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                            {leaveTypeSwitches?.map((leave_type, i) => (
                              <tr key={leave_type.id} className='dark:bg-teams_brand_dark_100'>
                                <td className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                                  {' '}
                                  {leave_type.leave_type.name}
                                  <p className="font-normal text-gray-500 dark:text-gray-200">
                                    {' '}
                                    {leave_type.leave_type.outlook_synchronization_subject}
                                  </p>
                                </td>
                                <td className="py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                                  <input
                                    maxLength={255}
                                    value={leave_type.sync_as_name}
                                    type="text"
                                    className={`w-20 rounded ${
                                      leave_type.sync_as_name === '' ? 'border-red-500 dark:text-gray-200' : 'border-gray-300 dark:text-gray-200 dark:bg-teams_brand_dark_100'
                                    } text-sm lg:w-40`}
                                    onChange={(e) => {
                                      const x = [...leaveTypeSwitches];
                                      const element = x[i];
                                      if (element) {
                                        element.sync_as_name = e.target.value;
                                        setLeaveTypeSwitches(x);
                                      }
                                    }}
                                  />{' '}
                                </td>
                                <td className="relative py-3.5 pl-0 pr-4 text-left text-sm font-semibold text-gray-900 sm:pr-6 dark:text-gray-200">
                                  {' '}
                                  <Switch
                                    checked={leave_type.bool}
                                    name="leave_types"
                                    onChange={(e: boolean) => {
                                      const x = [...leaveTypeSwitches];
                                      const element = x[i];
                                      if (element) {
                                        if (e === false) {
                                          element.only_approved = false;
                                        }
                                        element.bool = e;
                                        setLeaveTypeSwitches(x);
                                      }
                                    }}
                                    className={classNames(
                                      leave_type.bool ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                                      'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                                    )}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={classNames(
                                        leave_type.bool ? 'translate-x-5' : 'translate-x-0',
                                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                      )}
                                    />
                                  </Switch>
                                </td>
                                {leave_type.bool && (
                                  <td className="relative py-3.5 pl-0 pr-4 text-left text-sm font-semibold text-gray-900 sm:pr-6">
                                    {' '}
                                    <Switch
                                      checked={leave_type.only_approved}
                                      name="only_approved"
                                      onChange={(e: boolean) => {
                                        const x = [...leaveTypeSwitches];
                                        const element = x[i];
                                        if (element && element.bool) {
                                          element.only_approved = e;
                                          setLeaveTypeSwitches(x);
                                        }
                                      }}
                                      className={classNames(
                                        leave_type.only_approved  ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                                      )}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={classNames(
                                          leave_type.only_approved ? 'translate-x-5' : 'translate-x-0',
                                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                        )}
                                      />
                                    </Switch>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {!subscription.has_valid_subscription && <SnycCalendarMessageFreePlan />}
                  <EditMessageEmailSync />
                </div>
              )}
              <div className="mt-4 flex justify-end border-t p-4 sm:px-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    props.onClose();
                  }}
                  className="mx-2 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                >
                  {t('Cancel')}
                </button>
                {countStep >= 1 && (
                  <button
                    onClick={() => {
                      const step1 = steps[countStep];
                      if (step1) {
                        step1.status = 'upcoming';
                      }
                      const step2 = steps[countStep - 1];
                      if (step2) {
                        step2.status = 'current';
                      }

                      setSteps(steps);
                      setCountStep(countStep - 1);
                    }}
                    type="button"
                    className="mx-2 inline-flex items-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 font-medium text-white shadow-sm hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm "
                  >
                    {t('previous')}
                  </button>
                )}
                {countStep < steps.length - 1 && (
                  <button
                    onClick={() => {
                      if (watch('name') === '')
                        setError('name', {
                          type: 'custom',
                          message: t('This_is_required')
                        });
                      if (watch('description') === '')
                        setError('description', {
                          type: 'custom',
                          message: t('This_is_required')
                        });
                      if (
                        countStep === 1 &&
                        isValidEmail(watch('email')) === false &&
                        watch('calendar_sync_type') === 'ical_email'
                      )
                        setError('email', {
                          type: 'custom',
                          message: t('invalid_email')
                        });

                      if (countStep < 4 && watch('name') !== '' && watch('description') !== '') {
                        if (
                          countStep === 1 &&
                          isValidEmail(watch('email')) === false &&
                          watch('calendar_sync_type') === 'ical_email'
                        ) {
                          const step = steps[countStep];
                          if (step) step.status = 'current';
                        } else if (
                          countStep === 1 &&
                          watch('calendar_id') === '' &&
                          watch('calendar_sync_type') === 'outlook_calendar'
                        ) {
                          const step = steps[countStep];
                          if (step) step.status = 'current';
                        } else {
                          clearErrors('name');
                          clearErrors('description');
                          clearErrors('email');
                          const step = steps[countStep];
                          if (step) step.status = 'complete';
                          const nextStep = steps[countStep + 1];
                          if (nextStep) nextStep.status = 'current';
                          setSteps(steps);
                          setCountStep(countStep + 1);
                        }
                      }
                    }}
                    type="button"
                    disabled={nextButtonState}
                    className={` ${
                      nextButtonState
                        ? ' border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-300 '
                        : ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                    } mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium   shadow-sm focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm `}
                  >
                    {t('Next')}
                  </button>
                )}

                {countStep === steps.length - 1 && (
                  <button
                    disabled={!saveButtonState}
                    onClick={() => {
                      if (Object.keys(errors).length === 0) {
                        handleSubmit(onSubmitCalendarSyncSetting)();
                      }
                    }}
                    type="button"
                    className={` ${
                      !saveButtonState
                        ? ' border-gray-300 bg-teams_brand_foreground_bg text-gray-200 hover:bg-gray-300 '
                        : ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                    }  mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm `}
                  >
                    {(editSharedcalendarSetting.isLoading || addSharedcalendarSetting.isLoading) && (
                      <div className="-ml-1 mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('save')}
                  </button>
                )}
              </div>
              {alertModal && (
                <AlertModal
                  text={t('can_be_preformed_only_in_web')}
                  onClose={() => {
                    setAlertModal(false);
                  }}
                />
              )}
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
