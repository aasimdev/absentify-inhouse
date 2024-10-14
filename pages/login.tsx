import { useAbsentify } from '@components/AbsentifyContext';
import * as Sentry from '@sentry/browser';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import Loader from '@components/calendar/Loader';
import AlertModal from '@components/alertModal';
const Login = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const { teamsMobile, in_teams, ssoLoading } = useAbsentify();
  const { t, lang } = useTranslation('login');
  const { error, redirect_after_login, sp_token } = useRouter().query;
  const SignInError = ({ error }: any) => {
    const errorMessage = error.error || error;
    return <div className="mt-5 text-center text-base text-red-600">{errorMessage}</div>;
  };

  const generateRandomState = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0]!.toString(36);
  };

  const generateMicrosoftLoginUrl = () => {
    const host = window.location.host; // z.B. "localhost:3000"
    const protocol = window.location.protocol; // z.B. "http:"

    let redirectUri = `${protocol}//${host}/api/auth/signin`;
    let state = generateRandomState();
    const validSubdomainPattern = /^absentify-dev.*\.azurewebsites\.net$/;
    if (validSubdomainPattern.test(host)) {
      redirectUri = `https://app.absentify.com/api/auth/dev_signin`;
      state = `${protocol}//${host}/api/auth/signin`;
    }

    const baseUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
      scope: 'openid email profile offline_access User.Read',
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state,
      prompt: 'select_account'
    });

    return `${baseUrl}?${params.toString()}`;
  };
  const [showAlert, setShowAlert] = useState(false);
  useEffect(() => {
    if (redirect_after_login) {
      localStorage.setItem('redirect_after_login', redirect_after_login as string);
    }
  }, [redirect_after_login]);
  useEffect(() => {
    if (sp_token) {
      if (redirect_after_login) {
        localStorage.setItem('redirect_after_login', redirect_after_login as string);
      }
      location.href = location.origin + '/api/auth/signin?sp_token=' + sp_token;
    }
  }, [sp_token]);
  useEffect(() => {
    console.log('in_teams', in_teams);
  }, [in_teams]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <a href="https://absentify.com">
            {/*eslint-disable-next-line @next/next/no-img-element*/}
            <img className="mx-auto h-12 w-auto" src="/absentify_logo.svg" alt="absentify.com" />
          </a>
          {in_teams && (
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{t('Sign_in_to_your_account')}</h2>
          )}
        </div>
        <form className="mt-8 space-y-6" action="#" method="POST">
          <div>
            {!teamsMobile && <p className="mb-2 text-center text-sm">{t('no_credit_card_slogan')}</p>}
            <button
              disabled={loading || ssoLoading}
              onClick={async (e) => {
                e.preventDefault();
                setLoading(true);

                if (in_teams) {
                  // Show a popup dialogue prompting the user to consent to the required API permissions. This opens ConsentPopup.js.
                  // Learn more: https://docs.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/auth-tab-aad#initiate-authentication-flow

                  const { authentication, app } = await import('@microsoft/teams-js');
                  await app.initialize();
                  try {
                    console.log(' authentication.authenticate');
                    const result: any = await authentication.authenticate({
                      url: location.origin + '/teams/auth-start.html',
                      width: 600,
                      height: 535
                    });
                    console.log('authentication result', result);

                    if (result && result.code) {
                      location.href = location.origin + '/api/auth/signin?code=' + result.code;
                    } else {
                      console.log('teams-auth-popup', JSON.stringify(result));
                      setLoading(false);
                      location.href = location.origin + '/login';
                    }
                  } catch (reason) {
                    setLoading(false);
                    console.log(reason);

                    Sentry.captureException(reason);
                    setShowAlert(true);
                    location.href = location.origin;
                  }
                } else {
                  location.href = generateMicrosoftLoginUrl();
                }
              }}
              type="submit"
              className="roundedmd bg-teamsteams_brand_600 group relative flex w-full justify-center border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                {/*eslint-disable-next-line @next/next/no-img-element*/}
                <img className="mx-auto h-5 w-5" src="/microsoft_logo_icon_147261.svg" alt="microsoft.com" />
              </span>
              {(loading || ssoLoading) && (
                <div className="-ml-1 mr-3">
                  <Loader />
                </div>
              )}
              {t('login')}
            </button>{' '}
            {/* Error message */}
            {error && !in_teams && <SignInError error={error} />}
          </div>
          {showAlert && (
            <AlertModal
              text={'Error on login, please contact support'}
              onClose={() => {
                setShowAlert(false);
              }}
            />
          )}
        </form>
      </div>
      <>
        <Script
          id="profitwell-js"
          data-pw-auth="a11a7cb143dfe8ae0404793a457d03c4"
          dangerouslySetInnerHTML={{
            __html: `
            (function(i,s,o,g,r,a,m){i[o]=i[o]||function(){(i[o].q=i[o].q||[]).push(arguments)};
            a=s.createElement(g);m=s.getElementsByTagName(g)[0];a.async=1;a.src=r+'?auth='+
            s.getElementById(o+'-js').getAttribute('data-pw-auth');m.parentNode.insertBefore(a,m);
            })(window,document,'profitwell','script','https://public.profitwell.com/js/profitwell.js');
    
            profitwell('start', {});`
          }}
        />
      </>
    </div>
  );
};
export default Login;
