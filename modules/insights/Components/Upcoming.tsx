import useTranslation from 'next-translate/useTranslation';
import React, { useState, useEffect } from 'react';
import { useAbsentify } from '@components/AbsentifyContext';
import ProfileImage from '@components/layout/components/ProfileImage';
import { CakeIcon, BookmarkSquareIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import Link from 'next/link';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getDateOnly } from '~/lib/DateHelper';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { useDarkSide } from '@components/ThemeContext';

const Upcoming: React.FC<{ members: defaultMemberSelectOutput[]; subscription: boolean }> = (props) => {
  const [theme] = useDarkSide();
  const { current_member } = useAbsentify();
  const { subscription } = props;

  const { teamsMobile } = useAbsentify();
  const { t } = useTranslation('insights');
  const isToday = (someDate: Date) => {
    const today = new Date();
    return (
      someDate.getDate() == today.getDate() &&
      someDate.getMonth() == today.getMonth() &&
      someDate.getFullYear() == today.getFullYear()
    );
  };
  const getIcon = (type: string) => {
    if (type === 'birthday') return <CakeIcon height={16} className="mr-2 mt-1" />;
    if (type === 'anniversary') return <BookmarkSquareIcon height={16} className="mr-2 mt-1" />;
    return null;
  };

  const getAnniversaryText = (startDate: Date): string => {
    const today = new Date();
    const startYear = startDate.getFullYear();
    const currentYear = today.getFullYear();
    let years = currentYear - startYear;
  
    if (years === 0) {
      return t('first-working-day');
    } else if (years === 1) {
      return t('1-year-anniversary');
    } else {
      return t('multiple-years-anniversary', { years });
    }
  };
  
  const getAgeDisplay = (member: MemberState) => {
    if (member.type === 'birthday' && member.date && member.age !== 0) {
      return t('multiple-years-old', { age: isToday(member.date) ? member.age - 1 : member.age });
    }
  
    if (member.type === 'anniversary' && member.originalDate) {
      return getAnniversaryText(member.originalDate);
    }
  
    return '';
  };

  type MemberState = {
    id: string;
    user_id: string | null;
    name: string | null;
    last_name: string | null;
    first_name: string | null;
    email: string | null;
    date: Date | null;
    type: 'birthday' | 'anniversary';
    image: string | null;
    has_cdn_image: boolean;
    age: number;
    originalDate: Date | null;
    microsoft_user_id: string;
  };
  const [upcomingBAndA, setUpcomingBAndA] = useState<MemberState[]>();
  useEffect(() => {
    if (!props.members) return;

    let array: {
      id: string;
      user_id: string | null;
      name: string | null;
      last_name: string | null;
      first_name: string | null;
      email: string | null;
      date: Date | null;
      type: 'birthday' | 'anniversary';
      image: string | null;
      has_cdn_image: boolean;
      age: number;
      originalDate: Date | null;
      microsoft_user_id: string;
    }[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    array.push(...(fillArray(props.members, 'birthday', today.getFullYear()) as any));
    array.push(...(fillArray(props.members, 'birthday', today.getFullYear() + 1) as any));

    array.push(...(fillArray(props.members, 'employment_start_date', today.getFullYear()) as any));
    array.push(...(fillArray(props.members, 'employment_start_date', today.getFullYear() + 1) as any));

    const dateIn3Months = new Date();

    dateIn3Months.setMonth(dateIn3Months.getMonth() + 3);

    array = array
      .filter((x) => x.date != null && x.date >= today && x.date <= dateIn3Months)
      .sort(function (a, b) {
        if (!b.date) return 0;
        if (!a.date) return 1;
        return a.date.getTime() - b.date.getTime();
      })
      .map((x) => {
        return x;
      });
    setUpcomingBAndA(array.slice(0, 10));
  }, [props.members]);
  if (!upcomingBAndA?.length) return <p className="p-2 text-center dark:text-gray-200">{t('noDates')}</p>;
  return (
    <>
      {upcomingBAndA &&
        current_member &&
        upcomingBAndA.map((member, i) => {
          const dateOnly = member.date && getDateOnly(member.date);
          return (
            <div
              className="flex p-4 lg:w-full  lg:space-x-2 lg:p-3"
              key={member.id + member.date + '' + member.type}
            >
              <div className=" w-14 ">
                <ProfileImage className={!subscription && i >= 2 ? 'blur-sm ' : ''} tailwindSize="10" member={member} />
              </div>

              <div className="ml-4 w-full ">
                <div className={!subscription && i >= 2 ? 'blur-sm ' : ' font-medium '}>{member.name}</div>

                <div
                  className="text-slate-70 mt-1 cursor-pointer "
                  data-tooltip-id="upcoming-tooltip"
                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                  data-tooltip-delay="700"
                  data-tooltip-content={
                    !subscription && i < 2
                      ? `${t(member.type)} :   ${
                          member.originalDate ? format(member.originalDate, current_member.date_format) : ''
                        }`
                      : subscription
                      ? `${t(member.type)} :   ${
                          member.originalDate ? format(member.originalDate, current_member.date_format) : ''
                        }`
                      : ''
                  }
                >
                  <span>
                    <div
                      className={
                        !subscription && i >= 2
                          ? ' flex w-full justify-between blur-sm'
                          : 'flex w-full  justify-between gap-4'
                      }
                    >
                      <div className="inline-flex">
                        <span>
                        {getIcon(member.type)}
                        </span>
                        <span>
                          {member.date &&
                            format(
                              dateOnly as Date,
                              current_member.date_format
                                .replace('/yyyy', '')
                                .replace('-yyyy', '')
                                .replace('.yyyy', '')
                                .replace(' yyyy', '')
                                .replace('yyyy-', '')
                                .replace('yyyy/', '')
                                .replace('yyyy ', '')
                                .replace('yyyy.', '')
                            )}
                        </span>
                      </div>
                      <div className={'text-center w-auto' }>
                          <span className=' '>{getAgeDisplay(member)}</span>
                      </div>
                    </div>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      {current_member && upcomingBAndA.length >= 2 && (
        <ReactTooltip
          id="upcoming-tooltip"
          className="shadow-sm z-50 "
          classNameArrow="shadow-sm"
          place="top"
          opacity={1}
          style={{ boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
          clickable
        >
          <div className="block text-center text-sm">
            <p>{t('upgradeT1')}</p>
            {current_member.is_admin && !teamsMobile && (
              <Link href="/settings/organisation/upgrade" className="underline hover:text-blue-700">
                {t('upgradeT2')}
              </Link>
            )}
          </div>
        </ReactTooltip>
      )}
    </>
  );
};

export default Upcoming;
function getYearDiffWithMonth(startDate: Date, endDate: Date) {
  const ms = endDate.getTime() - startDate.getTime();

  const date = new Date(ms);

  return Math.abs(date.getUTCFullYear() - 1970);
}
function fillArray(members: defaultMemberSelectOutput[], field: 'birthday' | 'employment_start_date', year: number) {
  return members.map((x) => {
    const birthday = x.birthday ? new Date(x.birthday) : null;
    const employment_start_date = x.employment_start_date ? new Date(x.employment_start_date) : null;
    birthday?.setUTCFullYear(year);
    employment_start_date?.setUTCFullYear(year);
    let textValue = 0;
    if (field == 'birthday' && x.birthday) {
      textValue = ageOnUpcoming(new Date(x.birthday));
    } else if (field == 'employment_start_date' && x.employment_start_date) {
      textValue = ageOnUpcoming(new Date(x.employment_start_date));
    }
    return {
      id: x.id,
      name: x.name,
      date: field == 'birthday' ? birthday : employment_start_date,
      type: field == 'birthday' ? 'birthday' : 'anniversary',
      has_cdn_image: x?.has_cdn_image,
      age: textValue,
      originalDate: field == 'birthday' ? x.birthday : x.employment_start_date,
      microsoft_user_id: x.microsoft_user_id
    };
  });
}

function ageOnUpcoming(birthday: Date): number {
  const today: Date = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
  let age = today.getFullYear() - birthday.getFullYear();

  if (today <= birthdayThisYear) {
    return age;
  } else {
    return age + 1;
  }
}