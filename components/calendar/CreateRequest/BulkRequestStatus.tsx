import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, ForwardIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { classNames } from '~/lib/classNames';
import { convertLocalDateToUTC } from '~/lib/DateHelper';
import Loader from '../Loader';
import { api, RouterInputs } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import ProfileImage from '@components/layout/components/ProfileImage';

interface BulkRequestStatusProps {
  department_id: string;
  onClose: () => void;
}

export type BulkRequestStatusHandle = {
  triggerFunction: (data: RouterInputs['request']['add']) => Promise<void>;
};

type StatusListItem = {
  name: string | null;
  status: 'pending' | 'success' | 'running' | 'skipped';
  id: string;
  microsoft_user_id: string | null;
  email: string | null;
  errorMessage: string;
  has_cdn_image: boolean;
};

const BulkRequestStatus = forwardRef<BulkRequestStatusHandle, BulkRequestStatusProps>((props, ref) => {
  const { t } = useTranslation('calendar');
  const { current_member } = useAbsentify();

  const createRequst = api.request.add.useMutation();
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const [start, setStart] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: members } = api.member.all.useQuery(
    {
      filter: {
        ...(props.department_id !== '1' && { department_ids: [props.department_id] }),
        status: ['ACTIVE', 'INACTIVE']
      },
      limit: 500,
      page: 1
    },
    {
      staleTime: 60000
    }
  );

  const [statusList, setStatusList] = useState<StatusListItem[]>([]);
  function areAllErrorMessagesEmpty(statusList:StatusListItem[]):boolean {
    return statusList.every(person => person.errorMessage === '');
  }
  const localFunction = async (data: RouterInputs['request']['add']) => {
    if (!current_member) return;
    if (!departments) return;
    if (!members) return;
    setStart(true);
    setLoading(true);
  
    const internalList: StatusListItem[] = members.members.map((member) => ({
      name: member.name,
      id: member.id,
      microsoft_user_id: member.microsoft_user_id,
      email: member.email,
      status: 'pending',
      errorMessage: '',
      has_cdn_image: member.has_cdn_image
    }));
  
    setStatusList([...internalList]);
  
    const executeRequest = async (member: (typeof members.members)[0], index: number) => {
      const status = internalList[index];
      if (!status) return;
      status.status = 'running';
      setStatusList([...internalList]);
  
      try {
        await createRequst.mutateAsync({
          end: convertLocalDateToUTC(data.end),
          end_at: data.end_at,
          leave_type_id: data.leave_type_id,
          reason: data.reason,
          requester_member_id: member.id,
          start: convertLocalDateToUTC(data.start),
          start_at: data.start_at
        });
  
        status.status = 'success';
      } catch (error: any) {
        status.status = 'skipped';
        status.errorMessage = error.message;
      }
  
      setStatusList([...internalList]);
    };
  
    const maxConcurrent = 5;
    
    // Funktion zum Verarbeiten eines Batches
    const processBatch = async (startIndex: number) => {
      const batchPromises = [];
      for (let i = startIndex; i < Math.min(startIndex + maxConcurrent, members.members.length); i++) {
        const member = members.members[i];
        if (member) {
          batchPromises.push(executeRequest(member, i));
        }
      }
      await Promise.all(batchPromises);
    };
  
    // Batches nacheinander verarbeiten
    for (let i = 0; i < members.members.length; i += maxConcurrent) {
      await processBatch(i);
    }
  
    setLoading(false);
  };
  
  

  useImperativeHandle(ref, () => ({
    triggerFunction: localFunction
  }));
  if (!start) return <div></div>;
  return (
    <div className="px-4 sm:px-6 lg:px-8 mt-5">
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      {t('Name')}
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      <span className={`${areAllErrorMessagesEmpty(statusList) ? "hidden" : "visible"}`}>{t('Note')}</span>
                    </th>

                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      <span>{t('Status')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {statusList.map((person) => (
                    <tr key={person.name}>
                      <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <ProfileImage tailwindSize="8" member={person} />
                          </div>
                          <div className="flex-grow truncate text-left">{person.name}</div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 max-w-xs break-words   text-left ">
                        {person.status === 'skipped' && person.errorMessage}
                      </td>
                      <td className="relative whitespace-nowrap py-4 px-6 text-right text-sm font-medium sm:pr-6">
                        {person.status === 'pending' && <ClockIcon className="h-5 w-5 text-yellow-500" />}
                        {person.status === 'running' && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {person.status === 'skipped' && <ForwardIcon className="h-5 w-5 text-red-500" />}
                        {person.status === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 py-4 flex justify-end sm:pl-6">
        <button
          type="submit"
          disabled={loading}
          onClick={() => {
            props.onClose();
          }}
          className={classNames(
            'ml-5 bg-teams_brand_foreground_1 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-teams_brand_foreground_bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1',
            loading ? 'opacity-50 cursor-not-allowed' : ''
          )}
        >
          {t('Close')}
        </button>
      </div>
    </div>
  );
});

BulkRequestStatus.displayName = 'BulkRequestStatus';

export default BulkRequestStatus;
