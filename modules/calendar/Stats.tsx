import useTranslation from 'next-translate/useTranslation';
import { useState, useEffect } from 'react';
import { AllowanceUnit, type LeaveType } from '@prisma/client';
import { api, type RouterOutputs } from '~/utils/api';
import { formatDuration } from '~/helper/formatDuration';
import { Icon } from '@components/Icon';

const LeaveRow = (props: { leaveType: LeaveType }) => {
  return (
    <div className="flex items-center">
      {props.leaveType.icon != 'NoIcon' && (
        <div className=" w-4 mr-2">
          <Icon className="" width="4" color={props.leaveType.color} name={props.leaveType.icon} />
        </div>
      )}
      {props.leaveType.icon == 'NoIcon' && (
        <div style={{ backgroundColor: props.leaveType.color }} className="mr-2 mt-0.5 h-4 w-4 rounded-sm"></div>
      )}

      <span> {props.leaveType.name}</span>
    </div>
  );
};

const Stats = (props: {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  allowanceYear: number;
  member_id: string;
}) => {
  const { t, lang } = useTranslation('calendar');

  const { data: userAllowance, isLoading } = api.member_allowance.byMember.useQuery(
    { member_id: props.member_id, year: props.dateRange.startDate.getFullYear() },
    {
      staleTime: 60000
    }
  );
  const { data } = api.member.all.useQuery(
    { filter: { ids: [props.member_id] }, page: 1, limit: 1 },
    {
      staleTime: 60000
    }
  );
  const members = data?.members || [];

  const member = members.find((x) => x.id == props.member_id);

  const { data: publicHolidayDays } = api.public_holiday_day.all.useQuery(
    {
      public_holiday_id: member?.public_holiday_id + '',
      start: new Date(
        Date.UTC(
          props.dateRange.startDate.getFullYear(),
          props.dateRange.startDate.getMonth(),
          props.dateRange.startDate.getDate(),
          0,
          0,
          0
        )
      ),
      end: new Date(
        Date.UTC(
          props.dateRange.endDate.getFullYear(),
          props.dateRange.endDate.getMonth(),
          props.dateRange.endDate.getDate(),
          0,
          0,
          0
        )
      )
    },
    {
      enabled: member?.public_holiday_id != null,
      staleTime: 60000
    }
  );

  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });

  const [currentYearAllowances, setCurrentYearAllowance] = useState<RouterOutputs['member_allowance']['byMember']>();
  const [stats, setStats] = useState<{ id: string; amount: number; leave_type: LeaveType | undefined }[]>();
  useEffect(() => {
    if (!currentYearAllowances) return;
    if (!leave_types) return;
    if (!member) return;

    let defaulte = currentYearAllowances.find(
      (x) => x.allowance_type.id == member.allowance_type_configurtaions.find((y) => y.default)?.allowance_type_id
    );
    if (!defaulte) return;
    if (!defaulte.leave_types_stats) return;

    let resultArray = Object.entries(defaulte.leave_types_stats).map(([id, value]) => {
      return {
        leave_type: leave_types.find((x) => x.id == id),
        id: id,
        amount: value.amount
      };
    });
    setStats(resultArray);
  }, [currentYearAllowances, leave_types, member]);

  useEffect(() => {
    if (userAllowance) {
      let sorted = userAllowance.sort((a, b) => {
        if (!a.allowance_type) return 1;
        if (!b.allowance_type) return -1;
        const aDefault = member?.allowance_type_configurtaions.find(
          (x) => x.allowance_type_id == a.allowance_type_id
        )?.default;
        const bDefault = member?.allowance_type_configurtaions.find(
          (x) => x.allowance_type_id == b.allowance_type_id
        )?.default;
        if (aDefault && !bDefault) return -1; // If a is default and b is not, a comes first
        if (!aDefault && bDefault) return 1; // If b is default and a is not, b comes first
        // If both are either default or not, compare their names
        return a.allowance_type.name.localeCompare(b.allowance_type.name);
      });
      setCurrentYearAllowance(sorted.filter((x) => x.year == props.allowanceYear));
    }
  }, [userAllowance]);
  if (!currentYearAllowances) return null;

  function calcPublicHolidayDays(days: RouterOutputs['public_holiday_day']['all']) {
    let totalDays = 0;

    days.forEach((day) => {
      if (day) totalDays += day.duration === 'FullDay' ? 1 : 0.5;
    });

    return totalDays;
  }
  if (!member) return null;
  return (
    <>
      {currentYearAllowances.map((allowance) => {
        if (!allowance) return null;
        if (!leave_types) return null;
        if (!allowance.leave_types_stats) return null;

        if (
          member.allowance_type_configurtaions.find((x) => x.allowance_type_id == allowance.allowance_type_id)?.disabled
        )
          return null;

        let stat = Object.entries(allowance.leave_types_stats).map(([id, value]) => {
          // if (leave_types.find((x) => x.id == id)?.allowance_type_id == allowance.allowance_type_id)
          return {
            leave_type: leave_types.find((x) => x.id == id),
            id: id,
            amount: value.amount
          };
        });
        return (
          <div className="mt-3 overflow-hidden bg-white dark:bg-teams_dark_mode_core shadow sm:rounded-lg" key={allowance.id}>
            <div className="px-4 py-5 sm:px-2  w-full text-center ">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{allowance.allowance_type?.name}</h3>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-400" key={allowance.id + 'w'}>
              <dl>
                <div className="bg-white dark:bg-teams_dark_mode_core px-4 pt-2 grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 col-span-2 dark:text-gray-200"></dt>
                  <dd className=" text-right text-sm text-gray-900 dark:text-white">
                    {allowance.allowance_type.allowance_unit == 'days' && t('Days')}
                    {allowance.allowance_type.allowance_unit == 'hours' && t('Hours')}
                  </dd>
                </div>
                <div className="bg-white dark:bg-teams_dark_mode_core px-4 pt-2 grid grid-cols-3 gap-4 ">
                  <dt className="text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">{t('Allowance')}</dt>
                  <dd className="mt-0 text-right text-sm text-gray-900 dark:text-white">
                    {formatDuration(
                      allowance.allowance,
                      lang,
                      allowance.allowance_type.allowance_unit,
                      allowance.allowance_type.allowance_unit == 'hours',
                      t
                    )}
                  </dd>
                </div>
                <div className="bg-white dark:bg-teams_dark_mode_core px-4 pt-2 grid grid-cols-3 gap-4 ">
                  <dt className="text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">
                    {t('Brought_forward') + ' (' + (props.dateRange.startDate.getFullYear() - 1) + ')'}
                  </dt>
                  <dd className=" text-right text-sm text-gray-900 mt-0 dark:text-white">
                    {formatDuration(
                      allowance.brought_forward,
                      lang,
                      allowance.allowance_type.allowance_unit,
                      allowance.allowance_type.allowance_unit == 'hours',
                      t
                    )}
                  </dd>
                </div>
                {allowance.compensatory_time_off != 0 && (
                  <div className="bg-white dark:bg-teams_dark_mode_core px-4 pt-2 grid grid-cols-3 gap-4 ">
                    <dt className="text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">{t('compensatory_time_off')}</dt>
                    <dd className=" text-right text-sm text-gray-900 mt-0 dark:text-white">
                      {formatDuration(
                        allowance.compensatory_time_off,
                        lang,
                        allowance.allowance_type.allowance_unit,
                        false,
                        t
                      )}
                    </dd>
                  </div>
                )}

                {stat &&
                  stat.map((x) => {
                    if (!x) return null;
                    if (!x.leave_type) return null;
                    if (!x.leave_type.take_from_allowance) return null;
                    return (
                      <div className=" bg-white dark:bg-teams_dark_mode_core px-4 pt-5 flex" key={x.id + 'leavetype'}>
                        <dt className="flex-1 text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">
                          <LeaveRow leaveType={x.leave_type} />
                        </dt>
                        <dd className=" text-right text-sm text-gray-900 mt-0 ml-1 dark:text-white">
                          {formatDuration(
                            x.amount,
                            lang,
                            allowance.allowance_type.allowance_unit,
                            allowance.allowance_type.allowance_unit == 'hours',
                            t
                          )}
                        </dd>
                      </div>
                    );
                  })}

                <div className="border-t dark:border-gray-400 bg-white dark:bg-teams_dark_mode_core px-4 py-2 grid grid-cols-3 gap-4  xl:px-4">
                  <dt className="mt-1 text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">
                    {allowance.allowance_type.allowance_unit == 'days' && t('Days_remaining')}
                    {allowance.allowance_type.allowance_unit == 'hours' && t('Hours_remaining')}
                  </dt>
                  <dd className=" text-right text-lg text-gray-900 mt-0 dark:text-white">
                    {formatDuration(
                      allowance.remaining,
                      lang,
                      allowance.allowance_type.allowance_unit,
                      allowance.allowance_type.allowance_unit == 'hours',
                      t
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        );
      })}

      <div className="mt-3 overflow-hidden bg-white dark:bg-teams_dark_mode_core shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-2  w-full text-center">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{t('Non-deductible_leave')}</h3>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-400 pb-4">
          <dl>
            <div className="bg-white dark:bg-teams_dark_mode_core px-4 pt-2 grid grid-cols-3 gap-4 sm:px-4">
              <dt className="text-sm font-medium text-gray-500 col-span-2 dark:text-gray-300">{t('Public_holidays')}</dt>
              <dd className=" text-right text-sm text-gray-900 mt-0 dark:text-white">
                {publicHolidayDays &&
                  formatDuration(calcPublicHolidayDays(publicHolidayDays), lang, AllowanceUnit.days, true, t)}
              </dd>
            </div>
            {stats &&
              stats.map((x) => {
                if (!x.leave_type) return null;
                if (x.leave_type.take_from_allowance) return null;
                return (
                  <div className=" bg-white px-4 pt-5 flex" key={x.id + 'requests'}>
                    <dt className="flex-1 text-sm font-medium text-gray-500 col-span-2">
                      <LeaveRow leaveType={x.leave_type} />
                    </dt>
                    <dd className="text-right text-sm text-gray-900 mt-0 ml-1">
                      {formatDuration(x.amount, lang, x.leave_type.leave_unit, true, t)}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </div>
      </div>
    </>
  );
};

export default Stats;
