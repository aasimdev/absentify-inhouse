import type { NextPage } from 'next';
import useTranslation from 'next-translate/useTranslation';
import { classNames } from 'lib/classNames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useAbsentify } from '@components/AbsentifyContext';
import { useEffect, useState } from 'react';
import { api } from '~/utils/api';
import { useDarkSide } from '@components/ThemeContext';

const Integrations: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const [theme] = useDarkSide();
  const router = useRouter();
  const { subscription } = useAbsentify();
  const { data: calendarSyncSettings } = api.calendar_sync_setting.all.useQuery(
    undefined,
    { staleTime: 60000 }
  );
  const { data: timeghostSyncSettings} = api.timeghost_sync_setting.all.useQuery(
    undefined,
    { staleTime: 60000 }
  );
  const [ isAnyCalSyncSetting,setIsAnyCalSyncSetting] = useState<boolean>(false);
  const [ isAnyTgSyncSetting,setIsAnyTgSyncSetting] = useState<boolean>(false);
  const integrations = [
    {
      name: 'Microsoft Power Automate',
      description: t('integration_desc1'),
      integration: 'power_automate',
      imageUrl: '/integrations/powerautomate_400x400.png',
      bgColor: 'bg-white'
    },
    {
      name: 'Calendar Sync',
      description: t('integration_desc2'),
      integration:isAnyCalSyncSetting ? 'calendar_sync/settings ' :  'calendar_sync',

      imageUrl: '/integrations/cal_sync.png',
      bgColor: 'bg-white'
    },
    {
      name: 'timeghost',
      description: t('integration_desc3'),
      integration: isAnyTgSyncSetting ? 'timeghost/settings': 'timeghost',

      imageUrl: '/integrations/timeghost-favicon.png',
      bgColor: 'bg-black'
    },
    {
      name: 'API',
      description: t('integration_desc4'),
      bgColor: 'bg-white',
      integration: 'api',
      imageUrl: '/integrations/api_logo.png'
    },
    {
      name: 'Webhooks',
      description: t('integration_desc5'),
      bgColor: 'bg-white',
      integration: 'webhooks',
      imageUrl: '/integrations/webhook.png'
    },
    {
      name: 'Power Bi',
      description: t('integration_desc6'),
      bgColor: 'bg-white',
      integration: 'powerbi',
      imageUrl: '/integrations/powerbi.svg'
    },
    {
      name: 'Outlook out of office',
      description: t('integration_desc7'),
      bgColor: 'bg-[#e1e1e1]',
      integration: 'outlook_oof',
      imageUrl: '/integrations/outlook_oof.png'
    },
    {
      name: 'Microsoft Entra ID/Teams Group Synchronization',
      description: t('integration_desc8'),
      bgColor: 'bg-white',
      integration: 'ad_group_sync',
      imageUrl: '/integrations/adgroup.jpg'
    }
  ];
  
  useEffect(() => {
    if (!calendarSyncSettings) return;
    if (calendarSyncSettings.length > 0 && (calendarSyncSettings.find((x) => !x.deleted))) setIsAnyCalSyncSetting(true)
  }
  ,[calendarSyncSettings])
  useEffect(() => {
    if (!timeghostSyncSettings) return;
    if (timeghostSyncSettings.length > 0 && (timeghostSyncSettings.find((x) => !x.deleted))) setIsAnyTgSyncSetting(true)
  }
  ,[timeghostSyncSettings])

  return (
    <form className="divide-y divide-gray-200 lg:col-span-10">
      <div className="pt-6 divide-y divide-gray-200">
        <div className="p-4 sm:px-6 ">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('absentify_Integrations')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('absentify_Integrations_description')} </p>
          </div>
          {!subscription.has_valid_subscription && (
            <div className="flex relative z-0 py-5 px-6 w-full items-center text-left bg-teams_brand_50 rounded-md mt-5 dark:text-gray-200 dark:bg-teams_brand_dark_100">
              <div className="w-full text-sm dark:text-gray-200">
                {t('Integrations_description_available_in_plan') + ' '}
                <Link href="/settings/organisation/upgrade" className="transition-color duration-200 underline ">
                  {t('Integrations_description_available_in_plan_2')}
                </Link>
              </div>
            </div>
          )}
          <ul role="list" className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-6 cursor-pointer">
            {integrations.map((integration) => (
              <li
                key={integration.name}
                className="col-span-1 flex rounded-md shadow-sm dark:text-gray-200 dark:bg-teams_brand_dark_100"
                onClick={() => {
                  router.push(`/settings/organisation/integrations/${integration.integration}`);
                }}
              >
                <div
                  className={classNames(
                    integration.bgColor,
                    'flex-shrink-0 flex items-center justify-center w-16 text-white text-sm font-medium rounded-l-md border'
                  )}
                >
                  <img src={integration.imageUrl} alt={integration.name} width="50px" />
                </div>
                <div className="flex flex-1 items-center justify-between rounded-r-md border-t border-r border-b border-gray-200 bg-white dark:text-gray-200 dark:bg-teams_brand_dark_100">
                  <div className="flex-1 lg:px-2 px-4 py-2 text-sm truncate w-56 sm:w-auto lg:w-56 1xl:w-auto">
                    <Link
                      href={`/settings/organisation/integrations/${integration.integration}`}
                      className="font-medium text-gray-900 hover:text-gray-600 dark:text-gray-200 dark:text-gray-200"
                    >
                      {integration.name}
                    </Link>
                    <p
                      className="text-gray-500 truncate w-56 sm:w-auto lg:w-56 1xl:w-auto dark:text-gray-200"
                      data-tooltip-id="cell-tooltip"
                      data-tooltip-content={integration.description}
                      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                    >
                      {integration.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <ReactTooltip
            id="cell-tooltip"
            place="top"
            className="shadow z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
            classNameArrow="shadow-sm"
            opacity={1}
            style={{ width: '300px', boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}
          />
        </div>
      </div>
    </form>
  );
};

export default Integrations;
