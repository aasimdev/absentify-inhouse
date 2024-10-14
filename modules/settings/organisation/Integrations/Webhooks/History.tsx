import type { NextPage } from 'next';
import { useState } from 'react';
import { useAbsentify } from '@components/AbsentifyContext';
import { format } from 'date-fns';
import useTranslation from 'next-translate/useTranslation';
import { api, type RouterOutputs } from '~/utils/api';
import { useRouter } from 'next/router';
import HisotryModal from './HistoryModal';
import { notifyError } from '~/helper/notify';
const History: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const { current_member } = useAbsentify();
  const router = useRouter();
  const historyQuery = api.webhook_setting.infiniteHistory.useInfiniteQuery(
    {
      limit: 10
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor
    }
  );
  const retryWebhook = api.webhook_setting.retry.useMutation();
  const [currentPage, setCurrentPage] = useState(0);
  const [valueToShow, setValueToShow] = useState<
    RouterOutputs['webhook_setting']['infiniteHistory']['items'][0] | null
  >(null);
  const utils = api.useContext();

  if (!current_member) return <></>;
  return (
    <>
      <div className="divide-y divide-gray-200 lg:col-span-10">
        <div className="px-4 py-6 sm:p-6 lg:pb-8">
          <h2
            className="py-2 text-base font-semibold inline-flex -ml-2 cursor-pointer"
            onClick={() => {
              router.push('/settings/organisation/integrations/webhooks');
            }}
          >
            {' '}
            <span className="mt-1 mr-2">
              <svg
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                width={20}
                height={20}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"></path>
              </svg>
            </span>
            {t('Webhooks')}{' '}
          </h2>
          <h3 className="p-4 text-base font-semibold"> {t('history')}</h3>
          {historyQuery.data?.pages && historyQuery.data.pages.length > 0 && (
            <div>
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="mt-8 flex flex-col">
                  <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle">
                      <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 lg:pl-8"
                              >
                                {t('started')}
                              </th>

                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('status')}
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('eventname')}
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('attempts')} <span className="sr-only">Details </span>
                              </th>

                              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8">
                                <span className="sr-only">Retry </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {historyQuery.data.pages[currentPage]?.items.map((historyData) => (
                              <tr key={historyData.id}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
                                  {current_member && format(historyData.createdAt, current_member.long_datetime_format)}
                                </td>

                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {historyData.status}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {historyData.webhook_setting.event === 'request_created;request_status_changed' &&
                                    t('all')}
                                  {historyData.webhook_setting.event === 'request_created' && t('created')}
                                  {historyData.webhook_setting.event === 'request_status_changed' && t('statusChanged')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 ">
                                  <div className="inline-flex space-x-2">
                                    <p className="pt-1"> {historyData.webhookHistoryAttempts.length}</p>
                                    {historyData.webhookHistoryAttempts[0] && (
                                      <button
                                        onClick={() => {
                                          setValueToShow(historyData);
                                        }}
                                        className="mt-0.5 px-2 text-xs rounded border-[1px]"
                                      >
                                        {t('details')}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                <td className=" m-0 whitespace-nowrap  py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 lg:pr-8">
                                  <div className="cursor-pointer text-teams_brand_600 hover:text-teams_brand_900">
                                    <div
                                      onClick={async (e) => {
                                        e.preventDefault();

                                        await retryWebhook.mutateAsync(
                                          {
                                            id: historyData.id
                                          },
                                          {
                                            async onSuccess() {
                                              utils.webhook_setting.infiniteHistory.invalidate();
                                            },
                                            onError(error) {
                                              notifyError(error.message);
                                            }
                                          }
                                        );
                                      }}
                                    >
                                      {retryWebhook.isLoading && historyData.id == retryWebhook.variables?.id ? (
                                        <div className=" absolute -mt-2 pl-9">
                                          <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g>
                                              <rect x="11" y="1" width="2" height="5" opacity=".14" />
                                              <rect
                                                x="11"
                                                y="1"
                                                width="2"
                                                height="5"
                                                transform="rotate(30 12 12)"
                                                opacity=".29"
                                              />
                                              <rect
                                                x="11"
                                                y="1"
                                                width="2"
                                                height="5"
                                                transform="rotate(60 12 12)"
                                                opacity=".43"
                                              />
                                              <rect
                                                x="11"
                                                y="1"
                                                width="2"
                                                height="5"
                                                transform="rotate(90 12 12)"
                                                opacity=".57"
                                              />
                                              <rect
                                                x="11"
                                                y="1"
                                                width="2"
                                                height="5"
                                                transform="rotate(120 12 12)"
                                                opacity=".71"
                                              />
                                              <rect
                                                x="11"
                                                y="1"
                                                width="2"
                                                height="5"
                                                transform="rotate(150 12 12)"
                                                opacity=".86"
                                              />
                                              <rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" />
                                              <animateTransform
                                                attributeName="transform"
                                                type="rotate"
                                                calcMode="discrete"
                                                dur="0.75s"
                                                values="0 12 12;30 12 12;60 12 12;90 12 12;120 12 12;150 12 12;180 12 12;210 12 12;240 12 12;270 12 12;300 12 12;330 12 12;360 12 12"
                                                repeatCount="indefinite"
                                              />
                                            </g>
                                          </svg>
                                        </div>
                                      ) : (
                                        t('retry')
                                      )}
                                    </div>

                                    <span className="sr-only">, {historyData.id}</span>
                                  </div>
                                </td>
                                {historyData.webhookHistoryAttempts[0] && <></>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <nav
                className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
                aria-label="Pagination"
              >
                <div className="hidden sm:block">
                  <p className="text-sm text-gray-700"></p>
                </div>
                <div className="flex flex-1 justify-between sm:justify-end">
                  {currentPage <= (historyQuery.data?.pages.length ? historyQuery.data.pages.length - 1 : 0) &&
                    currentPage > 0 && (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(currentPage - 1);
                        }}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {t('previous')}
                      </a>
                    )}
                  {(currentPage < (historyQuery.data?.pages.length ? historyQuery.data.pages.length - 1 : 0) ||
                    historyQuery.hasNextPage) && (
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (historyQuery.hasNextPage) await historyQuery.fetchNextPage();
                        setCurrentPage(currentPage + 1);
                      }}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t('next')}
                    </a>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>
      {valueToShow && valueToShow.webhookHistoryAttempts[0] && (
        <HisotryModal
          onClose={() => {
            setValueToShow(null);
          }}
          data={valueToShow.webhookHistoryAttempts}
        ></HisotryModal>
      )}
    </>
  );
};
export default History;
