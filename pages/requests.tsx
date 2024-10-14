import type { GetServerSideProps, NextPage, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';
import useTranslation from 'next-translate/useTranslation';
import superjson from 'superjson';
import Requests from '../modules/requests/Index';
import { appRouter } from '~/server/api/root';
import { prisma } from '~/server/db';
import { createServerSideHelpers } from '@trpc/react-query/server';

import { api } from '~/utils/api';
import { current_member_Select } from '~/server/api/trpc';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
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
  /*   await helpers.member.current.prefetch(undefined, {});
  await helpers.workspace.current.prefetch(undefined, {});
  await helpers.department.all.prefetch(undefined, {});
  await helpers.member.all.prefetch(undefined, {}); */
  //await helpers.request.toApprove.prefetch(undefined, {});
  return {
    props: { trpcState: helpers.dehydrate() }
  };
};
function Page({}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { t } = useTranslation('requests');
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  return (
    <>
      <Head>
        <title>{`${t('Requests')} - absentify`}</title>
        <meta name="description" content={`${t('Requests')} - absentify`} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>
      <Requests />
    </>
  );
}

export default Page;
