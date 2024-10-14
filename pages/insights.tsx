import Insights from '@modules/insights/Insights';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAbsentify } from '@components/AbsentifyContext';
import { useEffect } from 'react';

import { api } from '~/utils/api';
import useTranslation from "next-translate/useTranslation";

const UsersPage: NextPage = () => {
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { t } = useTranslation('start');
  const { current_member } = useAbsentify();
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const router = useRouter();
  useEffect(() => {
    if (!departments) return;
    if (!current_member) return;
    const isAdmin = current_member?.is_admin;
    const isManager = departments?.some((x) =>
      x.members.find((y) => y.member_id == current_member?.id && y.manager_type == 'Manager')
    );
    if (!isAdmin && !isManager) {
      router.push('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, current_member]);

  return (
    <>
      <Head>
        <title>{`${t('Insights')} - absentify`}</title>
        <meta name="description" content={'Insights - absentify'} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>
      <Insights></Insights>
    </>
  );
};

export default UsersPage;
