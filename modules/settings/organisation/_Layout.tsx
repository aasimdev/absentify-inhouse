import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/dist/client/router';
import useTranslation from 'next-translate/useTranslation';
import { classNames } from 'lib/classNames';
import { ReactNode, useEffect, useState } from 'react';
import { useAbsentify } from '@components/AbsentifyContext';
import { api } from '~/utils/api';

const OrganisationLayout: React.FC<{ children: ReactNode }> = (props) => {
  const { t } = useTranslation('settings_organisation');
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { teamsMobile } = useAbsentify();
  const [subNavigation, setSubNavigation] = useState<{ name: string; href: string; current: boolean }[]>([
    { name: t('subNavigation_general'), href: '/settings/organisation/general', current: true },
    { name: t('subNavigation_Users'), href: '/settings/organisation/users', current: false },
    { name: t('subNavigation_Allowances'), href: '/settings/organisation/allowances', current: false },
    { name: t('subNavigation_Leave_types'), href: '/settings/organisation/leave_types', current: false },
    { name: t('subNavigation_Departments'), href: '/settings/organisation/departments', current: false },
    { name: t('subNavigation_Public_holidays'), href: '/settings/organisation/public_holidays', current: false },
    { name: t('subNavigation_Microsoft'), href: '/settings/organisation/microsoft', current: false },
    { name: t('subNavigation_Export'), href: '/settings/organisation/export', current: false },
    { name: t('subNavigation_Delete'), href: '/settings/organisation/delete', current: false }
  ]);

  let router = useRouter();
  for (let index = 0; index < subNavigation.length; index++) {
    const element = subNavigation[index];
    if (!element) continue;
    if (router.pathname.startsWith(element.href)) {
      element.current = true;
    } else {
      element.current = false;
    }
  }

  useEffect(() => {
    if (!teamsMobile)
      setSubNavigation([
        { name: t('subNavigation_general'), href: '/settings/organisation/general', current: true },
        { name: t('subNavigation_Billing'), href: '/settings/organisation/billing', current: false },
        { name: t('subNavigation_Upgrade'), href: '/settings/organisation/upgrade', current: false },
        { name: t('subNavigation_Users'), href: '/settings/organisation/users', current: false },
        { name: t('subNavigation_Allowances'), href: '/settings/organisation/allowances', current: false },
        { name: t('subNavigation_Leave_types'), href: '/settings/organisation/leave_types', current: false },
        { name: t('subNavigation_Departments'), href: '/settings/organisation/departments', current: false },
        { name: t('subNavigation_Public_holidays'), href: '/settings/organisation/public_holidays', current: false },
        { name: t('subNavigation_Microsoft'), href: '/settings/organisation/microsoft', current: false },
        { name: t('subNavigation_Integrations'), href: '/settings/organisation/integrations', current: false },
        { name: t('subNavigation_Export'), href: '/settings/organisation/export', current: false },
        { name: t('subNavigation_Delete'), href: '/settings/organisation/delete', current: false }
      ]);
  }, [teamsMobile]);

  return (
    <>
      <Head>
        <title>{`${t('Settings')} - absentify`}</title>
        <meta name="description" content={t('Settings') + ' - absentify'} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>
      <div className="divide-y divide-gray-200 dark:divide-teams_brand_dark_500 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x ">
        <aside className="py-6 lg:col-span-2">
          <nav className="space-y-1 grid grid-cols-2 lg:grid-cols-1">
            {subNavigation.map((item) => (
              <Link
                href={item.href}
                key={item.name}
                className={classNames(
                  item.current
                    ? 'bg-teams_brand_50 border-teams_brand_500 text-teams_brand_700 dark:bg-teams_brand_700 hover:bg-teams_brand_50 hover:text-teams_brand_700 hover:dark:bg-teams_brand_700'
                    : 'border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900 ',
                  'group border-l-2 blg:border-l-4 px-3 py-2 flex items-center text-sm font-medium dark:text-gray-200 hover:dark:bg-teams_brand_700'
                )}
                aria-current={item.current ? 'page' : undefined}
              >
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {props.children}
      </div>
    </>
  );
};

export default OrganisationLayout;
