import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Switch, Transition } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import DepartmentUsers from '@modules/settings/organisation/Departments/DepartmentUsers';

export default function Modal(props: {
  open: boolean;
  onClose: Function;
  value: null | RouterOutputs['group']['allGroupSettings'][0];
}) {
  const { t } = useTranslation('settings_organisation');
  const addMode = !props.value;
  const editMode = props.value;
  const utils = api.useContext();
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setError,
    setValue,
    clearErrors
  } = useForm<RouterInputs['group']['add']>();
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });

  const addGroupSyncSetting = api.group.add.useMutation();
  const editGroupSyncSetting = api.group.edit.useMutation();
  const { data: existingGroupSyncSettings } = api.group.allGroupSettings.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: syncedDepartmentsForGroup } = api.group.getSyncedDepartmentsForGroup.useQuery(
    { group_setting_id: editMode?.id as string },
    {
      staleTime: 60000,
      enabled: editMode !== null
    }
  );

  const { data: allGroups, isLoading: loadingGroups } = api.group.all.useQuery(undefined, {
    staleTime: 60000
  });
  const group_id = watch('group_id');
  const prevGroupIdRef = useRef<string | null>(null);
  const { data: groupMembers, refetch: groupMembersRefetch } = api.group.getGroupMembersWithPhotos.useQuery(
    { id: group_id },
    {
      enabled: false
    }
  );
  useEffect(() => {
    if (group_id && group_id.trim() !== '' && group_id !== prevGroupIdRef.current) {
      groupMembersRefetch();
      prevGroupIdRef.current = group_id;
    }
  }, [group_id]);

  const { subscription } = useAbsentify();
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);

  const [countStep, setCountStep] = useState<number>(0);
  const [groups, setGroups] = useState<RouterOutputs['group']['all']>([]);
  const { current_member } = useAbsentify();
  useEffect(() => {
    if (allGroups && existingGroupSyncSettings && addMode) {
      const existingGroupIds = existingGroupSyncSettings.map((group) => group.group_id);
      const filterGroups = allGroups.filter((group) => !existingGroupIds.includes(group.id));
      setGroups(filterGroups);
    } else if (allGroups && existingGroupSyncSettings && editMode) {
      const existingGroupIds = existingGroupSyncSettings.map((group) => group.group_id);
      const filterGroups = allGroups.filter(
        (group) => group.id === editMode.group_id || !existingGroupIds.includes(group.id)
      );
      setGroups(filterGroups);
    }
  }, [allGroups, existingGroupSyncSettings, addMode, editMode]);
  useEffect(() => {
    if (!editMode || !editMode.id || !syncedDepartmentsForGroup) return;
    setDepartmentIds(syncedDepartmentsForGroup.map((dep) => dep.department_id));
  }, [editMode, syncedDepartmentsForGroup]);
  const onSubmitGroupSyncSetting: SubmitHandler<RouterInputs['group']['add'] | RouterInputs['group']['edit']> = async (
    data: RouterInputs['group']['add'] | RouterInputs['group']['edit']
  ) => {
    if (!current_member) return;
    if (addMode) {
      if (data.group_id) data.department_ids = departmentIds ?? [];
      if (
        !subscription.enterprise &&
        !subscription.business &&
        !subscription.addons.multi_manager &&
        data.manager_change_option
      ) {
        notifyError(t('cant_activate_manager_option'));
        return;
      }
      await addGroupSyncSetting.mutateAsync(data, {
        onSuccess: async () => {
          props.onClose(true);
          utils.group.allGroupSettings.invalidate();
          utils.group.getSyncedDepartmentsForGroup.invalidate();
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);
        }
      });
    } else if (editMode && editMode.id) {
      data.department_ids = departmentIds ?? [];
      if (
        !subscription.enterprise &&
        !subscription.business &&
        !subscription.addons.multi_manager &&
        data.manager_change_option
      ) {
        notifyError(t('cant_activate_manager_option'));
        return;
      }
      (data as RouterInputs['group']['edit']).synced_group_setting_id = editMode.id;
      await editGroupSyncSetting.mutateAsync(data as RouterInputs['group']['edit'], {
        onSuccess: async () => {
          props.onClose(true);
          utils.group.allGroupSettings.invalidate();
          utils.group.getSyncedDepartmentsForGroup.invalidate();
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);
        }
      });
    }
  };

  const [steps, setSteps] = useState<{ id: string; name: string; status: 'current' | 'upcoming' | 'complete' }[]>([
    {
      id: t('Step', { number: 1 }),
      name: t('calendar_sync_setting_modal'),
      status: 'current'
    },
    { id: t('Step', { number: 2 }), name: t('select_group'), status: 'upcoming' },
    {
      id: t('Step', { number: 3 }),
      name: t('calendar_sync_Departments'),
      status: 'upcoming'
    },
    {
      id: t('Step', { number: 4 }),
      name: t('configure_sync'),
      status: 'upcoming'
    }
  ]);

  useEffect(() => {
    editMode?.group_id && setValue('group_id', editMode?.group_id);
    setValue('automatic_account_create_option', editMode?.automatic_account_create_option ?? false);
    setValue('remove_from_department_option', editMode?.remove_from_department_option ?? false);
    setValue('manager_change_option', editMode?.manager_change_option ?? false);
  }, [editMode]);
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
            <div className="inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-4xl sm:p-6 sm:align-middle">
              <Dialog.Title as="h3" className="py-6 text-lg font-medium leading-6 text-gray-900">
                {editMode ? t('edit_ad_teams_Sync') : t('add_ad_teams_sync')}
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
                          <span className="text-sm font-medium">{step.name}</span>
                        </span>
                      ) : step.status === 'current' ? (
                        <span
                          className="flex flex-col border-l-4 border-teams_brand_foreground_bg py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0"
                          aria-current="step"
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-teams_brand_foreground_bg">
                            {step.id}
                          </span>
                          <span className="text-sm font-medium">{step.name}</span>
                        </span>
                      ) : (
                        <span className="group flex flex-col border-l-4 border-gray-200 py-2 pl-4  md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{step.id}</span>
                          <span className="text-sm font-medium">{step.name}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="mt-5 border-t border-gray-200"></div>
              {steps[0] && steps[0].status === 'current' && (
                <div className="mt-5  bg-white">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900">
                          {t('calendar_sync_setting_modal')}
                        </h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500">
                          <p> {t('ad_group_setting_modal')}</p>
                        </div>
                      </div>
                      <div className="sEm:ml-6 mt-5 sm:mt-0 sm:flex sm:shrink-0 sm:items-center"></div>
                    </div>
                  </div>
                  <form className="divide-y divide-gray-200 pl-0 lg:pl-4" onSubmit={() => {}}>
                    <div className="mt-6 mb-10 grid grid-cols-1 content-center gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block pb-2 text-sm font-medium text-gray-700">
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
                                className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
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
                        <label htmlFor="username" className="block pb-2 text-sm font-medium text-gray-700">
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
                                className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
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
                    {!subscription && (
                      <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-teams_brand_50 py-5 px-6 text-left ">
                        <div className="w-full text-sm ">
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
                      <h3 className="text-lg font-medium leading-6 text-gray-900">{t('select_dep')}</h3>
                      <p className="mt-2 text-sm text-gray-700">{t('select_dep_desc')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm"></div>
                    <div className="">
                      {loadingGroups && <Loader height="5" width="5" />}
                      {!loadingGroups && (
                        <Controller
                          rules={{ required: true }}
                          name="group_id"
                          defaultValue={editMode ? editMode.group_id : undefined}
                          control={control}
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
                              className="w-full"
                              options={groups}
                              value={groups?.find((group) => group.id === value)}
                              getOptionLabel={(option) => option?.displayName}
                              getOptionValue={(option) => option.id}
                              onChange={(val) => {
                                onChange(val?.id);
                              }}
                            />
                          )}
                        />
                      )}
                    </div>
                    {errors.group_id && (
                      <div className="mt-2 inline-flex">
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                        <p className=" mr-4 text-sm text-red-600">{errors.group_id.message}</p>
                      </div>
                    )}
                  </div>
                  {group_id && (
                    <div className="mt-4">
                      <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700">
                        {t('group_members')}
                      </label>
                      {groupMembers ? (
                        <>
                          <DepartmentUsers
                            members={groupMembers.map((groupMember) => ({
                              id: groupMember.abentify_microsoft_id,
                              member: {
                                name: groupMember.displayName,
                                email: groupMember.mail,
                                microsoft_user_id: groupMember.microsoft_user_id,
                                has_cdn_image: groupMember.has_cdn_image
                              }
                            }))}
                            max_members={16}
                          />
                        </>
                      ) : (
                        <div className="flex justify-start mt-4">
                          <Loader height="5" width="5" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {steps[2] && steps[2].status === 'current' && (
                <div className="mt-6 mb-10 w-80 px-4 sm:px-6 lg:w-auto lg:pr-20 lg:pl-8">
                  <div className="pb-4 sm:flex sm:items-center ">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900">{t('calendar_sync_Departments')}</h3>
                      <p className="mt-2 text-sm text-gray-700">{t('group_dep_sync_desc')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      {departments && (
                        <Select
                          styles={{
                            control: (base) => ({
                              ...base,
                              '*': {
                                boxShadow: 'none !important'
                              }
                            })
                          }}
                          defaultValue={editMode ? departments.filter((x) => departmentIds.includes(x.id)) : undefined}
                          value={departmentIds ? departments.filter((x) => departmentIds.includes(x.id)) : undefined}
                          className="w-full"
                          name="department_ids"
                          isMulti
                          onChange={(val) => {
                            if (val) {
                              setDepartmentIds(val.map((x) => x.id));
                            }
                          }}
                          getOptionLabel={(option) => `${option.name}`}
                          getOptionValue={(option) => option.id}
                          options={departments}
                        />
                      )}
                    </div>
                  </div>
                  {errors.department_ids && (
                    <div className="mt-2 inline-flex">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />{' '}
                      <p className=" mr-4 text-sm text-red-600">{errors.department_ids.message}</p>
                    </div>
                  )}
                </div>
              )}
              {steps[3] && steps[3].status === 'current' && (
                <div className="mt-4  bg-white">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:flex-col ">
                      <div className="py-4">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">{t('synchronization_settings')}</h3>
                        <span className="text-sm text-gray-500">{t('default_option')}</span>
                        <Switch.Group as="li" className="flex items-center justify-between py-4">
                          <div className="flex flex-col">
                            <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                              {t('automatic_account_create_option')}
                            </Switch.Label>
                            <Switch.Description className="text-sm text-gray-500">
                              {t('automatic_acc_create_desc')}
                            </Switch.Description>
                          </div>
                          <Controller
                            control={control}
                            name="automatic_account_create_option"
                            render={({ field: { onChange, value } }) => (
                              <Switch
                                checked={value}
                                onChange={(val: boolean) => {
                                  onChange(val);
                                }}
                                className={classNames(
                                  value ? 'bg-teams_brand_500' : 'bg-gray-200',
                                  'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
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
                            <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                              {t('response_to_group_changes')}
                            </Switch.Label>
                            <Switch.Description className="text-sm text-gray-500">
                              {t('response_to_group_changes_desc')}
                            </Switch.Description>
                          </div>
                          <Controller
                            control={control}
                            name="remove_from_department_option"
                            render={({ field: { onChange, value } }) => (
                              <Switch
                                checked={value}
                                onChange={(val: boolean) => {
                                  onChange(val);
                                }}
                                className={classNames(
                                  value ? 'bg-teams_brand_500' : 'bg-gray-200',
                                  'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
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
                            <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                              {t('automatic_manager_change')}
                            </Switch.Label>
                            <Switch.Description className="text-sm text-gray-500">
                              {t('automatic_manager_change_description')}
                            </Switch.Description>
                          </div>
                          <Controller
                            control={control}
                            name="manager_change_option"
                            render={({ field: { onChange, value } }) => (
                              <Switch
                                checked={value}
                                onChange={(val: boolean) => {
                                  onChange(val);
                                }}
                                className={classNames(
                                  value ? 'bg-teams_brand_500' : 'bg-gray-200',
                                  'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
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
                </div>
              )}

              <div className="mt-4 flex justify-end border-t p-4 sm:px-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    props.onClose(false);
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

                      if (countStep < 4 && watch('name') !== '' && watch('description') !== '') {
                        if (countStep === 1 && groups.length === 0) {
                          setError('group_id', {
                            type: 'custom',
                            message: t('not_found_group_to_sync')
                          });
                        } else if (countStep === 1 && (watch('group_id') === '' || !watch('group_id'))) {
                          setError('group_id', {
                            type: 'custom',
                            message: t('This_is_required')
                          });
                        } else if (countStep === 2 && departmentIds.length === 0) {
                          setError('department_ids', {
                            type: 'custom',
                            message: t('This_is_required')
                          });
                        } else {
                          clearErrors('name');
                          clearErrors('description');
                          clearErrors('group_id');
                          clearErrors('department_ids');
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
                    className=" bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2  mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium   shadow-sm focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm"
                  >
                    {t('Next')}
                  </button>
                )}

                {countStep === steps.length - 1 && (
                  <button
                    disabled={editGroupSyncSetting.isLoading || addGroupSyncSetting.isLoading}
                    onClick={() => {
                      if (Object.keys(errors).length === 0) {
                        handleSubmit(onSubmitGroupSyncSetting)();
                      }
                    }}
                    type="button"
                    className={` ${
                      editGroupSyncSetting.isLoading || addGroupSyncSetting.isLoading
                        ? ' border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-300 '
                        : ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                    }  mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm `}
                  >
                    {(editGroupSyncSetting.isLoading || addGroupSyncSetting.isLoading) && (
                      <div className="-ml-1 mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('save')}
                  </button>
                )}
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
