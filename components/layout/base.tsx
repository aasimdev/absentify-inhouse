import { useAbsentify } from '@components/AbsentifyContext';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { ArrowTopRightOnSquareIcon, Bars3Icon, BellIcon, CogIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import { useRouter } from 'next/dist/client/router';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useState } from 'react';
import { api } from '~/utils/api';
import NoAccessAlertDialog from './components/NoAccessAlertDialog';
import FrillComponent from './components/FrillComponent';
import Navigation from './components/Navigation';
import ProfileImage from './components/ProfileImage';
import Link from 'next/link';
import { Status } from '@prisma/client';
import { addDays } from 'date-fns';
import PastDueAnnouncement from './components/PastDueAnnouncement';
export const createLogo = (logo: string | null | undefined, size: string) => {
  let picture = null;
  if (logo) {
    const image = logo.split('32x32');
    picture = image[0] + size + image[1];
  }
  return picture;
};

const BaseLayout = (props: { children: any }) => {
  const { in_teams, theme, current_member, pageTitle, setPageTitle } = useAbsentify();
  const router = useRouter();
  const { t, lang } = useTranslation('common');
  const [requests_length, setRequests_lenght] = useState<number>(0);
  const { data: requests } = api.request.toApprove.useQuery(undefined, {
    enabled: current_member != null,
    staleTime: 500
  });

  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member != null
  });
  const { data: frillSsoToken } = api.member.getFrillSsoToken.useQuery(undefined, {
    staleTime: 6000000,
    enabled: current_member != null
  });

  const logo = createLogo(workspace?.company_logo_url, workspace?.company_logo_ratio_square ? '256x256' : '400x80');

  useEffect(() => {
    if (!current_member) return;
    if (!requests) return;
    setRequests_lenght(requests.filter((request) => request.approver.approver_member_id == current_member.id).length);
  }, [requests, current_member]);

  useEffect(() => {
    if (!current_member) return;
    if (current_member.is_admin) return;
    if (!current_member.is_admin && router.asPath.startsWith('/settings/organisation')) {
      router.push('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current_member]);

  useEffect(() => {
    if (router.route == '/') setPageTitle(t('Overview'));
    else if (router.route == '/calendar') setPageTitle(t('Your_calendar'));
    else if (router.route == '/insights') setPageTitle(t('insights'));
    else if (router.route == '/requests') setPageTitle(t('Requests'));
    else if (router.route == '/settings/profile') setPageTitle(t('My_preferences'));
    else if (router.route == '/settings/organisation/general') setPageTitle(t('Settings'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.route, lang]);

  const userNavigation = [
    { name: t('Your_Preferences'), href: '/settings/profile' },
    {
      name: t('Help'),
      href: 'https://support.absentify.com',
      target: '_blank'
    },
    {
      name: t('Submit_idea'),
      href: 'https://feedback.absentify.com/b/7mlokrm5/feature-ideas',
      target: '_blank'
    },
    {
      name: t('Roadmap'),
      href: 'https://feedback.absentify.com/roadmap',
      target: '_blank'
    }

    /*  { name: t('Your_Profile'), href: '#' } */
  ];

  if (
    router.route == '/login' ||
    router.route == '/signup' ||
    router.route == '/teams/auth-start' ||
    router.route == '/teams/auth-end' ||
    router.route == '/microsoft/ms-teams/tab/config' ||
    router.route == '/microsoft/ms-teams/bot/taskmodule'
  ) {
    return props.children;
  }

  // Check whether at least one subscription has had the status 'past_due' for at least 14 days
  const isAnySubscriptionPastDueOverFourteenDays = workspace?.subscriptions.some((sub) => {
    return sub.status === 'past_due' && sub.past_due_since && sub.past_due_since <= addDays(new Date(), -14);
  });

  if (isAnySubscriptionPastDueOverFourteenDays) {
    return <NoAccessAlertDialog text={'Inactive_subscription'} description={'Inactive_subscription_description'} />;
  }

  const onClickItemHandler = async (
    e: React.MouseEvent,
    item: { name: string; href: string; target?: string | undefined }
  ) => {
    e.preventDefault();
    if (item.target) {
      window.open(item.href, item.target);
    } else {
      router.push(item.href);
    }
  };

  if (current_member && current_member.status === Status.INACTIVE)
    return <NoAccessAlertDialog text={'Inactive_account'} description={'Inactive_account_description'} />;
  if (current_member && current_member.status === Status.ARCHIVED)
    return <NoAccessAlertDialog text={'Deactivated_account'} description={'Deactivated_account_description'} />;
  return (
    <div>
      <Disclosure as="div" className="relative overflow-visible bg-teams_brand_700 pb-32">
        {({ open, close }) => {
          return (
            <>
              <nav
                className={classNames(
                  open ? 'bg-teams_brand_900' : 'bg-transparent',
                  'relative z-20 border-b border-teams_brand_500 border-opacity-25 lg:border-none lg:bg-transparent '
                )}
              >
                <div
                  className={classNames(
                    in_teams
                      ? theme == 'dark'
                        ? 'bg-teams_dark_mode'
                        : 'bg-teams_light_mode'
                      : ' mx-auto max-w-screen-2xl px-2 sm:px-6 lg:px-32 xl:px-28 1xl:px-4'
                  )}
                >
                  <div
                    className={classNames(
                      'relative flex items-center justify-between  lg:border-b lg:border-teams_brand_800',
                      in_teams ? 'pr-4' : 'h-16'
                    )}
                  >
                    <div className="flex items-center px-2 lg:px-0">
                      <div className="shrink-0">
                        {!in_teams && (
                          <Link href="/">
                            <div className="flex items-center">
                              {/*eslint-disable-next-line @next/next/no-img-element*/}
                              <img
                                className={classNames(
                                  'block',
                                  workspace?.company_logo_ratio_square || !logo ? 'h-8 w-8' : ' h-10 w-32'
                                )}
                                src={logo ? logo : '/icon.png'}
                                alt="absentify"
                              />
                            </div>
                          </Link>
                        )}
                      </div>
                      <div className="hidden lg:ml-3 lg:block lg:space-x-4">
                        <div className="flex">
                          <Navigation mobile={false} onClose={() => {}} />
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:hidden">
                      {/* Mobile menu button */}
                      <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                        <span className="sr-only">{t('Open_main_menu')}</span>
                        {open ? (
                          <XMarkIcon className="block h-6 w-6 shrink-0" aria-hidden="true" />
                        ) : (
                          <Bars3Icon className="block h-6 w-6 shrink-0" aria-hidden="true" />
                        )}
                      </Disclosure.Button>
                    </div>
                    <div className="hidden lg:ml-4 lg:block">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            router.push('/requests');
                          }}
                          className={classNames(
                            in_teams
                              ? 'text-teams_dark_mode_menu_underline hover:text-teams_brand_500'
                              : 'text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white',
                            'flex-shrink-0 rounded-full p-1 focus:bg-teams_brand_900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams_brand_900'
                          )}
                        >
                          <span className="sr-only">{t('View_notifications')}</span>
                          <div className="relative flex h-6 w-6 items-center justify-center rounded-full ">
                            <BellIcon className="h-6 w-6 " aria-hidden="true" />
                            {requests_length > 0 && (
                              <div className="Frill_Badge Frill_Badge--count  -translate-y-1/6 absolute top-0 left-4 inline-flex -translate-x-[50%]  bg-red-500 text-[8px] justify-center rounded-full py-0.5 font-bold leading-none text-white">
                                <span className=" "></span>
                                {requests_length}
                              </div>
                            )}
                          </div>
                        </button>

                        {frillSsoToken && (
                          <>
                            <FrillComponent frillSsoToken={`${frillSsoToken}`} />
                          </>
                        )}

                        {/* Profile dropdown */}
                        {!current_member && !in_teams && (
                          <span className="ml-3 inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                            <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </span>
                        )}
                        {current_member && (
                          <Menu as="div" className="relative ml-4 shrink-0">
                            <div>
                              <Menu.Button
                                className={classNames(
                                  in_teams
                                    ? 'text-teams_dark_mode_menu_underline hover:text-teams_brand_500'
                                    : 'text-white',
                                  'flex rounded-full text-sm focus:bg-teams_brand_900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams_brand_900'
                                )}
                              >
                                <span className="sr-only">{t('Open_user_menu')}</span>
                                {current_member && !in_teams && (
                                  <ProfileImage member={current_member} tailwindSize="8" />
                                )}
                                {in_teams && <CogIcon className="h-6 w-6 " aria-hidden="true" />}
                              </Menu.Button>
                            </div>
                            <Transition
                              as={Fragment}
                              enter="transition ease-out duration-100"
                              enterFrom="transform opacity-0 scale-95"
                              enterTo="transform opacity-100 scale-100"
                              leave="transition ease-in duration-75"
                              leaveFrom="transform opacity-100 scale-100"
                              leaveTo="transform opacity-0 scale-95"
                            >
                              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                {userNavigation.map((item) => (
                                  <Menu.Item key={item.name}>
                                    {({ active }) => (
                                      <div
                                        className="inline-flex w-full px-4 py-2 text-sm hover:bg-gray-100 text-gray-700 cursor-pointer"
                                        onClick={(event) => {
                                          onClickItemHandler(event, item);
                                        }}
                                      >
                                        <a className={classNames(active ? '  bg-gray-100' : '', 'pr-2')}>{item.name}</a>
                                        {item.name !== t('Your_Preferences') && (
                                          <ArrowTopRightOnSquareIcon height={16} />
                                        )}
                                      </div>
                                    )}
                                  </Menu.Item>
                                ))}
                                {!in_teams && (
                                  <>
                                    <Menu.Item>
                                      <a
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          window.open(
                                            'https://teams.cloud.microsoft.com/dl/launcher/launcher.html?url=%2F_%23%2Fl%2Fapp%2Ffbd349eb-146f-4e94-af76-df4754f40749%3Fsource%3Dapp-source&type=app&deeplinkId=72f43842-b8c0-4aea-9a35-42fe24e9a745&directDl=true&msLaunch=true&enableMobilePage=true',
                                            '_blank'
                                          );
                                        }}
                                        className=" flex flex-1 cursor-pointer hover:bg-gray-100 px-4 py-2 text-sm text-gray-700 "
                                      >
                                        {t('open_in_microsoft_teams')}{' '}
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          x="0px"
                                          y="0px"
                                          width="28"
                                          height="28"
                                          viewBox="0 0 48 48"
                                          style={{ fill: 'black' }}
                                        >
                                          <path
                                            fill="#5059c9"
                                            d="M44,22v8c0,3.314-2.686,6-6,6s-6-2.686-6-6V20h10C43.105,20,44,20.895,44,22z M38,16	c2.209,0,4-1.791,4-4c0-2.209-1.791-4-4-4s-4,1.791-4,4C34,14.209,35.791,16,38,16z"
                                          ></path>
                                          <path
                                            fill="#7b83eb"
                                            d="M35,22v11c0,5.743-4.841,10.356-10.666,9.978C19.019,42.634,15,37.983,15,32.657V20h18	C34.105,20,35,20.895,35,22z M25,17c3.314,0,6-2.686,6-6s-2.686-6-6-6s-6,2.686-6,6S21.686,17,25,17z"
                                          ></path>
                                          <circle cx="25" cy="11" r="6" fill="#7b83eb"></circle>
                                          <path
                                            d="M26,33.319V20H15v12.657c0,1.534,0.343,3.008,0.944,4.343h6.374C24.352,37,26,35.352,26,33.319z"
                                            opacity=".05"
                                          ></path>
                                          <path
                                            d="M15,20v12.657c0,1.16,0.201,2.284,0.554,3.343h6.658c1.724,0,3.121-1.397,3.121-3.121V20H15z"
                                            opacity=".07"
                                          ></path>
                                          <path
                                            d="M24.667,20H15v12.657c0,0.802,0.101,1.584,0.274,2.343h6.832c1.414,0,2.56-1.146,2.56-2.56V20z"
                                            opacity=".09"
                                          ></path>
                                          <linearGradient
                                            id="DqqEodsTc8fO7iIkpib~Na_zQ92KI7XjZgR_gr1"
                                            x1="4.648"
                                            x2="23.403"
                                            y1="14.648"
                                            y2="33.403"
                                            gradientUnits="userSpaceOnUse"
                                          >
                                            <stop offset="0" stopColor="#5961c3"></stop>
                                            <stop offset="1" stopColor="#3a41ac"></stop>
                                          </linearGradient>
                                          <path
                                            fill="url(#DqqEodsTc8fO7iIkpib~Na_zQ92KI7XjZgR_gr1)"
                                            d="M22,34H6c-1.105,0-2-0.895-2-2V16c0-1.105,0.895-2,2-2h16c1.105,0,2,0.895,2,2v16	C24,33.105,23.105,34,22,34z"
                                          ></path>
                                          <path
                                            fill="#fff"
                                            d="M18.068,18.999H9.932v1.72h3.047v8.28h2.042v-8.28h3.047V18.999z"
                                          ></path>
                                        </svg>
                                      </a>
                                    </Menu.Item>
                                  </>
                                )}

                                <Menu.Item>
                                  <a
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      location.href = location.origin + '/api/auth/signout';
                                    }}
                                    className={'block cursor-pointer hover:bg-gray-100 px-4 py-2 text-sm text-gray-700'}
                                  >
                                    {t('Sign_out')}
                                  </a>
                                </Menu.Item>
                              </Menu.Items>
                            </Transition>
                          </Menu>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Disclosure.Panel className="bg-teams_brand_900 lg:hidden">
                  <div className="flex flex-wrap px-2 pt-2 pb-3">
                    <Navigation mobile={true} onClose={() => close()} />
                  </div>
                  <div className="border-t border-teams_brand_800 pt-4 pb-3">
                    <div className="flex items-center px-2 lg:px-4">
                      <div className="shrink-0">
                        {current_member && !in_teams && <ProfileImage member={current_member} tailwindSize="10" />}
                      </div>
                      <div className="ml-3">
                        <div className="text-base font-medium text-white">{current_member?.name}</div>
                        <div className="text-sm font-medium text-teams_brand_200">{current_member?.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          router.push('/requests');
                          close();
                        }}
                        className="ml-auto shrink-0 rounded-full p-1 text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white focus:bg-teams_brand_900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams_brand_900"
                      >
                        <span className="sr-only"> {t('View_notifications')} </span>
                        <BellIcon
                          className={`h-6 w-6${requests_length > 0 ? ' text-red-600' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    <div className="mt-3 px-2">
                      {!in_teams &&
                        userNavigation.map((item) => (
                          <a
                            key={item.name}
                            onClick={async (e) => {
                              e.preventDefault();
                              if (item.target) {
                                window.open(item.href, item.target);
                              } else {
                                router.push(item.href);
                                close();
                              }
                            }}
                            className=" flex cursor-pointer rounded-md px-3 py-2 text-base font-medium text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white"
                          >
                            {item.name}
                            {item.name !== t('Your_Preferences') && (
                              <ArrowTopRightOnSquareIcon className="ml-2 mt-1" height={16} />
                            )}
                          </a>
                        ))}
                      {in_teams &&
                        userNavigation.map((item) => (
                          <a
                            key={item.name}
                            onClick={async (e) => {
                              e.preventDefault();
                              if (item.target) {
                                window.open(item.href, item.target);
                              } else {
                                router.push(item.href);
                                close();
                              }
                            }}
                            className=" flex cursor-pointer rounded-md px-3 py-2 text-base font-medium text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white"
                          >
                            {item.name}{' '}
                            {item.name !== t('Your_Preferences') && (
                              <ArrowTopRightOnSquareIcon className="ml-2 mt-1" height={16} />
                            )}
                          </a>
                        ))}
                      <a
                        className=" block cursor-pointer rounded-md px-3 py-2 text-base font-medium text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white"
                        onClick={() => {
                          location.href = location.origin + '/api/auth/signout';
                        }}
                      >
                        {t('Sign_out')}
                      </a>
                    </div>
                  </div>
                </Disclosure.Panel>
              </nav>

              <div
                aria-hidden="true"
                className={classNames(
                  open ? 'bottom-0' : 'inset-y-0',
                  '-trangray-x-1/2 absolute inset-x-0 w-full transform overflow-hidden lg:inset-y-0'
                )}
              >
                <div className="absolute inset-0 flex">
                  <div className="h-full w-1/2 bg-teams_brand_1001" />
                  <div className="h-full w-1/2" style={{ backgroundColor: '#494b83' }} />
                </div>
                <div className="relative flex justify-center">
                  <svg
                    className="shrink-0"
                    width={1750}
                    height={308}
                    viewBox="0 0 1750 308"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M284.161 308H1465.84L875.001 182.413 284.161 308z" fill="#7072bb" />
                    <path d="M1465.84 308L16.816 0H1750v308h-284.16z" fill="#494b83" />
                    <path d="M1733.19 0L284.161 308H0V0h1733.19z" fill="#37385c" />
                    <path d="M875.001 182.413L1733.19 0H16.816l858.185 182.413z" fill="#3d3e66" />
                  </svg>
                </div>
              </div>
              <header className="relative py-10">
                <div className="mx-auto max-w-screen-2xl px-2 sm:px-6 lg:px-32 xl:px-28 1xl:px-6">
                  <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
                </div>
              </header>
            </>
          );
        }}
      </Disclosure>
      <main className="relative -mt-32 mb-5">
        <div className={`mx-auto max-w-screen-2xl  px-2 pb-6 sm:px-6 lg:px-32 lg:pb-16 xl:px-28 1xl:px-2`}>
          <div className="overflow-auto rounded-lg bg-white shadow">
            {!current_member && router.route != '/' && (
              <div className="mx-auto w-full rounded-md border p-4">
                <div className="flex animate-pulse space-x-4">
                  <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 rounded bg-gray-700"></div>
                    <div className="h-2 rounded bg-gray-700"></div>
                    <div className="h-2 rounded bg-gray-700"></div>
                  </div>
                </div>
              </div>
            )}

            {(current_member || router.route == '/') && props.children}
          </div>
        </div>
      </main>
    {/*      <Announcment /> */}
      <PastDueAnnouncement />
    </div>
  );
};

export default BaseLayout;
