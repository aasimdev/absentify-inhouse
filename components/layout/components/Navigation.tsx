import { useAbsentify } from '@components/AbsentifyContext';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';

import { api } from '~/utils/api';
import { Display } from '@prisma/client';

const Navigation = (props: { mobile: boolean; onClose: Function }) => {
  const { t, lang } = useTranslation('common');
  const { in_teams, theme } = useAbsentify();
  const { current_member } = useAbsentify();
  const [navigation, setNavigation] = useState<{ name: string; href: string; current: boolean }[]>([]);
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const workspaceName = workspace
    ? workspace?.name.length > 30
      ? workspace.name.substring(0, 30) + '...'
      : workspace.name
    : null;
  useEffect(() => {
    if (!current_member) return;
    if (
      current_member.microsoft_user_id == 'f4058fbc-db7f-4572-962b-f6192f0e0b6a' ||
      current_member.microsoft_user_id == '8dba184e-2cf4-43a6-b4da-53ee68efac99'
    ) {
      const navigation = [
        { name: t('Start'), href: '/', current: true },
        {
          name: t('My_calendar'),
          href: `/calendar/${current_member.id}`,
          current: false
        },
        {
          name: t('Settings'),
          href: '/settings/organisation/general',
          current: false
        },
        { name: t('Insights'), href: '/insights', current: false },
        { name: 'Statistik', href: '/internal/stats', current: false }
      ];
      if (workspace?.display_logo === Display.ShowLogoAndName && workspaceName && !in_teams) {
        navigation.unshift({ name: workspaceName, href: '/', current: false });
      }
      setNavigation(navigation);
    } else if (current_member.is_admin) {
      const navigation = [
        { name: t('Start'), href: '/', current: true },
        {
          name: t('My_calendar'),
          href: `/calendar/${current_member.id}`,
          current: false
        },
        {
          name: t('Settings'),
          href: '/settings/organisation/general',
          current: false
        },
        { name: t('Insights'), href: '/insights', current: false }
      ];
      if (workspace?.display_logo === Display.ShowLogoAndName && workspaceName && !in_teams) {
        navigation.unshift({ name: workspaceName, href: '/', current: false });
      }
      setNavigation(navigation);
    } else if (
      departments?.find((x) => x.members.find((y) => y.member_id == current_member.id && y.manager_type == 'Manager'))
    ) {
      const navigation = [
        { name: t('Start'), href: '/', current: true },
        {
          name: t('My_calendar'),
          href: `/calendar/${current_member.id}`,
          current: false
        },
        { name: t('Insights'), href: '/insights', current: false }
      ];
      if (workspace?.display_logo === Display.ShowLogoAndName && workspaceName && !in_teams) {
        navigation.unshift({ name: workspaceName, href: '/', current: false });
      }
      setNavigation(navigation);
    } else {
      const navigation = [
        { name: t('Start'), href: '/', current: true },
        {
          name: t('My_calendar'),
          href: `/calendar/${current_member.id}`,
          current: false
        }
      ];
      if (workspace?.display_logo === Display.ShowLogoAndName && workspaceName && !in_teams) {
        navigation.unshift({ name: workspaceName, href: '/', current: false });
      }
      setNavigation(navigation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current_member, lang, departments]);

  const router = useRouter();
  for (let index = 0; index < navigation.length; index++) {
    const element = navigation[index];
    if (!element) continue;
    const v = router.pathname.split('/');
    let { pathname } = router;

    if (v.length > 3) {
      pathname = `/${v[1]}/${v[2]}/${v[3]}`;
    }

    if (pathname == element.href) {
      element.current = true;
    } else {
      element.current = false;
    }
    if (pathname.indexOf('/calendar/') > -1 && element.name == t('My_calendar')) element.current = true;
  }

  if (in_teams && theme == 'dark')
    return (
      <>
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => props.onClose()}
            className={
              props.mobile
                ? classNames(
                    item.current ? 'bg-black bg-opacity-25' : 'hover:bg-teams_brand_800',
                    ' rounded-md py-2 px-3 text-sm font-medium text-white',
                    item.name === workspaceName ? 'mr-6' : ''
                  )
                : classNames(
                    item.current
                      ? 'border-b-2 border-transparent border-teams_brand_600 text-white '
                      : 'text-teams_dark_mode_menu_underline hover:border-teams_dark_mode_menu_underline hover:text-white',
                    ' block border-b-2 border-transparent px-3 pt-2 pb-2  text-base font-medium ',
                    item.name === workspaceName ? 'mr-6' : ''
                  )
            }
          >
            {item.name}
          </Link>
        ))}
      </>
    );
  if (in_teams)
    return (
      <>
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => props.onClose()}
            className={
              props.mobile
                ? classNames(
                    item.current ? 'bg-black bg-opacity-25' : 'hover:bg-teams_brand_800',
                    ' rounded-md py-2 px-3 text-sm font-medium text-white',
                    item.name === workspaceName ? 'mr-6' : ''
                  )
                : classNames(
                    item.current
                      ? 'border-b-2 border-transparent border-teams_brand_800 text-black '
                      : 'text-teams_dark_mode_menu_underline hover:border-teams_dark_mode_menu_underline hover:text-black',
                    ' block border-b-2 border-transparent px-3 pt-2 pb-2  text-base font-medium ',
                    item.name === workspaceName ? 'mr-6' : ''
                  )
            }
          >
            {item.name}
          </Link>
        ))}
      </>
    );
  return (
    <>
      {navigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          onClick={() => props.onClose()}
          className={
            props.mobile
              ? classNames(
                  item.current && item.name !== workspaceName ? 'bg-black bg-opacity-25' : 'hover:bg-teams_brand_800',
                  ' rounded-md py-2 px-3 text-sm font-medium text-white',
                  item.name === workspaceName ? 'mr-6' : ''
                )
              : classNames(
                  item.current && item.name !== workspaceName ? 'bg-black bg-opacity-25' : 'hover:bg-teams_brand_800',
                  ' block rounded-md py-2 px-3 text-base font-medium text-white',
                  item.name === workspaceName ? 'mr-6' : ''
                )
          }
        >
          {item.name}
        </Link>
      ))}
    </>
  );
};
export default Navigation;
