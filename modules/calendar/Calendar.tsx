import useTranslation from 'next-translate/useTranslation';
import React, { useEffect, useState } from 'react';
import { useCalendarView } from '../../components/calendar/CalendarViewContext';
import { type RouterOutputs } from '~/utils/api';
import Cell from '@components/calendar/Calendar/CalendarCell';
import { api } from '~/utils/api';
import { getISOWeek } from 'date-fns';
import { useAbsentify } from '@components/AbsentifyContext';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { CheckCurrentUserHasPermissionToCreateRequest } from '~/lib/requestUtilities';
import { capitalizeFirstMonthLetter } from "~/helper/capitalizeFirstMonthLetter";
import { openDialogValuesType } from '@components/calendar/CreateRequest/CreateRequest';

const Calendar = (props: {
  year: number;
  month: number;
  member: defaultMemberSelectOutput;
  member_requests: RouterOutputs['request']['allOfUsersByDay'];
  member_public_holiday_days: RouterOutputs['public_holiday_day']['all'];
  workspaceSchedule: RouterOutputs['workspace_schedule']['current'];
  openAddDialog(data: openDialogValuesType): void;
  onOpenDetailModal(props: {
    data: RouterOutputs['request']['allOfUsersByDay'] | { id: string };
    openAsScheduler: boolean;
  }): void;
  withBorder: boolean;
}) => {
  const { current_member } = useAbsentify();
  const { t, lang } = useTranslation('calendar');
  const { setSelectionStartDate, setSelectionEndDate, setMouseDown } = useCalendarView();
  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const divWeeks = [
    { name: t('Monday').charAt(0) },
    { name: t('Tuesday').charAt(0) },
    { name: t('Wednesday').charAt(0) },
    { name: t('Thursday').charAt(0) },
    { name: t('Friday').charAt(0) },
    { name: t('Saturday').charAt(0) },
    { name: t('Sunday').charAt(0) }
  ];
  const startOfTheWeek = Number(current_member?.week_start) - 1;
  const [weeks, setWeeks] = useState<any>([]);
  const shiftedDivDays = divWeeks.slice(startOfTheWeek).concat(divWeeks.slice(0, startOfTheWeek));
  const shiftedWeeks = [];
  const defaultWeek = [];
  for (let i = 0; i < 7; i++) {
    defaultWeek.push(
      <React.Fragment key={i + '1'}>
        <div className=" z-0 w-10 text-center h-10 box-content border-r border-gray-300">
          <div className="border-b border-gray-300 h-10"></div>
        </div>
      </React.Fragment>
    );
  }
  for (let i = 0; i < weeks.length; i++) {
    if (i > 6) {
      break;
    }
    const previousWeek = weeks[i - 1] || defaultWeek;
    let emptyWeek = false;
    const startOfCurrentWeek = weeks[i];
    const shiftedWeek = previousWeek
      .slice(startOfTheWeek, startOfCurrentWeek.length)
      .concat(startOfCurrentWeek.slice(0, startOfTheWeek));
    if (i === 0) {
      emptyWeek = shiftedWeek.every((week: any) => (week?.props?.date ? false : true));
    }
    if (emptyWeek) {
      weeks.push(defaultWeek);
      continue;
    }
    shiftedWeeks.push(shiftedWeek);
  }

  const renderTable = () => {
    if (!current_member) return;
    if (!current_member.id) return;
    if (!leave_types) return;
    let firstEmptyBoxesNbr = 0;
    const isAnyHalfDayLT = leave_types.some((leaveType: any) => leaveType.minimum_daily_absence != 'FullDay');
    const arrayOfDays = [];
    const start = firstDayOfMonth();
    let today = new Date();

    let i = 0;

    for (let index = 0; index < start - 1; index++) {
      i++;
      if (i === 1) {
        arrayOfDays.push(
          <React.Fragment key={i + '1'}>
            <div className=" z-0 w-10 text-center h-10 box-content border-gray-300 border-r">
              <div className="border-b border-gray-300 h-10"></div>
            </div>
          </React.Fragment>
        );
      }
      if (i !== 1)
        arrayOfDays.push(
          <React.Fragment key={i + '1'}>
            <div className=" z-0 w-10 text-center h-10 border-r border-gray-300 box-content">
              <div className="border-b border-gray-300 h-10"></div>
            </div>
          </React.Fragment>
        );
      firstEmptyBoxesNbr = i;
    }
    let userHasPermissionToCreateRequest = false;
    if (current_member) {
      userHasPermissionToCreateRequest = CheckCurrentUserHasPermissionToCreateRequest(current_member, props.member);
    }

    for (let index = 0; index < lastDayOfMonth(); index++) {
      const day = index + 1;
      const dd = new Date(props.year, props.month, day, 0, 0, 0, 0);
      if (firstEmptyBoxesNbr + index === 6) {
        arrayOfDays.push(
          <Cell
            key={index + (current_member?.id + '3' ?? '0')}
            member={props.member}
            member_requests={props.member_requests}
            workspaceSchedule={props.workspaceSchedule}
            member_public_holiday_days={props.member_public_holiday_days}
            date={dd}
            onSelectionFinished={(x) => {
              if (x) {
                props.openAddDialog(x);
                setMouseDown('');
                setSelectionStartDate(null);
                setSelectionEndDate(null);
              }
            }}
            onOpenDetailModal={props.onOpenDetailModal}
            withBorder={props.withBorder}
            isAnyHalfDayLT={isAnyHalfDayLT}
            isToday={dd.toDateString() == today.toDateString()}
            userHasPermissionToCreateRequest={userHasPermissionToCreateRequest}
          ></Cell>
        );
      }
      if (firstEmptyBoxesNbr + index !== 6) {
        arrayOfDays.push(
          <Cell
            key={index + (current_member?.id + '4' ?? '0')}
            member={props.member}
            member_requests={props.member_requests}
            member_public_holiday_days={props.member_public_holiday_days}
            workspaceSchedule={props.workspaceSchedule}
            date={dd}
            onSelectionFinished={(x) => {
              if (x) {
                props.openAddDialog(x);
                setMouseDown('');
                setSelectionStartDate(null);
                setSelectionEndDate(null);
              }
            }}
            onOpenDetailModal={props.onOpenDetailModal}
            withBorder={props.withBorder}
            isAnyHalfDayLT={isAnyHalfDayLT}
            isToday={dd.toDateString() == today.toDateString()}
            userHasPermissionToCreateRequest={userHasPermissionToCreateRequest}
          ></Cell>
        );
      }
      i++;

      if (i == 7) i = 0;
    }

    const numberOfRemainingBoxes = 42 - arrayOfDays.length;
    // setLastEmptyBoxesNbr(numberOfRemainingBoxes)
    for (let index = 0; index < numberOfRemainingBoxes; index++) {
      switch (true) {
        case index === numberOfRemainingBoxes - 1 && startOfTheWeek === 0: {
          arrayOfDays.push(
            <React.Fragment key={i + '1'}>
              <div className=" w-10 h-10 border-r border-gray-300 bg-transparent box-content rounded-br-lg">
                <div className="border-b border-gray-300 h-10"></div>
              </div>
            </React.Fragment>
          );
          break;
        }
        case index === numberOfRemainingBoxes - 7: {
          arrayOfDays.push(
            <React.Fragment key={i + '1'}>
              <div className=" w-10 h-10 border-r border-gra-300 bg-transparent box-content">
                <div className="border-b border-gray-300 h-10"></div>
              </div>
            </React.Fragment>
          );
          break;
        }
        default: {
          arrayOfDays.push(
            <React.Fragment key={i + '1'}>
              <div className=" w-10 h-10 border-r border-gray-300 bg-transparent box-content">
                <div className="border-b border-gray-300 h-10"></div>
              </div>
            </React.Fragment>
          );
          break;
        }
      }
    }

    const weeks: any = [];
    let weekNumber = -1;
    arrayOfDays.forEach((td: any, i: number) => {
      if (i % 7 !== 0) {
        weeks[weekNumber].push(td); // if index not equal 7 that means not go to next week
      } else {
        weekNumber++;
        weeks.push([]); // when reach next week we contain all td in last week to rows
        weeks[weekNumber].push(td); // in current loop we still push current row to new container
      }
    });
    setWeeks(weeks);
  };

  const Months = [];
  Months.push(
    capitalizeFirstMonthLetter(new Date(props.year, props.month, 15, 0, 0, 0, 0).toLocaleString(lang, {
      month: 'long'
    }), lang)
  );

  useEffect(() => {
    if (!current_member) return;
    if (!props.year) return;
    if (!props.member_requests) return;
    renderTable();
  }, [props.year, current_member, props.member_requests, props.member]);

  const firstDayOfMonth = () => {
    const retValue = new Date(props.year, props.month, 1).getDay();
    return retValue == 0 ? 7 : retValue;
  };
  const lastDayOfMonth = () => {
    return new Date(props.year, props.month + 1, 0).getDate();
  };

  const splitCW = t('Calendar_Weekday').split(' ');
  const CW = splitCW[1]?.charAt(0);
  const showCW = current_member?.display_calendar_weeks;
  const monthName = capitalizeFirstMonthLetter(new Date(props.year, props.month, 15, 0, 0, 0, 0).toLocaleString(lang, { month: 'long' }), lang);
  return (
    <>
      <div className="sm:mx-2 sm:my-4 xg:mx-0 xl:mx-2">
        <div className="bg-grey-lighter dark:text-white px-2 py-2 text-center ">
          {monthName}
        </div>
        <div className="mx-3 mt-4 inline-flex text-center text-xs leading-6 text-gray-500">
          {showCW && <div className="w-10">{CW}</div>}
          {shiftedDivDays.map((div, index) => (
            <div key={div.name + index} className="w-10">
              {div.name}
            </div>
          ))}
        </div>

        <div className="mx-2 w-auto overflow-hidden  rounded-xl border shadow ">
          {shiftedWeeks.map((x: any, y: number) => {
            if (showCW) {
              const firstDayWeek = x[0].props.date;
              const lastDayWeek = x[6].props.date;
              const weekNumber = getISOWeek(firstDayWeek ? firstDayWeek : lastDayWeek);

              return (
                <div key={y} className="flex h-10 w-auto flex-row">
                  <React.Fragment>
                    <div className=" z-0 w-10 text-center justify-center flex flex-col text-gray-500 text-sm">
                      {weekNumber ? weekNumber : null}
                    </div>
                    <div className="z-0 -ml-10 border-b border-gray-500 bg-transparent text-center  opacity-30">
                      <div className="h-10 w-5 opacity-0"></div>
                    </div>
                    <div className="z-0  border-r border-b border-gray-500 bg-transparent text-center  opacity-30">
                      <div className={'h-10 w-5  opacity-0'}></div>
                    </div>
                  </React.Fragment>
                  {x.map((z: any, k: number) => {
                    return <React.Fragment key={k}>{z}</React.Fragment>;
                  })}
                </div>
              );
            }
            return (
              <div key={y} className="flex h-10 w-auto flex-row">
                {x.map((z: any, k: number) => {
                  return <React.Fragment key={k}>{z}</React.Fragment>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Calendar;
