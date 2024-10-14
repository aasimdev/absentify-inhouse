import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Transition, Switch } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { classNames } from '~/lib/classNames';
import DepartmentUsers from '@modules/settings/organisation/Departments/DepartmentUsers';
import ExclamationTriangleIcon from '@heroicons/react/20/solid/ExclamationTriangleIcon';
import { TimeghostUser } from '~/inngest/Functions/createTimeghostTimeEntry';
import { forEach } from 'lodash';

type W =
  | {
      allUserWorkspaces: {
        id: string;
        name: string;
      }[];
      userDefaultWorspaceId: string;
    }
  | undefined;

type LeaveTypes = RouterOutputs['leave_type']['all'];
type leaveType = RouterOutputs['leave_type']['all'][0];
type Departments = RouterOutputs['department']['all'];
type Department = RouterOutputs['department']['all'][0];

export default function CustomModal(props: {
  open: boolean;
  onClose: Function;
  value: RouterOutputs['timeghost_sync_setting']['add'];
}) {
  const { t } = useTranslation('settings_organisation');
  const utils = api.useContext();
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setError,
    clearErrors,
    setValue
  } = useForm<RouterInputs['timeghost_sync_setting']['add']>();
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });

  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const { data: LEAVE_TYPES } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const isUserAdmin = api.timeghost_sync_setting.isUserAdmin.useMutation();
  const timeghost_workspaces = api.timeghost_sync_setting.workspaces.useMutation();
  const timeghost_workspace_by_id = api.timeghost_sync_setting.workspaceById.useMutation();
  const [leaveTypeIds, setLeaveTypeIds] = useState<string[]>([]);
  const addTimeghostSyncSetting = api.timeghost_sync_setting.add.useMutation();
  const timeghostWorkspaceComegoStatus = api.timeghost_sync_setting.comegoStatus.useMutation();
  const [countStep, setCountStep] = useState<number>(0);
  const [syncPastAndFuture, setSyncPastAndFuture] = useState<boolean>(false);
  const [selectedLTOptions, setSelectedLTOptions] = useState<LeaveTypes>([]);
  const [selectedDepartmentOptions, setSelectedDepartmentOptions] = useState<Departments>([]);
  const [tgWorkspaceComegoStatus, setTgWorkspaceComegoStatus] = useState<boolean>(false);
  const [timeghostWorkspaceByIdUsers, setTimeghostWorkspaceByIdUsers] = useState<TimeghostUser[]>([]);
  const [tgWorkspaces, setTgWorkspaces] = useState<W>({
    allUserWorkspaces: [
      {
        id: '',
        name: ''
      }
    ],
    userDefaultWorspaceId: ''
  });
  const [pendingDepartmentMembers, setPendingDepartmentMembers] = useState<
    {
      id: string;
      member: {
        name: string | null;
        email: string | null;
        microsoft_user_id: string | null;
        has_cdn_image: boolean;
      };
    }[]
  >([]);
  const {
    data: workspace,
    isLoading: isLoadingWorkspace,
    refetch: refetchWorkspace
  } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const editTimeghostSyncSetting = api.timeghost_sync_setting.edit.useMutation();
  const [nextButtonState, setNextButtonState] = useState<boolean>(false);
  const [apiKeyErrorState, setApiKeyErrorState] = useState<boolean>(false);
  const [saveButtonState, setSaveButtonState] = useState<boolean>(false);
  const [saveAfterEditButton, setSaveAfterEditButton] = useState<boolean>(false);
  const [steps, setSteps] = useState<{ id: string; name: string; status: 'current' | 'upcoming' | 'complete' }[]>([
    {
      id: t('Step', { number: 1 }),
      name: t('timeghost_sync_settings_setup'),
      status: 'current'
    },
    {
      id: t('Step', { number: 2 }),
      name: t('select_leave_types_and_departments'),
      status: 'upcoming'
    },
    { id: t('Step', { number: 3 }), name: t('timeghost_api_key'), status: 'upcoming' },
    {
      id: t('Step', { number: 4 }),
      name: t('timeghost_workspaces'),
      status: 'upcoming'
    }
  ]);
  function createLeaveTypeOption(name: string): leaveType {
    return {
      id: 'all',
      createdAt: new Date(),
      updatedAt: new Date(),
      name,
      color: '',
      icon: '',
      take_from_allowance: false,
      needs_approval: false,
      maximum_absent: false,
      deleted: false,
      deleted_at: null,
      deleted_by_member_id: null,
      workspace_id: '',
      privacy_hide_leavetype: false,
      outlook_synchronization_show_as: 'oof',
      outlook_synchronization_subject: null,
      position: 0,
      reason_mandatory: false,
      reason_hint_text: null,
      allowance_type_id: '',
      sync_option: 'All',
      sync_to_outlook_as_dynamics_365_tracked: false,
      leave_unit: 'half_days',
      ignore_schedule: false,
      ignore_public_holidays: false,
      allowance_type: {
        name: '',
        id: ''
      }
    };
  }
  function createDepartment(name: string): Department {
    return {
      id: 'all',
      createdAt: new Date(),
      updatedAt: new Date(),
      name,
      maximum_absent: 0,
      workspace_id: '',
      approval_process: 'Linear_all_have_to_agree',
      groupSyncSettings: [],
      members: [],
      default_department_allowances: ''
    };
  }

  const { current_member } = useAbsentify();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<boolean>(false);
  const name = watch('name');
  const des = watch('description');
  const tg_workspace_id = watch('timeghost_workspace_id');
  const tgApiKey = watch('timeghost_api_access_token');
  const department_ids = watch('department_ids');
  const LToptions: LeaveTypes =
    LEAVE_TYPES && LEAVE_TYPES.length > 0
      ? LEAVE_TYPES.length === leaveTypeIds.length
        ? [createLeaveTypeOption(t('unselect_all')), ...LEAVE_TYPES]
        : [createLeaveTypeOption(t('select_all')), ...LEAVE_TYPES]
      : [];
  const DToptions: Departments =
    departments && departments.length > 0
      ? departments.length === departmentIds.length
        ? [createDepartment(t('unselect_all')), ...departments]
        : [createDepartment(t('select_all')), ...departments]
      : [];
  useEffect(() => {
    if (!props.value) return;
    if (!tgApiKey) return;
    setSaveAfterEditButton(tgApiKey == '' || loading || tgApiKey.includes('*'));
  }, [props.value, loading, tgApiKey]);
  useEffect(() => {
    if (!timeghost_workspaces.data) return;

    setTgWorkspaces(timeghost_workspaces.data);
  }, [tgWorkspaces, workspace, timeghost_workspaces]);

  useEffect(() => {
    if (!timeghost_workspace_by_id.data) return;
    setTimeghostWorkspaceByIdUsers(timeghost_workspace_by_id.data.users);
  }, [tg_workspace_id, timeghost_workspace_by_id, timeghostWorkspaceByIdUsers]);

  useEffect(() => {
    if (typeof timeghostWorkspaceComegoStatus !== 'boolean') return;
    setTgWorkspaceComegoStatus(timeghostWorkspaceComegoStatus);
  }, [tgWorkspaceComegoStatus, timeghostWorkspaceComegoStatus, tg_workspace_id]);

  useEffect(() => {
    if (!LEAVE_TYPES) return;
    if (!departments) return;
    if (departments[0]) {
      setDepartmentIds([departments[0].id]);
    }
    if (LEAVE_TYPES[0]) {
      setLeaveTypeIds([LEAVE_TYPES[0].id]);
    }
    //dependencies not needed here, because we only want to set the default values once / values could change during the process
  }, []);

  useEffect(() => {
    if (!tgWorkspaces) return;
    setValue('timeghost_workspace_id', tgWorkspaces.userDefaultWorspaceId);
  }, [tgWorkspaces]);
  useEffect(() => {
    if (countStep === 3) {
      onGetTgWorkspace(tgApiKey);
    }
  }, [countStep]);

  useEffect(() => {
    if (countStep == 0) {
      if (name == '' || des == '') {
        setNextButtonState(false);
      } else {
        setNextButtonState(true);
      }
    }

    if (countStep == 1) {
      if (leaveTypeIds.length == 0 || departmentIds.length == 0) {
        setNextButtonState(false);
      } else {
        setNextButtonState(true);
      }
    }
    if (countStep == 2) {
      if (tgApiKey == '' || !tgApiKey) {
        setNextButtonState(false);
      } else {
        setNextButtonState(true);
      }
    }
  }, [name, des, leaveTypeIds, departmentIds, tgApiKey, countStep]);
  useEffect(() => {
    // Fetch feature status only when on step 3, workspace id is available, and workspace id has changed
    if (countStep === 3 && tg_workspace_id !== '') {
      onGetComegoFeatureStatus(tgApiKey, tg_workspace_id);
    }
  }, [countStep, tg_workspace_id, tgApiKey, tgWorkspaceComegoStatus]);

  useEffect(() => {
    if (countStep === 3 && tg_workspace_id !== '') {
      onGetTimeghostWorkspaceById(tgApiKey, tg_workspace_id);
    }
  }, [countStep, tg_workspace_id, tgApiKey]);

  useEffect(() => {
    // Handle UI updates based on step and status
    if (countStep === 3) {
      if (tgWorkspaceComegoStatus) {
        setSaveButtonState(true);
        clearErrors('timeghost_workspace_id');
      } else {
        setSaveButtonState(false);
        setError('timeghost_workspace_id', {
          type: 'custom',
          message: t('comego_disabled_in_this_timeghost_workspace')
        });
      }
    }
  }, [countStep, tgWorkspaceComegoStatus, clearErrors, setError, tg_workspace_id]);

  useEffect(() => {
    if (LEAVE_TYPES) {
      // Sync external state into the local component state
      setSelectedLTOptions(LEAVE_TYPES.filter((x) => leaveTypeIds.includes(x.id)));
    }
  }, [LEAVE_TYPES, leaveTypeIds]);

  useEffect(() => {
    if (departments) {
      // Sync external state into the local component state
      setSelectedDepartmentOptions(departments.filter((x) => departmentIds.includes(x.id)));
    }
  }, [departments, departmentIds]);
  const onSubmitTimeghostSyncSetting: SubmitHandler<RouterInputs['timeghost_sync_setting']['add']> = async (
    data: RouterInputs['timeghost_sync_setting']['add']
  ) => {
    if (!current_member) return;
    if (!workspace) return;
    if (!tgWorkspaces) return;
    data.workspace_id = `${current_member.workspace_id}`;
    data.leave_type_ids = leaveTypeIds;
    data.department_ids = departmentIds;
    data.workspace_id = workspace.id;
    data.syncPastAndFuture = syncPastAndFuture;
    data.timeghost_workspace_id = tg_workspace_id;
    data.timeghost_api_access_token = tgApiKey;
    await addTimeghostSyncSetting.mutateAsync(data, {
      onSuccess: async (timeghost_sync_setting) => {
        await utils.timeghost_sync_setting.all.invalidate();
        props.onClose(timeghost_sync_setting);
        notifySuccess(t('Saved_successfully'));
      },
      onError: (error) => {
        notifyError(error.message);
      }
    });
  };

  const onGetTimeghostWorkspaceById = async (apiKey: string, tg_workspace_id: string) => {
    const workspace_by_id = await timeghost_workspace_by_id.mutateAsync(
      {
        timeghost_api_access_token: apiKey,
        workspace_id: tg_workspace_id
      },
      {
        async onSuccess() {
          setLoading(false);
        },
        onError(error) {
          notifyError(error.message);
          setLoading(false);
        }
      }
    );
    if (workspace_by_id) {
      setTimeghostWorkspaceByIdUsers(workspace_by_id.users);
    }
  };

  const onGetComegoFeatureStatus = async (apiKey: string, tg_workspace_id: string) => {
    const comego = await timeghostWorkspaceComegoStatus.mutateAsync(
      {
        timeghost_api_access_token: apiKey,
        workspace_id: tg_workspace_id
      },
      {
        async onSuccess() {
          setLoading(false);
        },
        onError(error) {
          notifyError(error.message);
          setLoading(false);
        }
      }
    );
    if (typeof comego === 'boolean') setTgWorkspaceComegoStatus(comego);
  };

  const onClickSaveHandler = () => {
    if (countStep === 3) {
      if (tg_workspace_id == '')
        setError('timeghost_workspace_id', {
          type: 'custom',
          message: t('This_is_required')
        });
      if (tg_workspace_id) {
        clearErrors('timeghost_workspace_id');
        handleSubmit(onSubmitTimeghostSyncSetting)();
      }
    }
  };

  const onGetTgWorkspace = async (apiKey: string) => {
    setLoadingWorkspaces(true);
    await timeghost_workspaces.mutateAsync(
      {
        timeghost_api_access_token: apiKey
      },
      {
        onSuccess: async () => {
          await utils.timeghost_sync_setting.all.invalidate();
        },
        onError: (error) => {
          notifyError(error.message);
        }
      }
    );
    setLoadingWorkspaces(false);
  };
  const onClickSaveAfterEditHandler = async () => {
    setLoading(true);

    if (props.value) {
      editTimeghostSyncSetting.mutateAsync(
        {
          id: props.value.id,
          data: {
            workspace_id: props.value.workspace_id,
            timeghost_api_access_token: tgApiKey
          }
        },
        {
          async onSuccess() {
            await utils.timeghost_sync_setting.all.invalidate();
            setLoading(false);
            props.onClose();
            notifySuccess(t('Saved_successfully'));
            setApiKeyErrorState(false);
          },
          onError(error) {
            setApiKeyErrorState(true);
            notifyError(error.message);
            setLoading(false);
          }
        }
      );
    }
  };
  const onGetApiTokenValidity = async (apiKey: string) => {
    setLoading(true);
    const tg_user_id = await isUserAdmin.mutateAsync(
      {
        timeghost_api_access_token: apiKey
      },
      {
        async onSuccess() {
          await utils.timeghost_sync_setting.all.invalidate();
          setApiKeyErrorState(false);
          goToNextStep();
          setLoading(false);
        },
        onError(error) {
          setApiKeyErrorState(true);
          notifyError(error.message);
          setLoading(false);
        }
      }
    );
    if (tg_user_id) return tg_user_id;
  };

  const CustomLoading = () => {
    return (
      <div className="pt-2 animate-pulse flex space-x-4">
        <div className="flex-1 space-y-1 py-1">
          <div className="grid grid-cols-10 gap-4">
            <div className="h-8 bg-gray-700 rounded col-span-10"></div>
          </div>
        </div>
      </div>
    );
  };

  const onClickNextStephandler = async () => {
    if (watch('description') === '')
      setError('description', {
        type: 'custom',
        message: t('This_is_required')
      });

    if (watch('name') === '')
      setError('name', {
        type: 'custom',
        message: t('This_is_required')
      });

    if (countStep < 4 && watch('name') !== '' && watch('description') !== '') {
      if (countStep === 1) {
        if (leaveTypeIds.length !== 0 && departmentIds.length !== 0) {
          clearErrors('leave_type_ids');
          clearErrors('department_ids');
          goToNextStep();
        }
        if (leaveTypeIds.length === 0)
          setError('leave_type_ids', {
            type: 'custom',
            message: t('This_is_required')
          });
        if (departmentIds.length === 0)
          setError('department_ids', {
            type: 'custom',
            message: t('This_is_required')
          });
      } else if (countStep === 2) {
        if (tgApiKey && tgApiKey !== '') {
          await onGetApiTokenValidity(tgApiKey);
        } else if (tgApiKey == '' || !tgApiKey) {
          setApiKeyErrorState(true);
        }
      } else {
        clearErrors('name');
        clearErrors('description');
        goToNextStep();
      }
    }
  };

  const onClickPrevStepHandler = () => {
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
  };

  const goToNextStep = () => {
    const step = steps[countStep];
    if (step) step.status = 'complete';
    const nextStep = steps[countStep + 1];
    if (nextStep) nextStep.status = 'current';
    setSteps(steps);
    setCountStep(countStep + 1);
  };

  function getPendingDepartmentMembers(departmentIds: string[], departments: Departments, timeghostWorkspaceByIdUsers:TimeghostUser[]) {
    let notInTimeghostWorkspaceMembers = [];
    let pendingDepartmentMembers = [];
  
    // Create a Set for timeghostWorkspaceByIdUsers for faster lookups
    const timeghostWorkspaceUserIds = new Set(timeghostWorkspaceByIdUsers.map((user) => user.id));
  
    // Get all absentify active members in the selected departments
    const activeDepartmentMembers = departmentIds.flatMap((departmentId) => {
      const department = departments.find((department) => department.id === departmentId);
  
      return department
        ? department.members
            .filter((member) => member.member.microsoft_user_id != null)
            .map((member) => ({
              id: member.id,
              member: {
                name: member.member.name,
                email: member.member.email,
                microsoft_user_id: member.member.microsoft_user_id,
                has_cdn_image: member.member.has_cdn_image
              }
            }))
        : [];
    });
  
    // Get all absentify active members in the selected departments that are not in the timeghost workspace
    notInTimeghostWorkspaceMembers = activeDepartmentMembers.filter((member) => {
      return !timeghostWorkspaceUserIds.has(member.member.microsoft_user_id as string);
    });
  
    // Get all pending members in the selected departments
    pendingDepartmentMembers = departmentIds.flatMap((departmentId) => {
      const department = departments.find((department) => department.id === departmentId);
  
      return department
        ? department.members
            .filter((member) => member.member.microsoft_user_id == null)
            .map((member) => ({
              id: member.id,
              member: {
                name: member.member.name,
                email: member.member.email,
                microsoft_user_id: member.member.microsoft_user_id,
                has_cdn_image: member.member.has_cdn_image
              }
            }))
        : [];
    });
  
    // avoid duplicate members using a Set
    const pendingMemberIds = new Set(pendingDepartmentMembers.map(member => member.id));
    
    if (notInTimeghostWorkspaceMembers.length > 0) {
      notInTimeghostWorkspaceMembers.forEach((member) => {
        if (!pendingMemberIds.has(member.id)) {
          pendingDepartmentMembers.push(member);
          pendingMemberIds.add(member.id); // Track this member's id to prevent duplicates
        }
      });
    }
  
    return pendingDepartmentMembers;
  }

  useEffect(() => {
    if (departmentIds.length == 0) return;
    if (!departments) return;
    if (countStep == 3) {
      const pendingDepartmentMembers = getPendingDepartmentMembers(departmentIds, departments, timeghostWorkspaceByIdUsers);
      setPendingDepartmentMembers(pendingDepartmentMembers);
    }
  }, [countStep, departmentIds, departments, department_ids, timeghostWorkspaceByIdUsers, tg_workspace_id]);

  if (props.value) {
    return (
      <Transition.Root show={props.open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => props.onClose()}>
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

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full mr-2">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        <p
                          dangerouslySetInnerHTML={{
                            __html: t('Edit_timeghost_sync', {
                              interpolation: { escapeValue: false },

                              value: props.value.name
                            })
                          }}
                        />
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-4">{t('timeghost_api_key')}:</p>
                      </div>

                      <Controller
                        rules={{ required: true }}
                        control={control}
                        name="timeghost_api_access_token"
                        defaultValue={props.value?.timeghost_api_access_token}
                        render={({ field: { onChange } }) => (
                          <input
                            type="text"
                            className={` w-full rounded-md ${
                              apiKeyErrorState ? ' border-red-500 ' : ' border-gray-300 '
                            }shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm`}
                            onChange={(val) => {
                              if (val) {
                                onChange(val.target.value);
                              }
                            }}
                            defaultValue={props.value?.timeghost_api_access_token}
                          />
                        )}
                      />
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      disabled={saveAfterEditButton}
                      className={` ${
                        saveAfterEditButton
                          ? ' border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-300 '
                          : ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                      } mx-0 sm:mx-2  text-center inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm justify-center w-full sm:w-auto `}
                      onClick={async () => {
                        if (tgApiKey && tgApiKey !== '') {
                          await onGetApiTokenValidity(tgApiKey);
                        }
                        onClickSaveAfterEditHandler();
                      }}
                    >
                      {loading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}
                      {t('save')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      onClick={() => props.onClose(false)}
                    >
                      {t('Cancel')}
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
            <div className=" inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-5xl sm:p-6 sm:align-middle">
              <Dialog.Title as="h3" className="py-6 text-lg font-medium leading-6 text-gray-900">
                {t('Add_timeghost_sync')}
              </Dialog.Title>
              <nav aria-label="Progress ">
                <ol role="list" className="  mt-4 space-y-4 md:flex md:space-y-0 md:space-x-8">
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
                          {t('timeghost_sync_setting_modal')}
                        </h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500">
                          <p> {t('timeghost_sync_modal_description')}</p>
                        </div>
                      </div>
                      <div className="sEm:ml-6 mt-5 sm:mt-0 sm:flex sm:shrink-0 sm:items-center"></div>
                    </div>
                  </div>
                  <form className="divide-y divide-gray-200 pl-0 lg:pl-4" onSubmit={() => {}}>
                    <div className="mt-6 mb-10 grid grid-cols-1 content-center gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block pb-2 text-sm font-medium text-gray-700">
                          {t('imeghost_sync_modal_name')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <Controller
                            control={control}
                            name="name"
                            defaultValue={undefined}
                            render={({ field: { onChange } }) => (
                              <input
                                {...register('name', { required: true })}
                                type="text"
                                autoComplete="name"
                                className={`block w-full min-w-0 grow rounded-md ${
                                  errors.name ? ' border-red-500 ' : ' border-gray-300 '
                                } focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm  `}
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
                            render={({ field: { onChange } }) => (
                              <input
                                {...register('description', { required: true })}
                                type="text"
                                autoComplete="description"
                                className={`block w-full min-w-0 grow rounded-md ${
                                  errors.description ? ' border-red-500 ' : ' border-gray-300 '
                                } focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm`}
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
                  </form>
                </div>
              )}
              {steps[1] && steps[1].status === 'current' && (
                <div className="mt-6 mb-10 px-4 sm:px-6 w-auto lg:pr-20 lg:pl-8">
                  <div className="pb-4 sm:flex sm:items-center ">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900">
                        {t('leaveType_for_timeghost_sync')}
                      </h3>
                      <p className="mt-2 text-sm text-gray-700">{t('leaveType_for_timeghost_sync_descrip')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      {LEAVE_TYPES && (
                        <Select
                          styles={{
                            control: (base) => ({
                              ...base,
                              borderColor: errors.leave_type_ids ? ' red ' : 'lightGrey',
                              '*': {
                                boxShadow: 'none !important'
                              }
                            })
                          }}
                          isMulti
                          value={selectedLTOptions}
                          className="w-full"
                          name="leave_type_ids"
                          onChange={(val) => {
                            if (val) {
                              if (val.some((option) => option.id === 'all')) {
                                // Check if all options are already selected
                                if (val.length === LEAVE_TYPES.length + 1) {
                                  setLeaveTypeIds([]);
                                  setSelectedLTOptions([]);
                                } else {
                                  setLeaveTypeIds(LEAVE_TYPES.map((x) => x.id));
                                  setSelectedLTOptions([...LEAVE_TYPES]);
                                }
                              } else {
                                setLeaveTypeIds(val.map((x) => x.id));
                                setSelectedLTOptions(val as LeaveTypes);
                              }
                            }
                          }}
                          getOptionLabel={(option) => `${option.name}`}
                          getOptionValue={(option) => option.id}
                          options={LToptions}
                          closeMenuOnSelect={false}
                        />
                      )}
                    </div>
                    {errors.leave_type_ids && (
                      <div className="mt-2 inline-flex">
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />
                        <p className=" mr-4 text-sm text-red-600">{errors.leave_type_ids.message}</p>
                      </div>
                    )}
                  </div>
                  <div className="pb-4 sm:flex sm:items-center ">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 mt-4">
                        {t('Departments_for_timeghost_sync')}
                      </h3>
                      <p className="mt-2 text-sm text-gray-700">{t('Departments_for_timeghost_sync_descrip')}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      {departments && (
                        <Select
                          styles={{
                            control: (base) => ({
                              ...base,
                              borderColor: errors.department_ids ? ' red ' : 'lightGrey',
                              '*': {
                                boxShadow: 'none !important'
                              }
                            })
                          }}
                          isMulti
                          value={selectedDepartmentOptions}
                          className="w-full"
                          name="department_ids"
                          onChange={(val) => {
                            if (val) {
                              if (val.some((option) => option.id === 'all')) {
                                // Check if all options are already selected
                                if (val.length === departments.length + 1) {
                                  setDepartmentIds([]);
                                  setSelectedDepartmentOptions([]);
                                } else {
                                  setDepartmentIds(departments.map((x) => x.id));
                                  setSelectedDepartmentOptions([...departments]);
                                }
                              } else {
                                setDepartmentIds(val.map((x) => x.id));
                                setSelectedDepartmentOptions(val as Departments);
                              }
                            }
                          }}
                          getOptionLabel={(option) => `${option.name}`}
                          getOptionValue={(option) => option.id}
                          options={DToptions}
                          closeMenuOnSelect={false}
                        />
                      )}
                    </div>
                    {errors.department_ids && (
                      <div className="mt-2 inline-flex">
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />
                        <p className=" mr-4 text-sm text-red-600">{errors.department_ids.message}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {steps[2] && steps[2].status === 'current' && (
                <>
                  <div className="mt-6 mb-10 px-4 sm:px-6 lg:px-8 lg:pr-20">
                    <div className="pb-4 sm:flex sm:items-center">
                      <div className="sm:flex-auto">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">{t('timeghost_api_key')}</h3>
                        <p className="mt-2 text-sm text-gray-700">{t('timeghost_api_key_descript')}</p>
                      </div>
                    </div>
                    <div className="sm:col-span-5">
                      <div className="flex-initial w-full">
                        <Controller
                          rules={{ required: true }}
                          control={control}
                          name="timeghost_api_access_token"
                          render={({ field: { onChange } }) => (
                            <input
                              type="text"
                              className={` w-full rounded-md ${
                                apiKeyErrorState ? ' border-red-500 ' : ' border-gray-300 '
                              }shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm`}
                              onChange={(val) => {
                                if (val) {
                                  onChange(val.target.value);
                                }
                              }}
                              defaultValue={tgApiKey}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {steps[3] && steps[3].status === 'current' && (
                <div className="mt-6 mb-10 px-4 sm:px-6 w-auto lg:pr-20 lg:pl-8">
                  {/* workspaces */}
                  <div className="pt-4 sm:flex sm:items-center ">
                    <div className="sm:flex-auto">
                      <h3 className="text-lg font-medium leading-6 text-gray-900">{t('timeghost_workspaces')}</h3>
                      <p className="mt-2 text-sm text-gray-700">{t('timeghost_workspaces_descrip')}</p>
                    </div>
                  </div>
                  {isLoadingWorkspace || loadingWorkspaces ? (
                    <CustomLoading />
                  ) : (
                    <div className="sm:col-span-5">
                      <div className="mt-1 flex rounded-md shadow-sm">
                        {tgWorkspaces && (
                          <Controller
                            rules={{ required: true }}
                            control={control}
                            name="timeghost_workspace_id"
                            render={({ field: { onChange } }) => (
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
                                defaultValue={tgWorkspaces.allUserWorkspaces.find(
                                  (workspace) => workspace.id == tgWorkspaces.userDefaultWorspaceId
                                )}
                                onChange={(val) => {
                                  if (val) onChange(val.id);
                                }}
                                options={tgWorkspaces.allUserWorkspaces}
                                getOptionLabel={(option) => `${option.name}`}
                                getOptionValue={(option) => option.id}
                              />
                            )}
                          />
                        )}
                      </div>
                      {!timeghostWorkspaceComegoStatus.isLoading && errors.timeghost_workspace_id && (
                        <div className="mt-2 inline-flex">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-500 " aria-hidden="true" />
                          <p className=" ml-1 mr-4 text-sm text-red-600">{errors.timeghost_workspace_id.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <Switch.Group as="div" className="flex items-center justify-between my-3">
                    <span className="flex flex-grow flex-col">
                      <Switch.Label as="span" className="text-sm font-medium leading-6 text-gray-900" passive>
                        {t('Sync_past_and_future')}
                      </Switch.Label>
                      <Switch.Description as="span" className="text-sm text-gray-500">
                        {t('Sync_past_and_future_description')}
                      </Switch.Description>
                    </span>
                    <Switch
                      checked={syncPastAndFuture}
                      onChange={setSyncPastAndFuture}
                      className={classNames(
                        syncPastAndFuture ? 'bg-teams_brand_600' : 'bg-gray-200',
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_600 focus:ring-offset-2'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          syncPastAndFuture ? 'translate-x-5' : 'translate-x-0',
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  </Switch.Group>

                  {pendingDepartmentMembers.length > 0 && (
                    <div className="my-4">
                      <div className="inline-flex">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm text-yellow-700 relative">
                            <p>{t('users_have_not_yet_logged_and_not_in_tg_workspace_attention_message')}</p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2 md:ml-6 ">
                        {timeghost_workspace_by_id.isLoading ? (
                          <Loader />
                        ) : (
                          <DepartmentUsers members={pendingDepartmentMembers} max_members={30} />
                        )}
                      </div>
                    </div>
                  )}
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
                    onClick={onClickPrevStepHandler}
                    type="button"
                    className="mx-2 inline-flex items-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 font-medium text-white shadow-sm hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm "
                  >
                    {t('previous')}
                  </button>
                )}
                {countStep < steps.length - 1 && (
                  <button
                    onClick={onClickNextStephandler}
                    type="button"
                    className={` ${
                      nextButtonState
                        ? 'bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                        : '  border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-300 '
                    } mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium   shadow-sm focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm `}
                  >
                    {loading && (
                      <div className="-ml-1 mr-3">
                        <Loader />
                      </div>
                    )}
                    {t('Next')}
                  </button>
                )}

                {countStep === steps.length - 1 && (
                  <button
                    onClick={onClickSaveHandler}
                    disabled={
                      !saveButtonState || addTimeghostSyncSetting.isLoading || timeghostWorkspaceComegoStatus.isLoading
                    }
                    type="button"
                    className={` ${
                      !saveButtonState
                        ? ' border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-300 '
                        : ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 '
                    }  mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm `}
                  >
                    {(addTimeghostSyncSetting.isLoading || timeghostWorkspaceComegoStatus.isLoading) && (
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

