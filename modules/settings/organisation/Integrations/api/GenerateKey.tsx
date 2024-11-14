import useTranslation from 'next-translate/useTranslation';
import { api } from '~/utils/api';
import { useEffect, useState } from 'react';
import { notifyError } from '~/helper/notify';
import Loader from "@components/calendar/Loader";
const GenerateKey = () => {
  const { t } = useTranslation('settings_organisation');
  const [loading, setLoading] = useState<boolean>(false);
  const create_api_key = api.apikey.create.useMutation();

  const [apikey, setApiKey] = useState<string>('');

  const { data: api_key, refetch: refetch_api_key } = api.apikey.current.useQuery(undefined, { staleTime: 60000 });

  useEffect(() => {
    if (apikey == "" && api_key) {
      setApiKey(api_key.key);
    }
  }, [api_key]);

  return (
    <div className="divide-y divide-gray-200 lg:col-span-10">
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 mb-1  dark:text-gray-200">{t('api_key')}</h2>
          <p className="py-2 text-sm text-gray-500  dark:text-gray-200">{t('api_key_subscription')}</p>

          <a className="underline mt-3 dark:text-gray-200" href="https://absentify.com/docs/api-reference">
            {t('view_api_doc')}
          </a>
        </div>
        <div className="mt-5 flex justify-between sm:justify-start sm:space-x-6 space-x-3">
          <div className="flex-initial sm:w-2/5 w-full">
            <input
              type="text"
              className=" w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm  dark:text-gray-200 dark:bg-teams_brand_tbody"
              value={apikey}
            />
          </div>
          <div className="flex-initial w-max">
            <button
              type="button"
              className={`w-full px-4 py-0.5 sm:py-2 mr-5 text-sm font-medium bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_border_1 rounded-md border border-transparent shadow-sm  focus:outline-none focus:ring-2 focus:ring-offset-2`}
              onClick={async () => {
                setLoading(true);
                await create_api_key.mutateAsync(
                  {},
                  {
                    async onSuccess(hh) {
                      setApiKey(hh.key);
                      refetch_api_key();
                      setLoading(false);
                    },
                    onError(error) {
                      notifyError(error.message);
                      setLoading(false);
                    }
                  }
                );
              }}
            >
              <p className="mx-auto">
                {loading ? (
                  <div className="-ml-1 mr-3">
                    <Loader />
                  </div>
                ) : (
                  t('generate_new_key')
                )}{' '}
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateKey;
