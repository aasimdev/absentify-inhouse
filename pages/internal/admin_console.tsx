
import type { NextPage } from 'next';
import Head from 'next/head';
import useTranslation from 'next-translate/useTranslation';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import type { RouterInputs } from '~/utils/api';
import { api } from '~/utils/api';

import { notifySuccess, notifyError } from '~/helper/notify';
import Loader from "@components/calendar/Loader";

const AdministrationPage: NextPage = () => {
  const { t, } = useTranslation('common');
  const {
    register,
    handleSubmit,
  } = useForm<
    RouterInputs['administration']['changeSubscriptionToAnotherWorkspace']
  >();
  const changeSubscriptionToAnotherWorkspace =
    api.administration.changeSubscriptionToAnotherWorkspace.useMutation();
  
  const onSubmit: SubmitHandler<
    RouterInputs['administration']['changeSubscriptionToAnotherWorkspace']
  > = async (
    data: RouterInputs['administration']['changeSubscriptionToAnotherWorkspace']
  ) => {
    await changeSubscriptionToAnotherWorkspace.mutateAsync(
      {
        from_workspace_id: data.from_workspace_id,
        to_workspace_id: data.to_workspace_id,
      },
      {
        onSuccess: async () => {
          notifySuccess( t('Saved_successfully') )
        },
        onError: (error: { message: any; }) => {
          notifyError( error.message);
        
        },
      }
    );
  };
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  return (
    <>
      <Head>
        <title>{`${t('Admin_Console')} - absentify`}</title>
        <meta name="description" content="Stats - absentify" />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : "/favicon.ico"} />
      </Head>
      <form
        className="divide-y divide-gray-200 lg:col-span-9"
        onSubmit={handleSubmit(onSubmit)}
      >
        {/* Profile section */}
        <div className="px-4 py-6 sm:p-6 lg:pb-8">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900">
              Admin Console
            </h2>
            <p className="mt-1 text-sm text-gray-500"></p>
          </div>
          <div className="mt-6 flex flex-col lg:flex-row">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label
                    htmlFor="first-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    From Workspace ID
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      {...register('from_workspace_id', { required: true })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="last-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    To Workspace ID
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      {...register('to_workspace_id', { required: true })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
                    />
                  </div>
                </div>
                <button
                  disabled={changeSubscriptionToAnotherWorkspace.isLoading}
                  type="submit"
                  className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                >
                  {changeSubscriptionToAnotherWorkspace.isLoading && (
                    <div className="-ml-1 mr-3"><Loader /></div>
                  )}
                  {t('Save')}
                </button>
              </div>
            </div>
          </div>{' '}
        </div>
      </form>
    </>
  );
};

export default AdministrationPage;
