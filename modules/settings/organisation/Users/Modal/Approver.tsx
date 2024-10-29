import { useAbsentify } from '@components/AbsentifyContext';
import ProfileImage from '@components/layout/components/ProfileImage';
import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { closestCenter, DndContext } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Listbox, RadioGroup, Transition } from '@headlessui/react';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ApprovalProcess } from '@prisma/client';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import Select, { InputActionMeta, components } from 'react-select';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { api, type RouterInputs } from '~/utils/api';
import { UpgradeModal } from '../../Departments/Modal';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { debounce } from 'lodash';

const SortableItem = (props: { member_id: string; removeManager: Function }) => {
  const [grabbing, setGrabbing] = useState<boolean>(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.member_id });
  const { data: membersData } = api.member.all.useQuery(
    { filter: { ids: [props.member_id] }, limit: 1, page: 1 },
    {
      staleTime: 60000
    }
  );
  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);
  if (!members) return <></>;

  const person = members.find((x: { id: string }) => x.id === props.member_id);
  if (!person) return <></>;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: grabbing ? 'grabbing' : 'grab'
  };
  return (
    <li
      key={person.id}
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between py-3"
      onMouseDown={() => setGrabbing(true)}
      onMouseUp={() => setGrabbing(false)}
    >
      <button
        {...listeners}
        type="button"
        className=" w-5 rounded-md bg-white text-sm font-medium text-gray-600 hover:text-gray-500 "
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      >
        <ChevronUpDownIcon height={15} /> <span className="sr-only"> {person.name}</span>
      </button>
      <div className="flex grow items-center" {...listeners}>
        <ProfileImage member={person} tailwindSize="8" className="" />
        <p className="ml-4 text-sm font-medium text-gray-900 dark:text-gray-200">{person.name}</p>
      </div>

      <button
        onClick={() => props.removeManager()}
        type="button"
        className="ml-6 rounded-md bg-white text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        <XMarkIcon height={15} /> <span className="sr-only"> {person.name}</span>
      </button>
    </li>
  );
};
export default function Approver(props: { onClose: Function; currentMember: defaultMemberSelectOutput }) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState<boolean>(false);
  const { current_member, subscription } = useAbsentify();
  const updateApprover = api.member.updateApprover.useMutation();
  const {
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    setError,
    clearErrors
  } = useForm<RouterInputs['member']['updateApprover']['data']>();
  const [selected, setSelected] = useState<{
    department_id: string;
    department_name: string;
    approval_process: ApprovalProcess;
    approvers: defaultMemberSelectOutput[];
  } | null>();
  const [levelsToSync, setLevelsToSync] = useState<number | null>(null);
  const utils = api.useContext();
  const [searchtext, setSearchText] = useState<string | undefined>('');
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: membersData, isLoading } = api.member.all.useQuery(
    {
      filter: {
        status: ['ACTIVE', 'INACTIVE'],
        department_ids: workspace?.privacy_show_otherdepartments
          ? undefined
          : props.currentMember.departments.map((x) => x.department.id),
        search: searchtext || undefined
      },
      page: 1,
      limit: 15
    },
    {
      enabled: !!workspace,
      staleTime: 60000
    }
  );
  const { data: microsoftManagers, isLoading: microsoftManagerLoading } = api.member.getMicrosoftManagers.useQuery(
    {
      microsoft_profile_managers_level: levelsToSync ?? 1,
      member_id: props.currentMember.id
    },
    { staleTime: 60000 }
  );

  const { data: managers } = api.member.all.useQuery(
    { filter: { ids: microsoftManagers?.map((x) => x.member_id) }, page: 1, limit: 1000 },
    { staleTime: 60000, enabled: !!microsoftManagers }
  );

  const members = useMemo(() => {
    let retVal = membersData?.members || [];
    if (managers?.members)
      for (let index = 0; index < managers.members.length; index++) {
        const element = managers.members[index];
        if (!element) continue;
        if (retVal.find((x: { id: any }) => x.id === element.id)) continue;
        retVal.push(element);
      }

    return retVal;
  }, [membersData?.members, managers]);

  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });

  const [approverOptions, setApproverOptions] = useState<
    {
      department_id: string;
      department_name: string;
      approval_process: ApprovalProcess;
      approvers: defaultMemberSelectOutput[];
    }[]
  >([]);
  const [items, setItems] = useState<UniqueIdentifier[]>([]);
  useEffect(() => {
    if (props.currentMember.approver_config_microsoft_profile_manager_sync) {
      setLevelsToSync(props.currentMember.approver_config_microsoft_profile_manager_sync);
    } else {
      setLevelsToSync(1);
    }
  }, [props.currentMember.approver_config_microsoft_profile_manager_sync]);

  const [membersToSelect, setMembersToSelect] = useState<defaultMemberSelectOutput[]>([]);

  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);

  useEffect(() => {
    if (subscription.addons.multi_manager) {
      setHasValidSubscription(true);
      return;
    }

    if (subscription.enterprise > 0) {
      setHasValidSubscription(true);
      return;
    }
    setHasValidSubscription(false);
  }, [subscription]);

  const approvalProcessOptions = [
    {
      id: ApprovalProcess.Linear_all_have_to_agree,
      title: t('linear-all-must-agree'),
      description: t('linear-all-must-agree_description'),
      current: true
    },
    {
      id: ApprovalProcess.Linear_one_has_to_agree,
      title: t('linear-one-must-agree'),
      description: t('linear-one-must-agree-description'),
      current: false
    },
    {
      id: ApprovalProcess.Parallel_all_have_to_agree,
      title: t('parallel-all-must-agree'),
      description: t('parallel-all-must-agree-description'),
      current: true
    },
    {
      id: ApprovalProcess.Parallel_one_has_to_agree,
      title: t('parallel-one-must-agree'),
      description: t('parallel-one-must-agree-description'),
      current: false
    }
  ];
  function createManagerArray(departmentMembers: defaultMemberSelectOutput['departments'][0]['department']['members']) {
    if (!members) return [];
    const ITEMS: string[] = [];
    const approvers: defaultMemberSelectOutput[] = [];
    const x = departmentMembers.filter((y: { manager_type: string }) => y.manager_type !== 'Member');
    const first = x.find((y) => y.predecessor_manager_id == null);
    if (first) {
      items.push(first.member_id);
      const m = members.find((y: { id: any }) => y.id === first?.member_id);
      if (m) approvers.push(m);
    }

    while (x.find((y) => y.predecessor_manager_id === ITEMS[ITEMS.length - 1])) {
      const next = x.find((y) => y.predecessor_manager_id === ITEMS[ITEMS.length - 1]);
      if (next) {
        ITEMS.push(next.member_id);
        const m = members.find((y: { id: any }) => y.id === next?.member_id);
        if (m) approvers.push(m);
      }
    }
    return approvers;
  }
  useEffect(() => {
    if (!props.currentMember) return;
    if (!microsoftManagers) return;
    setValue('approval_process', props.currentMember.approval_process);
    const APPROVEROPTIONS = [];
    for (let index = 0; index < props.currentMember.departments.length; index += 1) {
      const department = props.currentMember.departments[index];
      if (department && departments)
        APPROVEROPTIONS.push({
          department_id: department.department.id,
          department_name: department.department.name,
          approvers: createManagerArray(department.department.members),
          approval_process:
            departments.find((x: { id: any }) => x.id === department.department.id)?.approval_process ||
            ApprovalProcess.Linear_all_have_to_agree
        });
    }

    if (microsoftManagers.length > 0) {
      APPROVEROPTIONS.push({
        department_id: '1',
        department_name: t('synchronizes-the-managers-from-the-users-microsoft-profile'),
        approvers: [],
        approval_process: ApprovalProcess.Linear_all_have_to_agree
      });
    }

    APPROVEROPTIONS.push({
      department_id: '0',
      department_name: t('custom'),
      approvers: [],
      approval_process: ApprovalProcess.Linear_all_have_to_agree
    });

    APPROVEROPTIONS.push({
      department_id: '2',
      department_name: t('no_approver'),
      approvers: [],
      approval_process: ApprovalProcess.Linear_all_have_to_agree
    });

    setApproverOptions(APPROVEROPTIONS);
    if (props.currentMember.approver_config_department_id && props.currentMember.approval_process[0]) {
      setSelected(APPROVEROPTIONS.find((x) => x.department_id === props.currentMember.approver_config_department_id));
    } else if (props.currentMember.approver_config_microsoft_profile_manager_sync && microsoftManagers.length > 0) {
      setItems(microsoftManagers.map((x: { member_id: any }) => x.member_id));
      setSelected(APPROVEROPTIONS.find((x) => x.department_id === '1'));
    } else if (
      !props.currentMember.approver_config_department_id &&
      !props.currentMember.approver_config_microsoft_profile_manager_sync &&
      props.currentMember.has_approvers.length == 1 &&
      props.currentMember.has_approvers[0]?.approver_member_id == props.currentMember.id
    ) {
      setSelected(APPROVEROPTIONS.find((x) => x.department_id === '2'));
    } else {
      setSelected(APPROVEROPTIONS.find((x) => x.department_id === '0'));
    }
  }, [props.currentMember, microsoftManagers]);

  useEffect(() => {
    if (!members) return;
    if (!workspace) return;
    let MEMBERSTOSELECT = members.filter((x) => x.email != null && !items.find((y) => y === x.id));
    if (!workspace.privacy_show_otherdepartments) {
      MEMBERSTOSELECT = MEMBERSTOSELECT.filter((x: { departments: any[] }) =>
        x.departments.find((y: { department: { id: any } }) =>
          props.currentMember.departments.find((z: { department: { id: any } }) => z.department.id === y.department.id)
        )
      );
    }
    setMembersToSelect(MEMBERSTOSELECT);
  }, [members, workspace, items]);

  const [selectManager, setSelectManager] = useState<boolean>(false);
  function removeManager(id: string): void {
    const newManager = items.filter((m) => m !== id);
    setItems(newManager);
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over?.id) {
      setItems((item) => {
        const oldIndex = item.indexOf(active.id);
        const newIndex = item.indexOf(over.id);
        const newOrder = arrayMove(item, oldIndex, newIndex);

        return newOrder;
      });
    }
  };

  useEffect(() => {
    if (!microsoftManagers) return;
    if (selected?.department_id === '1') {
      props.currentMember.approver_config_microsoft_profile_manager_sync = levelsToSync;
      props.currentMember.approver_config_department_id = null;
      setItems(microsoftManagers.map((x: { member_id: any }) => x.member_id));
      return;
    }

    if (!props.currentMember) return;

    if (!members) return;

    const ITEMS: UniqueIdentifier[] = [];

    const x = props.currentMember.has_approvers;
    const first = x.find((y) => y.predecessor_approver_member_approver_id == null);
    if (first) ITEMS.push(first.approver_member_id);

    while (x.find((y) => y.predecessor_approver_member_approver_id === ITEMS[ITEMS.length - 1])) {
      const next = x.find((y) => y.predecessor_approver_member_approver_id === ITEMS[ITEMS.length - 1]);
      if (next) ITEMS.push(next.approver_member_id);
    }

    setItems(ITEMS);
  }, [selected, setItems, microsoftManagers]);

  const [showModal, setShowModal] = useState<boolean>(false);

  const onSubmit: SubmitHandler<RouterInputs['member']['updateApprover']['data']> = async () => {
    if (!props.currentMember?.id) {
      notifyError('Error');
      throw new Error('Error');
    }
    if (!selected) {
      notifyError('Error');
      throw new Error('Error');
    }

    if (selected && !hasValidSubscription && selected.department_id === '1') {
      setShowModal(true);
      throw new Error('Error');
    }

    const newData: RouterInputs['member']['updateApprover']['data'] = {
      approval_process: getValues('approval_process'),
      use_department_settings_for_approvers: selected.department_id !== '0' && selected.department_id !== '1',
      approver_department_id:
        selected.department_id !== '0' && selected.department_id !== '1' ? selected.department_id : null,
      approver_member: [],
      microsoft_profile_managers_level: selected.department_id === '1' ? levelsToSync : null,
      use_microsoft_profile_managers_for_approvers: selected.department_id === '1'
    };
    newData.approver_member = [];

    if (selected.department_id !== '0' && selected.department_id !== '1' && selected.approvers[0]) {
      newData.approver_member.push({
        member_id: `${selected.approvers[0].id}`,
        predecessor_manager_id: null
      });
    }

    if (selected.department_id === '1') {
      for (let i = 0; i < items.length; i += 1) {
        if (i === 0)
          newData.approver_member.push({
            member_id: `${items[i]}`,
            predecessor_manager_id: null
          });
        else
          newData.approver_member.push({
            member_id: `${items[i]}`,
            predecessor_manager_id: `${items[i - 1]}`
          });
      }
    }

    if (selected.department_id === '0')
      for (let i = 0; i < items.length; i += 1) {
        if (i === 0)
          newData.approver_member.push({
            member_id: `${items[i]}`,
            predecessor_manager_id: null
          });
        else
          newData.approver_member.push({
            member_id: `${items[i]}`,
            predecessor_manager_id: `${items[i - 1]}`
          });
      }

    if (newData.approver_member.length === 0 && selected.department_id === '0') {
      setError('approver_member', { type: 'required' });

      return false;
    }

    if (selected.department_id === '2') {
      newData.approver_member = [
        {
          member_id: `${props.currentMember.id}`,
          predecessor_manager_id: null
        }
      ];
      newData.approver_department_id = null;
      newData.use_department_settings_for_approvers = false;
      newData.use_microsoft_profile_managers_for_approvers = false;
      newData.microsoft_profile_managers_level = null;
    }

    setLoading(true);
    await updateApprover.mutateAsync(
      {
        id: props.currentMember.id,
        data: newData
      },
      {
        onSuccess: async () => {
          utils.member.all.invalidate();
          notifySuccess(t('Saved_successfully'));
          props.onClose();
        },
        onError: (error: { message: any }) => {
          notifyError(error.message);
        }
      }
    );
    setLoading(false);
  };

  const DropdownIndicator = (props: any) => {
    return (
      components.DropdownIndicator && (
        <components.DropdownIndicator {...props}>
          <MagnifyingGlassIcon width={22} />
        </components.DropdownIndicator>
      )
    );
  };
  const handleInputChange = (inputText: string, meta: InputActionMeta) => {
    if (meta.action !== 'input-blur' && meta.action !== 'menu-close') {
      handleSearchDebounced(inputText);
    }
  };
  const formatOptionLabel = (option: defaultMemberSelectOutput) => {
    return (
      <div className="flex justify-between">
        <div className="flex-grow overflow-hidden">
          <div className="flex grow items-center">
            <ProfileImage member={option} tailwindSize="8" className="" />
            <p className="ml-4 text-sm font-medium text-gray-900  dark:text-gray-200">{option.name}</p>
          </div>
        </div>
      </div>
    );
  };
  const handleSearchDebounced = useRef(debounce((searchText) => setSearchText(searchText), 300)).current;

  const noOptionsMessage = (obj: { inputValue: string }) => {
    if (obj.inputValue.trim().length === 0) {
      return null;
    }
    return t('no_matching_members_found');
  };
  if (!members) return null;
  if (!departments) return null;
  return (
    <form className="divide-y divide-gray-200 lg:col-span-9 dark:bg-teams_brand_dark_100 dark:divide-gray-500" onSubmit={() => {}}>
      <UpgradeModal
        open={showModal}
        useInDepartment={false}
        onClose={() => {
          setShowModal(false);
        }}
      />
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="py-6 px-4 sm:p-6 lg:pb-8 ">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">{t('approver')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-200"></p>
          </div>
          <div className="mt-6 flex flex-col ">
            <RadioGroup value={selected} onChange={setSelected}>
              <RadioGroup.Label className="sr-only dark:text-gray-200">
                <p>{t('approver')}</p>{' '}
              </RadioGroup.Label>
              <div className="relative -space-y-px rounded-md bg-white">
                {approverOptions.map((approverOption, planIdx) => (
                  <RadioGroup.Option
                    key={approverOption.department_name}
                    value={approverOption}
                    className={({ checked }) =>
                      classNames(
                        planIdx === 0 ? 'rounded-tl-md rounded-tr-md' : '',
                        planIdx === approverOptions.length - 1 || planIdx === approverOptions.length - 2
                          ? 'rounded-bl-md rounded-br-md md:grid md:grid-cols-1 '
                          : 'md:grid  md:grid-cols-2 ',
                        checked ? 'z-10 border-teams_brand_200 bg-teams_brand_50 dark:bg-teams_dark_mode_core dark:divide-gray-500 dark:text-gray-200' : 'border-gray-200 dark:bg-teams_brand_dark_100 dark:text-gray-200',
                        'relative flex cursor-pointer flex-col border p-4 focus:outline-none md:pl-4 md:pr-6'
                      )
                    }
                  >
                    {({ active, checked }) => (
                      <>
                        <span className="flex items-center text-sm">
                          <span
                            className={classNames(
                              checked ? 'border-transparent bg-teams_brand_600' : 'border-gray-300 bg-white',
                              active ? 'ring-2 ring-teams_brand_500 ring-offset-2' : '',
                              'flex h-4 w-4 items-center justify-center rounded-full border'
                            )}
                            aria-hidden="true"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <RadioGroup.Label
                            as="span"
                            className={classNames(
                              checked ? 'text-teams_brand_900 dark:text-gray-100' : 'text-gray-900 dark:text-gray-100',
                              'ml-3 font-medium'
                            )}
                          >
                            {approverOption.department_name}{' '}
                            {approverOption.department_id !== '0' &&
                              approverOption.department_id !== '1' &&
                              approverOption.department_id !== '2' && (
                                <span className="text-xs text-gray-500 dark:text-gray-200">
                                  ({approvalProcessOptions.find((y) => y.id === approverOption.approval_process)?.title}
                                  )
                                </span>
                              )}
                          </RadioGroup.Label>
                        </span>

                        <RadioGroup.Description
                          as="span"
                          className={classNames(
                            checked ? 'text-teams_brand_700 dark:text-gray-100' : 'text-gray-500 dark:text-gray-100',
                            'ml-6 pl-1 text-sm md:ml-0 md:pl-0 md:text-right'
                          )}
                        >
                          <span>
                            {approverOption.approvers.map((person) => (
                              <span
                                key={person.email}
                                className="ml-1 rounded-full hover:opacity-75"
                                data-tooltip-id="approv-tooltip"
                                data-tooltip-content={person.name as string}
                                data-tooltip-variant="light"
                                data-tooltip-offset={30}
                              >
                                <ProfileImage
                                  member={person}
                                  tailwindSize="8"
                                  className="inline-block h-8 w-8 rounded-full"
                                />
                              </span>
                            ))}
                          </span>
                          <ReactTooltip
                            id="approv-tooltip"
                            className="shadow-sm z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                            classNameArrow="shadow-sm"
                            place="top"
                            style={{
                              boxShadow: '0 0 10px rgba(0,0,0,.1)'
                            }}
                          />
                        </RadioGroup.Description>

                        {checked && approverOption?.department_id === '0' && (
                          <div className="ml-6 mt-5 flex flex-col ">
                            <div className="w-full bg-white px-2 shadow sm:rounded-lg dark:bg-teams_brand_dark_100">
                              <div className="">
                                <ul role="list" className="mt-2 divide-y divide-gray-200  dark:divide-gray-500">
                                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                    {items.map((id) => (
                                      <SortableItem
                                        member_id={`${id}`}
                                        removeManager={() => {
                                          removeManager(`${id}`);
                                        }}
                                        key={id}
                                      />
                                    ))}
                                  </SortableContext>

                                  <li className="flex items-center justify-between py-2 px-4 pl-5 ">
                                    {!selectManager && (
                                      <button
                                        onClick={() => setSelectManager(true)}
                                        type="button"
                                        className="group -ml-1 flex items-center rounded-md bg-white p-1 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-teams_brand_dark_100 dark:border dark:border-2 dark:border-gray-200"
                                      >
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 dark:border-gray-200 dark:text-gray-100">
                                          <PlusIcon className="h-5 w-5 dark:text-gray-200" aria-hidden="true" />
                                        </span>
                                        <span className="ml-4 text-sm font-medium text-gray-600 group-hover:text-gray-500 dark:text-gray-200">
                                          {t('add-approver')}
                                        </span>
                                      </button>
                                    )}{' '}
                                    {selectManager && (
                                      <Select
                                        options={membersToSelect.filter(
                                          (x: { id: string }) => !items.find((y) => `${y}` === x.id)
                                        )}
                                        components={{
                                          IndicatorSeparator: () => null,
                                          DropdownIndicator
                                        }}
                                        styles={{
                                          control: (base) => ({
                                            ...base,
                                            flexDirection: 'row-reverse',
                                            '*': {
                                              boxShadow: 'none !important'
                                            }
                                          }),
                                          clearIndicator: (base: any) => ({
                                            ...base,
                                            position: 'absolute',
                                            right: 0
                                          })
                                        }}
                                        autoFocus
                                         className="w-full my-react-select-container"
                                        classNamePrefix="my-react-select"
                                        formatOptionLabel={formatOptionLabel}
                                        onInputChange={handleInputChange}
                                        isLoading={!!searchtext && isLoading}
                                        filterOption={null}
                                        noOptionsMessage={noOptionsMessage}
                                        onChange={(val) => {
                                          if (!val) return;
                                          if (!hasValidSubscription && items.length >= 1) {
                                            setShowModal(true);
                                            setSelectManager(false);
                                            return;
                                          }
                                          clearErrors('approver_member');
                                          items.push(val.id);
                                          setSelectManager(false);
                                        }}
                                      />
                                    )}
                                  </li>
                                </ul>
                                {errors.approver_member && (
                                  <span className="text-sm text-red-400">{t('required')}</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 ">
                              <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('approval-process')}
                              </label>

                              <Listbox
                                value={approvalProcessOptions.find((x) => x.id === watch('approval_process'))}
                                onChange={(val) => {
                                  if (val) setValue('approval_process', val.id);
                                }}
                              >
                                {({ open }) => (
                                  <>
                                    <Listbox.Label className="sr-only">
                                      <p>{t('change-approval-process')}</p>{' '}
                                    </Listbox.Label>
                                    <div className="relative w-full">
                                      <div className="inline-flex w-full rounded-md border-gray-300 dark:bg-teams_brand_dark_400">
                                        <div className="inline-flex w-full rounded-md border-gray-300 dark:bg-teams_brand_dark_400">
                                          <Listbox.Button className="inline-flex w-full  items-center rounded-l-md border border-gray-300 bg-white py-2 pl-3 pr-4 text-gray-800 dark:text-gray-200 shadow-sm dark:bg-teams_brand_dark_100">
                                            <div className="inline-flex">
                                              <CheckIcon className="h-5 w-5 dark:text-gray-200" aria-hidden="true" />
                                              <p className="ml-2.5 text-sm font-medium dark:text-gray-200">
                                                {
                                                  approvalProcessOptions.find(
                                                    (x) => x.id === getValues('approval_process')
                                                  )?.title
                                                }
                                              </p>
                                            </div>
                                          </Listbox.Button>
                                          <Listbox.Button className="inline-flex items-center rounded-l-none rounded-r-md border border-l-0 border-gray-300 bg-white p-2 text-sm font-medium text-black shadow-sm hover:bg-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-50  dark:text-gray-200 shadow-sm dark:bg-teams_brand_dark_100">
                                            <span className="sr-only">{t('change-approval-process')}</span>
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
                                        <Listbox.Options className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white dark:bg-teams_brand_dark_100 dark:text-gray-200 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:divide-gray-500">
                                          {approvalProcessOptions.map((option) => (
                                            <Listbox.Option
                                              key={option.title}
                                              className={({ active }) =>
                                                classNames(
                                                  hasValidSubscription
                                                    ? active
                                                      ? 'bg-gray-100 text-gray-800 dark:bg-teams_brand_dark_400 dark:text-gray-900'
                                                      : ' text-gray-800 '
                                                    : option.id !== 'Linear_all_have_to_agree'
                                                    ? ' cursor-not-allowed bg-gray-100 text-gray-800 dark:bg-teams_brand_dark_400 dark:text-gray-900'
                                                    : ' ',
                                                  'cursor-pointer select-none p-4 text-sm'
                                                )
                                              }
                                              disabled={
                                                hasValidSubscription ? false : option.id !== 'Linear_all_have_to_agree'
                                              }
                                              value={option}
                                            >
                                              {({ selected, active }) => (
                                                <div
                                                  className={`flex flex-col ${
                                                    hasValidSubscription
                                                      ? ' '
                                                      : option.id !== 'Linear_all_have_to_agree'
                                                      ? ' has-tooltip '
                                                      : ' '
                                                  } `}
                                                >
                                                  <div className="flex justify-between">
                                                    <p className={selected ? 'font-semibold dark:text-gray-900' : 'font-normal dark:text-gray-200'}>
                                                      {option.title}
                                                    </p>
                                                    <span className=" stooltip -mt-14 -ml-4 w-11/12 rounded p-2 text-center shadow-custom bg-white dark:bg-teams_brand_dark_400 dark:text-gray-600">
                                                      <p>{t('upgradeT1')}</p>
                                                      {current_member?.is_admin && (
                                                        <Link
                                                          href="/settings/organisation/upgrade"
                                                          className="underline hover:text-blue-700"
                                                        >
                                                          {t('upgradeT2')}
                                                        </Link>
                                                      )}
                                                    </span>
                                                    {selected ? (
                                                      <span className={active ? 'text-black dark:text-gray-900' : 'text-gray-300'}>
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                  <p
                                                    className={classNames(
                                                      active ? ' text-gray-700' : 'text-gray-500',
                                                      'mt-2'
                                                    )}
                                                  >
                                                    {option.description}
                                                  </p>
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
                            </div>
                          </div>
                        )}

                        {checked && approverOption?.department_id === '1' && (
                          <div className="ml-6 mt-5 flex flex-col ">
                            <div className="mb-5">
                              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                                {t('how-many-manager-levels-are-to-be-used')}
                              </label>
                              <select
                                id="location"
                                name="location"
                                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm"
                                defaultValue={`${levelsToSync}`}
                                onChange={(e) => {
                                  setLevelsToSync(parseInt(e.target.value));
                                }}
                              >
                                <option>1</option>
                                <option>2</option>
                                <option>3</option>
                                <option>4</option>
                                <option>5</option>
                              </select>
                            </div>
                            {!microsoftManagerLoading && (
                              <div className="w-full bg-white px-2 shadow sm:rounded-lg">
                                <div className="">
                                  <ul role="list" className="divide-y divide-gray-200  ">
                                    {items.map((id) => (
                                      <li key={id} className="flex items-center justify-between py-3">
                                        <div className="flex grow items-center">
                                          <ProfileImage
                                            member={members.find((x: { id: UniqueIdentifier }) => x.id === id)}
                                            tailwindSize="8"
                                            className=""
                                          />
                                          <p className="ml-4 text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {members.find((x: { id: UniqueIdentifier }) => x.id === id)?.name}
                                          </p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  {errors.approver_member && (
                                    <span className="text-sm text-red-400">{t('required')}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {microsoftManagerLoading && (
                              <div className="-ml-1 mr-3">
                                <Loader />
                              </div>
                            )}

                            <div className="mt-2 ">
                              <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700">
                                {t('approval-process')}
                              </label>

                              <Listbox
                                value={approvalProcessOptions.find((x) => x.id === watch('approval_process'))}
                                onChange={(val) => {
                                  if (val) setValue('approval_process', val.id);
                                }}
                              >
                                {({ open }) => (
                                  <>
                                    <Listbox.Label className="sr-only">
                                      {' '}
                                      <p>{t('change-approval-process')}</p>
                                    </Listbox.Label>
                                    <div className="relative w-full">
                                      <div className="inline-flex w-full rounded-md border-gray-300 ">
                                        <div className="inline-flex w-full rounded-md border-gray-300">
                                          <Listbox.Button className="inline-flex w-full  items-center rounded-l-md border border-gray-300 bg-white py-2 pl-3 pr-4 text-gray-800 shadow-sm ">
                                            <div className="inline-flex">
                                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                              <p className="ml-2.5 text-sm font-medium">
                                                {
                                                  approvalProcessOptions.find(
                                                    (x) => x.id === getValues('approval_process')
                                                  )?.title
                                                }
                                              </p>
                                            </div>
                                          </Listbox.Button>
                                          <Listbox.Button className="inline-flex items-center rounded-l-none rounded-r-md border border-l-0 border-gray-300 bg-white p-2 text-sm font-medium text-black shadow-sm hover:bg-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-50 ">
                                            <span className="sr-only">{t('change-approval-process')}</span>
                                            <ChevronDownIcon className="h-5 w-5 text-gray-800" aria-hidden="true" />
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
                                        <Listbox.Options className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-teams_brand_dark_100 dark:text-gray-200 dark:divide-gray-500">
                                          {approvalProcessOptions.map((option) => (
                                            <Listbox.Option
                                              key={option.title}
                                              className={({ active }) =>
                                                classNames(
                                                  subscription
                                                    ? active
                                                      ? 'bg-gray-100 text-gray-800 dark:bg-teams_brand_dark_400 dark:text-gray-900'
                                                      : ' text-gray-800 '
                                                    : option.id !== 'Linear_all_have_to_agree'
                                                    ? ' cursor-not-allowed bg-gray-100 text-gray-800 '
                                                    : ' ',
                                                  'cursor-pointer select-none p-4 text-sm dark:bg-teams_brand_dark_400 dark:text-gray-900'
                                                )
                                              }
                                              disabled={subscription ? false : option.id !== 'Linear_all_have_to_agree'}
                                              value={option}
                                            >
                                              {({ selected, active }) => (
                                                <div
                                                  className={`flex flex-col ${
                                                    subscription
                                                      ? ' '
                                                      : option.id !== 'Linear_all_have_to_agree'
                                                      ? ' has-tooltip '
                                                      : ' '
                                                  } `}
                                                >
                                                  <div className="flex justify-between">
                                                    <p className={selected ? 'font-semibold' : 'font-normal'}>
                                                      {option.title}
                                                    </p>
                                                    <span className=" stooltip -mt-14 -ml-4 w-11/12 rounded p-2 text-center shadow-custom bg-white dark:text-gray-900">
                                                      <p>{t('upgradeT1')}</p>
                                                      {current_member?.is_admin && (
                                                        <Link
                                                          href="/settings/organisation/upgrade"
                                                          className="underline hover:text-blue-700"
                                                        >
                                                          {t('upgradeT2')}
                                                        </Link>
                                                      )}
                                                    </span>
                                                    {selected ? (
                                                      <span className={active ? 'text-black dark:text-gray-900' : 'text-gray-300'}>
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                  <p
                                                    className={classNames(
                                                      active ? ' text-gray-700' : 'text-gray-500',
                                                      'mt-2'
                                                    )}
                                                  >
                                                    {option.description}
                                                  </p>
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
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </RadioGroup.Option>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>
        <div className="mt-4 flex justify-end p-4 sm:px-6">
          <button
            disabled={updateApprover.isLoading}
            onClick={(e) => {
              e.preventDefault();
              props.onClose(false);
            }}
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
          >
            {t('Cancel')}
          </button>
          <button
            disabled={updateApprover.isLoading}
            type="submit"
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
            onClick={(e) => {
              e.preventDefault();
              if (Object.keys(errors).length === 0 && props.currentMember) {
                handleSubmit(onSubmit)();
              }
            }}
          >
            {loading && (
              <div className="-ml-1 mr-3">
                <Loader />
              </div>
            )}
            {t('Save')}
          </button>
        </div>
      </DndContext>
    </form>
  );
}
