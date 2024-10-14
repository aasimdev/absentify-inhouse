import { type NextPage } from 'next';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';
import { api } from '~/utils/api';
import Link from 'next/link';
import { notifyError } from '~/helper/notify';

const MSPayCreated: NextPage = () => {
  const { t, lang } = useTranslation('finishMsPay');
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [showGIF, setShowGIF] = useState<boolean>(false);
  const [ms_payment_token, setMs_payment_token] = useState<string>('');
  const ms_pay = api.workspace.finishMsPay.useMutation();

  async function init(ms_payment_token: string) {
    await ms_pay.mutateAsync(
      {
        x_ms_marketplace_token: ms_payment_token
      },
      {
        async onSuccess() {
          setLoading(false);
          setShowGIF(true);
        },
        onError() {
          notifyError(t('ms_payment_token_error'));

          setLoading(false);
          setShowGIF(false);
        }
      }
    );
    setMs_payment_token('');
  }

  useEffect(() => {
    if (router.query.token + '') {
      setMs_payment_token(router.query.token + '');
    }
  }, [router]);
  useEffect(() => {
    if (ms_payment_token) {
      init(ms_payment_token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms_payment_token]);

  return (
    <div className="bg-white flex justify-center">
      {loading ? (
        <div className=" p-8 ">
          <p className="py-4 text-lg">{t('subscription_in_activation')}</p>
          <div className="flex justify-center">
            <svg
              className=" -ml-1 mr-3 h-10 w-10 animate-spin "
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>
      ) : showGIF ? (
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
                  // await refetchWorkspace();
                  router.push('/settings/organisation/upgrade');
                }}
              >
                <p className="m-auto"> {t('get_started')}</p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className=" p-8 ">
          <p className="py-4 text-center">
            <Link href={'https://portal.azure.com/'}>{t('configure_account_again')}</Link>
            <br />
            {t('configure_now_email')}
          </p>
        </div>
      )}
    </div>
  );
};

export default MSPayCreated;
