import { type NextPage } from 'next';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { useEffect } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

import { api } from '~/utils/api';

const SubscriptionCreated: NextPage = () => {
  const { t, lang } = useTranslation('common');
  const router = useRouter();
  const { data: workspace, refetch: refetchWorkspace } =
    api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  async function reloadData() {
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    await refetchWorkspace();
    await delay(3000);
    await refetchWorkspace();
  }
  useEffect(() => {
    reloadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl py-12 px-4 text-center sm:px-6 lg:py-16 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl sm:tracking-tight">
          <span className="block">{t('absentify_plan_ready_to_use')}</span>
        </h2>
        <ConfettiExplosion />
        <iframe
          src="https://giphy.com/embed/ZfK4cXKJTTay1Ava29"
          width="480"
          height="440"
          frameBorder="0"
          className="giphy-embed mx-auto mt-8"
          allowFullScreen
        ></iframe>
        <div className="mt-8 flex justify-center">
          <div className="w-36">
            <button
              type="button"
              className="inline-flex w-full items-center  rounded-md border border-white bg-teams_brand_foreground_bg py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
              onClick={async (e) => {
                e.preventDefault();
                await refetchWorkspace();
                router.push('/settings/organisation/upgrade');
              }}
            >
              <p className="m-auto"> {t('get_started')}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCreated;
