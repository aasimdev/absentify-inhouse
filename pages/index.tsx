import Start from '@modules/start/Start';
import { createServerSideHelpers } from '@trpc/react-query/server';
import type { GetServerSideProps, InferGetServerSidePropsType, NextPage } from 'next';
import Head from 'next/head';
import useTranslation from 'next-translate/useTranslation';
import { appRouter } from '~/server/api/root';
import superjson from 'superjson';
import { prisma } from '~/server/db';
import { convertLocalDateToUTC } from '~/lib/DateHelper';
import { api } from '~/utils/api';
import { current_member_Select } from '~/server/api/trpc';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import { addDays } from 'date-fns';
import { getIronSession } from 'iron-session';
export const getServerSideProps: GetServerSideProps<{}> = async (context) => {
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
  let member = await prisma.member.findUnique({
    where: { id: session.user.member_id },
    select: current_member_Select
  });

  if (!member) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  if (member && member.microsoft_user_id != session.user.microsoft_user_id) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: {
      // infers the `session` as non-nullable
      session: { ...session, user: session.user },
      current_member: member,
      prisma: prisma,
      req: null
    },
    transformer: superjson // optional - adds superjson serialization
  });
  try {
    await helpers.workspace_schedule.current.prefetch(undefined, {});
    await helpers.workspace.current.prefetch(undefined, {});
    await helpers.leave_type.all.prefetch(undefined, {});
    await helpers.member.getFrillSsoToken.prefetch(undefined, {});
    await helpers.user.session.prefetch(undefined, {});
    //await helpers.request.toApprove.prefetch(undefined, {});
    let d = new Date();
    d.setHours(0, 0, 0, 0);
    d = addDays(d, 31);

    const memberCount = await helpers.member.count.fetch({ status: ['ACTIVE', 'INACTIVE'] }, {});
    const departments = await helpers.department.all.fetch(undefined, {});
    const currentMember = await helpers.member.current.fetch(undefined, {});

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let dateRange = { startDate, endDate: d };
    let selectedDepartment = { id: '1', name: '' };
    if (context.query.department_id) {
      const availableDepartment = departments.find((department) => department.id == context.query.department_id);
      if (availableDepartment) {
        selectedDepartment = availableDepartment;
      }
    } else if (currentMember?.default_timeline_department_id) {
      const memDep = departments.find((x) => x.id === currentMember.default_timeline_department_id);
      if (memDep) {
        selectedDepartment = memDep;
      } else if (departments.length === 1 && departments[0])
        selectedDepartment = {
          id: departments[0].id,
          name: departments[0].name
        };
      else if (memberCount > 250 && departments.length > 1 && departments[0]) {
        selectedDepartment = {
          id: departments[0].id,
          name: departments[0].name
        };
      } else selectedDepartment = { id: '1', name: '' };
    } else if (departments.length === 1 && departments[0])
      selectedDepartment = {
        id: departments[0].id,
        name: departments[0].name
      };
    else if (memberCount > 250 && departments.length === 1 && departments[0])
      selectedDepartment = {
        id: departments[0].id,
        name: departments[0].name
      };
    else selectedDepartment = { id: '1', name: '' };

    await helpers.request.allOfUsersByDay.prefetch({
      department_ids: selectedDepartment
        ? selectedDepartment.id != '1' && selectedDepartment.id != '2'
          ? [selectedDepartment.id]
          : null
        : null,
      start: convertLocalDateToUTC(dateRange.startDate),
      end: convertLocalDateToUTC(dateRange.endDate)
    });
    await helpers.public_holiday_day.all.prefetch({
      start: convertLocalDateToUTC(dateRange.startDate),
      end: convertLocalDateToUTC(dateRange.endDate)
    });
  } catch (error) {
    console.error(error);
  }

  return {
    props: { trpcState: helpers.dehydrate() }
  };
};
function Home({}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { t } = useTranslation('start');
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  return (
    <>
      <Head>
        <title>{`${t('Overview')} - absentify`}</title>
        <meta name="description" content={`${t('Overview')} - absentify`} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
        <link rel="manifest" href="/manifest.json"></link>
      </Head>
      <Start />
    </>
  );
}

export default Home;
