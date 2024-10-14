import { useAbsentify } from '@components/AbsentifyContext';
import { api, type RouterOutputs } from '~/utils/api';
import React, { useMemo } from 'react';
import { PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TimeFormat } from '@prisma/client';
import { getDayStartAndEndTimeFromscheduleOnClient, setScheduleFreeTimes } from '~/lib/requestUtilities';
import { endOfDay, format, startOfDay } from 'date-fns';
import useTranslation from 'next-translate/useTranslation';
import mappedTimezones from '~/helper/timezones';
import { convertLocalDateToUTC, dateFromDatabaseIgnoreTimezone } from '~/lib/DateHelper';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { Icon } from '@components/Icon';
export default function DayScheduleModal(props: {
  date: Date;
  onClose: Function;
  member_id: string;
  userHasPermissionToCreateRequest: boolean;
  openDetailModal: (x: RouterOutputs['request']['allOfUsersByDay'][0]) => void;
  openCreateModal: (x: Date, member_id: string) => void;
  isModalOnTop: boolean;
}) {
  const { t } = useTranslation('calendar');
  const { current_member } = useAbsentify();
  const { data: membersData } = api.member.all.useQuery(
    { filter: { ids: [props.member_id] }, limit: 1, page: 1 },
    { staleTime: 60000 }
  );

  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: requests, isLoading } = api.request.allOfUserByDay.useQuery({
    requester_member_id: props.member_id,
    start: convertLocalDateToUTC(startOfDay(props.date)),
    end: convertLocalDateToUTC(endOfDay(props.date))
  });

  const container = useRef(null);
  const [events, setEvents] = React.useState<JSX.Element[]>([]);

  useEffect(() => {
    if (!requests) return;
    setEvents(
      requests
        .filter((x) => dateFromDatabaseIgnoreTimezone(x.start).toDateString() == props.date.toDateString())
        .map((request) => {
          const title = request.details?.leave_type.name ?? 'Leave';
          const color = request.details?.leave_type.color ?? 'blue';
          const icon = request.details?.leave_type.icon ?? null;

          return createEvent(request, title, color, icon);
        })
    );
  }, [requests]);

  function generateHourList(timeFormat: TimeFormat) {
    let hours = [];
    if (timeFormat === TimeFormat.H24) {
      // 24-Stunden-Format: 1 bis 23
      for (let i = 0; i <= 23; i++) {
        hours.push({ label: `${i} ${t('hour_label_24H')}`, value: i });
      }
    } else {
      // 12-Stunden-Format: 1AM bis 11AM, 12PM bis 11PM
      for (let i = 0; i <= 11; i++) {
        hours.push({ label: `${i}AM`, value: i });
      }
      hours.push({ label: `12PM`, value: 12 });
      for (let i = 1; i <= 11; i++) {
        hours.push({ label: `${i}PM`, value: i + 12 });
      }
    }
    return hours;
  }

  function checkHourIsInsideSchedule(
    hour: number,
    minute: number,
    morningSchedule: {
      start: Date;
      end: Date;
    },
    afternoonSchedule: {
      start: Date;
      end: Date;
    },
    freeAFternoonOrMorning: {
      itsFreeMorning: boolean;
      itsFreeAfternoon: boolean;
    }
  ) {
    const timeInMinutes = hour * 60 + minute;

    const morningStart = morningSchedule.start.getUTCHours() * 60 + morningSchedule.start.getUTCMinutes();
    const morningEnd = morningSchedule.end.getUTCHours() * 60 + morningSchedule.end.getUTCMinutes();

    if (timeInMinutes >= morningStart && timeInMinutes < morningEnd) {
      if (freeAFternoonOrMorning.itsFreeMorning) return false;
      return true;
    }

    const afternoonStart = afternoonSchedule.start.getUTCHours() * 60 + afternoonSchedule.start.getUTCMinutes();
    const afternoonEnd = afternoonSchedule.end.getUTCHours() * 60 + afternoonSchedule.end.getUTCMinutes();

    if (timeInMinutes >= afternoonStart && timeInMinutes < afternoonEnd) {
      if (freeAFternoonOrMorning.itsFreeAfternoon) return false;
      return true;
    }

    return false;
  }

  let hoursList = generateHourList(current_member?.time_format ?? TimeFormat.H24);
  const memberWithSchedule = members?.find((member) => member.id === props.member_id);

  let schedule = memberWithSchedule?.schedules.find((x: any) => x.from && x.from <= props.date) as
    | defaultMemberSelectOutput['schedules'][0]
    | undefined;

  if (!schedule && workspaceSchedule) {
    schedule = workspaceSchedule as defaultMemberSelectOutput['schedules'][0];
  }

  if (!schedule) return <></>;
  const morningSchedule = getDayStartAndEndTimeFromscheduleOnClient(props.date, 'morning', 'lunchtime', schedule);
  const afternoonSchedule = getDayStartAndEndTimeFromscheduleOnClient(props.date, 'afternoon', 'end_of_day', schedule);
  const freeAFternoonOrMorning = setScheduleFreeTimes(props.date, schedule);

  function createEvent(
    request: RouterOutputs['request']['allOfUsersByDay'][0],
    title: string,
    color: string,
    icon: string | null
  ) {
    const rStart = dateFromDatabaseIgnoreTimezone(request.start);
    const rEnd = dateFromDatabaseIgnoreTimezone(request.end);

    //12 = 60min
    const startTime = format(rStart, current_member?.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a');
    const endTime = format(rEnd, current_member?.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a');

    let gridRowStart = 1 + (rStart.getHours() * 12 + rStart.getMinutes() / 5);

    //1h = 12
    //30min = 6

    const durationInUnits = (end: Date, start: Date) => {
      // Calculates the difference in milliseconds
      const diffInMs = end.getTime() - start.getTime();

      // Conversion from milliseconds to minutes
      const diffInMinutes = diffInMs / 1000 / 60;

      // Conversion to your specific units (5 minute steps)
      return diffInMinutes * 0.2;
    };
    let duration = durationInUnits(rEnd, rStart);
    if (duration + gridRowStart > 288) {
      duration = 288 - gridRowStart;
    }

    //1am = 13
    //2am = 23
    //2:30am = 28
    return (
      <li className="relative mt-px flex" key={request.id} style={{ gridRow: gridRowStart + ' / span ' + duration }}>
        <a
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.openDetailModal(request);
          }}
          className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg  p-2 text-xs leading-5 hover:bg-blue-100"
          style={{ backgroundColor: color }}
        >
          <p className="order-1 font-semibold text-white flex">
            {icon && <Icon key={'2'} name={icon} className="mr-1" color="white" width="3" />}
            <span className="mt-0.5">{title}</span>
          </p>
          <p className="text-white group-hover:text-gray-700">
            <time dateTime={rStart.toISOString()}>{startTime}</time>-{' '}
            <time dateTime={rEnd.toISOString()}>{endTime}</time>
          </p>
        </a>
      </li>
    );
  }
  if (!props.member_id) return <></>;

  function parseUtcOffset(utc: string) {
    const sign = utc[0] === '+' ? 1 : -1;
    const parts = utc.substring(1).split(':');
    if (!parts[0] || !parts[1]) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return sign * (hours * 60 + minutes);
  }

  function getTimezoneDifferenceMessage(currentUserTimezone: string, otherUserTimezone: string, otherUserName: string) {
    const currentUserTimezoneObj = mappedTimezones.find((x) => x.tzCode == currentUserTimezone);
    const otherUserTimezoneObj = mappedTimezones.find((x) => x.tzCode == otherUserTimezone);

    if (!currentUserTimezoneObj || !otherUserTimezoneObj) return '';

    const offsetCurrentUser = parseUtcOffset(currentUserTimezoneObj.utc);
    const offsetOtherUser = parseUtcOffset(otherUserTimezoneObj.utc);
    const difference = offsetOtherUser - offsetCurrentUser;
    const hoursDifference = Math.abs(difference) / 60;

    if (difference === 0) {
      return t('same-timezone', { otherUserName });
    } else if (difference > 0) {
      return t('timezone-ahead', { otherUserName, utc: otherUserTimezoneObj.utc, hours: hoursDifference });
    } else {
      return t('timezone-behind', { otherUserName, utc: otherUserTimezoneObj.utc, hours: hoursDifference });
    }
  }

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-30"
        onClose={() => {
          if (props.isModalOnTop) props.onClose();
        }}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <div>
                  <div className="mt-2 w-80">
                    <div className="flex h-full flex-col">
                      <div className="absolute top-0 right-0 pt-4 pr-4 sm:block">
                        <button
                          type="button"
                          className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                          onClick={() => {
                            props.onClose();
                          }}
                        >
                          <span className="sr-only">{t('Close')}</span>
                          <XMarkIcon className="md:h-6 md:w-6 w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 pb-6 -mt-3">
                          {format(props.date, current_member?.date_format ?? '')}{' '}
                          <p className="text-xs text-gray-500">
                            {current_member?.id != props.member_id &&
                              getTimezoneDifferenceMessage(
                                current_member?.timezone + '',
                                members?.find((x) => x.id == props.member_id)?.timezone + '',
                                members?.find((x) => x.id == props.member_id)?.name + ''
                              )}
                          </p>{' '}
                          {props.userHasPermissionToCreateRequest && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                if (!current_member?.id) return;

                                const dd = new Date(
                                  props.date.getFullYear(),
                                  props.date.getMonth(),
                                  props.date.getDate(),
                                  0,
                                  0,
                                  0,
                                  0
                                );
                                props.openCreateModal(dd, props.member_id);
                              }}
                              type="button"
                              className="mb-2 mt-2 flex w-full justify-center rounded border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 md:mb-0 md:w-7/12"
                            >
                              <div className="my-auto">
                                <PlusCircleIcon className="mr-2 h-4 w-4" aria-hidden="true" />{' '}
                              </div>
                              <p>{t('Create_request')}</p>
                            </button>
                          )}
                        </Dialog.Title>
                      </div>
                      <div className="isolate flex flex-auto overflow-hidden bg-white">
                        <div ref={container} className="flex flex-auto flex-col overflow-auto">
                          {' '}
                          {isLoading && (
                            <div className="px-6 md:px-4 w-screen max-w-screen-2xl">
                              <div>
                                <div className="mx-auto w-full">
                                  <div className="flex animate-pulse space-x-4 pt-2 ">
                                    <div className="flex-1 space-y-6 py-1">
                                      <div className="grid grid-cols-8 gap-4">
                                        <div className="col-span-6 md:col-span-4 h-40 rounded bg-gray-700"></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex animate-pulse space-x-4 pt-2">
                                  <div className="flex-1 space-y-6 py-1">
                                    <div className="grid grid-cols-8 gap-4">
                                      <div className="col-span-6 md:col-span-4 h-5 rounded bg-gray-700"></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex animate-pulse space-x-4 pt-2">
                                  <div className="flex-1 space-y-6 py-1">
                                    <div className="grid grid-cols-8 gap-4">
                                      <div className="col-span-6 md:col-span-4 h-60 rounded bg-gray-700"></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex animate-pulse space-x-4 pt-2">
                                  <div className="flex-1 space-y-6 py-10">
                                    <div className="grid grid-cols-8 gap-4">
                                      <div className="col-span-6 md:col-span-4  h-20 rounded bg-gray-700"></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex animate-pulse space-x-4 pt-2">
                                  <div className="flex-1 space-y-6 py-1">
                                    <div className="grid grid-cols-8 gap-4">
                                      <div className="col-span-6 md:col-span-4  h-40 rounded bg-gray-700"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex animate-pulse space-x-4 pt-2">
                                <div className="flex-1 space-y-6 py-1">
                                  <div className="grid grid-cols-8 gap-4">
                                    <div className="col-span-6 md:col-span-4  h-5 rounded bg-gray-700"></div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex animate-pulse space-x-4 pt-2">
                                <div className="flex-1 space-y-6 py-1">
                                  <div className="grid grid-cols-8 gap-4">
                                    <div className="col-span-6 md:col-span-4  h-60 rounded bg-gray-700"></div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex animate-pulse space-x-4 pt-2">
                                <div className="flex-1 space-y-6 py-10">
                                  <div className="grid grid-cols-8 gap-4">
                                    <div className="col-span-6 md:col-span-4  h-20 rounded bg-gray-700"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {!isLoading && (
                            <div className="flex w-full flex-auto">
                              <div className="w-14 flex-none bg-white ring-1 ring-gray-100" />
                              <div className="grid flex-auto grid-cols-1 grid-rows-1">
                                {/* Horizontal lines */}
                                <div
                                  className="col-start-1 col-end-2 row-start-1 grid divide-y divide-gray-100"
                                  style={{ gridTemplateRows: 'repeat(24, minmax(3.5rem, 1fr))' }}
                                >
                                  {hoursList.map((hour) => (
                                    <div key={hour.value}>
                                      <div className=" left-0 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400 h-0 ">
                                        {hour.label}
                                      </div>
                                      {[...Array(12)].map((_, i) => (
                                        <div
                                          key={i}
                                          className={
                                            checkHourIsInsideSchedule(
                                              hour.value,
                                              i * 5,
                                              morningSchedule,
                                              afternoonSchedule,
                                              freeAFternoonOrMorning
                                            )
                                              ? 'bg-gray-50 h-2'
                                              : ''
                                          }
                                        ></div>
                                      ))}
                                    </div>
                                  ))}
                                </div>

                                {/* Events */}

                                <ol
                                  className="col-start-1 col-end-2 row-start-1 grid grid-cols-1 cursor-pointer"
                                  style={{ gridTemplateRows: 'repeat(288, minmax(0, 1fr)) auto' }}
                                  onClick={(e) => {
                                    if (!props.userHasPermissionToCreateRequest) return;
                                    const grid = e.currentTarget;
                                    const rect = grid.getBoundingClientRect();
                                    const rowHeight = rect.height / 290; // 290 is the total number of rows (1 + 288 + 1)
                                    const clickPositionY = e.clientY - rect.top; // Position of the click relative to the grid container
                                    const rowIndex = Math.floor(clickPositionY / rowHeight);
                                    const newDate = new Date(props.date);
                                    const d = new Date(
                                      newDate.setHours(Math.floor(rowIndex / 12), (rowIndex % 12) * 5, 0, 0)
                                    );
                                    props.openCreateModal(d, props.member_id);
                                  }}
                                >
                                  {events.map((event) => event)}
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
