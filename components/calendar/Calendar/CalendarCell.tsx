import { EndAt, RequestStatus, StartAt } from '@prisma/client';
import { differenceInMinutes, format } from 'date-fns';
import { dateFromDatabaseIgnoreTimezone, dateToIsoDate, isDayUnit, isHourUnit } from 'lib/DateHelper';
import { getDayStartAndEndTimeFromscheduleOnClient, setScheduleFreeTimes } from 'lib/requestUtilities';
import React, { useEffect, useMemo, useState } from 'react';
import { type RouterOutputs } from '~/utils/api';
import { classNames } from '../../../lib/classNames';
import { Icon } from '@components/Icon';
import useTranslation from 'next-translate/useTranslation';
import { useCalendarView } from '../CalendarViewContext';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { openDialogValuesType } from '../CreateRequest/CreateRequest';

type Props = {
  date: Date;
  member: defaultMemberSelectOutput;
  member_requests?: RouterOutputs['request']['allOfUsersByDay'];
  member_public_holiday_days: RouterOutputs['public_holiday_day']['all'];
  workspaceSchedule: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current'];
  isAnyHalfDayLT: boolean;
  isToday?: boolean;
  onOpenDetailModal(data: {
    data: RouterOutputs['request']['allOfUsersByDay'] | { id: string };
    openAsScheduler: boolean;
    day: Date;
  }): void;
  onSelectionFinished(data: openDialogValuesType): void;
  withBorder: boolean;
  userHasPermissionToCreateRequest: boolean;
};

const Cell = ({
  date,
  member,
  member_requests,
  member_public_holiday_days,
  workspaceSchedule,
  isAnyHalfDayLT,
  isToday,
  onOpenDetailModal,
  onSelectionFinished,
  withBorder,
  userHasPermissionToCreateRequest
}: Props) => {
  const { t } = useTranslation('calendar');
  const birthday = useMemo(() => {
    return member.birthday ? format(dateToIsoDate(member.birthday), 'dd.MM') == format(date, 'dd.MM') : false;
  }, [member.birthday, date]);

  const anniversary = useMemo(() => {
    return member.employment_start_date
      ? format(dateToIsoDate(member.employment_start_date), 'dd.MM') == format(date, 'dd.MM') &&
          format(dateToIsoDate(member.employment_start_date), 'yyyy') < format(date, 'yyyy')
      : false;
  }, [member.employment_start_date, date]);

  const holiday = useMemo(() => {
    return member_public_holiday_days.find(
      (holiday) => dateToIsoDate(holiday.date).toDateString() == date.toDateString()
    );
  }, [member_public_holiday_days, date]);
  const schdeuleOnDate = useMemo(() => {
    let schedule = member.schedules.find((x) => x.from && dateToIsoDate(x.from) <= date);
    if (!schedule) schedule = workspaceSchedule as defaultMemberSelectOutput['schedules'][0];
    return schedule;
  }, [date, member.schedules, workspaceSchedule]);
  const publicHoliday = useMemo(() => {
    if (!holiday) return null;

    if (holiday.duration == 'Morning') return { morning: { tooltip: holiday.name }, afternoon: undefined };
    else if (holiday.duration == 'Afternoon') return { morning: undefined, afternoon: { tooltip: holiday.name } };
    else return { morning: { tooltip: holiday.name }, afternoon: { tooltip: holiday.name } };
  }, [holiday]);

  const { itsFreeMorning, itsFreeAfternoon } = useMemo(() => {
    let freeMorning = false;
    let freeAfternoon = false;

    if (publicHoliday) {
      if (publicHoliday.morning) freeMorning = true;
      if (publicHoliday.afternoon) freeAfternoon = true;
    } else if (schdeuleOnDate) {
      const freeTime = setScheduleFreeTimes(date, schdeuleOnDate);
      freeMorning = freeTime.itsFreeMorning;
      freeAfternoon = freeTime.itsFreeAfternoon;
    }

    return { itsFreeMorning: freeMorning, itsFreeAfternoon: freeAfternoon };
  }, [publicHoliday, schdeuleOnDate, date]);

  const afternoonSchedule = useMemo(() => {
    return getDayStartAndEndTimeFromscheduleOnClient(date, 'afternoon', 'end_of_day', schdeuleOnDate);
  }, [date, schdeuleOnDate]);

  const morningSchedule = useMemo(() => {
    return getDayStartAndEndTimeFromscheduleOnClient(date, 'morning', 'lunchtime', schdeuleOnDate);
  }, [date, schdeuleOnDate]);

  const schedule = { morning: itsFreeMorning, afternoon: itsFreeAfternoon };
  type DateRange = {
    start: Date;
    end: Date;
  };

  function doRangesOverlap(range1: DateRange, range2: DateRange): boolean {
    return range1.start < range2.end && range1.end > range2.start;
  }
  const filterRequests = (left: boolean) => {
    const retVal: RouterOutputs['request']['allOfUsersByDay'] = [];
    if (!member_requests) return retVal;
    const morning = new Date(date);
    morning.setHours(0, 0, 0, 0);
    const night = new Date(date);
    night.setHours(23, 59, 59, 0);

    for (let index = 0; index < member_requests.length; index++) {
      const request = member_requests[index];
      if (!request) continue;
      const start1 = dateFromDatabaseIgnoreTimezone(request.start);
      const end1 = dateFromDatabaseIgnoreTimezone(request.end);
      const afternoonScheduleStart = dateFromDatabaseIgnoreTimezone(afternoonSchedule.start);
      if (
        left &&
        doRangesOverlap(
          {
            start: morning,
            end: afternoonScheduleStart
          },
          {
            start: start1,
            end: end1
          }
        )
      ) {
        retVal.push(request);
      } else if (
        !left &&
        doRangesOverlap(
          {
            start: afternoonScheduleStart,
            end: night
          },
          {
            start: start1,
            end: end1
          }
        )
      ) {
        retVal.push(request);
      }
    }
    return retVal;
  };

  const [rRequests, setRRequests] = useState<RouterOutputs['request']['allOfUsersByDay']>([]);
  const [lRequests, setLRequests] = useState<RouterOutputs['request']['allOfUsersByDay']>([]);
  const [day, setDay] = useState<{
    morning: { icon: string | undefined; color: string; day_unit: boolean }[];
    afternoon: { icon: string | undefined; color: string; day_unit: boolean }[];
  }>({ morning: [], afternoon: [] });

  useEffect(() => {
    // Direkte Berechnung von rRequests und lRequests
    const newRRequests = filterRequests(false);
    const newLRequests = filterRequests(true);
    setRRequests(newRRequests);
    setLRequests(newLRequests);

    // Aktualisierung von `day` basierend auf neuen Werten von rRequests und lRequests
    const newDay = {
      morning: newLRequests.map((request) => ({
        icon: request.details?.leave_type.icon ?? undefined,
        color: request.details?.leave_type.color ?? hexToRgbA('#494b83', 1) + '',
        day_unit: isDayUnit(request.leave_unit)
      })),
      afternoon: newRRequests.map((request) => ({
        icon: request.details?.leave_type.icon ?? undefined,
        color: request.details?.leave_type.color ?? hexToRgbA('#494b83', 1) + '',
        day_unit: isDayUnit(request.leave_unit)
      }))
    };
    setDay(newDay);
  }, [member_requests]); // Abhängigkeit nur von `member_requests`

  const [showIcon, setShowIcon] = useState(true);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);
  const { selectionStartDate, selectionEndDate, setSelectionStartDate, setSelectionEndDate, setMouseDown, mouseDown } =
    useCalendarView();

  const handleMouseEnter = (side: 'left' | 'right') => {
    setShowIcon(false);

    if (
      (side === 'left' && (publicHoliday?.morning || day.morning || lRequests.length > 0)) ||
      (side === 'right' && (publicHoliday?.afternoon || day.afternoon || rRequests.length > 0)) ||
      birthday ||
      anniversary
    ) {
      return;
    }

    if (!isAnyHalfDayLT) {
      setHoverLeft(true);
      setHoverRight(true);
    } else {
      if (side === 'left') setHoverLeft(true);
      if (side === 'right') setHoverRight(true);
    }
  };

  const handleMouseLeave = (side: 'left' | 'right') => {
    setShowIcon(true);

    if (!isAnyHalfDayLT) {
      setHoverLeft(false);
      setHoverRight(false);
    } else {
      if (side === 'left') setHoverLeft(false);
      if (side === 'right') setHoverRight(false);
    }
  };

  const combineMorningTooltips = () => {
    const tooltips = [];

    if (publicHoliday?.morning) tooltips.push(publicHoliday.morning.tooltip);

    for (let index = 0; index < lRequests.length; index++) {
      const r = lRequests[index];
      if (!r) continue;
      if (!r.details?.leave_type && tooltips.indexOf(t('Absent')) == -1) tooltips.push(t('Absent'));
      else if (tooltips.indexOf(r.details?.leave_type.name) == -1) tooltips.push(r.details?.leave_type.name);
    }

    if (birthday) tooltips.push(t('Birthday'));

    if (anniversary) tooltips.push(t('Anniversary'));

    return tooltips.join(' / ');
  };

  const combineAfternoonTooltips = () => {
    const tooltips = [];

    if (publicHoliday?.afternoon) tooltips.push(publicHoliday.afternoon.tooltip);

    for (let index = 0; index < rRequests.length; index++) {
      const r = rRequests[index];
      if (!r) continue;
      if (!r.details?.leave_type && tooltips.indexOf(t('Absent')) == -1) tooltips.push(t('Absent'));
      else if (tooltips.indexOf(r.details?.leave_type.name) == -1) tooltips.push(r.details?.leave_type.name);
    }

    if (birthday) tooltips.push(t('Birthday'));

    if (anniversary) tooltips.push(t('Anniversary'));

    return tooltips.join(' / ');
  };

  const determineIcon = () => {
    if (publicHoliday?.morning && publicHoliday?.afternoon) return 'Calendar';

    if (birthday) return 'Gift';

    if (anniversary) return 'BookmarkSquareIcon';

    if (day.morning.filter((x) => !x.day_unit).length > 0 || day.afternoon.filter((x) => !x.day_unit).length > 0) {
      let longItems = lRequests.filter((x) => differenceInMinutes(x.end, x.start) > 300);
      longItems.push(...rRequests.filter((x) => differenceInMinutes(x.end, x.start) > 300));
      longItems = longItems.reduce((akkumulator: any, objekt: any) => {
        if (!akkumulator.some((o: any) => o.id === objekt.id)) {
          akkumulator.push(objekt);
        }
        return akkumulator;
      }, []);
      if (longItems.length == 1) {
        return longItems[0]?.details?.leave_type.icon;
      }
    } else {
      if (day.morning[0]?.icon) return day.morning[0].icon;

      if (day.afternoon[0]?.icon) return day.afternoon[0].icon;
    }

    return undefined;
  };

  const getMorningBackgroundClass = () => {
    if (!hoverLeft) {
      if (publicHoliday?.morning) {
        return 'heropattern-texture-gray-400';
      }

      if (birthday && day.morning.length > 0) {
        return 'bg-green-400 opacity-30';
      }
      if (birthday) {
        return 'bg-green-400';
      }

      if (anniversary && day.morning.length > 0) {
        return 'bg-[#003366] opacity-30';
      }

      if (anniversary) {
        return 'bg-[#003366]';
      }
    }

    if (
      selectionStartDate &&
      selectionEndDate &&
      selectionStartDate.member_id == member.id &&
      selectionEndDate.member_id == member.id &&
      date >= selectionStartDate.date &&
      date <= selectionEndDate.date
    ) {
      if (selectionStartDate.date.toDateString() != date.toDateString() || selectionStartDate.at === 'morning') {
        return 'bg-blue-100';
      }
    }

    return '';
  };

  const getAfternoonBackgroundClass = () => {
    if (!hoverRight) {
      if (publicHoliday?.afternoon) {
        return 'heropattern-texture-gray-400';
      }

      if (birthday && day.afternoon.length > 0) {
        return 'bg-green-400 opacity-30';
      }
      if (birthday) {
        return 'bg-green-400';
      }

      if (anniversary && day.afternoon.length > 0) {
        return 'bg-[#003366] opacity-30';
      }

      if (anniversary) {
        return 'bg-[#003366]';
      }
    }

    if (
      selectionStartDate &&
      selectionEndDate &&
      selectionStartDate.member_id == member.id &&
      selectionEndDate.member_id == member.id &&
      date >= selectionStartDate.date &&
      date <= selectionEndDate.date
    ) {
      if (selectionEndDate.date.toDateString() != date.toDateString() || selectionEndDate.at === 'end_of_day') {
        return 'bg-blue-100';
      }
    }

    return '';
  };

  const dynamicAfternoonBackground = () => {
    if (day.afternoon.length == 0) return {};
    if (!day.afternoon[0]) return {};
    if (day.afternoon.find((x) => !x.day_unit)) return { backgroundColor: 'transparent' };

    if (!rRequests[0]?.details?.leave_type) {
      return { backgroundColor: hexToRgbA('#494b83', 1) };
    }

    let rgbaColor = hexToRgbA(day.afternoon[0].color, 1);

    if (rRequests[0]?.details?.status === RequestStatus.PENDING) {
      rgbaColor = hexToRgbA(day.afternoon[0].color, 0.5);
    }

    return { backgroundColor: rgbaColor };
  };

  const dynamicMorningBackground = () => {
    if (day.morning.length == 0) return {};
    if (!day.morning[0]) return {};
    if (day.morning.find((x) => !x.day_unit)) return { backgroundColor: 'transparent' };

    if (!lRequests[0]?.details?.leave_type) {
      return { backgroundColor: hexToRgbA('#494b83', 1) };
    }

    let rgbaColor = hexToRgbA(day.morning[0].color, 1);

    if (lRequests[0]?.details?.status === RequestStatus.PENDING) {
      rgbaColor = hexToRgbA(day.morning[0].color, 0.5);
    }

    return { backgroundColor: rgbaColor };
  };

  const getOverlayClass = (isMorning: boolean) => {
    if (isMorning && schedule.morning) {
      if (birthday) {
        return 'heropattern-texture-green-400';
      }
      if (anniversary) {
        return 'heropattern-texture-blue-400';
      }
    }

    if (isMorning && day.morning && schedule?.morning) {
      return 'heropattern-texture-gray-400';
    }

    if (!isMorning && schedule.afternoon) {
      if (birthday) {
        return 'heropattern-texture-green-400';
      }
      if (anniversary) {
        return 'heropattern-texture-blue-400';
      }
    }

    if (!isMorning && day.afternoon && schedule.afternoon) {
      return 'heropattern-texture-gray-400';
    }

    return '';
  };

  const TimeBar: React.FC<{
    timeRanges: RouterOutputs['request']['allOfUsersByDay'];
  }> = ({ timeRanges }) => {
    const dateStr = useMemo(() => date.toDateString(), [date]);
    const [timeOutsideOfSchedule, setTimeOutsideOfSchedule] = useState(false);
    const filteredTimeRanges = useMemo(
      () =>
        timeRanges.filter((d) => {
          const start1 = dateFromDatabaseIgnoreTimezone(d.start).toDateString();
          const end1 = dateFromDatabaseIgnoreTimezone(d.end).toDateString();
          return start1 === dateStr || end1 === dateStr;
        }),
      [timeRanges, dateStr]
    );

    const renderBars = useMemo(() => {
      return filteredTimeRanges.map((range, index) => {
        let rStart = dateFromDatabaseIgnoreTimezone(range.start);
        let rEnd = dateFromDatabaseIgnoreTimezone(range.end);
        let morningScheduleStart = dateFromDatabaseIgnoreTimezone(morningSchedule.start);
        let afternoonScheduleEnd = dateFromDatabaseIgnoreTimezone(afternoonSchedule.end);
        if (rStart.toDateString() !== dateStr) return null;
        if (rStart > afternoonScheduleEnd) {
          setTimeOutsideOfSchedule(true);
          return null;
        }
        if (rEnd < morningScheduleStart) {
          setTimeOutsideOfSchedule(true);
          return null;
        }

        if (rStart < morningScheduleStart) rStart = morningScheduleStart;
        if (rEnd > afternoonScheduleEnd) rEnd = afternoonScheduleEnd;

        const totalMinutes = differenceInMinutes(afternoonScheduleEnd, morningScheduleStart);
        const startMinutes = differenceInMinutes(rStart, morningScheduleStart);
        const endMinutes = differenceInMinutes(rEnd, morningScheduleStart);
        const width = ((Math.min(endMinutes, totalMinutes) - startMinutes) / totalMinutes) * 100;
        const left = (startMinutes / totalMinutes) * 100;

        return (
          <div
            key={index}
            className="absolute bottom-0"
            style={{
              backgroundColor: range.details?.leave_type.color ?? hexToRgbA('#494b83', 1),
              width: `${width}%`,
              left: `${left}%`,
              height: '100%'
            }}
          />
        );
      });
    }, [filteredTimeRanges, dateStr]);

    if (filteredTimeRanges.length === 0 || filteredTimeRanges.filter((x) => isHourUnit(x.leave_unit)).length === 0) {
      return (
        <>
          <div style={dynamicMorningBackground()} className="absolute z-10 top-0 left-0 h-10 w-1/2">
            <div
              className={`${getMorningBackgroundClass()} h-10 ${
                withBorder ? 'border-b border-gray-300 w-5' : 'w-4 1md:w-5 lg:w-5 xl:w-5'
              }`}
            >
              {schedule.morning && (
                <div className={`absolute inset-0 bg-gray-300 opacity-40 ${getOverlayClass(true)}`}></div>
              )}
            </div>
          </div>
          <div
            style={dynamicAfternoonBackground()}
            className={`absolute z-10 top-0 ${
              withBorder ? 'left-5' : 'left-4 1md:left-5 lg:left-5 xl:left-5'
            } h-10 w-1/2`}
          >
            <div
              className={`${getAfternoonBackgroundClass()} h-10 ${
                withBorder ? 'border-b border-gray-300 w-5' : 'w-4 1md:w-5 lg:w-5 xl:w-5'
              }`}
            >
              {schedule.afternoon && (
                <div className={`absolute inset-0 bg-gray-300 opacity-40 ${getOverlayClass(false)}`}></div>
              )}
            </div>
          </div>
        </>
      );
    }
    return (
      <div className="absolute z-10 top-0 left-0 h-10 w-full flex">
        <div>{renderBars}</div>
        <div style={dynamicMorningBackground()} className="absolute z-10 top-0 left-0 h-10 w-1/2">
          <div
            className={`${getMorningBackgroundClass()} h-10 ${
              withBorder ? 'border-b border-gray-300 w-5' : 'w-4 1md:w-5 lg:w-5 xl:w-5'
            }`}
          >
            {schedule.morning && (
              <div className={`absolute inset-0 bg-gray-300 opacity-40 ${getOverlayClass(true)}`}></div>
            )}
          </div>
        </div>
        <div
          style={dynamicAfternoonBackground()}
          className={`absolute z-10 top-0 ${
            withBorder ? 'left-5' : 'left-4 1md:left-5 lg:left-5 xl:left-5'
          } h-10 w-1/2`}
        >
          <div
            className={`${getAfternoonBackgroundClass()} h-10 ${
              withBorder ? 'border-b border-gray-300 w-5' : 'w-4 1md:w-5 lg:w-5 xl:w-5'
            }`}
          >
            {schedule.afternoon && (
              <div className={`absolute inset-0 bg-gray-300 opacity-40 ${getOverlayClass(false)}`}></div>
            )}
          </div>
        </div>
        {timeOutsideOfSchedule && (
          <div
            className="absolute top-0 z-20 right-0 bg-orange-400"
            style={{
              width: '10px',
              height: '10px',
              clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
            }}
          ></div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={classNames(
          'relative h-10 box-content',
          withBorder ? 'border-r border-gray-300 bg-transparent w-10' : 'w-8 1md:w-10 lg:w-10 xl:w-10'
        )}
      >
        {isToday && (
          <div className="absolute inset-0 border-2 border-blue-500 rounded-full z-30 pointer-events-none"></div>
        )}

        <div
          data-tooltip-id="cell-tooltip"
          data-tooltip-content={combineMorningTooltips()}
          className={`absolute z-20 top-0 left-0 h-10 w-1/2  ${
            userHasPermissionToCreateRequest && hoverLeft ? 'bg-gray-300' : 'bg-transparent'
          } ${(userHasPermissionToCreateRequest || lRequests[0] || publicHoliday?.morning) && 'cursor-pointer'}`}
          onMouseEnter={() => handleMouseEnter('left')}
          onMouseLeave={() => handleMouseLeave('left')}
          onClick={() => {
            if (lRequests.length > 0) {
              onOpenDetailModal({
                data: lRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }

            if (holiday?.duration == 'Morning' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }

            if (userHasPermissionToCreateRequest) {
              onSelectionFinished({
                start: date,
                start_at: 'morning',
                end: date,
                end_at: 'lunchtime',
                member_id: member.id,
                department_id: null
              });
            }
          }}
          onMouseDown={() => {
            if (lRequests.length > 0) {
              onOpenDetailModal({
                data: lRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }
            if (holiday?.duration == 'Morning' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }
            if (userHasPermissionToCreateRequest) {
              setMouseDown(member.id);
              setSelectionStartDate({
                date: date,
                at: 'morning',
                member_id: member.id
              });
            }
          }}
          onMouseOver={() => {
            if (mouseDown == '') return;
            if (selectionStartDate && selectionStartDate.date.getFullYear() != date.getFullYear()) return;
            if (mouseDown == member.id)
              setSelectionEndDate({
                date,
                at: 'lunchtime',
                member_id: member.id
              });
          }}
          onMouseUp={() => {
            if (lRequests.length > 0) {
              onOpenDetailModal({
                data: lRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }
            if (holiday?.duration == 'Morning' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }
            if (selectionStartDate && selectionStartDate.date.getFullYear() != date.getFullYear()) return;
            if (selectionStartDate) {
              onSelectionFinished({
                start: selectionStartDate.date,
                start_at: selectionStartDate.at,
                end: date,
                end_at: 'lunchtime',
                member_id: member.id,
                department_id: null
              });
            }
          }}
        ></div>

        <div
          data-tooltip-id="cell-tooltip"
          data-tooltip-content={combineAfternoonTooltips()}
          className={`absolute z-20 top-0 right-0 h-10 w-1/2 ${
            userHasPermissionToCreateRequest && hoverRight ? 'bg-gray-300' : 'bg-transparent'
          } ${(userHasPermissionToCreateRequest || rRequests[0] || publicHoliday?.afternoon) && 'cursor-pointer'}`}
          onMouseEnter={() => handleMouseEnter('right')}
          onMouseLeave={() => handleMouseLeave('right')}
          onClick={() => {
            if (rRequests.length > 0) {
              onOpenDetailModal({
                data: rRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }
            if (holiday?.duration == 'Afternoon' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }

            if (userHasPermissionToCreateRequest) {
              onSelectionFinished({
                start: date,
                start_at: 'afternoon',
                end: date,
                end_at: 'end_of_day',
                member_id: member.id,
                department_id: null
              });
            }
          }}
          onMouseDown={() => {
            if (rRequests.length > 0) {
              onOpenDetailModal({
                data: rRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }
            if (holiday?.duration == 'Afternoon' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }
            if (userHasPermissionToCreateRequest) {
              setMouseDown(member.id);
              setSelectionStartDate({
                date: date,
                at: 'afternoon',
                member_id: member.id
              });
            }
          }}
          onMouseOver={() => {
            if (mouseDown == '') return;
            if (selectionStartDate && selectionStartDate.date.getFullYear() != date.getFullYear()) return;
            if (mouseDown == member.id)
              setSelectionEndDate({
                date,
                at: 'end_of_day',
                member_id: member.id
              });
          }}
          onMouseUp={() => {
            if (rRequests.length > 0) {
              onOpenDetailModal({
                data: rRequests,
                openAsScheduler:
                  day.morning.find((x) => !x.day_unit) || day.afternoon.find((x) => !x.day_unit) ? true : false,
                day: date
              });
              return;
            }
            if (holiday?.duration == 'Afternoon' || holiday?.duration == 'FullDay') {
              onOpenDetailModal({ data: holiday, openAsScheduler: false, day: date });
              return;
            }
            if (selectionStartDate && selectionStartDate.date.getFullYear() != date.getFullYear()) return;
            if (selectionStartDate)
              onSelectionFinished({
                start: selectionStartDate.date,
                start_at: selectionStartDate.at,
                end: date,
                end_at: 'end_of_day',
                member_id: member.id,
                department_id: null
              });
          }}
        ></div>

        {member_requests && <TimeBar timeRanges={member_requests} />}

        <div className="absolute z-30 inset-0 flex items-center justify-center pointer-events-none">
          {showIcon &&
          ((dynamicMorningBackground().backgroundColor && dynamicAfternoonBackground().backgroundColor) ||
            (getAfternoonBackgroundClass() !== '' && getMorningBackgroundClass() !== '')) &&
          determineIcon() ? (
            <Icon key={'2'} name={determineIcon()} className="" color="white" width="5" />
          ) : (
            <span className="text-black text-sm text-center">{date.getDate()}</span>
          )}
        </div>
      </div>
    </>
  );
};

export default Cell;

function hexToRgbA(hex: string, opercity: number) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length == 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = `0x${c.join('')}`;

    return `rgba(${
      // @ts-ignore
      [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')
    },${opercity})`;
  }
}
