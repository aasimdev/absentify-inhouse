import { useEffect, useState } from 'react';
import useTranslation from 'next-translate/useTranslation';
import Link from 'next/link';
import { useAbsentify } from '@components/AbsentifyContext';
import { useRouter } from 'next/router';
import { classNames } from '~/lib/classNames';
import { api } from "~/utils/api";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
export default function IntegrationDetails(props: {
  integration: 'timeghost' | 'power_automate' | 'calendar_sync' | 'api' | 'webhooks' | 'powerbi' | 'outlook_oof' | 'ad_group_sync';
}) {
  const { t, lang } = useTranslation('settings_organisation');
  const { subscription } = useAbsentify();
  const {data: workspace} = api.workspace.current.useQuery(undefined, {
    staleTime: 60000,
  });

  const router = useRouter();
  const [integration, setIntegration] = useState<
    | {
        integration: string;
        name: string;
        description: string;
        calendar_sync_description_note?: string;
        description_long_1?: string;
        description_long_2?: string;
        imageUrl: string;
        url: string;
        description_long?: string;
        connect_name: string;
        call_to_action_name: string;
        about: string;
        additional_frill_info: string;
        frill_link: string;
      }
    | null
    | undefined
  >(null);
  const integrations = [
    {
      integration: 'power_automate',
      name: t('power_automate_name'),
      about: t('power_automate_about_name'),
      // "Sync your absentify calendar with your favorite calendar app.",
      description: t('power_automate_description'),
      description_long: t('power_automate_description_long'),
      url: 'https://make.powerautomate.com/connectors/shared_absentify',
      imageUrl: '/integrations/powerautomate_400x400.png',
      connect_name: '',
      call_to_action_name: t('power_automate_call_to_action_name'),
      additional_frill_info: t('additional_frill_info') + ' ->',
      frill_link: 'https://feedback.absentify.com/roadmap/microsoft-power-automate-integration'
    },
    {
      integration: 'calendar_sync',
      name: t('calendar_sync_setting'),
      about: t('calendar_sync_about_name'),
      description: t('calendar_sync_description'),
      calendar_sync_description_note: t('calendar_sync_description_note'),
      description_long_1: t('calendar_sync_description_long_1'),
      description_long_2: t('calendar_sync_description_long_2'),
      url: '/integrations/calendar_sync',
      imageUrl: '/integrations/cal_sync.png',
      connect_name: '',
      // call_to_action_name: 'Configure Calendar Sync'
      call_to_action_name: t('configuration'),
      additional_frill_info: t('additional_frill_info') + ' ->',
      frill_link:
        'https://feedback.absentify.com/roadmap/push-holiday-leave-for-all-employees-into-a-shared-outlook-calendar'
    },
    {
      name: t('timeghost_name'),
      about: t('timeghost_about_name'),
      integration: 'timeghost',
      description: t('timeghost_description'),
      description_long: t('timeghost_description_long_1'),
      description_long_2: t('timeghost_description_long_2'),
      url: '/integrations/timeghost',
      imageUrl: '/integrations/timeghost-favicon.png',
      connect_name: t('timeghost_connect_name'),
      call_to_action_name: t('configuration'),
      additional_frill_info: t('additional_frill_info') + ' ->',
      frill_link: 'https://feedback.absentify.com/roadmap/timgehost-integration'
    },
    {
      name: t('api_name'),
      about: t('api_about_name'),
      integration: 'api',
      description: t('integration_desc4'),
      description_long: t('api_description_long'),
      url: '/integrations/api',
      imageUrl: '/integrations/api_logo.png',
      connect_name: '',
      call_to_action_name: t('get_api_key'),
      additional_frill_info: '',
      frill_link: ''
    },
    {
      name: t('Webhooks'),
      about: t('webhooks_about_name'),
      integration: 'webhooks',
      description: t('integration_desc5'),
      description_long: t('Webhooks_description'),
      url: '',
      imageUrl: '/integrations/webhook.png',
      connect_name: '',
      call_to_action_name: t('configure_url'),
      additional_frill_info: '',
      frill_link: ''
    },
    {
      name: 'Power Bi',
      about: t('powerbi_about_name'),
      integration: 'powerbi',
      description: t('integration_desc6'),
      description_long: t('powerbi_description'),
      url:
        lang == 'de'
          ? 'https://support.absentify.com/de/article/anleitung-zur-installation-und-verwendung-des-absentify-powerbi-custom-connectors-175s62q/'
          : 'https://support.absentify.com/en/article/guide-to-the-absentify-powerbi-custom-connector-44rm5c/',
      imageUrl: '/integrations/powerbi.svg',
      connect_name: '',
      call_to_action_name: t('powerbi_guide'),
      additional_frill_info: '',
      frill_link: ''
    },
    {
      integration: 'outlook_oof',
      name: t('Outlook_oof'),
      about: t('outlook_oof_about_name'),
      description: t('integration_desc7'),
      description_long: t('outlook_oof_desc'),
      url: '/integrations/outlook_oof',
      imageUrl: '/integrations/outlook_oof.png',
      connect_name: '',
      call_to_action_name: t('configuration'),
      additional_frill_info: t('additional_frill_info')+ ' ->',
      frill_link:
        'https://feedback.absentify.com/roadmap/centralized-management-of-ooo-templates'
    },
    {
      integration: 'ad_group_sync',
      name: t('ad_group_sync_name'),
      about: t('ad_group_sync_about'),
      description: t('integration_desc8'),
      description_long: t('ad_group_sync_desc'),
      url: '/integrations/ad_group_sync',
      imageUrl: '/integrations/adgroup.jpg',
      connect_name: '',
      call_to_action_name: t('configuration'),
      additional_frill_info: '',
      frill_link: ''
    }
  ];

  useEffect(() => {
    setIntegration(integrations.find((x) => x.integration === props.integration));
  }, [props.integration]);
  if (!integration) return null;
  return (
    <form className="divide-y divide-gray-200 lg:col-span-10 dark:bg-teams_brand_dark_100">
      <div className="pt-6 divide-y divide-gray-200">
        <div className="p-4 sm:px-6">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{integration.name}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{integration.description} </p>
            <br />
            {integration.integration === 'calendar_sync' && (
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-200 dark:bg-teams_brand_dark_100'>{integration.calendar_sync_description_note} <a target="_blank" href="https://support.absentify.com/en/article/setting-up-microsoft-integrations-abpgzq/?bust=1686129063445#2-outlook-calendar-synchronization)."><span className='hover:underline cursor-pointer hover:text-gray-400'>Calendar Sync <ArrowTopRightOnSquareIcon className=" mb-1 inline-block" height={15} />  </span></a></p>
            )}
          </div>
          {integration.integration != 'timeghost' &&
            !subscription.business &&
            subscription.business_by_user == 0 &&
            !(subscription.enterprise > 0) &&
            integration.integration != 'api' &&
            integration.integration != 'powerbi' &&
            integration.integration != 'outlook_oof' &&
            integration.integration != 'ad_group_sync' && (
              <div className="flex relative z-0 py-5 px-6 w-full items-center text-left bg-teams_brand_50 rounded-md mt- dark:text-gray-200 dark:bg-teams_brand_dark_100 dark:border dark:rounded dark:border-gray-100">
                <div className="w-full text-sm ">
                  {t('Integrations_description_available_in_plan') + ' '}
                  <Link href="/settings/organisation/upgrade" className="transition-color duration-200 underline ">
                    {t('Integrations_description_available_in_plan_2')}
                  </Link>
                </div>
              </div>
            )}

          {!(subscription.enterprise > 0) &&
            (integration.integration == 'api' ||
              integration.integration == 'powerbi' ||
              integration.integration == 'outlook_oof') && (
              <div className="flex relative z-0 py-5 px-6 w-full items-center text-left bg-teams_brand_50 rounded-md mt-5 dark:text-gray-200 dark:bg-teams_brand_dark_100  dark:border dark:rounded dark:border-gray-100">
                <div className="w-full text-sm dark:text-gray-200">
                  {t('Integration_description_available_in_enterprise_plan') + ' '}
                  <Link href="/settings/organisation/upgrade" className="transition-color duration-200 underline ">
                    {t('Integrations_description_available_in_plan_2')}
                  </Link>
                </div>
              </div>
            )}

            {integration.integration == 'ad_group_sync' && workspace?.microsoft_groups_read_write_all !== 'ACTIVATED' && (
              <div className="flex relative z-0 py-5 px-6 w-full items-center text-left bg-teams_brand_50 rounded-md mt-5 dark:text-gray-200 dark:bg-teams_brand_dark_100 dark:border dark:rounded dark:border-gray-100 ">
                <div className="w-full text-sm dark:text-gray-200">
                  <Link href="/settings/organisation/microsoft" className="transition-color duration-200 underline ">
                  {t('ad_groups_needs_activated') + ' '}
                  </Link>
                </div>
              </div>
            )}

          <div className="flex flex-col py-5 px-6 rounded border mt-10">
            <div className="flex items-center flex-row space-x-4">
              <img src={integration.imageUrl} alt="Integrately" className="w-8 h-8" />
              <h6 className="dark:text-gray-200">{integration.about}</h6>
            </div>
            <p className="mt-3 dark:text-gray-200">{integration.description_long}</p>
            <p className="mt-3 dark:text-gray-200">{integration.description_long_1}</p>
            <p className="mt-3 dark:text-gray-200">{integration.description_long_2}</p>
            {integration.integration === 'api' && (
              <a className="underline mt-3" href="https://api-doc.absentify.com/">
                {t('view_api_doc')}
              </a>
            )}
            {integration.integration === 'webhooks' && (
              <a className="underline mt-3 dark:text-gray-200" href="https://support.absentify.com/en/article/webhook-integration-r863or/">
                {t('Webhooks_description_2')}
              </a>
            )}
            <p className="mt-3 ">
              <a className="underline dark:text-gray-200" href={integration.frill_link} target="_blank">
                {integration.additional_frill_info}
              </a>
            </p>

            <hr className="flex w-full text-element-0 my-5" />
            <div className="flex items-center justify-between">
              <h6 className="dark:text-gray-200">{integration.connect_name}</h6>
              {integration.integration === 'power_automate' && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(integration.url, '_blank');
                  }}
                  className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:text-gray-200"
                >
                  {integration.call_to_action_name}
                </button>
              )}
              {integration.integration === t('timeghost_name') && (
                <button
                  type="button"
                  className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                  onClick={() => {
                    router.push('/settings/organisation/integrations/timeghost/settings');
                  }}
                >
                  {integration.call_to_action_name}
                </button>
              )}
              {integration.integration === 'api' && (
                <button
                  type="button"
                  disabled={!(subscription.enterprise > 0)}
                  className={`inline-flex justify-right px-4 py-0.5 sm:py-2 text-sm font-medium  ${
                    subscription.enterprise
                      ? ' bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_border_1 '
                      : ' bg-gray-100 text-gray-500 cursor-not-allowed '
                  }  rounded-md border border-transparent shadow-sm  focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  onClick={() => router.push('/settings/organisation/integrations/api/key')}
                >
                  <p className="mx-auto">{integration.call_to_action_name}</p>
                </button>
              )}
              {integration.integration === 'calendar_sync' && (
                <Link href="/settings/organisation/integrations/calendar_sync/settings">
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                  >
                    {integration.call_to_action_name}
                  </button>
                </Link>
              )}
              {integration.integration === 'outlook_oof' && (
                <Link
                  href="/settings/organisation/integrations/outlook_oof/settings"
                  className={classNames(!(subscription.enterprise > 0) ? ' pointer-events-none' : '')}
                >
                  <button
                    type="button"
                    disabled={!(subscription.enterprise > 0)}
                    className={classNames(
                      !(subscription.enterprise > 0)
                        ? '  bg-gray-100 text-gray-500'
                        : 'bg-teams_brand_foreground_bg text-white',
                      'inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500'
                    )}
                  >
                    {integration.call_to_action_name}
                  </button>
                </Link>
              )}
              {integration.integration === 'webhooks' && (
                <Link href="/settings/organisation/integrations/webhooks/configure_url">
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                  >
                    {integration.call_to_action_name}
                  </button>
                </Link>
              )}
              {integration.integration === 'powerbi' && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(integration.url, '_blank');
                  }}
                  className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                >
                  {integration.call_to_action_name}
                </button>
              )}
              {integration.integration === 'ad_group_sync' && (
                <Link href="/settings/organisation/integrations/ad_group_sync/settings" className={workspace?.microsoft_groups_read_write_all !== 'ACTIVATED' ?  ' pointer-events-none' : ''}>
                  <button
                    type="button"
                    disabled={workspace?.microsoft_groups_read_write_all !== 'ACTIVATED'}
                    className={classNames(
                      (workspace?.microsoft_groups_read_write_all !== 'ACTIVATED') ? "  bg-gray-100 text-gray-500 cursor-default" : "bg-teams_brand_foreground_bg text-white cursor-pointer hover:bg-teams_brand_border_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500",
                      "inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium rounded-md border border-transparent shadow-sm ",
                    )}
                  >
                    {integration.call_to_action_name}
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
