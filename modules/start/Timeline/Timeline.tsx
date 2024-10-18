import Cell from '@components/calendar/Calendar/CalendarCell';
import CancelModal from '@components/calendar/CancelModal';
import AddHoliday from '@components/calendar/CreateRequest/CreateRequest';
import DetailsModal from '@components/calendar/DetailsModal';
import PublicHolidayDetailsModal from '@components/calendar/PublicHolidayDetailsModal';
import ProfileImage from '@components/layout/components/ProfileImage';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid';
import { ChevronDownIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { addDays, format, getISOWeek, subDays } from 'date-fns';
import { areDatesEqualWithoutTime, dateFromDatabaseIgnoreTimezone, formatDate } from 'lib/DateHelper';
import { classNames } from 'lib/classNames';
import { dateToIsoDate, convertLocalDateToUTC } from 'lib/DateHelper';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import Select from 'react-select';
import { api, type RouterOutputs } from '~/utils/api';
import { useCalendarView } from '../../../components/calendar/CalendarViewContext';
import { useRouter } from 'next/router';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import {
  CheckCurrentUserHasPermissionToCreateRequest,
  getFiscalYear,
  getFiscalYearStartAndEndDates,
  setScheduleFreeTimes
} from '~/lib/requestUtilities';
import { EndAt, StartAt, Status } from '@prisma/client';
import { formatDuration } from '~/helper/formatDuration';
import DayScheduleModal from '@components/calendar/DayScheduleModal';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { Menu, Transition } from '@headlessui/react';
import { notifyError } from '~/helper/notify';

export type OpenDialogValuesType = {
  start: Date;
  end: Date;
  start_at: StartAt;
  end_at: EndAt;
  member_id: string | null;
  department_id?: string | null;
};

const Timeline: NextPage = () => {
  const { t, lang } = useTranslation('start');
  const translation = useTranslation('calendar');
  const isXS = useMediaQuery({ query: '(max-width: 636px)' });
  const isSM = useMediaQuery({ query: '(max-width: 869px)' });
  const isMD = useMediaQuery({ query: '(max-width: 1023px)' });
  const upMD = useMediaQuery({ minWidth: 1024, maxWidth: 1279 });
  const isLG = useMediaQuery({ minWidth: 1280, maxWidth: 1440 });
  const upLG = useMediaQuery({ query: '(min-width: 1441px)' });
  const upXL = useMediaQuery({ query: '(min-width: 1580px)' });
  const router = useRouter();
  let TODAY = new Date();
  const [screenWidth, setScreenWidth] = useState(0);
  const [switchToday, setSwitchToday] = useState<boolean>(false);
  const { current_member, setTimelineScrollPos, timelineScrollPos, subscription } = useAbsentify();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });
  const [cancelRequest, setCancelRequest] = useState<RouterOutputs['request']['allOfUsersByDay'][0] | null>(null);
  const [detailModalValues, setDetailModalValues] = useState<RouterOutputs['request']['allOfUsersByDay'][0] | null>(
    null
  );
  const [dayScheduleModalValues, setDayScheduleModalValues] = useState<{
    requests: RouterOutputs['request']['allOfUsersByDay'];
    date: Date;
  } | null>(null);
  const { setSelectionStartDate, setSelectionEndDate, setMouseDown } = useCalendarView();
  const [publicHolidayDetailModalValues, setPublicHolidayDetailModalValues] = useState<
    RouterOutputs['public_holiday_day']['byId'] | null
  >(null);
  const [dateRangeText, setDateRangeText] = useState<string>('');
  const [cellQuantity, setCellQuantity] = useState<number>(0);
  const [dateRangeTooltipText, setDateRangeTooltipText] = useState<{
    left: string;
    right: string;
  }>({ left: '', right: '' });
  const [minDateMaxDate, setMinDateMaxDate] = useState<{ min: Date; max: Date } | null>(null);
  const [departmentDropDownValues, setDepartmentDropDownValues] = useState<{ id: string; name: string }[]>();
  const [days, setDays] = useState<Date[]>();
  const [startToday, setStartToday] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>();
  const { data: public_holiday_days } = api.public_holiday_day.all.useQuery(
    {
      start: new Date(
        Date.UTC(
          dateRange?.startDate.getFullYear() ?? 2023,
          dateRange?.startDate.getMonth() ?? 0,
          dateRange?.startDate.getDate() ?? 1,
          0,
          0,
          0
        )
      ),
      end: new Date(
        Date.UTC(
          dateRange?.endDate.getFullYear() ?? 2023,
          dateRange?.endDate.getMonth() ?? 11,
          dateRange?.endDate.getDate() ?? 31,
          0,
          0,
          0
        )
      )
    },
    {
      enabled: current_member?.id != null && dateRange != null,
      staleTime: 60000
    }
  );
  const [visibleMembers, setVisibleMembers] = useState<defaultMemberSelectOutput[]>([]);
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });
  const showCW = current_member?.display_calendar_weeks;
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });
  const [selectedDepartment, setSelectedDepartment] = useState<{
    id: string;
    name: string;
  }>();
  const { data: membersCount } = api.member.count.useQuery(
    {
      status: ['ACTIVE', 'INACTIVE']
    },
    {
      staleTime: 60000
    }
  );
  const { data: membersData, refetch: refetchMemberAll } = api.member.all.useQuery(
    {
      filter: {
        department_ids:
          selectedDepartment?.id == '1' || selectedDepartment?.id == '2'
            ? undefined
            : selectedDepartment
            ? [selectedDepartment.id]
            : undefined,
        status: ['ACTIVE', 'INACTIVE']
      },
      page: 1,
      limit: 1000
    },
    {
      enabled: !!selectedDepartment,
      staleTime: 60000
    }
  );
  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);

  const [fiscal_year, setFiscalYear] = useState<number>(new Date().getFullYear());
  const calcState = (
    memberSchedules: defaultMemberSelectOutput['schedules'],
    schedule: defaultMemberSelectOutput['schedules'][0]
  ) => {
    if (!memberSchedules) return 'current';

    if (schedule.from && schedule.from > new Date()) return 'future';

    if (memberSchedules.length == 1 && schedule.from && schedule.from < new Date()) return 'current';

    const allOldschedules = memberSchedules.filter((x) => x.from && x.from < new Date());
    if (allOldschedules.length > 0 && allOldschedules[0] && allOldschedules[0].id == schedule.id) return 'current';

    return 'completed';
  };
  const [isAnyHalfDayLT, setIsAnyHalfDayLT] = useState(false);
  const { data: leaveTypes } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000,
    enabled: current_member?.id != null
  });
  const CHANGE_TIMELINE_DEPARTMENT = api.member.change_timeline_department.useMutation();
  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    // Check if window is available (client-side rendering)
    if (typeof window !== 'undefined') {
      // Add event listener for window resize
      window.addEventListener('resize', updateScreenWidth);

      // Call the function initially to set the initial screen width
      updateScreenWidth();
    }

    // Cleanup the event listener on component unmount
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScreenWidth);
      }
    };
  }, []);
  useEffect(() => {
    if (!leaveTypes) return;
    setIsAnyHalfDayLT(leaveTypes.some((leaveType: any) => leaveType.leave_unit !== 'days'));
  }, [leaveTypes]);
  const [dialogValues, setDialogValues] = useState<OpenDialogValuesType | null>(null);
  const {
    data: memberRequests,
    isLoading,
    refetch: refetchAllOfUsersByDay
  } = api.request.allOfUsersByDay.useQuery(
    {
      department_ids: selectedDepartment
        ? selectedDepartment?.id != '1' && selectedDepartment?.id != '2'
          ? [selectedDepartment?.id]
          : null
        : null,
      start: dateRange?.startDate ? convertLocalDateToUTC(dateRange?.startDate) : convertLocalDateToUTC(new Date()),
      end: dateRange?.endDate ? convertLocalDateToUTC(dateRange?.endDate) : convertLocalDateToUTC(new Date())
    },
    { enabled: selectedDepartment != undefined, staleTime: 60000 }
  );

  const lastDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 0, 0, 0, 0);
  };
  const calcAndSetDateRanges = (down: boolean) => {
    if (cellQuantity == 0) return;
    if (!dateRange) return;
    let { endDate } = dateRange;
    let { startDate } = dateRange;

    if (startToday && upLG) {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 0, 0, 0, 0);
      endDate = lastDayOfMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1, 0, 0, 0, 0));

      setStartToday(false);
    } else if (down && upLG) {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = lastDayOfMonth(startDate);
    } else if (down && !upLG) {
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
      startDate = subDays(startDate, cellQuantity);
    } else if (!down && upLG) {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1, 0, 0, 0, 0);
      endDate = lastDayOfMonth(startDate);
    } else if (!down && !upLG) {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
      endDate = addDays(endDate, cellQuantity);
    } else if (down) {
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
      startDate = subDays(startDate, cellQuantity);
    } else if (!down) {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
      endDate = addDays(endDate, cellQuantity);
    }
    if (switchToday) {
      setStartToday(true);
      if (upLG) {
        startDate = new Date();
        endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 31, 0, 0, 0, 0);
      } else {
        startDate = new Date();
        endDate = addDays(startDate, cellQuantity);
      }

      setSwitchToday(false);
    }

    if (
      minDateMaxDate &&
      new Date(
        minDateMaxDate.min.getFullYear(),
        minDateMaxDate.min.getMonth(),
        minDateMaxDate.min.getDate(),
        0,
        0,
        0,
        0
      ) <= startDate &&
      new Date(
        minDateMaxDate.max.getFullYear(),
        minDateMaxDate.max.getMonth(),
        minDateMaxDate.max.getDate(),
        0,
        0,
        0,
        0
      ) >= endDate
    )
      setDateRange({ startDate, endDate });
  };
  const getCellQuantity = (screenWidth: number, paddingXinPx: number, userInfoWidth: number, cellWidth: number) => {
    return parseInt(((screenWidth - paddingXinPx - userInfoWidth) / cellWidth).toString().split('.')[0] as string);
  };

  useEffect(() => {
    if (!screenWidth) return;
    if (!dateRange) return;
    if (isLG) setCellQuantity(getCellQuantity(screenWidth, 224, 200, 40));
    if (upLG) setCellQuantity(31);
    if (upMD) setCellQuantity(getCellQuantity(screenWidth, 224, 240, 40));
    if (isMD) setCellQuantity(getCellQuantity(screenWidth, 48, 230, 40));
    if (isSM) setCellQuantity(getCellQuantity(screenWidth, 48, 200, 32));
    if (isXS) setCellQuantity(getCellQuantity(screenWidth, 16, 130, 32));
  }, [isLG, screenWidth, upLG, isXS, isSM, cellQuantity, isMD, dateRange, upMD]);
  useEffect(() => {
    if (!selectedDepartment) return;
    if (!members) return;
    if (!departments) return;
    if (!memberRequests) return;
    if (!workspaceSchedule) return;
    if (selectedDepartment.id === '2') {
      let validSchedules: string[] = [];
      const allRequestToday = memberRequests.filter((request) => {
        const start = dateFromDatabaseIgnoreTimezone(request.start);
        const end = dateFromDatabaseIgnoreTimezone(request.end);
        const datesEqualStart = areDatesEqualWithoutTime(request.start, TODAY);
        const datesEqualEnd = areDatesEqualWithoutTime(request.end, TODAY);
        return (
          (datesEqualStart || TODAY >= start) &&
          (datesEqualEnd || TODAY <= end) &&
          request.details?.leave_type.outlook_synchronization_show_as !== 'workingElsewhere'
        );
      });
      let membersTodayAway: string[] = [];

      allRequestToday.forEach((x) => {
        if (!membersTodayAway.includes(x.requester_member_id)) {
          membersTodayAway.push(x.requester_member_id);
        }
      });
      //search all ids of specific and current schedule that matches today
      members.map((member) => {
        member.schedules.map((schedule) => {
          if (schedule) {
            let x = setScheduleFreeTimes(new Date(), schedule);
            if (calcState(member.schedules, schedule) == 'current' && (x.itsFreeMorning || x.itsFreeAfternoon)) {
              validSchedules.push(schedule.id);
            }
          }
        });
      });

      setVisibleMembers(
        members.filter((member) => {
          //search in public holiday days array if a date correspond to today
          const isHoliday = public_holiday_days
            ?.filter((x) => x.public_holiday_id == member.public_holiday_id)
            .find((date) => {
              const isoDate = dateToIsoDate(date.date);
              return formatDate(isoDate) == formatDate(new Date());
            });
          if (isHoliday) {
            return true;
          }

          //filter according to leave types
          if (membersTodayAway.includes(member.id)) {
            return true;
          }
          //specific schedule is not set -> take workspace schedules

          if (member.schedules.length == 0) {
            if (
              setScheduleFreeTimes(new Date(), workspaceSchedule).itsFreeMorning ||
              setScheduleFreeTimes(new Date(), workspaceSchedule).itsFreeAfternoon
            )
              return true;
          } else return member.schedules.find((schedule) => validSchedules.includes(schedule.id));
        })
      );
      return;
    }
    setVisibleMembers(
      members.filter((member) => {
        if (selectedDepartment.id === '1') return true;
        if (selectedDepartment.id === '2') return true;
        return member.departments.find((y) => y.department?.id === selectedDepartment.id) != null;
      })
    );
  }, [selectedDepartment, members, departments, memberRequests, workspaceSchedule, workspace]);

  useEffect(() => {
    //find in members the oldest allowance start date and the latest allowance end date
    if (!members) return;
    if (!workspace) return;

    let dfeaultValue = getFiscalYearStartAndEndDates(workspace.fiscal_year_start_month, new Date().getFullYear() - 1);
    let dfeaultValueMax = getFiscalYearStartAndEndDates(
      workspace.fiscal_year_start_month,
      new Date().getFullYear() + 1
    );

    let earliestStartDate = dfeaultValue.firstDayOfYear;
    let latestEndDate = dfeaultValueMax.lastDayOfYear;

    for (const member of members) {
      for (const allowance of member.allowances) {
        const start = allowance.start;
        const end = allowance.end;

        if (!earliestStartDate || start < earliestStartDate) {
          earliestStartDate = start;
        }

        if (!latestEndDate || end > latestEndDate) {
          latestEndDate = end;
        }
      }
    }

    setMinDateMaxDate({ min: earliestStartDate, max: latestEndDate });
  }, [members, workspace]);
  useEffect(() => {
    if (!current_member) return;
    if (!dateRange) return;
    if (cellQuantity == 0) return;
    if (
      dateRange.startDate.getMonth() === dateRange.endDate.getMonth() &&
      dateRange.startDate.getFullYear() === dateRange.endDate.getFullYear()
    ) {
      if (
        dateRange.startDate.getDate() === 1 &&
        lastDayOfMonth(dateRange.endDate).toDateString() === dateRange.endDate.toDateString()
      )
        setDateRangeText(
          `${dateRange.startDate.toLocaleString(lang, {
            month: 'long'
          })} ${dateRange.endDate.getFullYear()}`
        );
      else {
        const nd = new Date(dateRange.endDate);
        nd.setDate(nd.getDate());
        const resultL = format(subDays(dateRange.startDate, cellQuantity), current_member.date_format);
        const resultR = format(addDays(dateRange.endDate, cellQuantity), current_member.date_format);
        setDateRangeTooltipText({
          left: `${resultL} ${t('to')} ${format(dateRange.startDate, current_member.date_format)}`,
          right: `${format(nd, current_member.date_format)} ${t('to')} ${resultR}`
        });
        setDateRangeText(
          `${format(dateRange.startDate, current_member.date_format)} ${t('to')} ${format(
            nd,
            current_member.date_format
          )}`
        );
      }
      return;
    }

    if (dateRange.startDate.getMonth() !== dateRange.endDate.getMonth()) {
      const nd = new Date(dateRange.endDate);
      nd.setDate(nd.getDate());
      const resultL = format(subDays(dateRange.startDate, cellQuantity), current_member.date_format);
      const resultR = format(addDays(dateRange.endDate, cellQuantity), current_member.date_format);
      setDateRangeTooltipText({
        left: `${resultL} ${t('to')} ${format(dateRange.startDate, current_member.date_format)}`,
        right: `${format(nd, current_member.date_format)} ${t('to')} ${resultR}`
      });
      setDateRangeText(
        `${format(dateRange.startDate, current_member.date_format)} ${t('to')} ${format(
          nd,
          current_member.date_format
        )}`
      );
    }
  }, [dateRange, cellQuantity, current_member, format, t, upLG, upXL]);
  useEffect(() => {
    if (startToday || switchToday) {
      let d = new Date();
      d.setHours(0, 0, 0, 0);
      if (upLG && !upXL) d.setDate(d.getDate() + 29);
      else if (upLG && upXL) d.setDate(d.getDate() + 31);
      else d = addDays(d, cellQuantity);
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      setDateRange({ startDate, endDate: d });
    } else if (dateRange) {
      let d = new Date(dateRange.startDate);
      if (upLG) {
        d = lastDayOfMonth(new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1, 0, 0, 0, 0));
      } else d = addDays(d, cellQuantity);
      setDateRange({ startDate: new Date(dateRange.startDate), endDate: d });
    }
  }, [switchToday, cellQuantity, upLG, startToday, upXL]);
  function getDates(startDate: Date, endDate: Date) {
    const dates = [];
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    const stopDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
    while (currentDate <= stopDate) {
      dates.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }
    return dates;
  }
  useEffect(() => {
    if (!dateRange) return;
    if (!workspace) return;
    const DAYS = getDates(dateRange.startDate, dateRange.endDate);
    setDays(DAYS);
    setFiscalYear(getFiscalYear(dateRange.startDate, workspace.fiscal_year_start_month));
  }, [dateRange, cellQuantity, workspace]);
  useEffect(() => {
    if (!departments) return;
    if (!membersCount) return;
    if (!current_member) return;
    if (selectedDepartment) return;
    const DEPARTMENTDROPDOWNVALUE: { id: string; name: string }[] = [];
    if (membersCount <= 250) {
      DEPARTMENTDROPDOWNVALUE.push({ id: '1', name: t('All_departments') });
    }

    DEPARTMENTDROPDOWNVALUE.push({ id: '2', name: t('absentToday') });
    for (let index = 0; index < departments.length; index += 1) {
      const department = departments[index];
      if (department)
        DEPARTMENTDROPDOWNVALUE.push({
          id: department.id,
          name: department.name
        });
    }

    if (DEPARTMENTDROPDOWNVALUE.length === 3) {
      DEPARTMENTDROPDOWNVALUE.shift();
      setDepartmentDropDownValues(DEPARTMENTDROPDOWNVALUE);
    } else {
      setDepartmentDropDownValues(DEPARTMENTDROPDOWNVALUE);
    }

    if (router.query.department_id) {
      const availableDepartment = departments.find((department) => department.id == router.query.department_id);
      if (availableDepartment) {
        setSelectedDepartment(availableDepartment);
      } else {
        setSelectedDepartment({ id: '1', name: t('All_departments') });
      }
    } else if (current_member?.default_timeline_department_id) {
      const memDep = departments.find((x) => x.id === current_member.default_timeline_department_id);
      if (memDep) {
        setSelectedDepartment(memDep);
      } else if (departments.length === 1 && departments[0])
        setSelectedDepartment({
          id: departments[0].id,
          name: departments[0].name
        });
      else if (membersCount > 250 && departments.length > 1 && departments[0])
        setSelectedDepartment({
          id: departments[0].id,
          name: departments[0].name
        });
      else setSelectedDepartment({ id: '1', name: t('All_departments') });
    } else if (departments.length === 1 && departments[0])
      setSelectedDepartment({
        id: departments[0].id,
        name: departments[0].name
      });
    else if (membersCount > 250 && departments.length > 1 && departments[0])
      setSelectedDepartment({
        id: departments[0].id,
        name: departments[0].name
      });
    else setSelectedDepartment({ id: '1', name: t('All_departments') });
  }, [members, current_member, departments]);

  useEffect(() => {
    const setScrollToPreviousPosition = () => {
      if (containerRef.current) {
        containerRef.current.scrollTo(0, timelineScrollPos);
      }
    };
    setScrollToPreviousPosition();
  }, [timelineScrollPos, setTimelineScrollPos, isLoading]);

  /*   useEffect(() => {
    (async () => {
      const { data: refetchedMembers } = await refetchAllOfUsers();
      if (!refetchedMembers || !refetch) return;
      const refetchedRequest = refetchedMembers.find((request) => request.id === refetch.id);
      if ((refetchedRequest as RouterOutputs['request']['allOfUsersByDay'][0])?.requester_member_id) {
        setDetailModalValues(refetchedRequest as RouterOutputs['request']['allOfUsersByDay']);
      }
    })();
  }, [refetch]); */
  if (!dateRange) return null;
  if (!days) return null;
  return (
    <>
      <div className="flex min-h-96 grow flex-col border-y bg-white dark:bg-[#2a2a2a] shadow sm:rounded sm:border dark:sm:border-black">
        <div className="  border-b dark:border-b-gray-600 dark:bg-[#1d1d1d]">
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className="p-4">
              <div className="flex space-x-4 py-2 pr-2 text-lg font-normal sm:border-r dark:border-r-gray-600">
                <div className="inline-flex mt-1.5 ">
                  <span
                    data-tooltip-id="datenav-tooltip"
                    data-tooltip-content={upLG ? t('Previous_month') : dateRangeTooltipText.left}
                    data-tooltip-variant="light"
                  >
                    <a
                      className="mt-1.5 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        calcAndSetDateRanges(true);
                        if (containerRef && containerRef.current) setTimelineScrollPos(containerRef.current.scrollTop);
                      }}
                    >
                      <ArrowLeftIcon className="h-4 mr-1 dark:text-white" />
                    </a>
                  </span>
                  <ReactTooltip
                    id="datenav-tooltip"
                    className="shadow-sm z-50 "
                    classNameArrow="shadow-sm"
                    place="top"
                  />

                  <span
                    data-tooltip-id="datenav-tooltip"
                    data-tooltip-content={upLG ? t('Next_month') : dateRangeTooltipText.right}
                    data-tooltip-variant="light"
                  >
                    <a
                      className="mt-1.5 cursor-pointer "
                      onClick={(e) => {
                        e.preventDefault();
                        if (containerRef && containerRef.current) setTimelineScrollPos(containerRef.current.scrollTop);
                        if (fiscal_year <= new Date().getFullYear() + 1) calcAndSetDateRanges(false);
                      }}
                    >
                      <ArrowRightIcon className="h-4 ml-1 dark:text-white" />
                    </a>
                  </span>
                  <ReactTooltip id="datenav-tooltip" className="shadow z-50" classNameArrow="shadow-sm" place="top" />
                </div>

                <div className='dark:text-white'>{dateRangeText}</div>
              </div>
            </div>
            <div className="p-4 ">
              {departmentDropDownValues && departmentDropDownValues.length >= 2 && (
                <div className="grid md:grid md:grid-cols-3 md:items-start md:gap-4">
                  <label className="block break-normal text-sm font-medium text-gray-700 dark:text-white sm:py-2">
                    {`${t('Department')}: `}
                  </label>
                  <div className="z-20 mt-1 sm:col-span-2 sm:mt-0 ">
                    {selectedDepartment && (
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                        value={selectedDepartment}
                        className="block w-full sm:max-w-xs sm:text-sm "
                        onChange={async (val) => {
                          if (val) {
                            setSelectedDepartment(val);
                            await CHANGE_TIMELINE_DEPARTMENT.mutateAsync(
                              {
                                department_id: val.id
                              },
                              {
                                onSuccess: async () => {
                                  await refetchMemberAll();
                                }
                              }
                            );
                            setSwitchToday(true);
                          }
                        }}
                        getOptionLabel={(option) => `${option.name}`}
                        getOptionValue={(option) => option.id}
                        options={departmentDropDownValues}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mx-4 grid justify-items-end">
                {!current_member?.is_admin && !current_member?.is_manager && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!current_member?.id) return;

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
                    type="button"
                    className="mb-2 flex w-full justify-center rounded border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 md:mb-0 md:w-7/12"
                  >
                    <div className="my-auto">
                      <PlusCircleIcon className="mr-2 h-4 w-4" aria-hidden="true" />{' '}
                    </div>
                    <p>{t('Create_request')}</p>
                  </button>
                )}

                {(current_member?.is_admin || current_member?.is_manager) && (
                  <div className="inline-flex rounded-md shadow-sm">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (!current_member?.id) return;

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
                      type="button"
                      className="relative inline-flex items-center rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
                    >
                      <div className="my-auto">
                        <PlusCircleIcon className="mr-2 h-4 w-4" aria-hidden="true" />{' '}
                      </div>
                      <p>{t('Create_request')}</p>
                    </button>
                    <Menu as="div" className="relative -ml-px block">
                      <Menu.Button className="relative inline-flex items-center rounded-r-md bg-white px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10">
                        <span className="sr-only">Open options</span>
                        <ChevronDownIcon aria-hidden="true" className="h-5 w-5" />
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30">
                          <div className="py-1">
                            <Menu.Item key="1">
                              <a
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (!current_member?.id) return;

                                  if (!subscription.has_valid_subscription || subscription.small_team > 0) {
                                    notifyError(t('group_booking_required_business_plan'));
                                    return;
                                  }

                                  let dd = new Date();
                                  setDialogValues({
                                    start: dd,
                                    start_at: 'morning',
                                    end: dd,
                                    end_at: 'end_of_day',
                                    member_id: current_member.id,
                                    department_id: selectedDepartment?.id ?? null
                                  });
                                }}
                                className={'block cursor-pointer hover:bg-gray-100 px-4 py-2 text-sm text-gray-700'}
                              >
                                {t('Group_booking')}
                              </a>
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="-mb-px flex  h-[50vh]  justify-end py-2 pl-0 pr-2 lg:h-[70vh] lg:pr-2 lg:pl-1   ">
          <div
            ref={containerRef}
            className={'flex h-auto w-full flex-col overflow-y-auto overflow-x-hidden bg-white dark:bg-[#2a2a2a] text-sm '}
          >
            <div className={` sticky top-0 z-[15] inline-flex w-auto justify-end bg-white text-sm dark:bg-[#2a2a2a]`}>
              {days.map((d, index) => {
                if (showCW) {
                  const isMonday = d.getDay() === 1;
                  const weekNumber = isMonday && getISOWeek(d);
                  const splitCW = translation.t('Calendar_Weekday').split(' ');
                  const CW = `${splitCW[0]?.charAt(0)}${splitCW[1]?.charAt(0)}`;
                  return (
                    <div
                      className={classNames(
                        'flex flex-col justify-end',
                        d.getDay() === Number(current_member.week_start) ? 'border-l border-gray-500' : ''
                      )}
                      key={index}
                    >
                      {d.getDay() === 1 && (
                        <div className="w-full pl-0.5 pb-2 text-left text-gray-500 text-xs overflow-x-visible ">
                          <p className="-mr-2">{`${CW} ${weekNumber}`}</p>
                        </div>
                      )}
                      <div
                        className={
                          d.toDateString() === TODAY.toDateString()
                            ? 'w-10 border-2 border-blue-500 text-center'
                            : 'w-8 text-center 1md:w-10 lg:w-10 xl:w-10 dark:text-white'
                        }
                      >
                        {d.toLocaleDateString(lang, {
                          weekday: isXS || isSM ? 'narrow' : 'short'
                        })}
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    className={classNames(
                      'flex flex-col justify-end',
                      d.getDay() === 1 ? 'border-l border-gray-500' : ''
                    )}
                    key={index}
                  >
                    <div
                      className={
                        d.toDateString() === TODAY.toDateString()
                          ? 'w-10 border-2 border-blue-500 text-center dark:text-white'
                          : 'w-8 text-center 1md:w-10 lg:w-10 xl:w-10 dark:text-white'
                      }
                      key={index}
                    >
                      {d.toLocaleDateString(lang, {
                        weekday: isXS || isSM ? 'narrow' : 'short'
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/*  */}
            <div
              className={` ${
                visibleMembers.length >= 1 && visibleMembers.length <= 9 ? 'h-[620px] ' : ' h-auto '
              }  relative flex w-auto flex-col `}
            >
              <div className=" ">
                {!current_member ||
                  (isLoading && (
                    <div className="px-4 w-screen max-w-screen-2xl">
                      <div>
                        <div className="mx-auto w-full">
                          <div className="flex animate-pulse space-x-4 pt-2">
                            <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                            <div className="flex-1 space-y-6 py-1">
                              <div className="grid grid-cols-8 gap-4">
                                <div className="col-span-1 h-5 rounded bg-gray-700"></div>
                                <div className="col-span-7 h-5 rounded bg-gray-700"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex animate-pulse space-x-4 pt-2">
                          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                          <div className="flex-1 space-y-6 py-1">
                            <div className="grid grid-cols-8 gap-4">
                              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
                              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex animate-pulse space-x-4 pt-2">
                          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                          <div className="flex-1 space-y-6 py-1">
                            <div className="grid grid-cols-8 gap-4">
                              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
                              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex animate-pulse space-x-4 pt-2">
                          <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                          <div className="flex-1 space-y-6 py-1">
                            <div className="grid grid-cols-8 gap-4">
                              <div className="col-span-1 h-5 rounded bg-gray-700"></div>
                              <div className="col-span-7 h-5 rounded bg-gray-700"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                {workspace &&
                  workspaceSchedule &&
                  selectedDepartment &&
                  memberRequests &&
                  public_holiday_days &&
                  visibleMembers.map((member) => {
                    const defaultAllowanceType = member.allowance_type_configurtaions.find((x) => x.default);

                    const remaining = member.allowances.find(
                      (x) => x.year === fiscal_year && x.allowance_type.id == defaultAllowanceType?.allowance_type_id
                    );
                    let userHasPermissionToCreateRequest = false;
                    if (current_member) {
                      userHasPermissionToCreateRequest = CheckCurrentUserHasPermissionToCreateRequest(
                        current_member,
                        member
                      );
                    }
                    const remainginAllowance =
                      remaining?.remaining &&
                      formatDuration(remaining.remaining, lang, remaining.allowance_type.allowance_unit, false, t);
                    return (
                      <div
                        className="relative flex h-14 select-none flex-row justify-between py-2 px-1 lg:py-2 lg:px-0 z-0"
                        key={member.id}
                      >
                        <div className=" min-w-[60px] truncate mr-1">
                          <Link
                            href={`/calendar/${member.id}`}
                            passHref
                            className={classNames(
                              'has-tooltip flex flex-row h-10',
                              !workspace.privacy_show_calendarview && !remaining ? ' cursor-default ' : ''
                            )}
                          >
                            <span className="relative inline-block">
                              <div className={`${remaining ? ' mt-0 ' : ' mt-1.5 sm:mt-0 '} ml-3.5 h-10 w-10`}>
                                <ProfileImage member={member} tailwindSize={isXS ? '8' : '10'} />
                              </div>
                              {remaining != null && (
                                <span
                                  className={` -translate-y-1/6 absolute top-0 right-1 inline-flex w-[33px] -translate-x-[50%]  justify-center rounded-full px-2 py-0.5 font-bold leading-none text-white dark:text-black bg-[#4a52bb] text-[8px] dark:bg-white`}
                                >
                                  {remainginAllowance}
                                </span>
                              )}
                            </span>
                            <div
                              className={`my-auto truncate pl-0 font-bold sm:pl-2 dark:text-white`}
                              data-tooltip-id="name-tooltip"
                              data-tooltip-content={member.name as string}
                              data-tooltip-variant="light"
                            >
                              {member.name}
                            </div>
                          </Link>
                        </div>
                        <div className=" inline-flex">
                          {days.map((d, index) => {
                            return (
                              <Cell
                                key={`${index}cell`}
                                member={member}
                                member_requests={memberRequests.filter((x: any) => x.requester_member_id === member.id)}
                                member_public_holiday_days={public_holiday_days.filter(
                                  (x) => x.public_holiday_id == member.public_holiday_id
                                )}
                                workspaceSchedule={workspaceSchedule}
                                date={d}
                                onSelectionFinished={(x) => {
                                  if (x) {
                                    setDialogValues(x);
                                    setMouseDown('');
                                    setSelectionStartDate(null);
                                    setSelectionEndDate(null);
                                  }
                                }}
                                onOpenDetailModal={(x: {
                                  data: RouterOutputs['request']['allOfUsersByDay'] | { id: string };
                                  openAsScheduler: boolean;
                                  day: Date;
                                }) => {
                                  if (x.openAsScheduler) {
                                    setDayScheduleModalValues({
                                      requests: x.data as RouterOutputs['request']['allOfUsersByDay'],
                                      date: x.day
                                    });
                                  } else if ((x.data as RouterOutputs['request']['allOfUsersByDay'])[0]) {
                                    const t = x.data as RouterOutputs['request']['allOfUsersByDay'];
                                    if (t[0]) setDetailModalValues(t[0]);
                                  } else {
                                    setPublicHolidayDetailModalValues(
                                      x.data as RouterOutputs['public_holiday_day']['byId']
                                    );
                                  }
                                }}
                                withBorder={false}
                                isAnyHalfDayLT={isAnyHalfDayLT}
                                isToday={false}
                                userHasPermissionToCreateRequest={userHasPermissionToCreateRequest}
                              ></Cell>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {!isLoading && selectedDepartment && selectedDepartment.id == '2' && visibleMembers.length == 0 && (
                  <div className="relative  mr-0.5 flex h-14 w-auto select-none flex-row justify-center p-2 text-center text-base font-bold">
                    {t('allMembersPresent')}
                  </div>
                )}

                {detailModalValues && (
                  <DetailsModal
                    request_id={detailModalValues.id}
                    onClose={() => {
                      setDetailModalValues(null);
                    }}
                    onCancelRequest={() => {
                      setDetailModalValues(null);
                      setCancelRequest({ ...detailModalValues });
                    }}
                  />
                )}
                {dayScheduleModalValues &&
                  current_member &&
                  dayScheduleModalValues.requests[0]?.requester_member_id && (
                    <DayScheduleModal
                      isModalOnTop={dialogValues == null && detailModalValues == null && cancelRequest == null}
                      date={dayScheduleModalValues.date}
                      member_id={dayScheduleModalValues.requests[0].requester_member_id}
                      userHasPermissionToCreateRequest={CheckCurrentUserHasPermissionToCreateRequest(
                        current_member,
                        dayScheduleModalValues.requests[0].requester_member
                      )}
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
                {dialogValues && (
                  <AddHoliday
                    initDateValues={dialogValues}
                    openAsDialog={true}
                    showUserSelect={dialogValues.department_id == null}
                    showDepartmentSelect={dialogValues.department_id != null}
                    onClose={async () => {
                      setDialogValues(null);
                      refetchAllOfUsersByDay();
                      refetchMemberAll();
                    }}
                  ></AddHoliday>
                )}

                {cancelRequest && (
                  <CancelModal
                    request={cancelRequest}
                    onClose={async (request: RouterOutputs['request']['allOfUsersByDay'][0] | null) => {
                      setCancelRequest(null);
                      await refetchAllOfUsersByDay();
                      await refetchMemberAll();
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
              </div>
            </div>
            <ReactTooltip
              id="name-tooltip"
              className="z-50 shadow-sm"
              classNameArrow="shadow-sm"
              place="right"
              opacity={1}
              style={{ boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)' }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Timeline;
