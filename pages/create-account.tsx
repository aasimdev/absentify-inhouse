'use client';

import Head from 'next/head';
import { useState, Fragment, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useAbsentify } from '@components/AbsentifyContext';
import { useRouter } from 'next/router';
import useTranslation from 'next-translate/useTranslation';
import { api } from '~/utils/api';
import { notifyError } from '~/helper/notify';
import Trans from 'next-translate/Trans';

export default function CreateAccount() {
  const router = useRouter();
  const { t } = useTranslation('login');
  const { in_sharePoint, in_teams, current_member } = useAbsentify();
  const create_account_step_1 = api.register.create_account_step_1.useMutation();

  const [open, setOpen] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');
  const [email, setEmail] = useState('');
  const [utmParams, setUtmParams] = useState({});
  const [deviceInfo, setDeviceInfo] = useState({});
  const [pageSource, setPageSource] = useState('');

  const openModal = (url: string) => {
    setIframeSrc(url);
    setOpen(true);
  };

  const generateRandomState = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0]!.toString(36);
  };

  const generateMicrosoftLoginUrl = (email: string, state: string, prompt: boolean = true) => {
    const host = window.location.host; // z.B. "localhost:3000"
    const protocol = window.location.protocol; // z.B. "http:"

    let redirectUri = `${protocol}//${host}/api/auth/signin`;

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
      login_hint: email
    });
    if (prompt) {
      params.set('prompt', 'select_account');
    }

    return `${baseUrl}?${params.toString()}`;
  };

  useEffect(() => {
    if (current_member || in_sharePoint || in_teams) {
      router.push('/');
    }
  }, [current_member, router, in_sharePoint, in_teams]);

  // 4. UTM-Parameter
  useEffect(() => {
    const query = router.query;
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const utmData: Record<string, string> = {};

    utmKeys.forEach((key) => {
      if (query[key]) {
        utmData[key] = query[key] as string;
      }
    });

    setUtmParams(utmData);
  }, [router.query]);

  // 5. Anmelde-Quelle (Seite vor der Anmeldung)
  useEffect(() => {
    setPageSource(window.location.pathname);
  }, []);

  // 7. Device-Informationen
  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    let device = 'Unknown';
    let os = 'Unknown';

    if (/Mobi|Android/i.test(userAgent)) {
      device = 'Mobile';
    } else if (/iPad|Tablet/i.test(userAgent)) {
      device = 'Tablet';
    } else {
      device = 'Desktop';
    }

    // Recognize operating system
    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Mac/i.test(userAgent)) os = 'MacOS';
    else if (/Linux/i.test(userAgent)) os = 'Linux';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/iOS/i.test(userAgent)) os = 'iOS';

    setDeviceInfo({
      device,
      browser: userAgent,
      os: os
    });
  }, []);



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let microsoft_login_state = generateRandomState();
    const registrationData = {
      email,
      referrer: in_teams ? 'teams' : localStorage.getItem('absentify_referrer') || 'Direct',
      utmParams,
      deviceInfo,
      pageSource,
      microsoft_login_state,
      gclid: localStorage.getItem('absentify_gclid') || undefined
    };

    const registrationResult = await create_account_step_1.mutateAsync(registrationData);

    if (registrationResult.redirect === 'next_step') {
      router.push(generateMicrosoftLoginUrl(email, microsoft_login_state));
    } else if (registrationResult.redirect === '/login') {
      notifyError('You already have an account, please sign in.');
      router.push(generateMicrosoftLoginUrl(email, microsoft_login_state, false));
    } else {
      alert(registrationResult.redirect);
    }
    // Successful registration - do something here
  };
  return (
    <>
      <Head>
        <title>{`${t('Register_for_free')} - absentify`}</title>
        <meta name="description" content={t('Register_for_free') + ' - absentify'} />
      </Head>
      {/* Modal für die Darstellung der Privacy Policy und Terms of Service */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-40 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:max-w-4xl sm:w-full sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teams_brand_600 focus:ring-offset-2"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon aria-hidden="true" className="h-6 w-6" />
                    </button>
                  </div>
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    {iframeSrc.includes('privacy') ? 'Privacy Policy' : 'Terms of Service'}
                  </Dialog.Title>
                  <div className="mt-2">
                    <iframe
                      src={iframeSrc}
                      width="100%"
                      height="500px"
                      className="rounded-lg border"
                      title="Document"
                      sandbox="allow-same-origin allow-scripts"
                      referrerPolicy="no-referrer"
                    ></iframe>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <div className="flex min-h-full flex-1 flex-col justify-center px-6  pt-24  lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 transform-gpu overflow-hidden opacity-30 blur-3xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
            }}
            className="ml-[max(50%,38rem)] aspect-[1313/771] w-[82.0625rem] bg-gradient-to-tr from-[#6264a7] to-[#494b83]"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 flex transform-gpu overflow-hidden pt-32 opacity-25 blur-3xl sm:pt-40 xl:justify-end"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
            }}
            className="ml-[-22rem] aspect-[1313/771] w-[82.0625rem] flex-none origin-top-right rotate-[30deg] bg-gradient-to-tr from-[#6264a7] to-[#494b83] xl:ml-0 xl:mr-[calc(50%-12rem)]"
          />
        </div>
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Image alt="absentify" src="/absentify_logo.svg" width={40} height={40} className="mx-auto h-6 w-auto" />

          <h2 className="mt-10 text-center text-4xl font-bold leading-9 tracking-tight text-gray-900">
            {t('Register_for_free')}
          </h2>
          <p className="mt-2 text-center text-lg font-medium text-gray-500">{t('No_credit_card_required')}</p>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t('Microsoft_email_example')}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teams_brand_600 sm:text-sm sm:leading-6"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-teams_brand_600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-teams_brand_500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teams_brand_600"
              >
                {t('Continue')}
              </button>
            </div>
          </form>
          <p className="mt-10 text-center text-sm text-gray-500">
            <Trans
              i18nKey="login:Agree_to_policy"
              components={{
                0: (
                  <button
                    onClick={() => openModal('https://absentify.com/privacy-policy')}
                    className="font-semibold text-teams_brand_600 hover:text-teams_brand_500"
                  />
                ),
                1: (
                  <button
                    onClick={() => openModal('https://absentify.com/terms-and-conditions')}
                    className="font-semibold text-teams_brand_600 hover:text-teams_brand_500"
                  />
                )
              }}
            />
          </p>
          <p className="mt-10 text-center text-sm text-gray-500">
            {t('Already_have_account')}{' '}
            <Link href="/login" className="font-semibold leading-6 text-teams_brand_600 hover:text-teams_brand_500">
              {t('Sign_in')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
