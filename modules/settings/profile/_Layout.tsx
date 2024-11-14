import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/dist/client/router';
import useTranslation from 'next-translate/useTranslation';
import { classNames } from 'lib/classNames';
import {   ReactNode, useEffect, useState } from 'react';
import { api } from "~/utils/api";

const ProfileLayout: React.FC<{children:ReactNode}> = ( props ) => {
  const { t } = useTranslation('settings_profile');

    const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const [subNavigation, setSubNavigation] = useState([
    { name: t('general'), href: '/settings/profile', current: true },
    { name: t('subNavigation_notifications'), href: '/settings/profile/email_notifications', current: false }
  ]);

  let router = useRouter();
  for (let index = 0; index < subNavigation.length; index++) {
    const element = subNavigation[index];
    if(element){
      if (router.pathname == element.href) {
        element.current = true;
      } else {
        element.current = false;
      }
    }
    
  }

  useEffect(() => {
    if (!workspace) return;
    if (workspace.microsoft_mailboxSettings_read_write == 'ACTIVATED')
      setSubNavigation([
        { name: t('general'), href: '/settings/profile', current: true },
        { name: t('subNavigation_automaticReplies'), href: '/settings/profile/automatic_replies', current: false },
        { name: t('subNavigation_notifications'), href: '/settings/profile/email_notifications', current: false }
      ]);
  }, [workspace]);

  return <>
    <Head>
      <title>{`${t('My_preferences')} - absentify`}</title>
      <meta name="description" content={t('My_preferences') + ' - absentify'} />
      <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : "/favicon.ico"} />
    </Head>
    
    <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
      <aside className="py-6 lg:col-span-3 dark:bg-teams_dark_mode_core">
        <nav className="space-y-1">
          {subNavigation.map((item) => (
            (<Link
              href={item.href}
              key={item.name}
              className={classNames(
                item.current
                  ? 'bg-teams_brand_50 dark:bg-teams_brand_tbody dark:text-gray-200 border-teams_brand_500 text-teams_brand_700 hover:bg-teams_brand_50 dark:hover:bg-teams_brand_dark_400 hover:text-teams_brand_700'
                  : 'border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900 dark:hover:text-gray-200 dark:hover:bg-teams_brand_tbody',
                'group border-l-4 px-3 py-2 flex items-center text-sm font-medium dark:text-gray-200'
              )}
              aria-current={item.current ? 'page' : undefined}>

              <span className="truncate">{item.name}</span>

            </Link>)
          ))}
        </nav>
      </aside>

      <>{props.children}</>
    </div>
 
  </>;
};

export default ProfileLayout;
