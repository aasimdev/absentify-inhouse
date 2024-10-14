import CalendarView from '@modules/calendar/CalendarView';
import type { GetServerSideProps, NextPage, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { prisma } from '~/server/db';
import { CheckCurrentUserHasPermissionToCreateRequest } from '~/lib/requestUtilities';
import { api } from '~/utils/api';
import { current_member_Select } from '~/server/api/trpc';
import { getIronSession } from 'iron-session';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import { useAbsentify } from '@components/AbsentifyContext';

export const getServerSideProps: GetServerSideProps<{ member_id: string }> = async (context) => {
  const session = await getIronSession<SessionData>(context.req, context.res, getIronSessionConfig(context.req));
  if (!session.user || !session.user.member_id) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }
  let current_member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: current_member_Select
  });

  if (!current_member) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }
  if (current_member && current_member.microsoft_user_id != session.user.microsoft_user_id) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  if (!context.query.member_id) {
    return {
      redirect: {
        destination: '/calendar/' + current_member.id,
        permanent: false
      }
    };
  }
  const member_id = context.query.member_id + '';
  const member = await prisma.member.findUnique({
    where: { id: member_id },
    select: {
      id: true,
      has_approvers: { select: { approver_member_id: true } },
      departments: {
        select: { department: { select: { members: { select: { member_id: true, manager_type: true } } } } }
      }
    }
  });

  if (!member) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  const isCurrentUserHasPermissionToCreateRequest = CheckCurrentUserHasPermissionToCreateRequest(
    current_member,
    member
  );
  if (
    !isCurrentUserHasPermissionToCreateRequest &&
    !member.has_approvers.find((x) => x.approver_member_id == current_member?.id)
  ) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: current_member.workspace_id },
      select: { privacy_show_calendarview: true }
    });
    if (!workspace?.privacy_show_calendarview) {
      return {
        redirect: {
          destination: '/',
          permanent: false
        }
      };
    }
  }

  return {
    props: { member_id: member_id }
  };
};
function Page({ member_id }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { t } = useTranslation('calendar');
  const router = useRouter();
  const { pageTitle } = useAbsentify();
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const { request_id } = router.query;
  return (
    <>
      <Head>
        <title>{`${pageTitle} - absentify`}</title>
        <meta name="description" content={`${t('Your_calendar')} - absentify`} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>

      <CalendarView member_id={member_id} request_id={request_id ? `${request_id}` : undefined}></CalendarView>
    </>
  );
}

export default Page;
