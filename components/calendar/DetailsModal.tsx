import { useAbsentify } from '@components/AbsentifyContext';
import DeclineModal from '@components/calendar/DeclineModal';
import ProfileImage from '@components/layout/components/ProfileImage';
import { Dialog, Menu, Transition } from '@headlessui/react';
import { CheckIcon, EllipsisVerticalIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { ClockIcon } from '@heroicons/react/24/outline';
import { ApprovalProcess, RequestApproverStatus, RequestStatus } from '@prisma/client';
import { format } from 'date-fns';
import { classNames } from 'lib/classNames';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useState, useMemo } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { api, type RouterOutputs } from '~/utils/api';
import TeamsChatButton from './TeamsChatButton';
import React from 'react';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from './Loader';
import { formatDuration, formatLeaveRequestDetails } from '~/helper/formatDuration';
import { uniq } from 'lodash';
import { uuidv4 } from '~/lib/uuidv4';
import { useDarkSide } from '@components/ThemeContext';

export default function DetailsModal(props: { request_id: string; onClose: Function; onCancelRequest: Function }) {
  const { in_teams, teamsChatIsSupported, current_member, impersonate } = useAbsentify();
  const [loading, setLoading] = useState<string>('');
  const approveRequest = api.request.approveRequest.useMutation();
  const { t, lang } = useTranslation('calendar');
  const utils = api.useContext();
  const [effectCompleted, setEffectCompleted] = useState<boolean>(false);
  const [declineRequest, setDeclineRequest] = useState<RouterOutputs['request']['toApprove'][0] | null>(null);
  const [theme] = useDarkSide();
  const { data: adminIds } = api.member.adminIds.useQuery(undefined, { staleTime: 60000 });

  const { data: departaments } = api.department.all.useQuery(undefined, { staleTime: 60000 });
  const {
    data: request,
    isLoading: requestIsLoading,
    refetch: refetchRequest
  } = api.request.byId.useQuery({ id: props.request_id });
  const getAllMemberIdsNeeded = () => {
    const allMemberIds: string[] = [];
    if (!request) return [];
    if (request.request_creator_member) allMemberIds.push(request.request_creator_member.id);
    if (request.requester_member) allMemberIds.push(request.requester_member.id);

    if (request.details) {
      for (let index = 0; index < request.details.request_approvers.length; index++) {
        const element = request.details.request_approvers[index];
        if (!element) continue;
        if (element.approver_member_id) allMemberIds.push(element.approver_member_id);
        if (element.status_changed_by_member_id) allMemberIds.push(element.status_changed_by_member_id);
      }
    }

    return uniq(allMemberIds);
  };
  const {
    data,
    refetch: refetchMemberAll,
    isLoading: isMemberLoading
  } = api.member.all.useQuery({ filter: { ids: getAllMemberIdsNeeded() }, page: 1, limit: 1000 }, { staleTime: 60000 });
  const members = data?.members || [];
  const [approver, setApprover] = useState<{
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    reason: string | null;
    status_change_date: Date | null;
    status_changed_by_member_id: string | null;
  }>({
    status: 'PENDING',
    approver_member_id: null,
    predecessor_request_member_approver_id: null,
    reason: null,
    status_change_date: null,
    status_changed_by_member_id: null
  });
  const sendReminderMail = api.request.sendReminderMailToApproverRequest.useMutation();
  const [dropDownDots, setDropDownDots] = useState<JSX.Element[]>([]);
  const [approveDeclineVisible, setApproveDeclineVisible] = useState(false);
  const onClient = typeof window !== 'undefined';

  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const isManager = useMemo(() => {
    return departaments?.find((department) =>
      department.members.find((member) => member.member_id === current_member?.id && member.manager_type === 'Manager')
    );
  }, [departaments, current_member?.id]);

  const isManagerOfRequester = useMemo(() => {
    if (!request) return null;
    const requesterDeps = departaments?.filter((dep) =>
      dep.members.map((mem) => mem.member_id).includes(request.requester_member_id)
    );
    return (
      requesterDeps?.find((department) =>
        department.members.find(
          (member) => member.member_id === current_member?.id && member.manager_type === 'Manager'
        )
      ) || null
    );
  }, [departaments, current_member?.id, request?.requester_member_id]);

  const { data: syncLogs } = api.request.getSyncDetailsForRequest.useQuery(
    { id: props.request_id },
    {
      enabled: impersonate
    }
  );

  const allowedManagers = isManager ? (workspace?.allow_manager_past_request_cancellation ? true : false) : true;
  const approvalProcessOptions = [
    {
      id: ApprovalProcess.Linear_all_have_to_agree,
      title: t('linear-all-must-agree'),
      description: t('linear-all-must-agree_description')
    },
    {
      id: ApprovalProcess.Linear_one_has_to_agree,
      title: t('linear-one-must-agree'),
      description: t('linear-one-must-agree-description')
    },
    {
      id: ApprovalProcess.Parallel_all_have_to_agree,
      title: t('parallel-all-must-agree'),
      description: t('parallel-all-must-agree-description')
    },
    {
      id: ApprovalProcess.Parallel_one_has_to_agree,
      title: t('parallel-one-must-agree'),
      description: t('parallel-one-must-agree-description')
    }
  ];
  const [dontShowAttention, setDontShowAttention] = useState(true);
  useEffect(() => {
    if (!current_member) return;
    if (!request) return;
    if (!request.details) return;
    setApproveDeclineVisible(false);
    const findApprover =
      current_member?.id &&
      request.details?.request_approvers.map((app) => app.approver_member_id).includes(current_member.id);
    setDontShowAttention(!isManagerOfRequester && !findApprover && current_member?.id !== request.requester_member_id);
    const dropDownDotList: JSX.Element[] = [];
    let currentApproverWithOption: {
      status: RequestApproverStatus;
      approver_member_id: string | null;
      predecessor_request_member_approver_id: string | null;
    }[] = [];

    if (
      request.details.approval_process == 'Linear_all_have_to_agree' ||
      request.details.approval_process == 'Linear_one_has_to_agree'
    ) {
      const approvers = sortApprovers(request.details.request_approvers);
      const currentApprover = approvers.find((x) => x.status == RequestApproverStatus.PENDING);
      if (currentApprover) currentApproverWithOption.push(currentApprover);
    } else if (
      request.details.approval_process == 'Parallel_all_have_to_agree' ||
      request.details.approval_process == 'Parallel_one_has_to_agree'
    ) {
      currentApproverWithOption = request.details.request_approvers.filter(
        (x) => x.status == RequestApproverStatus.PENDING
      );
    }
    if (
      (current_member.is_admin && request.details.status == RequestStatus.PENDING) ||
      (currentApproverWithOption.find((x) => x.approver_member_id == current_member?.id) &&
        request.details.status == RequestStatus.PENDING)
    ) {
      setApproveDeclineVisible(true);
    }

    if (isManager && request.details.status == RequestStatus.PENDING) {
      const filterDeps = departaments?.filter((dep) => {
        const manager = dep.members.find(
          (mem) => mem.member_id === current_member.id && mem.manager_type === 'Manager'
        );
        return manager;
      });
      const depsMems = filterDeps?.flatMap((department) => department.members);

      const approvers = sortApprovers(request.details.request_approvers);
      const currentApprover = approvers.find((x) => x.status == RequestApproverStatus.PENDING);
      const isManagerOfCurrent = currentApprover?.approver_member_id
        ? depsMems?.map((mem) => mem.member_id).includes(currentApprover?.approver_member_id)
        : null;
      const notAdmin = currentApprover?.approver_member_id
        ? !adminIds?.includes(currentApprover?.approver_member_id)
        : null;
      if (isManagerOfCurrent && notAdmin) {
        setApproveDeclineVisible(true);
      }
    }

    if (
      (request.details.status == RequestStatus.PENDING || request.details.status == RequestStatus.APPROVED) &&
      !current_member.is_admin &&
      request.requester_member_id == current_member.id &&
      request.start > new Date()
    ) {
      dropDownDotList.push(DropDownCancelButton);
    }

    if (
      (request.details.status == RequestStatus.PENDING || request.details.status == RequestStatus.APPROVED) &&
      !current_member.is_admin &&
      isManager &&
      request.start > new Date()
    ) {
      if (!dropDownDotList.find((x) => x.key == DropDownCancelButton.key)) dropDownDotList.push(DropDownCancelButton);
    }
    if (
      (current_member.is_admin || (isManager && allowedManagers)) &&
      (request.details.status == 'PENDING' || request.details.status == 'APPROVED')
    ) {
      if (!dropDownDotList.find((x) => x.key == DropDownCancelButton.key)) dropDownDotList.push(DropDownCancelButton);
    }

    if (
      in_teams &&
      DropDownTeamsButton &&
      teamsChatIsSupported &&
      onClient &&
      (current_member.is_admin || (isManager && allowedManagers))
    )
      dropDownDotList.push(DropDownTeamsButton);
    setDropDownDots(dropDownDotList);
    setEffectCompleted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, current_member, members]);

  useEffect(() => {
    if (!current_member) return;
    if (!impersonate) return;
    if (!syncLogs) return;
    if (syncLogs.length === 0) return;
    console.table(syncLogs);
  }, [current_member, syncLogs]);
  function sortApprovers(
    approver: {
      status: RequestApproverStatus;
      approver_member_id: string | null;
      predecessor_request_member_approver_id: string | null;
      reason: string | null;
      status_change_date: Date | null;
      status_changed_by_member_id: string | null;
      uuid: string;
      reminderDate: Date;
    }[]
  ) {
    const items: string[] = [];
    const approvers: {
      status: RequestApproverStatus;
      approver_member_id: string | null;
      predecessor_request_member_approver_id: string | null;
      reason: string | null;
      status_change_date: Date | null;
      status_changed_by_member_id: string | null;
      uuid: string;
      reminderDate: Date;
    }[] = [];
    const first = approver.find((y) => y.predecessor_request_member_approver_id == null);
    if (first) {
      items.push(`${first.approver_member_id}`);
      approvers.push(first);
    }

    while (true) {
      const next = approver.find((y) => y.predecessor_request_member_approver_id == items[items.length - 1]);
      if (next) {
        // Überprüfe, ob der Genehmigende bereits in der Liste 'approvers' existiert
        if (approvers.includes(next)) {
          console.warn('Zyklischer Verweis gefunden, Schleife wird unterbrochen.');
          break;
        }
        if (next.approver_member_id) items.push(next.approver_member_id + '');
        approvers.push(next);
      } else {
        // Wenn kein nächster Genehmigender gefunden wird, beende die Schleife
        break;
      }
    }

    return approvers;
  }
  const buttonClick = async (request: RouterOutputs['request']['allOfUsersByDay'][0], new_status: RequestStatus) => {
    if (!current_member) return;
    if (!current_member) return;
    if (!request.details) return;
    const approvers = sortApprovers(request.details.request_approvers);
    const filterDeps = departaments?.filter((dep) => {
      const manager = dep.members.find((mem) => mem.member_id === current_member.id && mem.manager_type === 'Manager');
      return manager;
    });
    const depsMems = filterDeps?.flatMap((department) => department.members);
    let currentApprover =
      request.details?.approval_process !== 'Linear_all_have_to_agree' &&
      approvers.find((member) => member.approver_member_id === current_member.id);
    if (!currentApprover || currentApprover.status !== 'PENDING') {
      currentApprover = approvers.find((member) => {
        if (request.details?.approval_process === 'Parallel_all_have_to_agree') {
          const isManagerOfCurrent = member?.approver_member_id
            ? depsMems?.map((mem) => mem.member_id).includes(member?.approver_member_id)
            : null;
          const notAdmin = member?.approver_member_id ? !adminIds?.includes(member?.approver_member_id) : null;
          if (isManagerOfCurrent && notAdmin) {
            return member.status == RequestStatus.PENDING;
          } else if (current_member?.is_admin) {
            if (
              !(approvers.find((approver) => approver.approver_member_id === current_member?.id)?.status === 'APPROVED')
            ) {
              return member.status == RequestStatus.PENDING;
            }
          }
        } else {
          return member.status == RequestStatus.PENDING;
        }
      });
    }
    if (new_status == 'DECLINED') {
      if (currentApprover) setDeclineRequest({ request, approver: currentApprover });
      return;
    }
    setLoading('approved');
    if (!currentApprover || !currentApprover.approver_member_id) {
      notifyError(t('no_access'));
      setLoading('');
      return;
    }
    await approveRequest.mutateAsync(
      {
        id: request.id,
        data: {
          approver_uuid: currentApprover.uuid,
          approver_id: currentApprover.approver_member_id
        }
      },
      {
        async onSuccess() {
          utils.request.toApprove.invalidate();
          refetchMemberAll();
          utils.request.allOfUsersByDay.invalidate();
          setLoading('');
          props.onClose();
        },
        onError(error) {
          notifyError(error.message);
          setLoading('');
        }
      }
    );
  };
  const getTeamsChatButtonData = (request: RouterOutputs['request']['allOfUsersByDay'][0]) => {
    if (!in_teams) return null;
    if (!members) return null;
    if (!current_member) return null;
    const requetser = members.find((x) => x.id == request.requester_member_id);

    const datestring = formatLeaveRequestDetails(request, current_member, t);

    const x = `${request.details?.leave_type.name} ${t('of')} ${requetser?.name}: ${datestring}`;
    return { topic: x, message: `${t('chat_button_message')}: ${datestring}` };
  };

  const DropDownDots: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
      setIsOpen(!isOpen);
    };
    if (dropDownDots.length === 0) return <></>;
    return (
      <div className="absolute bottom-6 my-auto inline-block text-left">
        <button
          onClick={toggleMenu}
          className="flex items-center rounded-full bg-gray-100 p-2 text-gray-400 hover:text-gray-600 focus:outline-none dark:bg-teams_brand_tbody  dark:text-gray-200  hover:text-gray-800 dark:border dark:border-gray-200"
        >
          <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        {isOpen && (
          <div className="absolute left-0 bottom-0 z-50 mt-2 w-56 origin-top-right rounded-md bg-white px-2 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none transform translate-y-full dark:bg-teams_brand_tbody dark:text-gray-200 dark:hover:bg-teams_brand_dark_600">
            <div className="py-1.5">
              {dropDownDots
                .filter((x) => x != null)
                .map((item) => (
                  <div
                    key={uuidv4()}
                    className="group flex items-center rounded text-sm px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer dark:hover:bg-teams_brand_dark_400 dark:hover:text-gray-600 dark:text-gray-200"
                  >
                    {item}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  const DropDownNotAvailable = () => {
    if (dontShowAttention) return <></>;
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <div className="text-sm text-yellow-700 relative">
              <p>{!current_member?.is_admin && !isManagerOfRequester ? t('Ask_manager_or_admin') : t('Ask_admin')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DropDownCancelButton = (
    <Fragment key="cancel">
      <span className="-mr-4 ml-3" key="cancel">
        <XMarkIcon className=" h-5 w-5 text-red-500 group-hover:text-red-400" aria-hidden="true" />
      </span>
      <button
        style={{
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          paddingTop: '8px',
          paddingBottom: '8px'
        }}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          props.onCancelRequest();
        }}
      >
        {t('Cancel_request')}
      </button>
    </Fragment>
  );

  const DropDownTeamsButton = members ? (
    request ? (
      <TeamsChatButton
        emails={[
          members.find((x) => x.id == request.requester_member_id)?.email ?? '',
          ...members
            ?.filter((x) => request.details?.request_approvers.find((y) => y.approver_member_id == x.id))
            ?.map((x) => x.email ?? '')
        ]}
        message={getTeamsChatButtonData(request)?.message ?? ''}
        topic={getTeamsChatButtonData(request)?.topic ?? ''}
        label={t('Chat')}
      />
    ) : null
  ) : null;

  const ApproveButton = request ? (
    <div className="flex align-middle justify-betwen sm:w-56 h-12 w-32 border border-gray-300 rounded-md px-4 py-2  dark:text-gray-200 dark:bg-teams_brand_tbody">
      {loading === 'approved' ? (
        <div className="mt-2">
          <Loader />
        </div>
      ) : (
        <CheckIcon
          className=" mr-0.5 h-5 w-5 self-center text-green-500 group-hover:text-green-400"
          aria-hidden="true"
        />
      )}
      <button
        style={{ width: '100%', height: '100%' }}
        disabled={loading == request.id}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          buttonClick(request, 'APPROVED');
        }}
        className = " dark:text-gray-200 dark:bg-teams_brand_tbody"
      >
        {t('Approve')}
      </button>
    </div>
  ) : (
    <></>
  );
  const DeclineButton = request ? (
    <div className="flex align-middle justify-betwen sm:w-56 h-12 w-32 border border-gray-300 rounded-md px-4 py-2  dark:text-gray-200 dark:bg-teams_brand_tbody">
      <XMarkIcon className=" h-5 self-center w-5 text-red-500 group-hover:text-red-400" aria-hidden="true" />
      <button
        style={{ width: '100%', height: '100%' }}
        disabled={loading == request.id}
        type="button"
        onClick={() => {
          buttonClick(request, 'DECLINED');
        }}
        className = " dark:text-gray-200 dark:bg-teams_brand_tbody"
      >
        {t('Decline')}
      </button>
    </div>
  ) : (
    <></>
  );
  const getTooltipText = (approver: {
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    reason: string | null;
    status_change_date: Date | null;
    status_changed_by_member_id: string | null;
  }) => {
    if (!current_member) return null;
    const DetailsTable = () => {
      return (
        <table>
          <tbody>
            {approver.status_change_date && (
              <tr>
                <td>{t('executed')}:</td>
                <td className="pl-2">{format(approver.status_change_date, current_member.long_datetime_format)}</td>
              </tr>
            )}
            {approver.reason && (
              <tr>
                <td>{t('Reason')}:</td>
                <td className="pl-2">{approver.reason}</td>
              </tr>
            )}
            {approver.status_changed_by_member_id != null &&
              approver.approver_member_id != approver.status_changed_by_member_id && (
                <tr>
                  <td>{t('status-changed-by')}:</td>
                  <td className="pl-2">{members?.find((x) => x.id == approver.status_changed_by_member_id)?.name}</td>
                </tr>
              )}
          </tbody>
        </table>
      );
    };
    if (approver.status == 'PENDING') return t('Pending-in-cal');

    return <DetailsTable />;
  };

  const currentDate = new Date();
  const [selectedButton, setSelectedButton] = useState<string[]>([]);
  useEffect(() => {
    let effecthappened = false;
    if (effectCompleted) {
      effecthappened = true;
      setLoading('');
    } else {
      if (effecthappened) setLoading(props.request_id);
      else {
        setLoading(' ');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectCompleted]);

  return (
    <>
      <Transition.Root show={request != null} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-30 overflow-auto"
          onClose={() => {
            props.onClose();
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
              <div className="dark:bg-teams_brand_tbody z-30 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full sm:p-6">
                {(isMemberLoading || requestIsLoading || !request || !current_member) && (
                  <div>
                    <CustomLoading />
                  </div>
                )}
                {current_member && request && !isMemberLoading && !requestIsLoading && (
                  <>
                    <div className="">
                      <h3 className="text-lg font-medium leading-6 text-gray-900  dark:text-gray-200">
                        {request?.details?.leave_type ? request.details.leave_type.name : t('Absent')}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                        {formatLeaveRequestDetails(request, current_member, t)}
                      </p>
                    </div>

                    {members && request?.details && (
                      <div className="border-t border-gray-200 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200 dark:text-gray-200">
                          {request.details?.leave_type.needs_approval && (
                            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 ">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Status')}</dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-400 sm:col-span-2 sm:mt-0">
                                <span>
                                  {request.details.status == RequestStatus.APPROVED && t('Approved')}
                                  {request.details.status == RequestStatus.PENDING && t('Pending-in-cal')}
                                  {request.details.status == RequestStatus.CANCELED && t('canceled')}
                                  {request.details.status == RequestStatus.DECLINED && t('declined')}
                                </span>
                              </dd>
                            </div>
                          )}
                          {request.details?.leave_type.needs_approval && (
                            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 ">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('process-status')}</dt>
                              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-400">
                                {request.details?.request_approvers.length > 1 && (
                                  <span>
                                    {`${
                                      approvalProcessOptions.find(
                                        (x) => x.id == request.requester_member.approval_process
                                      )?.title
                                    }:`}
                                  </span>
                                )}
                                {sortApprovers(request.details?.request_approvers).map((approver) => {
                                  const reminderDate = new Date(approver.reminderDate);
                                  reminderDate.setHours(reminderDate.getHours() + 24);
                                  const dayPassed = reminderDate < currentDate;
                                  return (
                                    <div
                                      key={approver.approver_member_id}
                                      className="group mt-2 block shrink-0 cursor-pointer"
                                    >
                                      <div
                                        className="flex justify-between"
                                        onMouseOver={() => {
                                          setApprover(approver);
                                        }}
                                      >
                                        <div className="flex items-center">
                                          <div className="w-10">
                                            <ProfileImage
                                              tailwindSize="8"
                                              member={members.find((x) => x.id == approver.approver_member_id)}
                                            />
                                          </div>
                                          <div className="ml-3">
                                          <span data-tooltip-id="detailM-tooltip" data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}>
                                          <p className="text-sm font-medium text-gray-700 dark:text-gray-400  dark:group-hover:text-gray-500 group-hover:text-gray-900 w-[235px] text-ellipsis overflow-hidden dark:bg-teams_brand_tbody">
                                                
                                                {members.find((x) => x.id == approver.approver_member_id)?.name ??
                                                  t('Deleted_User')}
                                              </p>
                                              <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700 dark:text-gray-500  dark:group-hover:text-gray-600">
                                                {approver.status == RequestApproverStatus.APPROVED && t('Approved')}
                                                {approver.status == RequestApproverStatus.PENDING &&
                                                  t('Pending-in-cal')}
                                                {approver.status == RequestApproverStatus.CANCELED && t('canceled')}
                                                {approver.status == RequestApproverStatus.CANCELED_BY_ANOTHER_MANAGER &&
                                                  t('canceled-by-another-manager')}
                                                {approver.status == RequestApproverStatus.DECLINED && t('declined')}
                                                {approver.status == RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER &&
                                                  t('declined-by-another-manager')}
                                                {approver.status == RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER &&
                                                  t('Approved_by_another_manager')}
                                              </p>
                                            </span>
                                          </div>
                                        </div>
                                        {approver.status === RequestApproverStatus.PENDING &&
                                          dayPassed &&
                                          approver?.approver_member_id &&
                                          !selectedButton.includes(approver.approver_member_id) &&
                                          approver.approver_member_id !== current_member.id && (
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!approver.approver_member_id) return;
                                                setSelectedButton(
                                                  (prev) =>
                                                    [...prev, approver.approver_member_id].filter(
                                                      (item) => item !== null
                                                    ) as string[]
                                                );
                                                await sendReminderMail.mutateAsync(
                                                  {
                                                    request_id: request.id,
                                                    member_id: approver.approver_member_id
                                                  },
                                                  {
                                                    async onSuccess() {
                                                      refetchRequest();
                                                      notifySuccess(t('succsess_mail'));
                                                    },
                                                    onError() {
                                                      notifyError(t('error_mail'));
                                                    }
                                                  }
                                                );
                                              }}
                                              className="mr-5"
                                            >
                                              <span
                                                className="ml-1 flex items-center cursor-pointer"
                                                data-tooltip-id="questionM-tooltip"
                                                data-tooltip-content={t('resend_mail')}
                                                data-tooltip-variant="light"
                                              >
                                                <ClockIcon
                                                  className=" h-5 w-5 hover:text-gray-400"
                                                  aria-hidden="true"
                                                />
                                              </span>
                                              <ReactTooltip
                                                id="questionM-tooltip"
                                                className="shadow z-50"
                                                classNameArrow="shadow-sm"
                                                place="top"
                                                style={{ width: '160px' }}
                                              />
                                            </button>
                                          )}
                                        {sendReminderMail.isLoading &&
                                          approver.approver_member_id &&
                                          selectedButton.includes(approver.approver_member_id) && (
                                            <div className="mt-2 mr-5">
                                              <Loader />
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </dd>
                            </div>
                          )}
                          {approver && (
                            <ReactTooltip
                              id="detailM-tooltip"
                              place="top"
                              className="shadow z-50 "
                              classNameArrow="shadow-sm"
                              opacity={1}
                              style={theme === "light" ? { backgroundColor: '#fff' } : undefined }
                              
                            >
                              {getTooltipText(approver)}
                            </ReactTooltip>
                          )}
                          {request.details && (
                            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 ">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Take_from_allowance')}</dt>

                              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-400">
                                {request.details.leave_type.take_from_allowance
                                  ? formatDuration(
                                      request.details.workday_absence_duration,
                                      lang,
                                      request.leave_unit,
                                      true,
                                      t
                                    )
                                  : t('No')}
                              </dd>
                            </div>
                          )}
                          {request.details?.reason && (
                            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Reason')}</dt>
                              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 break-words dark:text-gray-400">
                                {request.details?.reason}
                              </dd>
                            </div>
                          )}

                          <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Request_created')}</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-400">
                              {format(request.createdAt, current_member.long_datetime_format)}
                            </dd>
                          </div>

                          <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-200">{t('Request_created_by')}</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 dark:text-gray-400">
                              <div className="flex items-center">
                                <div>
                                  <ProfileImage
                                    tailwindSize="8"
                                    member={members.find((x) => x.id == request.request_creator_member?.id)}
                                  />
                                </div>
                                <div className="ml-3">
                                  <p
                                    className="text-sm font-medium text-gray-700 group-hover:text-gray-900 cursor-pointer text-ellipsis overflow-hidden w-64 dark:text-gray-400 dark:group-hover:text-gray-500"
                                    data-tooltip-id="user-tooltip"
                                    data-tooltip-variant="light"
                                  >
                                    {members.find((x) => x.id == request.request_creator_member?.id)?.name ??
                                      t('Deleted_User')}
                                  </p>
                                  <ReactTooltip
                                    id="user-tooltip"
                                    place="top"
                                    className="shadow z-50"
                                    classNameArrow="shadow-sm"
                                  >
                                    {request.request_creator_member?.name}
                                  </ReactTooltip>
                                </div>
                              </div>
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                    {approveDeclineVisible && (
                      <div className="flex justify-between py-5 border-gray-200 border-t">
                        <span
                          className={classNames(
                            'hover:bg-gray-100 hover:text-gray-900',
                            'hover:text-gray-700',
                            'group flex items-center rounded  text-sm '
                          )}
                        >
                          {ApproveButton}
                        </span>
                        <span
                          className={classNames(
                            'hover:bg-gray-100 hover:text-gray-900',
                            'hover:text-gray-700',
                            'group flex items-center rounded  text-sm '
                          )}
                        >
                          {DeclineButton}
                        </span>
                      </div>
                    )}
                    <div className="mt-6 space-x-2 sm:mt-6">
                      {loading != request.id && !isMemberLoading && dropDownDots.length > 0 ? (
                        <DropDownDots />
                      ) : (
                        loading == request.id && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )
                      )}
                      {dropDownDots.length === 0 &&
                        loading != request.id &&
                        request.details?.status === RequestStatus.PENDING &&
                        !isMemberLoading &&
                        workspace?.allow_manager_past_request_cancellation === false &&
                        request.start < new Date() && <DropDownNotAvailable />}
                      <div className="flex items-end justify-end">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            props.onClose();
                          }}
                        className=" block mt-4 rounded-md border h-10 border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                        >
                          <p className="my-auto">{t('Close')}</p>
                        </button>
                      </div>
                    </div>

                    {declineRequest && (
                      <DeclineModal
                        t={t}
                        request={declineRequest}
                        onClose={() => {
                          utils.request.toApprove.invalidate();
                          refetchMemberAll();
                          utils.request.allOfUsersByDay.invalidate();
                          props.onClose();
                          setDeclineRequest(null);
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}

const CustomLoading = () => {
  return (
    <>
      <div className="px-4 w-auto">
        <div>
          <div className="mx-auto w-full">
            <div className="flex animate-pulse space-x-4 pt-2">
              <div className="flex-1 space-y-6 py-1">
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-3 h-5 rounded bg-gray-700"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-2">
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-6">
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-2 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-6">
            <div className="h-5 w-40 rounded bg-gray-700 mt-1.5 mr-10"></div>
            <div className="h-8 w-8 rounded-full bg-gray-700 "></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-6">
            <div className="h-5 w-40 rounded bg-gray-700 mt-1.5 mr-10"></div>

            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-6">
            <div className="h-5 w-40 rounded bg-gray-700 mt-1.5 mr-10"></div>

            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 py-6 mb-4">
            <div className="h-5 w-40 rounded bg-gray-700 mt-1.5 mr-10"></div>
            <div className="h-8 w-8 rounded-full bg-gray-700 "></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
