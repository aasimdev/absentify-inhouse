import Loader from '@components/calendar/Loader';
import ProfileImage from '@components/layout/components/ProfileImage';
import { ChevronLeftIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Status } from "@prisma/client";

import useDebounce from 'helper/useDebounce';
import { classNames } from 'lib/classNames';
import type { NextPage } from 'next';
import useTranslation from "next-translate/useTranslation";
import { useRouter } from 'next/dist/client/router';
import Head from 'next/head';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';

import { api } from '~/utils/api';

const tabs = [{ name: 'Profile', href: '#', current: true }];

const UsersPage: NextPage = () => {
  const { t } = useTranslation('start');
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string | undefined>('');
  const debouncedSearchTerm: string = useDebounce<string>(search as string, 500);
  const { memberId } = router.query;
  const { data: members, isLoading: isSearchLoading } = api.administration.findMemberByEmail.useQuery({
    email: debouncedSearchTerm
  });

  const { data: currentMember } = api.administration.getMemberById.useQuery(
    { id: `${memberId}` },
    {
      enabled: !!memberId
    }
  );
  const searchHandler = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchRef.current?.value?.toLowerCase());
  };
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });

  useEffect(() => {
    if (!members) return;
    if (!memberId) return;
    router.push(`/internal/users/?memberId=${memberId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  return (
    <>
      <Head>
        <title>{`${t('Admin_Panel')} - absentify`}</title>
        <meta name="description" content="Admin Panel - absentify" />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>
      <div className="divide-y divide-gray-200 lg:col-span-9">
        <div className="relative z-0 flex flex-1 overflow-hidden">
          <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none xl:order-last">
            {/* Breadcrumb */}
            <nav className="flex items-start px-4 py-3 sm:px-6 lg:px-8 xl:hidden" aria-label="Breadcrumb">
              <a href="#" className="inline-flex items-center space-x-3 text-sm font-medium text-gray-900">
                <ChevronLeftIcon className="-ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                <span>Directory</span>
              </a>
            </nav>

            <article className="">
              {/* Profile header */}
              {currentMember && (
                <div>
                  <div>
                    <div className="h-20 w-full bg-teams_brand_50 object-cover lg:h-32" />
                  </div>
                  <div className="mx-auto -mt-16 max-w-5xl px-4 sm:px-6 lg:px-8 ">
                    <div className="mt-2 sm:mt-6 sm:flex sm:items-end sm:space-x-5">
                      <div
                        className="mt-2 flex  rounded-full border-[10px] border-white "
                        onClick={() => {
                          location.href = location.origin + '/api/auth/impersonate?memberId=' + currentMember.id;
                        }}
                      >
                        <ProfileImage member={currentMember} className="rounded-full" tailwindSize="40" />
                      </div>
                      <div className="mb-8 sm:flex sm:min-w-0 sm:flex-1 sm:items-center sm:justify-end sm:space-x-6 sm:pb-1">
                        <div className=" min-w-0 flex-1 sm:hidden 2xl:block">
                          <h1 className="truncate text-2xl font-bold text-gray-900">{currentMember.name}</h1>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 hidden min-w-0 flex-1 sm:block 2xl:hidden">
                      <h1 className="truncate text-2xl font-bold text-gray-900">{currentMember.name}</h1>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="mt-6 sm:mt-2 2xl:mt-5">
                <div className="border-b border-gray-200">
                  <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                      {tabs.map((tab) => (
                        <a
                          key={tab.name}
                          href={tab.href}
                          className={classNames(
                            tab.current
                              ? 'border-teams_brand_400 text-gray-900'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                            'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                          )}
                          aria-current={tab.current ? 'page' : undefined}
                        >
                          {tab.name}
                        </a>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              {/* Description list */}
              {currentMember && (
                <div className="mx-auto my-6 h-[50vh] max-w-5xl overflow-y-scroll px-4 sm:px-6 lg:px-8">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    {Object.keys(currentMember).map((field, i) => (
                      <div
                        key={field + i}
                        className={` ${
                          field == 'is_approver_of' || field == 'has_approvers' ? ' hidden ' : ' sm:col-span-1 '
                        } `}
                      >
                        <dt className="inline-flex text-sm font-medium text-gray-500">
                          {field == 'name'
                            ? 'Name'
                            : field == 'user_id'
                            ? 'User ID'
                            : field == 'email'
                            ? 'Email'
                            : field == 'user'
                            ? 'Language'
                            : field == 'is_admin'
                            ? 'Admin'
                            : field == 'status'
                            ? 'Status'
                            : field == 'id'
                            ? 'ID'
                            : field == 'workspace'
                            ? 'Workspace'
                            : ''}
                          {field == 'is_admin' && (
                            <span>
                              {currentMember.is_admin ? (
                                <CheckCircleIcon
                                  className={classNames(' ml-2 h-5 w-5 text-green-600')}
                                  aria-hidden="true"
                                />
                              ) : (
                                <XCircleIcon
                                  className={classNames('ml-2 h-5 w-5 text-teams_brand_400')}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          )}
                          {field == 'status' && (
                            <span>
                              {currentMember.status === Status.ARCHIVED ? (
                                <CheckCircleIcon
                                  className={classNames(' ml-2 h-5 w-5 text-green-600')}
                                  aria-hidden="true"
                                />
                              ) : (
                                <XCircleIcon
                                  className={classNames('ml-2 h-5 w-5 text-teams_brand_400')}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          )}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {field == 'email' ? (
                            currentMember.email
                          ) : field == 'workspace' ? (
                            <Link
                              href={`/internal/workspace/?workspaceId=${currentMember.workspace.id}`}
                              legacyBehavior
                            >
                              <p className="cursor-pointer hover:text-teams_brand_600">
                                {currentMember.workspace.name}
                              </p>
                            </Link>
                          ) : field == 'name' ? (
                            currentMember.name
                          ) : field == 'id' ? (
                            currentMember.id
                          ) : field == 'user' ? (
                            currentMember?.language?.toUpperCase()
                          ) : (
                            ''
                          )}
                        </dd>
                      </div>
                    ))}
                    {Object.keys(currentMember).map((field, i) => (
                      <div
                        key={field + i}
                        className={` ${
                          field == 'is_approver_of' || field == 'has_approvers' ? ' sm:col-span-2 ' : ' hidden '
                        } `}
                      >
                        <dt className="inline-flex text-sm font-medium text-gray-500">
                          {field == 'has_approvers' ? 'Approver(s)' : field == 'is_approver_of' ? 'Approver of' : ''}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {field == 'has_approvers' ? (
                            <div className="">
                              <div className="flex shrink-0 -space-x-1">
                                <table className="min-w-full divide-y divide-gray-300">
                                  <thead>
                                    <tr>
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
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 bg-white">
                                    {currentMember &&
                                      currentMember?.has_approvers?.map((member, memberIdx) => (
                                        <tr
                                          key={member.approver_member.id}
                                          className={memberIdx % 2 === 0 ? undefined : 'bg-gray-50 '}
                                        >
                                          <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                            {member.approver_member.name}
                                          </td>
                                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                            {member.approver_member.name}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : field == 'is_approver_of' ? (
                            <div className="">
                              <div className="flex shrink-0 -space-x-1">
                                <table className="min-w-full divide-y divide-gray-300">
                                  <thead>
                                    <tr>
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
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 bg-white">
                                    {currentMember &&
                                      currentMember.is_approver_of?.map((member, memberIdx) => (
                                        <tr
                                          key={member.approver_member.id + memberIdx}
                                          className={memberIdx % 2 === 0 ? undefined : 'bg-gray-50 '}
                                        >
                                          <td className=" whitespace-nowrap px-3 py-4 text-sm text-gray-500 sm:table-cell">
                                            {member.approver_member.name}
                                          </td>
                                          <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 lg:table-cell">
                                            {member.approver_member.name}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            ''
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </article>
          </main>
          <aside className="hidden h-[95vh] w-96 shrink-0 overflow-y-scroll border-r border-gray-200 xl:order-first xl:flex xl:flex-col">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-gray-900">Users</h2>
              <form className="mt-6 flex space-x-4" action="#">
                <div className="min-w-0 flex-1">
                  <label htmlFor="search" className="sr-only">
                    Search
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="search"
                      name="search"
                      id="search"
                      className="block w-full rounded-md border-gray-300 pl-10 focus:border-teams_brand_400 focus:ring-teams_brand_400 sm:text-sm"
                      placeholder="Search"
                      ref={searchRef}
                      onChange={searchHandler}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_400 focus:ring-offset-2"
                  onClick={searchHandler}
                >
                  <FunnelIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  <span className="sr-only">Search</span>
                </button>
              </form>
            </div>
            {/* Directory list */}
            <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Directory">
              <ul role="list" className="relative z-0 divide-y divide-gray-200 dark:divide-teams_brand_border">
                {isSearchLoading && (
                  <div className="mb-3  ml-10">
                    <Loader />
                  </div>
                )}
                {members &&
                  members.map((member) => (
                    <li key={member.id}>
                      <div
                        className="relative flex items-center space-x-3 rounded px-6 py-5 focus-within:ring-2 focus-within:ring-inset focus-within:ring-teams_brand_400 hover:bg-gray-50"
                        onClick={() => {
                          router.push(`/internal/users/?memberId=${member.id}`);
                        }}
                      >
                        <div className="shrink-0">
                          <ProfileImage member={member} className="rounded-full" tailwindSize="10" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <a href="#" className="focus:outline-none">
                            {/* Extend touch target to entire panel */}
                            <span className="absolute inset-0" aria-hidden="true" />
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
};

export default UsersPage;
