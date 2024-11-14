import useTranslation from 'next-translate/useTranslation';
import ScheduleBox from '../../../../../../components/schedules/ScheduleBox';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import AddEditSchedule from '../../../../../../components/schedules/AddEdit';
import { useState } from 'react';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { ExtendedMemberScheduleSelectOutput } from '../Index';

export default function Schedule(props: {
  onClose: Function;
  currentMember: defaultMemberSelectOutput;
  onInvalidate: Function;
  schedules: ExtendedMemberScheduleSelectOutput[];
  isLoading: boolean;
}) {
  const { t } = useTranslation('schedules');
  const [addEditMode, setAddEditMode] = useState<boolean>(false);
  const currentMember = props.currentMember;
  const schedules = props.schedules;

  return (
    <div className="divide-y divide-gray-200 lg:col-span-9 dark:bg-teams_dark_mode dark:divide-teams_brand_border">
      <div className="py-6 px-4 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Schedule')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('Schedule_description')}</p>
        </div>

        <div className="mt-6 flex flex-col lg:flex-row">
          {addEditMode && currentMember && (
            <AddEditSchedule
              enableEdit={true}
              mode="member_schedules"
              member_id={currentMember.id}
              onClose={() => {
                setAddEditMode(false);
              }}
              onInvalidate={props.onInvalidate}
            />
          )}
          {!addEditMode && (
            <div className="flex-grow space-y-6">
              <button
                onClick={() => {
                  setAddEditMode(true);
                }}
                type="button"
                className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-2 text-center hover:border-gray-400 dark:border-teams_brand_border"
              >
                <PlusCircleIcon className="mx-auto h-6 w-6 text-gray-400 dark:text-teams_brand_dark_550" />

                <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-200">{t('New_Schedule')}</span>
              </button>

              {schedules &&
                schedules.map((schedule) => (
                  <div key={schedule.id}>
                    <div>
                      {currentMember && (
                        <ScheduleBox
                          showState={true}
                          enableEdit={schedule.from !== null}
                          mode={schedule.from == null ? 'workspace_schedules' : 'member_schedules'}
                          key={schedule.id}
                          schedule={schedule}
                          state={schedule.state}
                          member_id={currentMember.id}
                          onInvalidate={props.onInvalidate}
                          isLoading={props.isLoading}
                        />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end py-4 px-4 sm:px-6">
        <button
          disabled={false}
          onClick={(e) => {
            e.preventDefault();
            props.onInvalidate();
            props.onClose(false);
          }}
          type="button"
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-transparent dark:border dark:border-gray-200 dark:text-white"
        >
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}
