import useTranslation from 'next-translate/useTranslation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal, { ExtendedMemberScheduleSelectOutput } from './Modal/Index';
import ProfileImage from '@components/layout/components/ProfileImage';
import { ActivateUsersAlert, ArchiveUserAlert, DeleteUserAlert, UnarchiveUserAlert } from './AlertModals';
import { api } from '~/utils/api';
import InviteModal from './Invite';
import {
  DocumentPlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  BellSnoozeIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import useDebounce from 'helper/useDebounce';
import { useMediaQuery } from 'react-responsive';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import ImportModal from './Import/Import';
import Loader from '@components/calendar/Loader';
import TabsUsers from './Modal/TabsUsers';
import { useRouter } from 'next/router';
import { useAbsentify } from '@components/AbsentifyContext';
import { Department, Status } from '@prisma/client';
import { formatDuration } from '~/helper/formatDuration';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import Select from 'react-select';

const Users = () => {
  const { t, lang } = useTranslation('users');
  const { teamsMobile, current_member } = useAbsentify();
  const utils = api.useContext();
  const router = useRouter();
  const isCustomBP1 = useMediaQuery({ query: '(min-width: 1388px)' });
  const isCustomBP2 = useMediaQuery({ query: '(min-width: 1280px)' });
  const isCustomBP3 = useMediaQuery({ query: '(min-width: 1190px)' });
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalImportOpen, setModalImportOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<defaultMemberSelectOutput | null>(null);
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, { staleTime: 60000 });
  const [updatedSortedSchedules, setUpdatedSortedSchedules] = useState<
    ExtendedMemberScheduleSelectOutput[] | undefined
  >([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState<boolean>(false);
  const { data: departaments } = api.department.all.useQuery(undefined, { staleTime: 60000 });
  const [showingOfresultsEnd, setShowingOfresultsEnd] = useState<number>(0);
  const [archiveUsersAlert, setArchiveUsersAlert] = useState<defaultMemberSelectOutput[] | null>(null);
  const [deleteUsersAlert, setDeleteUsersAlert] = useState<defaultMemberSelectOutput[] | null>(null);
  const [page, setPage] = useState<number>(1);
  const [unarchiveUsersAlert, setUnarchiveUsersAlert] = useState<defaultMemberSelectOutput[] | null>(null);
  const [activateUsersAlert, setActivateUsersAlert] = useState<defaultMemberSelectOutput[] | null>(null);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState<string>('');
  const [search, setSearch] = useState<string | undefined>('');
  const [selectMultiMode, setSelectMultiMode] = useState<boolean>(false);
  const [selectedDeps, setSelectedDeps] = useState<Department[]>([]);
  const debouncedSearchTerm: string = useDebounce<string>(search as string, 500);
  const [actionTypeClicked, setActionTypeClicked] = useState<boolean>(false);
  const rowsPerPage = [
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 75, label: '75' },
    { value: 100, label: '100' },
    { value: 200, label: '200' },
    { value: 300, label: '300' }
  ];
  const {
    data: membersData,
    refetch: refetchMembers,
    isLoading
  } = api.member.all.useQuery(
    {
      filter: {
        status: showArchived ? [Status.ARCHIVED] : [Status.ACTIVE, Status.INACTIVE],
        department_ids: selectedDeps.length > 0 ? selectedDeps.map((dep) => dep.id) : [],
        search: debouncedSearchTerm ?? undefined
      },
      page: page,
      limit: limit
    },
    { staleTime: 60000 }
  );

  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);
  const searchRef = useRef<HTMLInputElement>(null);
  const onRefreshHandler = async () => {
    setSchedulesLoading(true);
    await utils.member.all.invalidate();
    await utils.workspace_schedule.current.invalidate();
    setSchedulesLoading(false);
  };

  const searchHandler = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchRef.current?.value?.toLowerCase());
  };
  const getManagerOfMember = (memberId: string) => {
    if (!members) return null;
    const member = members.find((x) => x.id == memberId);
    if (!member) return null;

    const items: string[] = [];
    const names: string[] = [];

    if (member.has_approvers.length == 1 && member.has_approvers[0]?.approver_member_id == memberId) {
      return t('no_approver');
    }

    const first = member.has_approvers.find((y) => y.predecessor_approver_member_approver_id == null);
    if (first) {
      items.push(first.approver_member_id);

      if (first && first.approver_member && first.approver_member.name) {
        const m = first.approver_member.name;
        if (m) names.push(m);
      }
    }

    while (member.has_approvers.find((y) => y.predecessor_approver_member_approver_id == items[items.length - 1])) {
      const next = member.has_approvers.find(
        (y) => y.predecessor_approver_member_approver_id == items[items.length - 1]
      );
      if (next) {
        items.push(next.approver_member_id);
        if (next && next.approver_member && next.approver_member.name) {
          const m = next.approver_member.name;
          if (m) names.push(m);
        }
      }
    }
    return names.join(', ');
  };

  const tabs = [
    { id: 1, name: t('Active') },
    { id: 2, name: t('Archived') }
  ];

  const handleTabs = (value: boolean) => {
    setShowArchived(value);
  };

  useEffect(() => {
    const current_member = valueForEdit;

    if (!workspaceSchedule || !current_member) return;
    const stateOrder = ['future', 'current', 'completed'];

    const memberSchedules = members.find((member) => member.id === current_member.id)?.schedules || [];

    // Add updatedWorkspaceSchedule to memberSchedules and calculate state
    const updatedWorkspaceSchedule = { ...workspaceSchedule, from: null, member_id: '' };
    const schedulesWithState: ExtendedMemberScheduleSelectOutput[] = [...memberSchedules, updatedWorkspaceSchedule].map(
      (schedule) => ({
        ...schedule,
        state: calculateState(schedule, memberSchedules)
      })
    );

    // Sort schedules by state
    const finalSchedules = schedulesWithState.sort((a, b) => {
      const stateIndexA = stateOrder.indexOf(a.state);
      const stateIndexB = stateOrder.indexOf(b.state);
      return stateIndexA - stateIndexB;
    });

    setUpdatedSortedSchedules(finalSchedules);
  }, [workspaceSchedule, members, valueForEdit]);

  useEffect(() => {
    if (router.query.user_name && router.query.user_email) {
      setValueForEdit(null);
      setModalOpen(true);
    } else if (router.query.user_id) {
      const member = members.find((member) => member.id === router.query.user_id);
      if (member) {
        setValueForEdit(member);
        setModalOpen(true);
        delete router.query.user_id;
        router.push({ pathname: router.pathname });
      }
    }
  }, [router, members]);

  const handleCheckboxChange = (id: string) => {
    if (!selectedMembers.includes(id)) {
      setSelectedMembers([...selectedMembers, id]);
    } else {
      setSelectedMembers(selectedMembers.filter((memberId) => memberId !== id));
    }
  };

  const allowancePart = (member: defaultMemberSelectOutput, year = 0) => {
    const allowance = member.allowances?.find(
      (x) =>
        x.year == new Date().getFullYear() + year &&
        x.allowance_type?.id == member.allowance_type_configurtaions.find((y) => y.default)?.allowance_type_id
    );

    return (
      allowance?.allowance &&
      formatDuration(allowance.allowance, lang, allowance.allowance_type.allowance_unit, false, t)
    );
  };

  useEffect(() => {
    if ((search && search?.length > 0) || selectedDeps.length > 0) {
      setPage(1);
    }
  }, [search, selectedDeps]);

  useEffect(() => {
    if (!membersData) return;
    const end = Math.min(page * limit, membersData.count ?? 0);
    setShowingOfresultsEnd(end);
  }, [page, membersData]);

  useEffect(() => {
    if (!membersData) return;
    if (!selectMultiMode) return;
    const end = Math.min(page * limit, membersData.count ?? 0);
    const selectedMembers = membersData.members.slice(0, end).map((member) => member.id);
    setSelectedMembers(selectedMembers);
  }, [selectMultiMode, membersData, search]);

  useEffect(() => {
    setActionTypeClicked(false);
  }, [loading, deleteUsersAlert, archiveUsersAlert, activateUsersAlert, unarchiveUsersAlert]);

  useEffect(() => {
    if (actionTypeClicked) {
      setSelectedMembers([]);
      setSelectMultiMode(false);
    }
  }, [actionTypeClicked]);
  return (
    <div className="divide-y divide-gray-200 lg:col-span-10">
      {/* Profile section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <TabsUsers tabs={tabs} handler={handleTabs} showArchived={showArchived} />
        <div className="flex justify-between sm:flex-row flex-col items-start mt-4">
          <div className="  sm:mb-0 mb-4 sm:mr-4 sm:w-1/4 w-full">
            {departaments && departaments.length > 0 && (
              <div className="w-full">
                <div className="mt-1 flex rounded-md shadow-sm">
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
                    menuPortalTarget={document.body}
                    placeholder={t('Filter') + '...'}
                    isMulti
                    value={
                      selectedDeps
                        ? departaments.filter((dep) => selectedDeps.map((dep) => dep.id).includes(dep.id))
                        : undefined
                    }
                    className="w-full z-10"
                    name="department_ids"
                    onChange={(val) => {
                      if (val) {
                        setSelectedDeps([...val]);
                      }
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={departaments}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0 sm:w-3/4 w-full sm:self-end sm:ml-4">
            <div className="flex items-center px-0 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
              <div className=" w-full">
                <label htmlFor="search" className="sr-only">
                  {t('search')}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    id="search"
                    name="search"
                    className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-teams_brand_500 focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teams_brand_500 sm:text-sm"
                    placeholder={t('search')}
                    type="search"
                    ref={searchRef}
                    onChange={searchHandler}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col  items-center">
          <div className="-my-2 overflow-x-auto  w-full ">
            <div className="inline-block min-w-full py-2 align-middle sm:px-2 lg:px-1 px-2">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* depends on selecting several users or not */}
                  {!selectMultiMode && !(selectedMembers.length > 0) ? (
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className={`min-w-20 w-32 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:w-40 `}
                        >
                          <span className="flex h-6 items-center">
                            <input
                              id="name"
                              name="name"
                              type="checkbox"
                              aria-describedby="user_name"
                              className="h-3 w-3 rounded border-gray-300 text-teams_brand_500 focus:ring-teams_brand_500 mr-3"
                              onChange={(e) => {
                                setSelectMultiMode(e.target.checked);
                              }}
                            />
                            {t('name')}
                          </span>
                        </th>
                        <th
                          scope="col"
                          className="min-w-20 hidden w-32 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell lg:w-40"
                        >
                          {t('department_s')}
                        </th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                            isCustomBP3 ? ' table-cell ' : ' hidden '
                          }`}
                        >
                          {t('approver')}
                        </th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500  ${
                            isCustomBP2 ? ' table-cell ' : ' hidden '
                          } `}
                        >
                          {t('allowance_current_year')}
                        </th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500  ${
                            isCustomBP1 ? ' table-cell ' : ' hidden '
                          } `}
                        >
                          {t('allowance_next_year')}
                        </th>
                        <th scope="col" className="relative px-6 py-3"></th>{' '}
                        <th scope="col" className="relative px-6 py-3"></th>
                        <th scope="col" className="relative px-6 py-3"></th>
                        <th scope="col" className="relative"></th>
                      </tr>
                    </thead>
                  ) : (
                    <thead className="bg-teams_brand_100 w-full">
                      <tr className="">
                        <th
                          scope="col"
                          className={`min-w-20 w-32 px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 lg:w-40 `}
                        >
                          <span className="flex h-6 items-center cursor-pointer">
                            <input
                              id="name"
                              name="name"
                              type="checkbox"
                              checked={selectMultiMode}
                              aria-describedby="user_name"
                              className="h-3 w-3 rounded border-gray-300 text-teams_brand_500 focus:ring-teams_brand_500 mr-3 "
                              onChange={(e) => {
                                setSelectMultiMode(e.target.checked);
                                setSelectedMembers([]);
                              }}
                            />
                            {!showArchived && membersData ? (
                              <>
                                <span
                                  className="inline-flex hover:text-teams_brand_500"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const members = membersData.members.filter((member) =>
                                      selectedMembers.includes(member.id)
                                    );
                                    setArchiveUsersAlert(members);
                                    if (members.length == 1) setLoading(members[0]?.id || '');
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 mr-2"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  {t('Archive')}
                                </span>
                                <span
                                  className="inline-flex hover:text-teams_brand_500"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const members = membersData.members.filter((member) =>
                                      selectedMembers.includes(member.id)
                                    );
                                    setActivateUsersAlert(members);
                                    if (members.length == 1) setLoading(members[0]?.id || '');
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="size-5 ml-4 mr-2"
                                  >
                                    <path d="M5.85 3.5a.75.75 0 0 0-1.117-1 9.719 9.719 0 0 0-2.348 4.876.75.75 0 0 0 1.479.248A8.219 8.219 0 0 1 5.85 3.5ZM19.267 2.5a.75.75 0 1 0-1.118 1 8.22 8.22 0 0 1 1.987 4.124.75.75 0 0 0 1.48-.248A9.72 9.72 0 0 0 19.266 2.5Z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M12 2.25A6.75 6.75 0 0 0 5.25 9v.75a8.217 8.217 0 0 1-2.119 5.52.75.75 0 0 0 .298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 1 0 7.48 0 24.583 24.583 0 0 0 4.83-1.244.75.75 0 0 0 .298-1.205 8.217 8.217 0 0 1-2.118-5.52V9A6.75 6.75 0 0 0 12 2.25ZM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 0 0 4.496 0l.002.1a2.25 2.25 0 1 1-4.5 0Z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>

                                  {t('Activate')}
                                </span>
                              </>
                            ) : (
                              <>
                                <span
                                  className="inline-flex hover:text-teams_brand_500"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (membersData) {
                                      const members = membersData.members.filter((member) =>
                                        selectedMembers.includes(member.id)
                                      );
                                      setDeleteUsersAlert(members);
                                      if (members.length == 1) setLoading(members[0]?.id || '');
                                    }
                                  }}
                                >
                                  <TrashIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                                  {t('Delete')}
                                </span>
                                <span
                                  className="ml-6 inline-flex hover:text-teams_brand_500"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (membersData) {
                                      const members = membersData.members.filter(
                                        (member) =>
                                          selectedMembers.includes(member.id) && member.status === Status.ARCHIVED
                                      );
                                      setUnarchiveUsersAlert(members);
                                      if (members.length == 1) setLoading(members[0]?.id || '');
                                    }
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="size-5 mr-2"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15"
                                    />
                                  </svg>

                                  {t('Unarchive')}
                                </span>
                              </>
                            )}
                          </span>
                        </th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-xs font-medium  tracking-wider text-gray-500`}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 table-cell `}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 table-cell  `}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 ${
                            isCustomBP1 ? ' table-cell ' : ' hidden '
                          } `}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 ${
                            isCustomBP3 ? ' table-cell ' : ' hidden '
                          } `}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 ${
                            isCustomBP3 ? ' table-cell ' : ' hidden '
                          } `}
                        ></th>
                        <th
                          scope="col"
                          className={`px-3 py-3 text-left text-sm font-medium  tracking-wider text-gray-500 ${
                            isCustomBP3 ? ' table-cell ' : ' hidden '
                          } `}
                        ></th>

                        <th
                          scope="col"
                          className=" flex items-center  text-sm  mt-3 -ml-44 "
                          dangerouslySetInnerHTML={{
                            __html: t('selected_users', {
                              interpolation: { escapeValue: false },
                              number: selectedMembers.length
                            })
                          }}
                        />
                      </tr>
                    </thead>
                  )}

                  <tbody className="divide-y divide-gray-200 bg-white ">
                    {isLoading && <CustomListLoading />}
                    {!isLoading &&
                      members.map((member) => (
                        <tr key={member.id}>
                          <td
                            className={`flex w-full flex-row whitespace-nowrap px-3 py-4 text-sm font-medium ${
                              selectMultiMode && selectedMembers.includes(member.id)
                                ? 'text-teams_brand_500'
                                : 'text-gray-500'
                            }  `}
                          >
                            <span className="flex h-auto items-center">
                              <input
                                id={member.id}
                                name="name"
                                type="checkbox"
                                checked={
                                  selectMultiMode || selectedMembers.length > 0
                                    ? selectedMembers.includes(member.id)
                                      ? true
                                      : false
                                    : false
                                }
                                aria-describedby="user_name"
                                className="h-3 w-3 rounded border-gray-300 text-teams_brand_500 focus:ring-teams_brand_500 mr-3"
                                onChange={() => {
                                  handleCheckboxChange(member.id);
                                }}
                              />
                            </span>
                            <span
                              className=" relative w-8"
                              onClick={(e) => {
                                e.preventDefault();
                                setValueForEdit(member);
                                setModalOpen(true);
                              }}
                            >
                              <ProfileImage member={member} tailwindSize="8" />
                              {member.status === Status.INACTIVE && !member.is_admin && current_member?.is_admin && (
                                <BellSnoozeIcon
                                  className="flex h-5 w-5 mr-2 z-10 absolute right-4 bottom-5 "
                                  aria-hidden="true"
                                  color={'#FF6600'}
                                  data-tooltip-id="bell-tooltip"
                                  data-tooltip-content={t('inactive_user')}
                                  data-tooltip-offset={10}
                                  data-tooltip-variant="light"
                                />
                              )}
                            </span>
                            <span
                              className="min-w-24 ml-2 mt-2  w-32 truncate lg:w-40 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                setValueForEdit(member);
                                setModalOpen(true);
                              }}
                            >
                              <span
                                data-tooltip-id="member-tooltip"
                                data-tooltip-content={member.name as string}
                                data-tooltip-variant="light"
                              >
                                {member.name}
                              </span>
                            </span>
                          </td>
                          <td
                            className={`hidden w-80 whitespace-nowrap px-3 py-4 text-sm ${
                              selectMultiMode && selectedMembers.includes(member.id)
                                ? 'text-teams_brand_500'
                                : 'text-gray-500'
                            } md:table-cell`}
                          >
                            <span className="min-w-20  ml-2 mt-2 w-32 truncate lg:w-40 cursor-pointer">
                              <span
                                data-tooltip-id="member-tooltip"
                                data-tooltip-content={member.departments.map((x) => x.department?.name).join(', ')}
                                data-tooltip-variant="light"
                              >
                                {member.departments.length > 1
                                  ? member.departments.length + ' ' + t('departments')
                                  : member.departments.map((x) => x.department?.name).join(', ')}
                              </span>
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-4 text-sm ${
                              selectMultiMode && selectedMembers.includes(member.id)
                                ? 'text-teams_brand_500'
                                : 'text-gray-500'
                            } ${isCustomBP3 ? ' table-cell w-50' : ' hidden '}`}
                          >
                            <span className="min-w-20  ml-2 mt-2 w-28 truncate lg:w-32 cursor-pointer">
                              <span
                                data-tooltip-id="member-tooltip"
                                data-tooltip-content={getManagerOfMember(member.id) as string}
                                data-tooltip-variant="light"
                              >
                                <p className="w-36 xl:w-50 truncate inline-block align-middle ">
                                  {' '}
                                  {getManagerOfMember(member.id)}
                                </p>
                              </span>
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-4 text-sm ${
                              selectMultiMode && selectedMembers.includes(member.id)
                                ? 'text-teams_brand_500'
                                : 'text-gray-500'
                            } ${isCustomBP2 ? ' table-cell ' : ' hidden '}`}
                          >
                            {allowancePart(member)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-4 text-sm ${
                              selectMultiMode && selectedMembers.includes(member.id)
                                ? 'text-teams_brand_500'
                                : 'text-gray-500'
                            }  ${isCustomBP1 ? ' table-cell ' : ' hidden '} `}
                          >
                            {allowancePart(member, 1)}
                          </td>
                          <td
                            className={` ${
                              isCustomBP3 ? ' px-5 lg:px-3 ' : ''
                            } whitespace-nowrap py-4 text-right text-sm font-medium `}
                          >
                            <a
                              onClick={async (e) => {
                                e.preventDefault();
                                setValueForEdit(member);
                                setModalOpen(true);
                              }}
                              className={`${!selectMultiMode ? 'cursor-pointer text-gray-400 ' : 'hidden'}  `}
                            >
                              <span
                                className=""
                                aria-hidden="true"
                                data-tooltip-id="member-tooltip"
                                data-tooltip-content={t('Edit')}
                                data-tooltip-variant="light"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </span>
                            </a>
                          </td>
                          <td
                            className={` ${
                              isCustomBP3 ? ' px-5 lg:px-3 ' : ''
                            } whitespace-nowrap py-4 text-right text-sm font-medium `}
                          >
                            <a
                              onClick={async (e) => {
                                e.preventDefault();
                                router.push('/calendar/' + member.id);
                              }}
                              className="cursor-pointer"
                            >
                              <span
                                className=""
                                aria-hidden="true"
                                data-tooltip-id="member-tooltip"
                                data-tooltip-content={t('View_calendar')}
                                data-tooltip-variant="light"
                              >
                                <CalendarDaysIcon
                                  className={`${
                                    !selectMultiMode ? 'cursor-pointer text-gray-400 h-5 w-5 ' : 'hidden'
                                  }  `}
                                  aria-hidden="true"
                                />
                              </span>
                            </a>
                          </td>
                          <td
                            className={` ${
                              isCustomBP3 ? ' px-5 lg:px-3 ' : ' '
                            } whitespace-nowrap py-4 text-right text-sm font-medium`}
                          >
                            <a
                              onClick={async (e) => {
                                e.preventDefault();
                                if (member.status === Status.ARCHIVED) {
                                  setDeleteUsersAlert([member]);
                                  setLoading(member.id);
                                  return;
                                }
                                setArchiveUsersAlert([member]);
                                setLoading(member.id);
                              }}
                              className={`${!selectMultiMode ? 'cursor-pointer text-gray-400 ' : 'hidden'}  `}
                            >
                              {loading == member.id && (
                                <div className="-ml-1 mr-3">
                                  <Loader />
                                </div>
                              )}
                              {loading !== member.id && member.status !== Status.ARCHIVED && (
                                <span
                                  data-tooltip-id="member-tooltip"
                                  data-tooltip-content={t('Archive')}
                                  data-tooltip-variant="light"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              )}
                              {loading !== member.id && member.status === Status.ARCHIVED && (
                                <span
                                  data-tooltip-id="member-tooltip"
                                  data-tooltip-content={t('Delete')}
                                  data-tooltip-variant="light"
                                >
                                  <TrashIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </span>
                              )}
                            </a>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <ReactTooltip
                    id="bell-tooltip"
                    className="shadow-sm "
                    classNameArrow="shadow-sm"
                    place="top"
                    opacity={1}
                    style={{ width: '50%', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}
                  />
                  <ReactTooltip
                    id="member-tooltip"
                    className="shadow-sm z-50"
                    classNameArrow="shadow-sm"
                    place="top"
                    style={{ boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}
                  />
                </table>
                <nav
                  className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 w-full"
                  aria-label="Pagination"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex  justify-between sm:justify-start items-center">
                      {/* Rows Per Page Section */}
                      <div className="hidden sm:flex items-center justify-center">
                        <p className="text-sm text-gray-700  pr-4">{t('RowsPerPage')}</p>
                        <Select
                          menuPlacement="top"
                          value={rowsPerPage.find((x) => x.value === limit)}
                          onChange={(e) => e && setLimit(e.value)}
                          styles={{
                            container: (baseStyles) => ({ ...baseStyles, width: '95px', height: '40px' }),
                            control: (baseStyles) => ({
                              ...baseStyles,
                              '*': {
                                boxShadow: 'none !important'
                              },
                              width: '95px'
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            menu: (baseStyles) => ({
                              ...baseStyles,
                              width: '95px'
                            })
                          }}
                          menuPortalTarget={document.body}
                          options={rowsPerPage}
                        />
                      </div>
                      {/* Showing Results Section */}
                      <div className="hidden sm:flex pl-4">
                        <p className="text-sm text-gray-700">
                          {t('ShowingOfresults', {
                            start: (page - 1) * limit + 1,
                            end: showingOfresultsEnd,
                            total: membersData?.count
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Pagination Buttons */}
                    <div className="flex ">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (membersData?.hasPreviousPage) setPage(page - 1);
                        }}
                        disabled={!membersData?.hasPreviousPage}
                        className="relative inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0 disabled:opacity-50"
                      >
                        {t('previous')}
                      </button>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (membersData?.hasNextPage) setPage(page + 1);
                        }}
                        disabled={!membersData?.hasNextPage}
                        className="relative ml-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0 disabled:opacity-50"
                      >
                        {t('next')}
                      </button>
                    </div>
                  </div>
                </nav>
                {teamsMobile ? (
                  <div className="rounded-md bg-yellow-50 p-4 mt-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-yellow-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3 text-sm">{t('only_desktop')}</div>
                    </div>
                  </div>
                ) : (
                  <tr>
                    <td className="w-auto cursor-pointer whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 lg:w-full">
                      <div
                        className="flex"
                        onClick={(e) => {
                          e.preventDefault();
                          setValueForEdit(null);
                          setModalOpen(true);
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                            clipRule="evenodd"
                          />
                        </svg>{' '}
                        <span className="ml-2">{t('add_new_user')}</span>
                      </div>
                      <div
                        className="mt-5 flex"
                        onClick={(e) => {
                          e.preventDefault();
                          setValueForEdit(null);
                          setModalImportOpen(true);
                        }}
                      >
                        <DocumentPlusIcon height="20" />

                        <span className="ml-2">{t('import_users')}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {archiveUsersAlert && archiveUsersAlert.length > 0 && (
        <ArchiveUserAlert
          usersToArchive={archiveUsersAlert}
          onClose={async () => {
            setLoading('');
            setArchiveUsersAlert(null);
          }}
          actionTypeClicked={(e: boolean) => {
            setActionTypeClicked(e);
          }}
        />
      )}
      {unarchiveUsersAlert && unarchiveUsersAlert.length > 0 && (
        <UnarchiveUserAlert
          usersToUnarchive={unarchiveUsersAlert}
          onClose={async () => {
            setLoading('');
            setUnarchiveUsersAlert(null);
          }}
          actionTypeClicked={(e: boolean) => {
            setActionTypeClicked(e);
          }}
        />
      )}
      {activateUsersAlert && activateUsersAlert.length > 0 && (
        <ActivateUsersAlert
          usersToActivate={activateUsersAlert}
          onClose={async () => {
            setLoading('');
            setActivateUsersAlert(null);
          }}
          actionTypeClicked={(e: boolean) => {
            setActionTypeClicked(e);
          }}
        />
      )}

      {deleteUsersAlert && deleteUsersAlert.length > 0 && (
        <DeleteUserAlert
          usersToDelete={deleteUsersAlert}
          onClose={async () => {
            setLoading('');
            setDeleteUsersAlert(null);
          }}
          actionTypeClicked={(e: boolean) => {
            setActionTypeClicked(e);
          }}
        />
      )}

      {modalOpen && !valueForEdit && (
        <InviteModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
          }}
        ></InviteModal>
      )}
      {modalImportOpen && (
        <ImportModal
          open={modalImportOpen}
          onClose={() => {
            setModalImportOpen(false);
          }}
        ></ImportModal>
      )}
      {modalOpen && valueForEdit && updatedSortedSchedules && (
        <Modal
          currentMember={valueForEdit}
          open={modalOpen}
          onInvalidate={onRefreshHandler}
          schedules={updatedSortedSchedules}
          onClose={() => {
            setModalOpen(false);
            setValueForEdit(null);
          }}
          isLoading={schedulesLoading}
        ></Modal>
      )}
    </div>
  );
};

export default Users;

const calculateState = (
  schedule: defaultMemberSelectOutput['schedules'][0],
  memberSchedules: defaultMemberSelectOutput['schedules']
) => {
  const allOldSchedules = memberSchedules.filter((x) => x.from && new Date(x.from) < new Date());
  // if schedule is workspace schedule
  if (schedule.from === null) {
    return memberSchedules.length === 0 || allOldSchedules.length === 0 ? 'current' : 'completed';
  }
  // if schedule(s) is/are member schedule
  else {
    if (memberSchedules.length >= 1 && schedule.from && schedule.from > new Date()) return 'future';

    if (memberSchedules.length === 1 && schedule.from && schedule.from < new Date()) return 'current';

    if (allOldSchedules.length > 0 && allOldSchedules[0] && allOldSchedules[0].id === schedule.id) {
      return 'current';
    }

    return 'completed';
  }
};

const CustomListLoading = () => {
  return (
    <div className="p-4 w-screen max-w-screen-2xl">
      <div className=" space-y-4">
        <div className="mx-auto w-full">
          <div className="flex animate-pulse space-x-4 pt-2">
            <div className="h-8 w-8 rounded-full bg-gray-700"></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-8 gap-4">
                <div className="col-span-1 h-5 rounded bg-gray-700"></div>
                <div className="col-span-7 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex animate-pulse space-x-4 pt-2">
          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="grid grid-cols-8 gap-4">
              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
            </div>
          </div>
        </div>
        <div className="flex animate-pulse space-x-4 pt-2">
          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="grid grid-cols-8 gap-4">
              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
            </div>
          </div>
        </div>
        <div className="flex animate-pulse space-x-4 pt-2">
          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="grid grid-cols-8 gap-4">
              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
