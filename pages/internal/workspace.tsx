import Loader from '@components/calendar/Loader';
import ProfileImage from '@components/layout/components/ProfileImage';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

import { MicrosoftAppStatus } from '@prisma/client';
import { classNames } from 'lib/classNames';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getPlanName } from '~/helper/paddle_config';

import { api } from '~/utils/api';

const WorkspacePage: NextPage = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const { data: workspace, isLoading: loadingWorkspace } = api.administration.getWorkspaceById.useQuery(
    { id: workspaceId as string },
    {
      enabled: !!workspaceId
    }
  );
  return (
    <>
      <div className="divide-y divide-gray-200 lg:col-span-9">
        <div className="relative z-0 flex flex-1 overflow-hidden">
          {workspaceId && loadingWorkspace && (
            <div className="mb-3 ml-10">
              <Loader />
            </div>
          )}
          {workspace && (
            <div className="w-full px-12 py-4">
              <nav className="flex items-start" aria-label="Breadcrumb">
                <Link href="/internal/users" legacyBehavior>
                  <span className="mb-2 inline-flex w-full cursor-pointer items-center space-x-3 border-b pb-2 text-sm  font-medium text-gray-900">
                    <ChevronLeftIcon className="-ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                    <span>Users</span>
                  </span>
                </Link>
              </nav>
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">{workspace.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">.</p>
              </div>
              <div className="mt-5 border-t border-gray-200">
                <dl className="sm:divide-y sm:divide-gray-200">
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{workspace.id}</dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Enable to purchase Enterprise</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      <CheckCircleIcon className={classNames('h-5 w-5 text-green-600')} aria-hidden="true" />
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Referrer</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{workspace.referrer}</dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Microsoft calendars: read-write</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {workspace.microsoft_calendars_read_write == MicrosoftAppStatus.ACTIVATED ? (
                        <CheckCircleIcon className={classNames('h-5 w-5 text-green-600')} aria-hidden="true" />
                      ) : (
                        <XCircleIcon className={classNames('h-5 w-5 text-teams_brand_400')} aria-hidden="true" />
                      )}
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Microsoft users: read all</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {workspace.microsoft_users_read_all == MicrosoftAppStatus.ACTIVATED ? (
                        <CheckCircleIcon className={classNames('h-5 w-5 text-green-600')} aria-hidden="true" />
                      ) : (
                        <XCircleIcon className={classNames('h-5 w-5 text-teams_brand_400')} aria-hidden="true" />
                      )}
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Microsoft groups: read-write-all</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {workspace.microsoft_groups_read_write_all == MicrosoftAppStatus.ACTIVATED ? (
                        <CheckCircleIcon className={classNames('h-5 w-5 text-green-600')} aria-hidden="true" />
                      ) : (
                        <XCircleIcon className={classNames('h-5 w-5 text-teams_brand_400')} aria-hidden="true" />
                      )}
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Microsoft Mailbox Settings: read-write</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {workspace.microsoft_mailboxSettings_read_write == MicrosoftAppStatus.ACTIVATED ? (
                        <CheckCircleIcon className={classNames('h-5 w-5 text-green-600')} aria-hidden="true" />
                      ) : (
                        <XCircleIcon className={classNames('h-5 w-5 text-teams_brand_400')} aria-hidden="true" />
                      )}
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Subscriptions</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      <div className="flex shrink-0 -space-x-1">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead>
                            <tr>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 sm:table-cell"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Quantity
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Currency
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Subscription plan
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Interval
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {workspace.subscriptions?.map((subscription) => (
                              <tr key={subscription.subscription_id}>
                                <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                  {subscription.status as string}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {subscription.quantity}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {subscription.currency}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {getPlanName(subscription.subscription_plan_id)}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {subscription.billing_cycle_interval}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Numbers</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      <div className="flex  space-x-3">
                        <table className="min-w-full ">
                          <thead>
                            <tr>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 sm:table-cell"
                              >
                                Departments
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Members
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Leave types
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Requests
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                WebhookHistory
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Member Mailbox Settings
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            <tr>
                              <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                {workspace._count.departments.toString()}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                {workspace._count.members.toString()}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                {workspace._count.leave_types.toString()}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                {workspace._count.requests.toString()}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                {workspace._count.webhookHistory.toString()}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                {workspace._count.memberMailboxSettings.toString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Departments</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      <div className="flex shrink-0 -space-x-1">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead>
                            <tr>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Name
                              </th>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Members
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {workspace.departments?.map((department) => (
                              <tr key={department.id}>
                                <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {department.name}
                                </td>
                                <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {department.members.length.toString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                    <dt className="text-sm font-medium text-gray-500">Members</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      <div className="flex shrink-0 -space-x-1">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead>
                            <tr>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 sm:table-cell"
                              ></th>
                              <th
                                scope="col"
                                className=" px-3 py-3.5 text-left text-sm font-semibold text-gray-700 sm:table-cell"
                              >
                                Name
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Email
                              </th>
                              <th
                                scope="col"
                                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-700 lg:table-cell"
                              >
                                Admin
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {workspace.members?.map((member) => (
                              <tr
                                key={member.id}
                                className="cursor-pointer hover:font-semibold"
                                onClick={() => router.push(`/internal/users/?memberId=${member.id}`)}
                              >
                                <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                  {' '}
                                  <ProfileImage member={member} className="rounded-full" tailwindSize="10" />
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                  {' '}
                                  {member.name}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {member.email}
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                  {member.is_admin ? (
                                    <CheckCircleIcon
                                      className={classNames('h-5 w-5 text-green-600')}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <XCircleIcon
                                      className={classNames('h-5 w-5 text-teams_brand_400')}
                                      aria-hidden="true"
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WorkspacePage;
