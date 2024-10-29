import { format } from 'date-fns';
import { classNames } from 'lib/classNames';
import { dateToIsoDate } from 'lib/DateHelper';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { useState } from 'react';

import { type RouterOutputs } from '~/utils/api';

import AddEditSchedule from './AddEdit';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';

export default function ScheduleBox(props: {
  schedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current'];
  mode: 'member_schedules' | 'workspace_schedules';
  state: 'current' | 'future' | 'completed';
  showState: boolean;
  member_id?: string;
  enableEdit: boolean;
  onInvalidate: Function;
  isLoading: boolean;
}) {
  const [addEditMode, setAddEditMode] = useState<boolean>(false);
  const { t } = useTranslation('schedules');
  const { current_member } = useAbsentify();
  if (!props.isLoading && addEditMode)
    return (
      <AddEditSchedule
        enableEdit={props.enableEdit}
        mode={props.mode}
        member_id={props.member_id}
        onClose={() => {
          setAddEditMode(false);
        }}
        schedule={props.schedule}
        onInvalidate={props.onInvalidate}
      />
    );
  if (props.isLoading) return <CustomLoading />;
  if (!current_member) return <></>;
  return (
    <div className="bg-white dark:bg-transparent shadow sm:rounded-lg border-0 dark:border dark:border-gray-400">
      <div className="px-4 py-5 sm:p-6">
        {props.showState && (
          <div className="flex justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
              {t('From')}: {props.mode == 'workspace_schedules' && <>{t('Start_of_employment')}</>}
              {props.schedule && (props.schedule as defaultMemberSelectOutput['schedules'][0])?.from && (
                <>{format(dateToIsoDate((props.schedule as any).from), current_member.date_format)}</>
              )}
            </h3>

            {props.state == 'completed' ? (
              <span className="inline-block h-5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200 dark:bg-teams_brand_dark_400">
                {t('Completed')}
              </span>
            ) : props.state == 'future' ? (
              <span className="inline-block h-5 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-gray-200 dark:bg-teams_brand_dark_400">
                {t('In_future')}
              </span>
            ) : (
              <span className="inline-block h-5 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-gray-200 dark:bg-teams_brand_dark_400">
                {t('Current_work_schedule')}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 max-w-xl text-sm text-gray-500">
          <div
            className={`flex items-center justify-between bg-white dark:bg-transparent py-3 sm:px-6 md:px-4${
              props.mode == 'member_schedules' ? ' border-t border-gray-200' : ''
            }`}
          >
            <div className="flex flex-1 items-center justify-between">
              <div>
                <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.monday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.monday_am_enabled || props.schedule.monday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500'
                      )}
                    >
                      {t('Monday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.monday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.tuesday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.tuesday_am_enabled || props.schedule.tuesday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Tuesday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.tuesday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.wednesday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.wednesday_am_enabled || props.schedule.wednesday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Wednesday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.wednesday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.thursday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.thursday_am_enabled || props.schedule.thursday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Thursday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.thursday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.friday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.friday_am_enabled || props.schedule.friday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Friday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.friday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.saturday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.saturday_am_enabled || props.schedule.saturday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Saturday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.saturday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                  <div className=" w-10 border-teams_brand_500 border bg-white dark:bg-transparent dark:border-gray-400 flex items-center box-content z-10 relative text-sm font-medium">
                    <div
                      className={classNames(
                        'w-5 h-9',
                        props.schedule.sunday_am_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                    <span
                      className={classNames(
                        'absolute left-2/4 -translate-x-2/4 z-20',
                        props.schedule.sunday_am_enabled || props.schedule.sunday_pm_enabled
                          ? 'text-teams_brand_600 dark:text-white'
                          : 'text-gray-500 dark:text-white'
                      )}
                    >
                      {t('Sunday').charAt(0)}
                    </span>
                    <div
                      className={classNames(
                        ' w-5  h-9',
                        props.schedule.sunday_pm_enabled
                          ? 'z-10 border-teams_brand_500 bg-teams_brand_50 dark:bg-teams_brand_dark_400 text-teams_brand_600'
                          : ' bg-transparent'
                      )}
                    ></div>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm">
          <a
            className="cursor-pointer font-medium text-teams_brand_600 dark:text-white hover:text-teams_brand_500"
            onClick={(e) => {
              e.preventDefault();
              setAddEditMode(true);
            }}
          >
            {props.enableEdit ? t('ViewEdit') : t('Show')} <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}

const CustomLoading = () => {
  return (
    <>
      <div className="px-4 w-full max-w-screen-2xl bg-white shadow sm:rounded-lg p-4 dark:bg-teams_brand_dark_100">
        <div>
          <div className="mx-auto w-full">
            <div className="flex animate-pulse space-x-4 pt-2">
              <div className="flex-1 space-y-6 py-1">
                <div className="grid grid-cols-8 gap-4 space-x-20">
                  <div className="col-span-6 h-5 rounded bg-gray-700"></div>
                  <div className=" col-span-2 h-5 rounded bg-gray-700"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-2">
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-8 gap-4">
                <div className="col-span-5 h-10 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex animate-pulse space-x-4 pt-2">
            <div className="flex-1 space-y-6 py-1">
              <div className="grid grid-cols-8 gap-4">
                <div className="col-span-1 h-5 rounded bg-gray-700"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
