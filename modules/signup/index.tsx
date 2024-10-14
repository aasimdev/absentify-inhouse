import icon from '../../public/icon.png';
import Image from 'next/legacy/image';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { JoinModal } from './JoinModal';
import AccessRequestSuccessModal from './AccessRequestSuccessModal';
import RegisterModal from './Register';
import { useAbsentify } from '@components/AbsentifyContext';
import { api } from '~/utils/api';
import setLanguage from 'next-translate/setLanguage';

export default function Sigup() {
  const { t } = useTranslation('signup');
  const { in_teams, current_member } = useAbsentify();

  const { data: session, isSuccess: session_isSuccess } = api.user.session.useQuery(undefined, {
    staleTime: 6000
  });
  const { data: invitation } = api.register.checkIfInvitationExists.useQuery();
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [openJoinModal, setOpenJoinModal] = useState(false);
  const [openSucessModal, setOpenSucessModal] = useState(false);
  const router = useRouter();
  const { data: ipData } = api.register.getCountry.useQuery(undefined, {
    staleTime: 60000
  });
  //const editUser = api.user.edit.useMutation();
  useEffect(() => {
    if (ipData) {
      let language: string = ipData?.languages ? ipData.languages.slice(0, 2) : 'en';

      if (language.toLowerCase() == 'de') {
        setLanguage('de');
      }
    }
  }, [ipData]);

  useEffect(() => {
    if (invitation) {
      location.href = location.origin + '/api/auth/signout';
    }
  }, [invitation]);

  useEffect(() => {
    if (session_isSuccess) {
      if (!session) router.push('/login', '/login', { locale: router.locale });
      if (session?.member_id) router.push('/', '/', { locale: router.locale });
    }
  }, [session_isSuccess, session]);

  return (
    <>
      <div className="relative bg-gray-50 overflow-hidden min-h-screen">
        <div className="hidden sm:block sm:absolute sm:inset-y-0 sm:h-full sm:w-full" aria-hidden="true">
          <div className="relative h-full max-w-7xl mx-auto">
            <svg
              className="absolute right-full transform translate-y-1/4 translate-x-1/4 lg:translate-x-1/2"
              width={404}
              height={784}
              fill="none"
              viewBox="0 0 404 784"
            >
              <defs>
                <pattern
                  id="f210dbf6-a58d-4871-961e-36d5016a0f49"
                  x={0}
                  y={0}
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <rect x={0} y={0} width={4} height={4} className="text-gray-200" fill="currentColor" />
                </pattern>
              </defs>
              <rect width={404} height={784} fill="url(#f210dbf6-a58d-4871-961e-36d5016a0f49)" />
            </svg>
            <svg
              className="absolute left-full transform -translate-y-3/4 -translate-x-1/4 md:-translate-y-1/2 lg:-translate-x-1/2"
              width={404}
              height={784}
              fill="none"
              viewBox="0 0 404 784"
            >
              <defs>
                <pattern
                  id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                  x={0}
                  y={0}
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <rect x={0} y={0} width={4} height={4} className="text-gray-200" fill="currentColor" />
                </pattern>
              </defs>
              <rect width={404} height={784} fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)" />
            </svg>
          </div>
        </div>
        <div className="relative pt-6 pb-16 sm:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="relative flex items-center justify-between sm:h-10 md:justify-center" aria-label="Global">
              <div className="flex items-center flex-1 md:absolute md:inset-y-0 md:left-0">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <p>
                    <span className="sr-only">absentify</span>
                    {!in_teams && (
                      <Image
                        src={icon}
                        onClick={() => {
                          location.href = location.origin + '/api/auth/signout';
                        }}
                        alt="absentify.com"
                        width={40}
                        height={40}
                        className="h-8 w-auto sm:h-10"
                      />
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex md:space-x-10"></div>
              <div className="hidden md:absolute md:flex md:items-center md:justify-end md:inset-y-0 md:right-0">
                <span className="inline-flex rounded-md shadow"></span>
              </div>
            </nav>
          </div>

          <main className="mt-16 mx-auto max-w-7xl px-4 sm:mt-24">
            <div className="text-center">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block xl:inline">{t('Welcome') + ' ' + session?.name}</span> <span>👋</span>
              </h1>
              <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                {t('Welcome_description')}
              </p>
              <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                {t('Welcome_first_step')}
              </p>
              <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
                <div className="rounded-md shadow ">
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenRegisterModal(true);
                    }}
                    className="cursor-pointer w-full min-h-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_foreground_1 md:py-4 md:text-lg md:px-10"
                  >
                    {t('Register_a_new_company')}
                  </a>
                </div>
                <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenJoinModal(true);
                    }}
                    className="cursor-pointer w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-teams_brand_foreground_1 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
                  >
                    {t('Join_an_existing_company')}
                  </a>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="mt-8 md:mt-0 md:order-1">
            <p className="text-center md:text-left text-base text-gray-400">
              &copy; 2023 absentify, All rights reserved.
            </p>
          </div>
          <div className="flex justify-end space-x-6 md:order-2">
            <a
              onClick={() => {
                location.href = location.origin + '/api/auth/signout';
              }}
              className="cursor-pointer text-base text-gray-400 hover:text-gray-500"
            >
              Logout
            </a>
          </div>
        </div>
      </footer>
      {openRegisterModal && (
        <RegisterModal
          onClose={() => {
            setOpenRegisterModal(false);
          }}
        />
      )}
      {openJoinModal && (
        <JoinModal
          onClose={(invite: boolean) => {
            setOpenJoinModal(false);
            if (invite) setOpenSucessModal(true);
          }}
        />
      )}
      {openSucessModal && <AccessRequestSuccessModal />}
    </>
  );
}
