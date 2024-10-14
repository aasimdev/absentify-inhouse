import DeclineModal from '@components/calendar/DeclineModal';
import { Icon } from '@components/Icon';
import ProfileImage from '@components/layout/components/ProfileImage';

import useTranslation from 'next-translate/useTranslation';
import React, { useEffect, useState } from 'react';
import { api, type RouterOutputs } from '~/utils/api';
import { type RequestStatus } from '@prisma/client';
import { useAbsentify } from '@components/AbsentifyContext';
import { format } from 'date-fns';
import TeamsChatButton from './TeamsChatButton';
import Image from 'next/legacy/image';
import { useRouter } from 'next/router';
import { classNames } from 'lib/classNames';
import { notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { formatDuration, formatLeaveRequestDetails } from '~/helper/formatDuration';
import { uniq } from 'lodash';

const LeaveRow = (props: { leaveType?: { icon: string; name: string; color: string } }) => {
  if (!props.leaveType) return <></>;

  return (
    <div className="flex">
      {props.leaveType.icon != 'NoIcon' && (
        <Icon className="mr-2 -mt-0.5" width="4" color={props.leaveType.color} name={props.leaveType.icon} />
      )}
      {props.leaveType.icon == 'NoIcon' && (
        <div style={{ backgroundColor: props.leaveType.color }} className="mr-2 mt-0.5 h-4 w-4 rounded-sm"></div>
      )}

      <span> {props.leaveType.name}</span>
    </div>
  );
};

const Requests = () => {
  const { t, lang } = useTranslation('requests');
  const { in_teams } = useAbsentify();
  const { current_member } = useAbsentify();
  const [iDs, setIDs] = useState<string[]>([]);
  const [requestsToApproveAsGroups, setRequestsToApproveAsGroups] = useState<
    { group: string; requests: RouterOutputs['request']['toApprove'] }[]
  >([]);
  const [declineRequest, setDeclineRequest] = useState<RouterOutputs['request']['toApprove'][0] | null>(null);
  const utils = api.useContext();
  const approveRequest = api.request.approveRequest.useMutation();
  const { data: requestsToApprove, refetch: refetchToApprove, isLoading } = api.request.toApprove.useQuery();
  const getAllMemberIdsNeeded = () => {
    const allMemberIds: string[] = [];
    if (!requestsToApprove) return allMemberIds;

    for (let index = 0; index < requestsToApprove.length; index++) {
      const ap = requestsToApprove[index];
      if (!ap) continue;

      if (ap.approver.approver_member_id) allMemberIds.push(ap.approver.approver_member_id);

      const request = ap.request;

      if (!request) continue;

      if (request.request_creator_member) allMemberIds.push(request.request_creator_member.id);
      if (request.requester_member) allMemberIds.push(request.requester_member.id);

      if (request.details) {
        for (let index2 = 0; index2 < request.details.request_approvers.length; index2++) {
          const element = request.details.request_approvers[index2];
          if (!element) continue;
          if (element.approver_member_id) allMemberIds.push(element.approver_member_id);
          if (element.status_changed_by_member_id) allMemberIds.push(element.status_changed_by_member_id);
        }
      }
    }

    return uniq(allMemberIds);
  };

  const { data, refetch: refetchMemberAll } = api.member.all.useQuery(
    { filter: { ids: getAllMemberIdsNeeded() }, page: 1, limit: 1000 },
    { staleTime: 60000 }
  );
  const members = data?.members || [];

  useEffect(() => {}, [requestsToApprove]);

  const handleAddRequestId = (newRequestId: string) => {
    if (newRequestId !== '') {
      const newArray = [...iDs, newRequestId];
      setIDs(newArray);
    }
  };

  const buttonClick = async (request: RouterOutputs['request']['toApprove'][0], new_status: RequestStatus) => {
    if (!current_member) return;
    if (!request.approver.approver_member_id) return;

    if (new_status == 'DECLINED') {
      setDeclineRequest(request);
      return;
    }
    await approveRequest.mutateAsync(
      {
        id: request.request.id,
        data: {
          approver_uuid: request.approver.uuid,
          approver_id: request.approver.approver_member_id
        }
      },
      {
        async onSuccess() {
          refetchToApprove();
          refetchMemberAll();
          utils.request.allOfUsersByDay.invalidate();
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
    if (requestsToApprove) {
      requestsToApprove.map((x, i) => {
        if (x.request.id != iDs[i]) {
          setIDs([]);
        }
      });
    }
  };
  useEffect(() => {
    if (!requestsToApprove) return;
    const group_to_values = requestsToApprove.reduce((obj: any, item) => {
      let request_approver_member_id = '0';
      if (item.approver.approver_member_id && item.approver.approver_member_id != undefined)
        request_approver_member_id = item.approver.approver_member_id;
      obj[request_approver_member_id] = obj[request_approver_member_id] || [];
      obj[request_approver_member_id].push(item);
      return obj;
    }, {});

    const groups = Object.keys(group_to_values).map((key) => {
      return { group: key, requests: group_to_values[key] };
    });
    setRequestsToApproveAsGroups(groups);
  }, [requestsToApprove]);

  const getTeamsChatButtonData = (request: RouterOutputs['request']['toApprove'][0]['request']) => {
    if (!in_teams) return null;
    if (!members) return null;
    if (!current_member) return null;
    const requetser = members.find((x) => x.id == request.requester_member_id);

    const datestring = formatLeaveRequestDetails(request, current_member, t);

    const x = request.details?.leave_type.name + ' ' + t('of') + ' ' + requetser?.name + ': ' + datestring;
    return { topic: x, message: t('chat_button_message') + ': ' + datestring };
  };
  if (isLoading) {
    return (
      <div className="grid min-h-64 w-full grid-cols-1 place-items-center gap-4 text-xl">
        <Loader height="10" width="10" />
      </div>
    );
  }
  if (!isLoading && (!requestsToApproveAsGroups || requestsToApproveAsGroups.length == 0))
    return (
      <div className="grid min-h-64 w-full grid-cols-1 place-items-center gap-4 text-xl">
        <div className="inline-flex">
          <p className="pb-3">{t('Nothing_todo')}</p>
          <span className="pl-2">
            <Image src="/broom.png" alt="Broom" width={25} height={25} quality={100} />
            <Image src="/blush.png" alt="Emoji_smile" width={24} height={24} quality={100} />
          </span>
        </div>
      </div>
    );
  return (
    <>
      {RenderRequests(requestsToApproveAsGroups.find((x) => x.group == current_member?.id))}

      {requestsToApproveAsGroups
        .filter((x) => x.group != current_member?.id)
        .map((x) => {
          {
            return <React.Fragment key={x.group}>{RenderRequests(x)}</React.Fragment>;
          }
        })}

      {declineRequest && (
        <DeclineModal
          t={t}
          request={declineRequest}
          onClose={() => {
            refetchToApprove();
            refetchMemberAll();
            setDeclineRequest(null);
          }}
        />
      )}
    </>
  );

  function RenderRequests(
    requestsToApprove: { group: string; requests: RouterOutputs['request']['toApprove'] } | undefined
  ) {
    const router = useRouter();
    const onClient = typeof window !== 'undefined';
    if (!current_member) return <></>;
    if (!requestsToApprove) return;
    if (!members) return;

    return (
      <div>
        {requestsToApprove.group !== current_member?.id && (
          <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {t('Requests_open_for_approval_of') + ' ' + members.find((x) => x.id == requestsToApprove.group)?.name ||
                ''}
            </h3>
          </div>
        )}
        <ul role="list" className="mx-4 mt-5 divide-y divide-gray-200 sm:mt-0 sm:border-t-0">
          {members &&
            requestsToApprove.requests.map((request) => (
              <li key={request.request.id}>
                <div className="group block">
                  <div className="flex items-center py-5 px-0 sm:py-6 sm:px-4 ">
                    <div className=" flex flex-1 items-center">
                      <div className="flex-shrink-0">
                        <ProfileImage
                          tailwindSize="12"
                          member={members.find((x) => x.id == request.request.requester_member_id)}
                        />
                      </div>
                      <div className=" flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                        <div>
                          <p className="w-24 truncate text-sm font-medium sm:w-full">
                            {members.find((x) => x.id == request.request.requester_member_id)?.name}
                          </p>
                          <p className="mt-2 flex items-center text-sm text-gray-500">
                            <span className="truncate">{request.request.details?.reason}</span>
                          </p>
                          <p className="mt-2 hidden items-center  text-sm text-gray-500 md:flex">
                            <span className="truncate">
                              {t('Created')}: {format(request.request.createdAt, current_member.long_datetime_format)}
                            </span>
                          </p>
                        </div>
                        <div>
                          <div>
                            <div className="text-sm text-gray-900">
                              <LeaveRow leaveType={request.request.details?.leave_type} />

                              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                                {formatLeaveRequestDetails(request.request, current_member, t)}
                              </p>
                            </div>
                            {request.request.details && (
                              <p className="mt-2 flex items-center text-sm text-gray-500">
                                {formatDuration(
                                  request.request.details.workday_absence_duration,
                                  lang,
                                  request.request.leave_unit,
                                  true,
                                  t
                                )}{' '}
                                {request.request.details?.leave_type.take_from_allowance
                                  ? t('from_allowance', {
                                      allowance: request.request.details.leave_type.allowance_type?.name
                                    })
                                  : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={classNames('grid gap-2', in_teams ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
                      <button
                        disabled={iDs.includes(request.request.id)}
                        type="button"
                        onClick={() => {
                          router.push(
                            '/calendar/' + request.request.requester_member_id + '?request_id=' + request.request.id
                          );
                        }}
                        className=" ml-5 inline-flex w-32 justify-center rounded-md  border border-blue-300 bg-white py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 "
                      >
                        {t('Details')}
                      </button>
                      <button
                        disabled={iDs.includes(request.request.id)}
                        type="button"
                        onClick={() => {
                          handleAddRequestId(request.request.id);
                          buttonClick(request, 'APPROVED');
                        }}
                        className=" ml-5 inline-flex w-32 justify-center rounded-md  border border-green-300 bg-white py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 "
                      >
                        {iDs.includes(request.request.id) && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Approve')}
                      </button>
                      {in_teams && onClient && (
                        <TeamsChatButton
                          emails={[
                            members.find((x) => x.id == request.request.requester_member_id)?.email ?? '',
                            ...members
                              ?.filter((x) =>
                                request.request.details?.request_approvers.find((z) => z.approver_member_id == x.id)
                              )
                              ?.map((y) => y.email + '')
                          ]}
                          message={getTeamsChatButtonData(request.request)?.message ?? ''}
                          topic={getTeamsChatButtonData(request.request)?.topic ?? ''}
                          label={t('Chat')}
                        />
                      )}
                      <button
                        disabled={iDs.includes(request.request.id)}
                        type="button"
                        onClick={() => {
                          buttonClick(request, 'DECLINED');
                        }}
                        className="ml-5 w-32 rounded-md border border-red-300 bg-white py-2 px-3 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 "
                      >
                        {t('Decline')}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>
    );
  }
};

export default Requests;
