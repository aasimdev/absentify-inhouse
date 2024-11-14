import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import React, { useEffect, useState } from 'react';
import Stats from './Stats';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { CalendarViewProvider } from '@components/calendar/CalendarViewContext';
import Calendar from './Calendar';
import AddHoliday, { openDialogValuesType } from '@components/calendar/CreateRequest/CreateRequest';
import DetailsModal from '@components/calendar/DetailsModal';
import PublicHolidayDetailsModal from '@components/calendar/PublicHolidayDetailsModal';
import CancelModal from '../../components/calendar/CancelModal';
import { useAbsentify } from '@components/AbsentifyContext';
import { api, type RouterOutputs } from '~/utils/api';
import DayScheduleModal from '@components/calendar/DayScheduleModal';
import { CheckCurrentUserHasPermissionToCreateRequest } from 'lib/requestUtilities';
import { useRouter } from 'next/router';
import { addDays, addYears, eachMonthOfInterval, endOfDay, startOfDay } from 'date-fns';
import { convertLocalDateToUTC } from '~/lib/DateHelper';
import { capitalizeFirstMonthLetter } from '~/helper/capitalizeFirstMonthLetter';
const CalendarView = (props: { member_id?: string; request_id?: string }) => {
  const { t, lang } = useTranslation('calendar');
  const router = useRouter();
  const [dialogValues, setDialogValues] = useState<openDialogValuesType | null>(null);
  const [minDateMaxDate, setMinDateMaxDate] = useState<{ minYear: number; maxYear: number } | null>(null);
  const [detailModalValues, setDetailModalValues] = useState<RouterOutputs['request']['allOfUsersByDay'][0] | null>(
    null
  );
  const [publicHolidayDetailModalValues, setPublicHolidayDetailModalValues] = useState<
    RouterOutputs['public_holiday_day']['byId'] | null
  >(null);
  const [cancelRequest, setCancelRequest] = useState<RouterOutputs['request']['allOfUsersByDay'][0] | null>(null);
  const { current_member, setPageTitle } = useAbsentify();
  const { data } = api.member.all.useQuery(
    { limit: 1, page: 1, filter: { ids: [props.member_id ? props.member_id : current_member?.id + ''] } },
    {
      staleTime: 60000,
      enabled: !!current_member
    }
  );
  const member = data?.members[0] || null;
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const [dayScheduleModalValues, setDayScheduleModalValues] = useState<{
    requests: RouterOutputs['request']['allOfUsersByDay'];
    date: Date;
  } | null>(null);
  const [year, setYear] = useState<number>(
    new Date(new Date().getFullYear(), workspace?.fiscal_year_start_month ?? 0, 1) > new Date()
      ? new Date().getFullYear() - 1
      : new Date().getFullYear()
  );
  const start = new Date(year, workspace?.fiscal_year_start_month ?? 0, 1);
  const end = addDays(addYears(new Date(year, workspace?.fiscal_year_start_month ?? 0, 1), 1), -1);

  const { data: member_requests, refetch: refetch_member_requests } = api.request.allOfUserByDay.useQuery(
    {
      requester_member_id: member?.id as string,
      start: convertLocalDateToUTC(startOfDay(start)),
      end: convertLocalDateToUTC(endOfDay(end))
    },
    { enabled: !!member?.id && member?.id !== 'undefined' && !!workspace?.id }
  );

  const { data: public_holiday_days } = api.public_holiday_day.all.useQuery(
    {
      public_holiday_id: member?.public_holiday_id,
      start: new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)),
      end: new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0))
    },
    {
      enabled: !!member?.id && member?.id !== 'undefined' && !!workspace?.id,
      staleTime: 60000
    }
  );

  const { data: request, isLoading } = api.request.byId.useQuery(
    { id: props.request_id + '' },
    {
      enabled: !!props.request_id
    }
  );
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, { staleTime: 60000 });
  const [isCurrentUserHasPermissionToCreateRequest, setIsCurrentUserHasPermissionToCreateRequest] = useState(false);

  useEffect(() => {
    if (!member) return;
    if (!workspace) return;

    let minYear = new Date().getFullYear() - 1;
    let maxYear = new Date().getFullYear() + 1;

    for (const allowance of member.allowances) {
      if (allowance.year < minYear) {
        minYear = allowance.year;
      }
      if (allowance.year > maxYear) {
        maxYear = allowance.year;
      }
    }

    setMinDateMaxDate({ minYear: minYear, maxYear: maxYear });
  }, [member, workspace]);

  useEffect(() => {
    if (!current_member) return;
    if (!member) return;
    setPageTitle(t('user_name-s-calendar', { name: member.name }));

    setIsCurrentUserHasPermissionToCreateRequest(CheckCurrentUserHasPermissionToCreateRequest(current_member, member));
  }, [member, current_member]);

  useEffect(() => {
    if (!props.request_id) return;
    if (!request) return;
    if (request.requester_member_id != props.member_id) return;
    setDetailModalValues(request);
  }, [request, props.request_id]);
  if (!current_member) return null;
  return (
    <>
      <div className="grid grid-cols-1 border-t dark:border-teams_brand_tbody_border border-b bg-white dark:bg-teams_dark_mode shadow sm:rounded sm:border md:grid-cols-10">
        <div className="border-b dark:border-teams_brand_tbody_border md:col-span-10">
          <div className="-mb-px flex justify-between pl-6">
            <div className="flex ">
              <div className="flex py-6 text-lg  font-normal ">
                <div className="mr-4 mt-1 inline-flex">
                  <span
                    data-tooltip-id="yearnav-tooltip"
                    data-tooltip-content={t('Previous_year')}
                    data-tooltip-variant="light"
                  >
                    <a
                      className="mt-1.5 cursor-pointer "
                      onClick={(e) => {
                        e.preventDefault();
                        if (minDateMaxDate && minDateMaxDate.minYear <= year - 1) setYear(year - 1);
                      }}
                    >
                      <ArrowLeftIcon className="h-4 ml-1 dark:text-white" />
                    </a>
                  </span>
                  <ReactTooltip
                    id="yearnav-tooltip"
                    place="top"
                    className="shadow z-50 dark:text-gray-200 dark:bg-teams_brand_tbody"
                    classNameArrow="shadow-sm"
                    style={{
                      boxShadow: '0 0 10px rgba(0,0,0,.1)'
                    }}
                  />

                  <span
                    data-tooltip-id="yearnav-tooltip"
                    data-tooltip-content={t('Next_year')}
                    data-tooltip-variant="light"
                  >
                    <a
                      className="mt-1.5 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        if (minDateMaxDate && minDateMaxDate.maxYear >= year + 1) setYear(year + 1);
                      }}
                    >
                      <ArrowRightIcon className="h-4 ml-1 dark:text-white" />
                    </a>
                  </span>
                  <ReactTooltip
                    id="yearnav-tooltip"
                    place="top"
                    className="shadow z-50 dark:text-gray-200 dark:bg-teams_brand_tbody"
                    classNameArrow="shadow-sm"
                    style={{
                      boxShadow: '0 0 10px rgba(0,0,0,.1)'
                    }}
                  />
                </div>
                <div className="self-center dark:text-white">
                  {start.getMonth() == 0 && (
                    <>
                      {capitalizeFirstMonthLetter(
                        new Date(Date.UTC(year, 0, 15, 0, 0, 0, 0)).toLocaleString(lang, { month: 'long' }),
                        lang
                      )}{' '}
                      {t('to')}{' '}
                      {capitalizeFirstMonthLetter(
                        new Date(Date.UTC(year, 11, 15, 0, 0, 0, 0)).toLocaleString(lang, { month: 'long' }),
                        lang
                      )}{' '}
                      {year}
                    </>
                  )}
                  {start.getMonth() !== 0 && (
                    <>
                      {start.toLocaleString(lang, { month: 'long' })} {start.getFullYear()} {t('to')}{' '}
                      {end.toLocaleString(lang, { month: 'long' })} {end.getFullYear()}
                    </>
                  )}
                </div>
              </div>
            </div>

           {member &&
          (isCurrentUserHasPermissionToCreateRequest ||
            member.has_approvers.find((x) => x.approver_member_id == current_member.id)) && ( 
            <div className="flex">
              <a
                href=""
                className="self-center"
                onClick={(e) => {
                  e.preventDefault();
                  if (!current_member) return;
                  if (!current_member.id) return;
                  let dd = new Date();
                  setDialogValues({
                    start: dd,
                    start_at: 'morning',
                    end: dd,
                    end_at: 'end_of_day',
                    member_id: current_member.id,
                    department_id: null
                  });
                }}
              >
                <button
                  type="button"
                  className=" mx-6 inline-flex items-center rounded border border-gray-300 bg-white dark:bg-transparent px-6 py-1.5 text-sm font-medium text-gray-700 dark:text-teams_brand_gray shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 dark:ring-teams_brand_tbody_border focus:ring-offset-2 dark:border-teams_brand_border"
                >
                  <PlusCircleIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                  {t('Create_request')}
                </button>
              </a>
              <p></p>
            </div>)}
          </div>
        </div>

        {member &&
          (isCurrentUserHasPermissionToCreateRequest ||
            member.has_approvers.find((x) => x.approver_member_id == current_member.id)) && (
            <div className=" overflow-y-auto min-h-[30vh] h-auto md:h-[70vh] sm:col-span-5 md:col-span-3 lg:col-span-2 sm:mx-auto lg:ml-2 px-4 my-4 lg:my-0 max-w-screen-sm sm:w-max-[22vh] xl:w-max-[30vh] pb-4">
              <Stats
                member_id={member.id}
                dateRange={{
                  startDate: start,
                  endDate: end
                }}
                allowanceYear={year}
              ></Stats>
            </div>
          )}

        <div
          className={`overflow-y-scroll h-[70vh]  sm:col-span-5 md:col-span-7 ${
            isCurrentUserHasPermissionToCreateRequest ||
            member?.has_approvers.find((x) => x.approver_member_id == current_member.id)
              ? ' lg:col-span-8 '
              : ' lg:col-span-10 '
          } `}
        >
          <div className="grid select-none grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 1xl:grid-cols-3 gap-0 mb-4">
            {member && workspaceSchedule && member_requests && public_holiday_days && (
              <CalendarViewProvider>
                {eachMonthOfInterval({ start, end }).map((day) => {
                  return (
                    <div key={day + '' + year} className="mx-auto">
                      <Calendar
                        year={day.getFullYear()}
                        month={day.getMonth()}
                        member_requests={member_requests}
                        workspaceSchedule={workspaceSchedule}
                        member_public_holiday_days={public_holiday_days}
                        member={member}
                        openAddDialog={(x: openDialogValuesType) => {
                          if (x) {
                            setDialogValues(x);
                          }
                        }}
                        onOpenDetailModal={(zz: {
                          data: RouterOutputs['request']['allOfUsersByDay'] | { id: string };
                          openAsScheduler: boolean;
                          day: Date;
                        }) => {
                          if (zz.openAsScheduler) {
                            setDayScheduleModalValues({
                              requests: zz.data as RouterOutputs['request']['allOfUsersByDay'],
                              date: zz.day
                            });
                          } else if ((zz.data as RouterOutputs['request']['allOfUsersByDay'])[0]) {
                            const t = zz.data as RouterOutputs['request']['allOfUsersByDay'];
                            if (t[0]) setDetailModalValues(t[0]);
                          } else {
                            setPublicHolidayDetailModalValues(zz.data as RouterOutputs['public_holiday_day']['byId']);
                          }
                        }}
                        withBorder={true}
                      />
                    </div>
                  );
                })}
              </CalendarViewProvider>
            )}
          </div>
          <ReactTooltip id="cell-tooltip" className="z-50" />
        </div>
      </div>
      {dialogValues && (
        <AddHoliday
          initDateValues={dialogValues}
          openAsDialog={true}
          showUserSelect={true}
          showDepartmentSelect={false}
          onClose={() => {
            console.log('refetch');
            refetch_member_requests();
            setDialogValues(null);
          }}
        ></AddHoliday>
      )}
      {detailModalValues && (
        <DetailsModal
          request_id={detailModalValues.id}
          onClose={() => {
            setDetailModalValues(null);
            delete router.query.request_id;
            router.push(router);
          }}
          onCancelRequest={() => {
            setDetailModalValues(null);
            setCancelRequest({ ...detailModalValues });
          }}
        />
      )}
      {cancelRequest && (
        <CancelModal
          request={cancelRequest}
          onClose={(request: RouterOutputs['request']['allOfUsersByDay'][0] | null) => {
            setCancelRequest(null);
            setDetailModalValues(null);
            delete router.query.request_id;
            router.push(router);
            console.log('refetch');
            refetch_member_requests();
            if (request) setDetailModalValues(request);
          }}
        />
      )}
      {publicHolidayDetailModalValues && (
        <PublicHolidayDetailsModal
          public_holiday_day={publicHolidayDetailModalValues}
          onClose={() => {
            setPublicHolidayDetailModalValues(null);
          }}
        />
      )}
      {dayScheduleModalValues && dayScheduleModalValues.requests[0]?.requester_member_id && (
        <DayScheduleModal
          isModalOnTop={dialogValues == null}
          date={dayScheduleModalValues.date}
          member_id={dayScheduleModalValues.requests[0].requester_member_id}
          userHasPermissionToCreateRequest={isCurrentUserHasPermissionToCreateRequest}
          onClose={() => {
            setDayScheduleModalValues(null);
          }}
          openDetailModal={(x: RouterOutputs['request']['allOfUsersByDay'][0]) => {
            setDetailModalValues(x);
          }}
          openCreateModal={(x: Date, member_id: string) => {
            setDialogValues({
              start: x,
              start_at: 'morning',
              end: x,
              end_at: 'end_of_day',
              member_id: member_id,
              department_id: null
            });
          }}
        />
      )}
    </>
  );
};

export default CalendarView;
