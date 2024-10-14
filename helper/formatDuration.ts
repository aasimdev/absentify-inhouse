import { LeaveUnit } from '@prisma/client';
import { format } from 'date-fns';
import { Translate } from 'next-translate';
import { dateToIsoDate, dateFromDatabaseIgnoreTimezone } from '~/lib/DateHelper';
import { defaultRequestSelectOutput } from '~/server/api/routers/request';
import { RouterOutputs } from '~/utils/api';

export function formatDuration(
  duration: number,
  language: string,
  unit: LeaveUnit | undefined,
  showWithUnit: boolean,
  t: Translate
): string {
  if (unit === undefined) {
    return '';
  }

  const isNegative = duration < 0;
  const absDuration = Math.abs(duration);

  if (unit === LeaveUnit.days || unit === LeaveUnit.half_days) {
    // Check whether 'duration' has a decimal number of .5
    const integerPart = Math.floor(absDuration);
    const decimalPart = absDuration % 1;
    let formattedDuration;

    if (decimalPart === 0.5) {
      // Replace the decimal value with the symbol '½'
      formattedDuration = (isNegative ? '-' : '') + (integerPart === 0 ? '½' : `${integerPart}½`);
    } else {
      // Standard formatting for other values
      const formatter = new Intl.NumberFormat(language, {
        minimumFractionDigits: decimalPart !== 0 ? 1 : 0,
        maximumFractionDigits: decimalPart !== 0 ? 2 : 0
      });
      formattedDuration = (isNegative ? '-' : '') + formatter.format(absDuration);
    }

    // Return of the formatted string with 'day' or 'days'
    if (!showWithUnit) return formattedDuration;
    return formattedDuration + ' ' + (absDuration !== 1 ? t('days') : t('day'));
  }

  const hours = Math.floor(absDuration / 60);
  const minutes = absDuration % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');

  if (!showWithUnit) {
    return `${isNegative ? '-' : ''}${hours}:${formattedMinutes}`;
  }
  return `${isNegative ? '-' : ''}${hours}h ${formattedMinutes}m`;
}
export function formatLeaveRequestDetails(
  request: defaultRequestSelectOutput,
  current_member: RouterOutputs['member']['current'],
  t: Translate
) {
  const translateAt = (value: string) => {
    if (value == 'afternoon') return t('Afternoon');
    if (value == 'morning') return t('Morning');
    if (value == 'lunchtime') return t('Lunchtime');
    if (value == 'end_of_day') return t('End_of_Day');
    return '';
  };
  // Überprüfung des Leave-Unit-Typs
  if (request.leave_unit === 'days' || request.leave_unit === 'half_days') {
    // Formatierung für Tage oder Halbtage
    return `${format(dateToIsoDate(request.start), current_member?.date_format)} ${translateAt(
      `${request.start_at}`
    )} ${t('to')} ${format(dateToIsoDate(request.end), current_member?.date_format)} ${translateAt(
      `${request.end_at}`
    )}`;
  } else {
    // Formatierung für andere Leave-Unit-Typen
    return `${format(dateFromDatabaseIgnoreTimezone(request.start), current_member?.long_datetime_format)} ${t(
      'to'
    )} ${format(dateFromDatabaseIgnoreTimezone(request.end), current_member?.long_datetime_format)}`;
  }
}
