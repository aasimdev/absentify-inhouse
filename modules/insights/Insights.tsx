import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useAbsentify } from '@components/AbsentifyContext';
import React, { useState, useEffect, useMemo } from 'react';
import useTranslation from 'next-translate/useTranslation';
import Select from 'react-select';
import { classNames } from 'lib/classNames';
import { useMediaQuery } from 'react-responsive';
import Link from 'next/link';
import ProfileImage from '@components/layout/components/ProfileImage';
import Upcoming from './Components/Upcoming';
import DayOffChart from './Components/DayOffChart';
import { RouterOutputs, api } from '~/utils/api';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { convertLocalDateToUTC, dateFromDatabaseIgnoreTimezone, isDayUnit } from '~/lib/DateHelper';
import { AllowanceUnit, LeaveUnit } from '@prisma/client';
import { formatDuration } from '~/helper/formatDuration';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { useDarkSide } from '@components/ThemeContext';

type S = {
  label: string;
  data: number[];
  backgroundColor: string;
}[];
type D = {
  labels: string[];
  datasets: S;
};

const Insights = () => {
  const [theme] = useDarkSide();
  const { current_member } = useAbsentify();
  const { teamsMobile, subscription } = useAbsentify();
  const { t, lang } = useTranslation('insights');
  const months = [
    { label: new Date(2023, 0, 5).toLocaleDateString(lang, { month: 'long' }), value: 0 },
    { label: new Date(2023, 1, 5).toLocaleDateString(lang, { month: 'long' }), value: 1 },
    { label: new Date(2023, 2, 5).toLocaleDateString(lang, { month: 'long' }), value: 2 },
    { label: new Date(2023, 3, 5).toLocaleDateString(lang, { month: 'long' }), value: 3 },
    { label: new Date(2023, 4, 5).toLocaleDateString(lang, { month: 'long' }), value: 4 },
    { label: new Date(2023, 5, 5).toLocaleDateString(lang, { month: 'long' }), value: 5 },
    { label: new Date(2023, 6, 5).toLocaleDateString(lang, { month: 'long' }), value: 6 },
    { label: new Date(2023, 7, 5).toLocaleDateString(lang, { month: 'long' }), value: 7 },
    { label: new Date(2023, 8, 5).toLocaleDateString(lang, { month: 'long' }), value: 8 },
    { label: new Date(2023, 9, 5).toLocaleDateString(lang, { month: 'long' }), value: 9 },
    { label: new Date(2023, 10, 5).toLocaleDateString(lang, { month: 'long' }), value: 10 },
    { label: new Date(2023, 11, 5).toLocaleDateString(lang, { month: 'long' }), value: 11 }
  ];

  let isXS = useMediaQuery({ minWidth: 0, maxWidth: 650 });
  let upLG = useMediaQuery({ minWidth: 1920 });
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, { staleTime: 60000 });
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: string; name: string }>();
  const [doughnutData, setDoughnutData] = useState<{
    booked: number;
    remaining: number;
    totalAllowance: number;
  }>();
  const [fiscalYearStartAndEndDates, setFiscalYearStartAndEndDates] = useState<{
    firstDayOfYear: Date;
    lastDayOfYear: Date;
  } | null>(null);

  const [selectedUnit, setSelectedUnit] = useState<{ id: AllowanceUnit; name: string }>();
  const [selectUnitDropDownValues, setSelectUnitDropDownValues] = useState<{ id: AllowanceUnit; name: string }[]>();
  const [departmentDropDownValues, setDepartmentDropDownValues] = useState<{ id: string; name: string }[]>();
  const [selectedAllowanceType, setSelectedAllowanceType] = useState<RouterOutputs['allowance']['allTypes'][0]>();
  const [chartData, setChartData] = useState<D>();
  const [burnoutBoardData, setBurnoutBoardData] = useState<
    {
      lastRequestDaysAgo: number;
      upcomingRequestInDays: number;
      member: defaultMemberSelectOutput;
      remaining: number;
    }[]
  >([]);
  const { data: membersData } = api.member.all.useQuery(
    {
      filter: {
        status: ['ACTIVE', 'INACTIVE'],
        department_ids:
          selectedDepartment?.id == '1' ? undefined : selectedDepartment ? [selectedDepartment.id] : undefined
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

  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const getFiscalYearStartAndEndDates = (startMonth: number, year: number) => {
    const firstDayOfYear = new Date(year, startMonth, 1);
    const lastDayOfYear = new Date(year + 1, startMonth, 0); // last day of previous month

    return {
      firstDayOfYear,
      lastDayOfYear
    };
  };
  const { data: allowancesTypes } = api.allowance.allTypes.useQuery(undefined, {
    staleTime: 60000
  });

  useEffect(() => {
    if (!workspace) return;
    const { firstDayOfYear, lastDayOfYear } = getFiscalYearStartAndEndDates(
      workspace.fiscal_year_start_month,
      new Date(new Date().getFullYear(), workspace?.fiscal_year_start_month ?? 0, 1) > new Date()
        ? new Date().getFullYear() - 1
        : new Date().getFullYear()
    );
    setFiscalYearStartAndEndDates({ firstDayOfYear, lastDayOfYear });
  }, [workspace]);
  const daysBetween = (date_1: Date, date_2: Date) => {
    let difference = date_1.getTime() - date_2.getTime();
    let TotalDays = Math.ceil(difference / (1000 * 3600 * 24));
    return TotalDays;
  };
  const { data: member_requests, isLoading } = api.request.getInsights.useQuery(
    {
      department_id: !selectedDepartment || selectedDepartment.id == '1' ? null : selectedDepartment.id,
      start: fiscalYearStartAndEndDates
        ? convertLocalDateToUTC(fiscalYearStartAndEndDates?.firstDayOfYear)
        : new Date(),
      end: fiscalYearStartAndEndDates ? convertLocalDateToUTC(fiscalYearStartAndEndDates?.lastDayOfYear) : new Date(),
      leave_unit: selectedUnit?.id ?? 'days'
    },
    { enabled: fiscalYearStartAndEndDates != null }
  );

  const getCurrentDays = () => {
    if (members) {
      let remaining: number = 0;
      let booked: number = 0;
      let totalAllowance: number = 0;

      for (let index = 0; index < members.length; index++) {
        let allowance = members[index]?.allowances.find(
          (x) => x.year == new Date().getFullYear() && x.allowance_type.id == selectedAllowanceType?.id
        );
        if (!allowance) continue;

        remaining += allowance.remaining;
        totalAllowance += allowance.allowance + allowance.brought_forward;
        booked += allowance.taken;
      }

      setDoughnutData({ remaining, totalAllowance, booked });
    }
  };

  const getlastAbsentDays = () => {
    if (member_requests && members) {
      let values: {
        lastRequestDaysAgo: number;
        upcomingRequestInDays: number;
        member: defaultMemberSelectOutput;
        remaining: number;
      }[] = [];
      const today = new Date();
      for (let index = 0; index < members.length; index++) {
        const member = members[index];
        if (!member) continue;
        const lastRequests = member_requests.filter(
          (x) => x.requester_member_id == member.id && x.date.getTime() < today.getTime()
        );

        let lastRequestDaysAgo = 0;
        if (lastRequests.length > 0) {
          const lastRequest = lastRequests[lastRequests.length - 1];
          if (lastRequest) lastRequestDaysAgo = daysBetween(today, lastRequest.date) - 1;

          if (lastRequestDaysAgo < 0) lastRequestDaysAgo = 0;
        }

        const upcommingRequests = member_requests.filter(
          (x) => x.requester_member_id == member.id && x.date.getTime() > today.getTime()
        );

        let upcomingRequestInDays = 0;
        if (upcommingRequests.length > 0 && upcommingRequests[0]) {
          upcomingRequestInDays = daysBetween(upcommingRequests[0].date, today) + 1;

          if (upcomingRequestInDays < 0) upcomingRequestInDays = 0;
        }
        let alloance = member.allowances.filter(
          (y) =>
            y.year == today.getFullYear() &&
            y.allowance_type?.id == member.allowance_type_configurtaions.find((x) => x.default)?.allowance_type_id
        );
        if (alloance && alloance[0])
          values.push({
            lastRequestDaysAgo,
            upcomingRequestInDays,
            member,
            remaining: alloance?.length > 0 ? alloance[0].remaining : 0
          });
      }
      setBurnoutBoardData(
        values
          .filter((x) => x.lastRequestDaysAgo > 30)
          .sort((n1, n2) => {
            if (n1.lastRequestDaysAgo > n2.lastRequestDaysAgo) {
              return -1;
            }

            if (n1.lastRequestDaysAgo < n2.lastRequestDaysAgo) {
              return 1;
            }

            return 0;
          })
      );
    }
  };

  const getData = () => {
    if (member_requests && leave_types && fiscalYearStartAndEndDates && selectedUnit) {
      let filteredLeaveType = leave_types.filter((c) => {
        if (selectedUnit.id == AllowanceUnit.days) {
          return c.leave_unit == LeaveUnit.days || c.leave_unit == LeaveUnit.half_days;
        } else {
          return (
            c.leave_unit == LeaveUnit.hours ||
            c.leave_unit == LeaveUnit.minutes_5 ||
            c.leave_unit == LeaveUnit.minutes_1 ||
            c.leave_unit == LeaveUnit.minutes_10 ||
            c.leave_unit == LeaveUnit.minutes_15 ||
            c.leave_unit == LeaveUnit.minutes_30
          );
        }
      });

      const sets = new Array(filteredLeaveType.length);

      for (let i = 0; i < sets.length; i++) {
        sets[i] = { label: '', data: [NaN], backgroundColor: '' };
      }
      const startMonth = fiscalYearStartAndEndDates.firstDayOfYear.getMonth();
      for (let index = 0; index < filteredLeaveType.length; index++) {
        const leaveType = filteredLeaveType[index];
        if (!leaveType) continue;

        const element = sets[index];
        let fiscalYearMonths: number[] = [];
        let memberRequestDurationByMonth: number[] = [];
        for (let i = 0; i < 12; i++) {
          fiscalYearMonths[i] = (startMonth + i) % 12;
        }
        fiscalYearMonths.forEach((month, index) => {
          memberRequestDurationByMonth[index] = member_requests
            .filter(
              (x) => x.leave_type.id == leaveType.id && dateFromDatabaseIgnoreTimezone(x.date).getMonth() == month
            )
            .reduce((a, b) => a + (selectedUnit.id == 'hours' ? b.duration / 60 : b.duration), 0);
        });

        element.label = leaveType.name;
        element.data = memberRequestDurationByMonth;
        element.backgroundColor = leaveType.color;
      }

      const labels = Array(12)
        .fill(null)
        .map((_, i) => months.find((x) => x.value == (startMonth + i) % 12)?.label ?? '');

      setChartData({
        labels,
        datasets: sets
      });
    }
  };
  useEffect(() => {
    if (members.length == 0) return;
    getCurrentDays();
  }, [members, selectedAllowanceType]);
  useEffect(() => {
    if (!members) return;
    if (!member_requests) return;

    getlastAbsentDays();
  }, [members, member_requests]);
  useEffect(() => {
    if (!allowancesTypes) return;
    if (!selectedAllowanceType) setSelectedAllowanceType(allowancesTypes[0]);
  }, [allowancesTypes]);
  useEffect(() => {
    getData();

    if (!leave_types) return;
    let unitSelect: {
      id: AllowanceUnit;
      name: string;
    }[] = [
      {
        id: AllowanceUnit.days,
        name: t('Days')
      },
      {
        id: AllowanceUnit.hours,
        name: t('Hours')
      }
    ];
    let s = unitSelect.find((x) => x.id == AllowanceUnit.days);
    if (leave_types.filter((x) => isDayUnit(x.leave_unit)).length == 0) {
      unitSelect = unitSelect.filter((x) => x.id !== AllowanceUnit.days);
      s = unitSelect.find((x) => x.id == AllowanceUnit.hours);
    }
    if (
      leave_types.filter(
        (x) =>
          x.leave_unit == 'hours' ||
          x.leave_unit == 'minutes_5' ||
          x.leave_unit == 'minutes_1' ||
          x.leave_unit == 'minutes_10' ||
          x.leave_unit == 'minutes_15' ||
          x.leave_unit == 'minutes_30'
      ).length == 0
    ) {
      unitSelect = unitSelect.filter((x) => x.id !== AllowanceUnit.hours);
      s = unitSelect.find((x) => x.id == AllowanceUnit.days);
    }
    setSelectUnitDropDownValues(unitSelect);
    if (s && !selectedUnit) setSelectedUnit(s);
  }, [member_requests, leave_types, selectedUnit]);

  useEffect(() => {
    if (!members) return;
    if (!departments) return;
    if (!current_member) return;
    if (selectedDepartment) return;

    let departmentDropDownValues = [
      {
        id: '1',
        name: t('All_departments')
      }
    ];

    for (let index = 0; index < departments.length; index++) {
      const department = departments[index];
      if (!department) continue;
      if (
        current_member.is_admin ||
        department.members.find((y) => y.member_id == current_member.id && y.manager_type == 'Manager')
      )
        departmentDropDownValues.push({
          id: department.id,
          name: department.name
        });
    }

    if (departmentDropDownValues.length == 2) departmentDropDownValues.shift();

    setDepartmentDropDownValues(departmentDropDownValues);

    if (departmentDropDownValues.length > 0) setSelectedDepartment(departmentDropDownValues[0]);
  }, [members, current_member, departments]);

  return (
    <div className="grid bg-white grid-cols-1 md:grid-cols-8 pb-5 border-t border-b sm:rounded sm:border drop-shadow-lg dark:bg-teams_brand_dark_100 dark:border-[#595869]">
      <div className="md:col-span-10  border-b dark:bg-teams_brand_dark_100 dark:divide-gray-500">
        <div className="flex bg-white justify-between pl-6 -mb-px dark:bg-teams_brand_dark_100">
          <div className="lg:flex hidden"></div>

          <div className="">
            <div className="md:grid md:grid-cols-3 md:gap-4 md:items-start p-4 ">
              <label className="block text-sm font-medium sm:pt-2 text-gray-700 break-normal dark:text-gray-200">
                {t('department') + ': '}
              </label>
              <div
                className={
                  'mt-1 ' + current_member &&
                  selectedDepartment &&
                  departmentDropDownValues &&
                  departmentDropDownValues.length == 1
                    ? ' sm:mt-1 '
                    : ' sm:mt-0 ' + ' sm:col-span-2'
                }
              >
                {current_member &&
                  selectedDepartment &&
                  departmentDropDownValues &&
                  departmentDropDownValues.length > 1 && (
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
                      className="block w-full sm:max-w-xs sm:text-sm my-react-select-container"
                      classNamePrefix="my-react-select"
                      onChange={(val) => {
                        if (val) setSelectedDepartment(val);
                      }}
                      getOptionLabel={(option) => `${option.name}`}
                      getOptionValue={(option) => option.id}
                      options={departmentDropDownValues}
                    />
                  )}
                {current_member &&
                  selectedDepartment &&
                  departmentDropDownValues &&
                  departmentDropDownValues.length == 1 && (
                    <span className="font-medium sm:pt-2 text-gray-700 text-sm dark:text-gray-200">
                      {departmentDropDownValues[0]?.name}
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-2 sm:col-span-5 md:col-span-10 lg:col-span-10 xl:col-span-2 w-auto xl:w-full dark:bg-teams_brand_dark_100 ">
        <div className="mt-4 divide-y divide-slate-400/20 rounded-lg border bg-white text-[0.8125rem] leading-5 text-slate-900 drop-shadow dark:bg-teams_brand_dark_100">
          <p className="p-2 text-center dark:text-gray-200">{t('upcomming')}</p>
          {/* Upcoming loading */}
          {isLoading && (
            <div className="block w-full animate-puls dark:bg-teams_brand_dark_100">
              <div className="mx-auto w-full">
                <div className="p-4 animate-pulse py-6e flex space-x-4 ">
                  <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 h-5 rounded bg-gray-700"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 h-5 rounded bg-gray-700"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4 ">
                  <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 h-5 rounded bg-gray-700"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4 ">
                  <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 h-5 rounded bg-gray-700"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="h-8 w-8 rounded-full bg-gray-700"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 h-5 rounded bg-gray-700"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
                <div className="p-4 animate-pulse py-6e flex space-x-4">
                  <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                  <div className="flex-1 space-y-6 py-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                    </div>
                  </div>
                </div>
                <hr className="w-full " />
              </div>
            </div>
          )}
          {!isLoading && <Upcoming members={members} subscription={subscription.has_valid_subscription}></Upcoming>}
        </div>
      </div>

      <div className=" xl:ml-2 sm:col-span-5 md:col-span-10 lg:col-span-8">
        {isLoading && !chartData && (
          <>
            {/* DayOffChart Loading */}
            <div className="p-6 px-20 m-2 bg-white drop-shadow overflow-hidden rounded-lg dark:bg-teams_brand_dark_100">
              <div className="block w-full ">
                <div className="w-full mx-auto">
                  <div className="pt-2 animate-pulse flex lg:flex-row flex-col space-x-4">
                    <div className="rounded-full bg-white border-[24px] border-gray-700 h-28 w-28 lg:mx-0 mx-auto"></div>
                    <div className="flex-1 space-y-6 my-auto lg:pl-20 pl-0 pt-3 lg:pt-0">
                      <div className="grid grid-cols-7 gap-10">
                        <div className="h-12 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-12 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-12 bg-gray-700 rounded col-span-2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Annual trand loading */}
            <div
              className="relative  p-8 lg:pb-14 sm:px-6 pt-20  inline-flex space-x-2 sm:space-x-3 lg:space-x-6 justify-center bg-white drop-shadow overflow-hidden rounded-lg m-4 dark:bg-teams_brand_dark_100"
              style={{ width: '97.7%' }}
            >
              <h1 className="absolute text-base text-center pb-4 -mt-12">{t('annualTrend')}</h1>
              <div className="rotate-180 animate-pulse flex ">
                <div className=" bg-slate-700 lg:h-40 h-20 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className=" rotate-180 animate-pulse flex">
                <div className=" bg-slate-700 lg:h-10 h-5 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-32 h-16 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-56 h-28 sm:w-10  w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-44 h-20 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-24 h-12 sm:w-10 w-5 lg:w-12 "></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-80 h-40 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-14 h-7 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-52 h-28 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-20 h-10 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-48 h-24 sm:w-10 w-5 lg:w-12"></div>
              </div>
              <div className="animate-pulse flex rotate-180">
                <div className=" bg-slate-700 lg:h-52 h-28 sm:w-10 w-5 lg:w-12"></div>
              </div>
            </div>
          </>
        )}
        {doughnutData && !isLoading && (
          <div className="p-6 my-4 ml-2 xl:ml-4  mr-2 bg-white drop-shadow border overflow-hidden rounded-lg dark:bg-teams_brand_dark_100">
            {allowancesTypes && allowancesTypes.length > 1 && (
              <div className="flex-none ml-auto right-0 mr-4 w-56 ">
                <div className={'mt-1 '}>
                  <Select
                    styles={{
                      control: (base) => ({
                        ...base,
                        '*': {
                          boxShadow: 'none !important'
                        }
                      })
                    }}
                    value={selectedAllowanceType}
                    className="block w-full sm:max-w-xs sm:text-sm w-full my-react-select-container"
                    classNamePrefix="my-react-select"
                    onChange={(val) => {
                      if (val) setSelectedAllowanceType(val);
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={allowancesTypes}
                  />
                </div>
              </div>
            )}
            <DayOffChart
              data={doughnutData}
              nbrEmployees={members?.length}
              allowanceUnit={selectedAllowanceType?.allowance_unit ?? 'days'}
            />
          </div>
        )}
        {chartData && !isLoading && (
          <div className="lg:p-6 p-1 my-4 ml-2 xl:ml-4  mr-2 bg-white drop-shadow overflow-hidden rounded-lg border dark:bg-teams_brand_dark_100">
            <div className="flex items-center justify-center">
              <div className="flex justify-center flex-grow">
                <h1 className="text-base dark:text-gray-200">{t('annualTrend')}</h1>
              </div>
              {selectUnitDropDownValues && selectUnitDropDownValues.length > 1 && (
                <div className="flex-none mr-4 xl:w-36">
                  <Select
                    styles={{
                      control: (base) => ({
                        ...base,
                        '*': {
                          boxShadow: 'none !important'
                        }
                      })
                    }}
                    value={selectedUnit}
                    
                    className="w-full my-react-select-container block w-full sm:max-w-xs sm:text-sm mt-4 lg:mt-0"
                    classNamePrefix="my-react-select"
                    onChange={(val) => {
                      if (val) setSelectedUnit(val);
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={selectUnitDropDownValues}
                  />
                </div>
              )}
            </div>
            <Bar
              options={{
                plugins: {
                  tooltip: {
                    enabled: !!subscription.has_valid_subscription
                  },
                  legend: {
                    position: 'bottom'
                  }
                },

                responsive: true,
                scales: {
                  x: {
                    grid: {
                      color: 'transparent'
                    },
                    stacked: true
                  },
                  y: {
                    display: false,
                    stacked: true,
                    ticks: {
                      align: 'center'
                    }
                  }
                }
              }}
              data={chartData}
            />
          </div>
        )}
        <div className=" h-auto my-4 ml-2 xl:ml-4  mr-2">
          <div className="bg-white drop-shadow border overflow-hidden rounded-lg mt-3 w-full h-full lg:p-4 p-0 pt-6 dark:bg-teams_brand_dark_100">
            <p className="  text-base text-center block dark:text-gray-200">{t('burnOutBoard')}</p>
            {/* burnout board loading */}
            {isLoading && (
              <div className="block w-full p-4">
                <div className="w-full mx-auto">
                  <div className="pt-2 animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                    <div className="flex-1 space-y-6 py-1">
                      <div className="grid grid-cols-8 gap-4">
                        <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                    <div className="flex-1 space-y-6 py-1">
                      <div className="grid grid-cols-8 gap-4">
                        <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                    <div className="flex-1 space-y-6 py-1">
                      <div className="grid grid-cols-8 gap-4">
                        <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                    <div className="flex-1 space-y-6 py-1">
                      <div className="grid grid-cols-8 gap-4">
                        <div className="h-5 bg-gray-700 rounded col-span-2"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                        <div className="h-5 bg-gray-700 rounded col-span-3"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap bg-white overflow-hidden lg:p-4 p-0 dark:bg-teams_brand_dark_100">
              {!burnoutBoardData.length && !isLoading && <p className="text-center mx-auto dark:text-gray-200">{t('allGood')}</p>}
              <table cellPadding="0" cellSpacing="0" className=" select-none border-0 w-full">
                <tbody>
                  {workspaceSchedule &&
                    selectedDepartment &&
                    member_requests &&
                    burnoutBoardData &&
                    burnoutBoardData.map((member, i) => {
                      const lastRequestinDays = member.lastRequestDaysAgo;
                      const upcomingRequestInDays = member.upcomingRequestInDays;
                      return (
                        <tr
                          className={
                            !subscription.has_valid_subscription && i >= 1
                              ? ' blur-sm flex md:flex-nowrap flex-wrap  lg:space-x-18 px-6 text-sm justify-start  border-b  pb-4'
                              : 'flex md:flex-nowrap flex-wrap lg:space-x-18 px-6 text-sm justify-start    border-b  pb-4 '
                          }
                          key={member.member.id}
                        >
                          <td className={` ${upLG ? ' lg:w-72 ' : ' lg:w-52 '}  w-full max-w-72`}>
                            <div>
                              <div
                                className={classNames(
                                  ' text-left flex lg:ml-0 ml-2 lg:space-x-2 space-x-8 flex-row has-tooltip mt-2 dark:text-gray-200'
                                )}
                              >
                                <div className="relative h-10 w-10 dark:text-gray-200">
                                  <ProfileImage member={member.member} tailwindSize={isXS ? '8' : '10'} className="" />
                                </div>

                                {isXS && (
                                  <div
                                    className="truncate lg:w-12 md:w-36 ml-0 mt-2 dark:text-gray-200"
                                    data-tooltip-id="username-tooltip"
                                    data-tooltip-content={member.member.name as string}
                                    data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                  >
                                    {member.member.name}
                                  </div>
                                )}
                                {!isXS && (
                                  <div
                                    className="truncate w-40 mx-2 mt-2 dark:text-gray-200"
                                    data-tooltip-id="username-tooltip"
                                    data-tooltip-content={member.member.name as string}
                                    data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                  >
                                    {member.member.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="text-sm pt-2 px-16 lg:px-0 mt-2 ml-4 xl:w-[150px] cursor-pointer dark:text-gray-200">
                            {t('remaining-allowance-days')}
                            {i >= 1 && (
                              <div
                                className="dark:text-gray-200"
                                data-tooltip-id="insight-tooltip"
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                data-tooltip-delay-hide={700}
                              >
                                {formatDuration(
                                  member.remaining,
                                  lang,
                                  selectedUnit?.id == AllowanceUnit.days ? 'days' : 'hours',
                                  true,
                                  t
                                )}
                              </div>
                            )}
                            {i == 0 && (
                              <div className=" ">
                                {formatDuration(
                                  member.remaining,
                                  lang,
                                  selectedUnit?.id == AllowanceUnit.days ? 'days' : 'hours',
                                  true,
                                  t
                                )}
                              </div>
                            )}
                          </td>

                          <td
                            className={` ${
                              upLG ? ' lg:pl-24 lg:w-72 ' : ' lg:pl-12 lg:w-60 '
                            }  px-20 lg:px-4 mt-2 w-full max-w-72`}
                          >
                            <div className="">
                              <p className="text-sm pb-2 lg:pb-0 dark:text-gray-200">
                                {t('lastRequestIndays', { lastRequestinDays: lastRequestinDays })}
                              </p>

                              {upcomingRequestInDays > 0 ? (
                                <p className="text-sm  dark:text-gray-200">
                                  {t('upcomingRequestInDays', { upcomingRequestInDays: upcomingRequestInDays })}
                                </p>
                              ) : (
                                <></>
                              )}
                              {upcomingRequestInDays == 0 ? (
                                <p className="text-sm  dark:text-gray-200">
                                  {t('upcomingRequestInDay', { upcomingRequestInDays: upcomingRequestInDays })}
                                </p>
                              ) : (
                                <></>
                              )}
                              {upcomingRequestInDays > 90 ? (
                                <p className="text-sm  dark:text-gray-200">
                                  {t('upcomingRequestInMonth', { upcomingRequestInDays: upcomingRequestInDays })}
                                </p>
                              ) : (
                                <></>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!subscription.has_valid_subscription && burnoutBoardData.length >= 1 && (
              <ReactTooltip
                id="insight-tooltip"
                className="shadow-sm z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                classNameArrow="shadow-sm"
                place="top"
                opacity={1}
                style={{ boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                clickable
              >
                <div className="block text-sm text-center">
                  <p className="dark:text-gray-200">{t('upgradeT1')}</p>
                  {current_member?.is_admin && !teamsMobile && (
                    <Link href="/settings/organisation/upgrade" className="underline hover:text-blue-700 dark:text-gray-200">
                      {t('upgradeT2')}
                    </Link>
                  )}
                </div>
              </ReactTooltip>
            )}
          </div>
          <ReactTooltip
            id="username-tooltip"
            className="shadow-sm z-50 dark:bg-teams_dark_mode_core dark:text-gray-200"
            classNameArrow="shadow-sm"
            place="right"
            opacity={1}
            style={{ boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
          />
        </div>
      </div>
    </div>
  );
};
export default Insights;