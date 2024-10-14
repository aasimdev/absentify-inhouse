import Sigup from '@modules/signup';
import { getIronSession } from 'iron-session';
import { GetServerSideProps } from 'next';
import useTranslation from "next-translate/useTranslation";
import Head from 'next/head';
import { prisma } from '~/server/db';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
export const getServerSideProps: GetServerSideProps<{}> = async (context) => {
  const session = await getIronSession<SessionData>(context.req, context.res, getIronSessionConfig(context.req));

  if (!session.user) {
    session.destroy();
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  if (session.user.member_id) {
    let member = await prisma.member.findUnique({
      where: { id: session.user.member_id },
      select: { id: true, microsoft_user_id: true, microsoft_tenantId: true }
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
  }

  if (!session.user.member_id) {
    let member = await prisma.member.findFirst({
      where: { email: session.user.email.toLowerCase(), microsoft_user_id: null },
      select: { id: true }
    });

    if (member) {
      await prisma.member.update({
        where: { id: member.id },
        data: {
          microsoft_user_id: session.user.microsoft_user_id,
          microsoft_tenantId: session.user.microsoft_tenant_id
        }
      });
      session.destroy();
      return {
        redirect: {
          destination: '/login',
          permanent: false
        }
      };
    }
  }

  if (session.user.member_id) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  return { props: {} };
};
export default function Index() {
  const { t } = useTranslation('signup');
  return (
    <>
      <Head>
        <title>{`${t('sign_up')} - absentify`}</title>
        <meta name="description" content={'Sign up - absentify'} />
        <link rel="icon" href={'/favicon.ico'} />
      </Head>
      <Sigup />
    </>
  );
}
