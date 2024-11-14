/* eslint-disable no-nested-ternary */
/* eslint-disable no-param-reassign */
import { useAbsentify } from '@components/AbsentifyContext';
import ProfileImage from '@components/layout/components/ProfileImage';
import { closestCenter, DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { Dialog, Listbox, Transition } from '@headlessui/react';
import {
  CheckBadgeIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ApprovalProcess, Status } from '@prisma/client';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select, { components, InputActionMeta } from 'react-select';

import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';

import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { debounce } from 'lodash';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import DepartmentUsers from "./DepartmentUsers";
import { InputPicker } from "@components/duration-select/duration-select";
import { useDarkSide } from '@components/ThemeContext';

export const allowanceOptions = [
  { value: 0, label: '0' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2' },
  { value: 2.5, label: '2.5' },
  { value: 3, label: '3' },
  { value: 3.5, label: '3.5' },
  { value: 4, label: '4' },
  { value: 4.5, label: '4.5' },
  { value: 5, label: '5' },
  { value: 5.5, label: '5.5' },
  { value: 6, label: '6' },
  { value: 6.5, label: '6.5' },
  { value: 7, label: '7' },
  { value: 7.5, label: '7.5' },
  { value: 8, label: '8' },
  { value: 8.5, label: '8.5' },
  { value: 9, label: '9' },
  { value: 9.5, label: '9.5' },
  { value: 10, label: '10' },
  { value: 10.5, label: '10.5' },
  { value: 11, label: '11' },
  { value: 11.5, label: '11.5' },
  { value: 12, label: '12' },
  { value: 12.5, label: '12.5' },
  { value: 13, label: '13' },
  { value: 13.5, label: '13.5' },
  { value: 14, label: '14' },
  { value: 14.5, label: '14.5' },
  { value: 15, label: '15' },
  { value: 15.5, label: '15.5' },
  { value: 16, label: '16' },
  { value: 16.5, label: '16.5' },
  { value: 17, label: '17' },
  { value: 17.5, label: '17.5' },
  { value: 18, label: '18' },
  { value: 18.5, label: '18.5' },
  { value: 19, label: '19' },
  { value: 19.5, label: '19.5' },
  { value: 20, label: '20' },
  { value: 20.5, label: '20.5' },
  { value: 21, label: '21' },
  { value: 21.5, label: '21.5' },
  { value: 22, label: '22' },
  { value: 22.5, label: '22.5' },
  { value: 23, label: '23' },
  { value: 23.5, label: '23.5' },
  { value: 24, label: '24' },
  { value: 24.5, label: '24.5' },
  { value: 25, label: '25' },
  { value: 25.5, label: '25.5' },
  { value: 26, label: '26' },
  { value: 26.5, label: '26.5' },
  { value: 27, label: '27' },
  { value: 27.5, label: '27.5' },
  { value: 28, label: '28' },
  { value: 28.5, label: '28.5' },
  { value: 29, label: '29' },
  { value: 29.5, label: '29.5' },
  { value: 30, label: '30' },
  { value: 30.5, label: '30.5' },
  { value: 31, label: '31' },
  { value: 31.5, label: '31.5' },
  { value: 32, label: '32' },
  { value: 32.5, label: '32.5' },
  { value: 33, label: '33' },
  { value: 33.5, label: '33.5' },
  { value: 34, label: '34' },
  { value: 34.5, label: '34.5' },
  { value: 35, label: '35' },
  { value: 35.5, label: '35.5' },
  { value: 36, label: '36' },
  { value: 36.5, label: '36.5' },
  { value: 37, label: '37' },
  { value: 37.5, label: '37.5' },
  { value: 38, label: '38' },
  { value: 38.5, label: '38.5' },
  { value: 39, label: '39' },
  { value: 39.5, label: '39.5' },
  { value: 40, label: '40' },
  { value: 40.5, label: '40.5' },
  { value: 41, label: '41' },
  { value: 41.5, label: '41.5' },
  { value: 42, label: '42' },
  { value: 42.5, label: '42.5' },
  { value: 43, label: '43' },
  { value: 43.5, label: '43.5' },
  { value: 44, label: '44' },
  { value: 44.5, label: '44.5' },
  { value: 45, label: '45' },
  { value: 45.5, label: '45.5' },
  { value: 46, label: '46' },
  { value: 46.5, label: '46.5' },
  { value: 47, label: '47' },
  { value: 47.5, label: '47.5' },
  { value: 48, label: '48' },
  { value: 48.5, label: '48.5' },
  { value: 49, label: '49' },
  { value: 49.5, label: '49.5' },
  { value: 50, label: '50' }
];
export function UpgradeModal(props: { open: boolean; onClose: Function; useInDepartment: boolean }) {
  const cancelButtonRef = useRef(null);
  const { t } = useTranslation('settings_organisation');
  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-30"
        initialFocus={cancelButtonRef}
        onClose={() => {
          props.onClose();
        }}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
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
              <Dialog.Panel className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-teams_brand_tbody">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teams_brand_300 sm:mx-0 sm:h-10 sm:w-10 dark:text-gray-200">
                    <CheckBadgeIcon className="h-6 w-6 text-teams_brand_800 dark:text-gray-200" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                      {t('you-need-to-upgrade')}
                    </Dialog.Title>
                    <div className="mt-2">
                      {props.useInDepartment && (
                        <p className="text-sm text-gray-500 dark:text-gray-200">{t('you-need-to-upgrade-department-description')}</p>
                      )}
                      {!props.useInDepartment && (
                        <p className="text-sm text-gray-500 dark:text-gray-200">{t('you-need-to-upgrade-user-description')}</p>
                      )}

                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-200">{t('you-need-to-upgrade-description2')}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <Link href={'/settings/organisation/upgrade'} legacyBehavior>
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      {t('Upgrade')}
                    </button>
                  </Link>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={() => {
                      props.onClose();
                    }}
                    ref={cancelButtonRef}
                  >
                    {t('okay')}
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
const SortableItem = (props: { member_id: string; removeManager: Function }) => {
  const [grabbing, setGrabbing] = useState<boolean>(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.member_id });
  const { data: personData } = api.member.all.useQuery(
    { filter: { ids: [props.member_id] }, limit: 1, page: 1 },
    {
      staleTime: 60000
    }
  );
  const person = useMemo(() => {
    return personData?.members[0] || null;
  }, [personData?.members]);
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
      className="flex items-center justify-between py-3 "
      onMouseDown={() => setGrabbing(true)}
      onMouseUp={() => setGrabbing(false)}
    >
      <button
        {...listeners}
        type="button"
        className=" w-5 rounded-md bg-white text-sm font-medium text-gray-600 hover:text-gray-500 dark:text-gray-200 dark:bg-teams_brand_tbody "
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      >
        <ChevronUpDownIcon height={15} /> <span className="sr-only dark:text-gray-200"> {person.name}</span>
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

export default function Modal(props: {
  open: boolean;
  onClose: Function;
  value: null | RouterOutputs['department']['all'][0];
}) {
  const { t } = useTranslation('settings_organisation');
  const [theme] = useDarkSide();
  const utils = api.useContext();
  const addDepartment = api.department.add.useMutation();
  const editDepartment = api.department.edit.useMutation();
  const {data: allowanceTypes} = api.allowance.allTypes.useQuery(undefined, {staleTime: 60000});
  const [items, setItems] = useState<UniqueIdentifier[]>([]);
  const { subscription } = useAbsentify();
  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);
  const [searchtext, setSearchText] = useState<string | undefined>('');
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const [depMembers, setDepMembers] = useState<RouterOutputs['department']['all'][0]['members']>([]);
  const [defaultAllowances, setDefaultAllowances] = useState<{
    id: string,
    value: number, 
  }[]>([]);
  const handleAdvancedSettings = () => {
    setAdvancedSettings(!advancedSettings);
  }
  useEffect(() => {
    if(!props.value?.members || props.value?.members?.length === 0) return;
      const filteredMembers = props.value?.members.filter((member, index) => props.value?.members
      .findIndex(mem => mem.member_id === member.member_id) === index).filter(member => member.member.status !== 'ARCHIVED');
      setDepMembers(filteredMembers);
    
  },[props.value?.members])
  const addOrUpdateAllowance = (allowanceType: {id: string, value: number}) => {
    const isDuplicate = defaultAllowances.some((allowance) => allowance.id === allowanceType.id);

    if (!isDuplicate) {
      setDefaultAllowances((prev) => [
        ...prev, allowanceType,
      ]);
    } else {
      setDefaultAllowances((prev) =>
        prev.map((allowance) =>
          allowance.id === allowanceType.id
            ? allowanceType
            : allowance
        )
      );
    }
  };

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
  const maximumAbsentoptions = [
    { label: t('departments_No_limit'), value: -1 },
    { label: `1 ${t('departments_User')}`, value: 1 },
    { label: `2 ${t('departments_Users')}`, value: 2 },
    { label: `3 ${t('departments_Users')}`, value: 3 },
    { label: `4 ${t('departments_Users')}`, value: 4 },
    { label: `5 ${t('departments_Users')}`, value: 5 },
    { label: `6 ${t('departments_Users')}`, value: 6 },
    { label: `7 ${t('departments_Users')}`, value: 7 },
    { label: `8 ${t('departments_Users')}`, value: 8 },
    { label: `9 ${t('departments_Users')}`, value: 9 }
  ];
  const { current_member } = useAbsentify();
  const cancelButtonRef = useRef(null);
  const {
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    getValues,
    watch,
    setError,
    clearErrors
  } = useForm<RouterInputs['department']['add'] | RouterInputs['department']['edit']>({
    defaultValues: {
      data: {
        approval_process: ApprovalProcess.Linear_all_have_to_agree,
        maximum_absent: maximumAbsentoptions[0]?.value
      }
    }
  });
  type AddDepartmentInput = RouterInputs['department']['add'];
  type EditDepartmentInput = RouterInputs['department']['edit'];
  const {data: groupSyncSettings, refetch: refetchGroupSyncSettings} = api.group.getOwnersByDep.useQuery({department_id: props?.value?.id as string}, {enabled: !!props?.value?.id});
  const onAddSubmit: SubmitHandler<AddDepartmentInput> = async (data) => {
    data.data.default_department_allowances = defaultAllowances;
    await addDepartment.mutateAsync(data, {
      onSuccess: async (department) => {
        await utils.department.all.invalidate();
        props.onClose(department);
        notifySuccess(t('Saved_successfully'));
      },
      onError: (error) => {
        notifyError(error.message);
      }
    });
  };
  const prevDepIdRef = useRef<string | null>(null); 
  useEffect(() => {
    if(props?.value?.id && props?.value?.id !== prevDepIdRef.current) {
      refetchGroupSyncSettings();
      prevDepIdRef.current = props?.value?.id;
    }
  }, [props.value?.id]);

  const onEditSubmit: SubmitHandler<EditDepartmentInput> = async (data) => {
    if(!props?.value) return;
      if(groupSyncSettings?.find(setting => setting.manager_change_option)) {
        const manIds = props.value.members.filter(mem => mem.manager_type === 'Manager').map(mem => mem.member_id);
        const filterMangers = data.data.manager_member?.filter(manager => !manIds.includes(manager.member_id));
        if(filterMangers && filterMangers.length > 0) {
          notifyError(t('cant_change_managers'));
          return;
        }
      }
      data.data.default_department_allowances = defaultAllowances;
    await editDepartment.mutateAsync(
      { id: data.id, data: data.data },
      {
        onSuccess: async (department) => {
          await utils.department.all.invalidate();
          props.onClose(department);
          notifySuccess(t('Saved_successfully'));
        },
        onError: (error) => {
          notifyError(error.message);
        }
      }
    );
  };

  const onSubmit: SubmitHandler<RouterInputs['department']['add'] | RouterInputs['department']['edit']> = async (
    data: RouterInputs['department']['add'] | RouterInputs['department']['edit']
  ) => {
    if (!current_member) return;
    data.data.workspace_id = `${current_member?.workspace_id}`;
    data.data.manager_member = [];
    for (let i = 0; i < items.length; i += 1) {
      if (i === 0)
        data.data.manager_member.push({
          member_id: `${items[i]}`,
          predecessor_manager_id: null
        });
      else
        data.data.manager_member.push({
          member_id: `${items[i]}`,
          predecessor_manager_id: `${items[i - 1]}`
        });
    }
    if (data.data.manager_member.length === 0) {
      setError('data.manager_member', { type: 'required' });
      return;
    }
    if (data.data.approval_process == null) {
      data.data.approval_process = ApprovalProcess.Linear_all_have_to_agree;
    }
    if (!data.id) {
      await onAddSubmit(data as AddDepartmentInput);
    } else {
      await onEditSubmit(data as EditDepartmentInput);
    }
  };
  const {data: activeMembersData} = api.member.all.useQuery({ filter: { status: ['ACTIVE'] }, limit: 25, page: 1 }, {staleTime: 60000});
  const activeMembers = useMemo(() => {
    return activeMembersData?.members || [];
  }, [activeMembersData?.members]);

  const { data: membersData, isLoading } = api.member.all.useQuery(
    { filter: { status: ['ACTIVE', 'INACTIVE'], search: searchtext || undefined }, limit: 25, page: 1 },
    {
      staleTime: 60000
    }
  );
  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);

  useEffect(() => {
    if (members)
      if (props.value) {
        for (let index = 0; index < Object.keys(props.value).length; index += 1) {
          const element = Object.keys(props.value)[index];
          // @ts-ignore
          setValue(`data.${element}`, props.value[element]);
        }
        setValue('id', props.value.id);
      }
  }, [members]);

  useEffect(() => {
    if (!props.value || !allowanceTypes) return;
    const default_department_allowances: {
      id: string,
      value: number, 
    }[] = typeof props.value.default_department_allowances === 'string' && Array.isArray(JSON.parse(props.value.default_department_allowances))
    ? JSON.parse(props.value.default_department_allowances) : [];

    const allowanceTypeIds = default_department_allowances.map(type => type.id);
    const filteredDefaultAllowances = allowanceTypes.filter(allowance => !allowanceTypeIds.includes(allowance.id));
    const additionalDefaultAllowances = filteredDefaultAllowances.map(allowance => ({
      id: allowance.id,
      value: 0,
    }));
      setDefaultAllowances([...default_department_allowances, ...additionalDefaultAllowances]);
  },[allowanceTypes, props.value]);

  useEffect(() => {
  if(!props.value) return;
    const ITEMS: UniqueIdentifier[] = [];

      const x = props.value.members.filter((y) => y.manager_type !== 'Member');
      const first = x.find((y) => y.predecessor_manager_id == null);
      if (first) ITEMS.push(first.member_id);
  
      while (x.find((y) => y.predecessor_manager_id === ITEMS[ITEMS.length - 1])) {
        const next = x.find((y) => y.predecessor_manager_id === ITEMS[ITEMS.length - 1]);
        if (next) ITEMS.push(next.member_id);
      }

    setItems(ITEMS);
  }, [props.value]);

  useEffect(() => {
    if(props.value || !activeMembers) return;
    const filteredMembers = activeMembers.filter(member => member.email && member.email.trim() !== '');
    if(filteredMembers.length === 1 && filteredMembers[0]?.id) {
      setItems([filteredMembers[0].id]);
    }
  },[activeMembers, props.value]);
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
  const [showModal, setShowModal] = useState<boolean>(false);
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
            <p className="ml-4 text-sm font-medium text-gray-900">{option.name}</p>
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
  return (
    <>
      {showModal && (
        <UpgradeModal
          open={showModal}
          useInDepartment={true}
          onClose={() => {
            setShowModal(false);
          }}
        />
      )}
      {!showModal && (
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
                <div className="z-30 inline-block overflow-visible rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle dark:bg-teams_brand_tbody dark:divide-teams_brand_border">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                        <>
                          {' '}
                          {props.value && t('departments_edit_a_department')}{' '}
                          {!props.value && t('departments_add_a_department')}
                        </>
                      </Dialog.Title>
                      <form className="divide-y divide-gray-200 dark:divide-teams_brand_border" onSubmit={handleSubmit(onSubmit)}>
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                            <div className="sm:col-span-5">
                              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('departments_Name')}
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
                                      type="text"
                                      name="name"
                                      autoComplete="name"
                                      className="block w-full min-w-0 grow rounded-md border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:text-gray-200 dark:bg-transparent dark:border-teams_brand_border"
                                    />
                                  )}
                                />
                              </div>
                              {errors.data?.name && <span className="text-sm text-red-400">{t('required')}</span>}
                            </div>
                            <div className={classNames('relative sm:col-span-5',
                              groupSyncSettings?.find(setting => setting.manager_change_option) ? ' pointer-events-none': ''
                              )}>
                              
                                {groupSyncSettings?.find(setting => setting.manager_change_option) && (
                                  <>
                                  <div className="absolute inset-0 bg-gray-400 opacity-20 z-20 dark:text-gray-200"></div>
                                  <span className=" text-xs text-gray-400 dark:text-gray-200">{t('cant_manage_managers')}</span>
                                  </>
                                )}
                              <label htmlFor="username" className="block mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('departments_Boss')}
                              </label>
                              <div className="space-y-2">
                              
                                <div>
                                <ul role="list" className="mt-2 divide-y divide-gray-200 border-y border-gray-200 dark:bg-teams_brand_tbody dark:text-gray-200 dark:divide-teams_brand_border dark:border-teams_brand_border">
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

                                  <li className="flex items-center justify-between py-2 dark:border-gray-100">
                                    {!selectManager && (
                                      <button
                                        onClick={() => setSelectManager(true)}
                                        type="button"
                                        className="group -ml-1 flex items-center rounded-md bg-white p-1 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-teams_brand_tbody dark:border-gray-100"
                                      >
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 dark:bg-teams_brand_tbody dark:text-gray-200 dark:border-teams_brand_dark_550">
                                          <PlusIcon className="h-5 w-5 dark:text-teams_brand_dark_550" aria-hidden="true" />
                                        </span>
                                        <span className="ml-4 text-sm font-medium text-gray-600 group-hover:text-gray-500 dark:text-gray-200">
                                          {t('add-manager')}
                                        </span>
                                      </button>
                                    )}{' '}
                                    {selectManager && (
                                      <Select
                                        components={{
                                          IndicatorSeparator: () => null,
                                          DropdownIndicator
                                        }}
                                        options={members.filter(
                                          (x) => x.email != null && !items.find((y) => y === x.id)
                                        )}
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
                                          clearErrors('data.manager_member');
                                          items.push(val.id);
                                          setSelectManager(false);
                                        }}
                                      />
                                    )}
                                  </li>
                                </ul>
                              </div>
                              
                              </div>
                              {errors.data?.manager_member && (
                                <span className="text-sm text-red-400">{t('required')}</span>
                              )}
                            </div>
                            {depMembers && depMembers.length > 0 && (
                              <div className="sm:col-span-5">
                                <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                  {t('dep_members')}
                                </label>
                                <DepartmentUsers members={depMembers} max_members={16}/>
                              </div>
                            )}

                            <div className="sm:col-span-5">
                              <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('approval-process')}
                              </label>

                              <Listbox
                                value={approvalProcessOptions.find((x) => x.id === watch('data.approval_process'))}
                                onChange={(val) => {
                                  if (val) setValue('data.approval_process', val.id);
                                }}
                              >
                                {({ open }) => (
                                  <>
                                    <Listbox.Label className="sr-only">
                                      {' '}
                                      <p>{t('change-approval-process')}</p>
                                    </Listbox.Label>
                                    <div className="relative w-full">
                                      <div className="inline-flex w-full rounded-md border-gray-300 dark:bg-teams_brand_tbody">
                                        <div className="inline-flex w-full  rounded-md  border-gray-300 dark:bg-teams_brand_tbody">
                                          <Listbox.Button className="inline-flex w-full  items-center rounded-l-md border border-gray-300 bg-white py-2 pl-3 pr-4 text-gray-800 shadow-sm dark:bg-teams_brand_tbody dark:border-teams_brand_border">
                                            <div className="inline-flex">
                                              <CheckIcon className="h-5 w-5 dark:text-gray-200" aria-hidden="true" />
                                              <p className="ml-2.5 text-sm font-medium dark:text-gray-200">
                                                {
                                                  approvalProcessOptions.find(
                                                    (x) => x.id === getValues('data.approval_process')
                                                  )?.title
                                                }
                                              </p>
                                            </div>
                                          </Listbox.Button>
                                          <Listbox.Button className="inline-flex items-center rounded-l-none rounded-r-md border border-l-0 border-gray-300 bg-white p-2 text-sm font-medium text-black shadow-sm hover:bg-white focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-50  dark:text-gray-200 shadow-sm dark:bg-teams_brand_tbody dark:border-teams_brand_border">
                                            <span className="sr-only">{t('change-approval-process')}</span>
                                            <ChevronDownIcon className="h-5 w-5 text-gray-800 dark:text-teams_brand_border" aria-hidden="true" />
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
                                        <Listbox.Options className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white dark:bg-teams_brand_thead shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:divide-teams_brand_border">
                                          {approvalProcessOptions.map((option) => (
                                            <Listbox.Option
                                              key={option.title}
                                              className={({ active }) =>
                                                classNames(
                                                  subscription
                                                    ? active
                                                      ? 'bg-gray-100 text-gray-800 dark:text-gray-200 dark:bg-teams_brand_tbody'
                                                      : ' text-gray-800 dark:text-gray-200'
                                                    : option.id !== 'Linear_all_have_to_agree'
                                                  ? ' cursor-not-allowed bg-gray-100 text-gray-800 dark:text-gray-200'
                                                  : ' ',
                                                'cursor-pointer select-none p-4 text-sm'
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
                                                    <p className={selected ? 'font-semibold dark:text-gray-200' : 'font-normal dark:text-gray-200'}>
                                                      {option.title}
                                                    </p>
                                                    <span className=" stooltip -mt-14 -ml-4 w-11/12 rounded p-2 text-center shadow-custom bg-white dark:bg-teams_brand_thead dark:text-gray-600">
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
                                                      <span className={active ? 'text-black dark:text-gray-200' : 'text-gray-300'}>
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                  <p
                                                    className={classNames(
                                                      active ? ' text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-teams_brand_gray',
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
                            <div className="sm:col-span-5">
                              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                {t('departments_Maximum_absent')}
                              </label>
                              <div className="mt-1 flex rounded-md shadow-sm">
                                <Controller
                                  rules={{ required: true }}
                                  control={control}
                                  name="data.maximum_absent"
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
                                      value={value ? maximumAbsentoptions.find((x) => x.value === value) : undefined}
                                      
                                      className="w-full my-react-select-container"
                                      classNamePrefix="my-react-select"
                                      onChange={(val) => {
                                        onChange(val?.value);
                                      }}
                                      options={maximumAbsentoptions}
                                    />
                                  )}
                                />
                              </div>
                              {errors.data?.maximum_absent && (
                                <span className="text-sm text-red-400">{t('required')}</span>
                              )}
                            </div>
                            <div className="sm:col-span-5">
                              <button type="button" className="dark:text-gray-200 " onClick={handleAdvancedSettings}>
                              <span
                                className=" flex text-sm font-medium text-gray-700 dark:text-gray-200"
                                data-tooltip-id="lt-tooltip"
                                data-tooltip-content={t('advanced_tooltip')}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              >
                                {t('advanced')}
                                <ChevronUpDownIcon height={17} className="text-gray-800 mt-1 ml-0.5 dark:text-gray-200" />
                              </span>
                              <ReactTooltip id="lt-tooltip" place="top" className="shadow z-50 dark:text-gray-200 dark:bg-teams_brand_thead" classNameArrow="shadow-sm" style={{ width: '320px' }}/>
                              </button>
                              {advancedSettings && (
                              <div>
                                <div className="text-sm text-gray-700 mt-4 dark:text-gray-200">{t('advanced_desc')}</div>
                                {(allowanceTypes && allowanceTypes.length > 0) && allowanceTypes.map(allowanceType => {
                                  const allowance = defaultAllowances.find(allowance => allowance.id === allowanceType.id) as {
                                    id: string;
                                    value: number;
                                }
                                  return(
                                 <div className="mt-4" key={allowanceType.id}>
                                 <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {allowanceType.name}
                                 </span>
                                  <div className="mt-1 flex rounded-md shadow-sm">
                                    {<InputPicker
                                      unit={allowanceType.allowance_unit}
                                      value={allowance?.value ? allowance.value : 0}
                                      onChange={(val) => {
                                        if(typeof val === 'number') {
                                          addOrUpdateAllowance({
                                            id: allowanceType.id,
                                            value: val,
                                          });
                                        }
                                      }}
                                      className = "dark:text-gray-200 dark:bg-teams_brand_tbody w-full rounded border border-gray-300 focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:border-teams_brand_border"
                                    />}
                                </div>
                                </div>
                                  )})}
                                </div>
                                )}
                              </div>
                            </div>
                          <div className="mt-4 flex justify-end p-4 sm:px-6">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                props.onClose();
                              }}
                              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody  dark:border dark:border-gray-200 dark:text-white"
                            >
                              {t('Cancel')}
                            </button>
                            <button
                              disabled={addDepartment.isLoading || editDepartment.isLoading}
                              type="submit"
                              className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_300 dark:text-gray-200 dark:ring-0 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                            >
                              {(addDepartment.isLoading || editDepartment.isLoading) && (
                                <div className="-ml-1 mr-3">
                                  <Loader />
                                </div>
                              )}
                              {t('Save')}
                            </button>
                          </div>
                        </DndContext>
                      </form>
                    </div>
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      )}
    </>
  );
}
