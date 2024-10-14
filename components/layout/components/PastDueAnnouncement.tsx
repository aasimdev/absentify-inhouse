import { useAbsentify } from '@components/AbsentifyContext';
import { BoltIcon } from '@heroicons/react/24/outline';
import { addDays, format, differenceInDays } from 'date-fns';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';

import { api } from '~/utils/api';

export default function PastDueAnnouncement() {
  const { current_member } = useAbsentify();
  const { t } = useTranslation('common');
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const [show, setShow] = useState(false);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !current_member) return;

    const subscriptionEndDate = workspace.subscriptions.find((sub) => {
      return sub.status === 'past_due' && sub.past_due_since;
    })?.past_due_since;

    if (subscriptionEndDate) {
      const calculatedEndDate = addDays(new Date(subscriptionEndDate), 14);
      const daysLeft = differenceInDays(calculatedEndDate, new Date());

      setEndDate(format(calculatedEndDate, current_member.date_format));

      if (current_member.is_admin || daysLeft <= 5) {
        setShow(true);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, current_member]);

  if (!show) return null;

  return (
    <>
      <div className="fixed -inset-x-0 bottom-0">
        <div className="bg-red-500">
          <div className="mx-auto max-w-7xl p-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between">
              <div className="flex w-0 flex-1 items-center">
                <span className="flex rounded-lg bg-red-700 p-2">
                  <BoltIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
                <p className="ml-3 truncate font-medium text-white">
                  <span className="md:hidden"> {t('past_due_announcement_title_short', { endDate })}</span>
                  <span className="hidden md:inline"> {t('past_due_announcement_title_long', { endDate })}</span>
                </p>
              </div>
              <div className="order-2 shrink-0 sm:order-3 sm:ml-3"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
