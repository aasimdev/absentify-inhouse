import { api } from '~/utils/api';
import useTranslation from 'next-translate/useTranslation';
import Loader from '@components/calendar/Loader';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { format } from 'date-fns';
import { useAbsentify } from '@components/AbsentifyContext';

export default function MailLogs(props: { onClose: Function; currentMember: defaultMemberSelectOutput }) {
  const { t } = useTranslation('users');
  const { current_member } = useAbsentify();
  const {
    data: mailHistoryData,
    isLoading,
    isError
  } = api.member.mailHistory.useQuery({ member_id: props.currentMember.id, limit: 10, page: 1 });

  if (isLoading) return <Loader />;
  if (isError) return <div>{t('Error_loading_mail_history')}</div>;

  const hasStatusMessage = mailHistoryData?.some(mail => mail.deliveryDetails && JSON.parse(mail.deliveryDetails).statusMessage);

  return (
    <div className="divide-y divide-gray-200 lg:col-span-9 max-w-full dark:divide-gray-500 dark:bg-teams_brand_dark_100">
      <div className="py-6 px-4 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('EmailHistory')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('Displaying_the_last_90_days')}</p>
        </div>
        <div className="mt-6">
          <div className="w-full max-w-4xl mx-auto">
            <div className="inline-block min-w-full py-2 align-middle sm:px-2 lg:px-1 px-2">
              <div className="overflow-hidden border-b border-gray-200 dark:border-gray-900 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 table-fixed dark:divide-gray-500 dark:bg-teams_brand_dark_100">
                  <thead className="bg-gray-50 dark:bg-teams_brand_dark_500">
                    <tr>
                      <th
                        scope="col"
                        className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-200 tracking-wider ${hasStatusMessage ? 'w-1/3' : 'w-1/2'}`}
                      >
                        {t('Subject')}
                      </th>
                      <th
                        scope="col"
                        className="w-1/12 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-200"
                      >
                        {t('Delivery_Status')}
                      </th>
                      {hasStatusMessage && (
                        <th
                          scope="col"
                          className=" w-1/3 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-200"
                        >
                          {t('Delivery_Details')}
                        </th>
                      )}
                      <th
                        scope="col"
                        className=" w-1/6 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-200"
                      >
                        {t('Timestamp')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100">
                    {mailHistoryData?.map((mail, index) => (
                      <tr key={index}>
                        <td
                          className="px-4 py-2 text-sm text-gray-500 break-words whitespace-normal max-w-xs dark:text-gray-200"
                          title={mail.emailHistory.subject}
                        >
                          {mail.emailHistory.subject}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-gray-500 break-words whitespace-normal max-w-xs dark:text-gray-200"
                          title={mail.deliveryStatus ?? t('Mail_Pending')}
                        >
                          {mail.deliveryStatus ?? t('Mail_Pending')}
                        </td>
                        {hasStatusMessage && (
                          <td
                            className="px-4 py-2 text-sm text-gray-500 break-all whitespace-normal max-w-lg dark:text-gray-200"
                            title={mail.deliveryDetails ? JSON.parse(mail.deliveryDetails).statusMessage : ''}
                          >
                            {mail.deliveryDetails ? JSON.parse(mail.deliveryDetails).statusMessage : ''}
                          </td>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-200">
                          {mail.deliveryAttemptTimestamp
                            ? format(
                                new Date(mail.deliveryAttemptTimestamp),
                                current_member?.long_datetime_format ?? ''
                              )
                            : mail.emailHistory.sentAt
                            ? format(new Date(mail.emailHistory.sentAt), current_member?.long_datetime_format ?? '')
                            : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end p-4 sm:px-6">
        <button
          onClick={(e) => {
            e.preventDefault();
            props.onClose(false);
          }}
          type="button"
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
        >
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}
