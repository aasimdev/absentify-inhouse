import { useAbsentify } from '@components/AbsentifyContext';
import { SpeakerWaveIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';

import { api } from '~/utils/api';

export default function Announcment() {
  const { current_member } = useAbsentify();
  const { t } = useTranslation('common');
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const [show, setShow] = useState(false);
  const { subscription } = useAbsentify();
  useEffect(() => {
    if (!workspace) return;
    if (!current_member) return;

    if (current_member.is_admin 
     // && !subscription && !localStorage.getItem('announcement_2')
      ) {
      setShow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, current_member]);
  if (!show) return null;
  return (
    <>
      {/*
      Make sure you add some bottom padding to pages that include a sticky banner like this to prevent
      your content from being obscured when the user scrolls to the bottom of the page.
    */}
      <div className="fixed -inset-x-0 bottom-0">
        <div className="bg-teams_brand_foreground_bg">
          <div className="mx-auto max-w-7xl p-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between">
              <div className="flex w-0 flex-1 items-center">
                <span className="flex rounded-lg bg-teams_brand_foreground_1 p-2">
                  <SpeakerWaveIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
                <p className="ml-3 truncate font-medium text-white">
                  <span className="md:hidden">{t('announcement_title_short1')}</span>
                  <span className="hidden md:inline">{t('announcement_title_long1')}</span>
                </p>
              </div>
              
              <div className="order-2 shrink-0 sm:order-3 sm:ml-3">
                <button
                  onClick={() => {
                    setShow(false);
                    if (typeof umami !== 'undefined') {
                      umami.track('Dismiss_Announcement');
                    }
                    localStorage.setItem('announcement_2', 'true');
                  }}
                  type="button"
                  className="-mr-1 flex rounded-md p-2 hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
                >
                  <span className="sr-only">{t('Dismiss')}</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
