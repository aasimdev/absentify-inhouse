import { LeaveUnit } from '@prisma/client';
import { addMinutes } from 'date-fns';

export function formatDate(yourDate?: Date | null) {
  if (!yourDate) return '';
  if (!isValidDate(yourDate)) return '';
  const offset = yourDate.getTimezoneOffset();
  yourDate = new Date(yourDate.getTime() - offset * 60 * 1000);

  return yourDate.toISOString().split('T')[0];
}
export function formatTime(yourDate?: Date | null) {
  if (!yourDate) return '';
  if (!isValidDate(yourDate)) return '';
  const date = yourDate.toISOString().split('T')[1];
  if (date) return date.split('.')[0];
}
function isValidDate(d: Date) {
  // @ts-ignore
  return d instanceof Date && !isNaN(d);
}
export function convertLocalDateToUTC(date: Date) {
  if (!date) return new Date();
  const timezoneOffsetInMinutes = date.getTimezoneOffset();
  return addMinutes(date, timezoneOffsetInMinutes * -1);
}

export function dateToIsoDate(date: Date) {
  const [withoutT] = date.toISOString().split('T');
  return new Date(`${withoutT}T00:00:00`);
}
export function getDateOnly(someDate: Date): Date {
  return new Date(someDate.valueOf() + someDate.getTimezoneOffset() * 60 * 1000);
}

export function prepareDateForBackend(date: Date): Date {
  const result = addMinutes(date, date.getTimezoneOffset() * -1);
  return result;
}
export function dateFromDatabaseIgnoreTimezone(date: Date) {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0,
    0
  );
}

export function areDatesEqualWithoutTime(date1: Date, date2: Date) {
  const utcYear1 = date1.getUTCFullYear();
  const utcMonth1 = date1.getUTCMonth();
  const utcDay1 = date1.getUTCDate();

  const utcYear2 = date2.getUTCFullYear();
  const utcMonth2 = date2.getUTCMonth();
  const utcDay2 = date2.getUTCDate();

  return utcYear1 === utcYear2 && utcMonth1 === utcMonth2 && utcDay1 === utcDay2;
}
export function getDates(startDate: Date, endDate: Date) {
  const dates = [];
  let currentDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0)
  );
  const stopDate = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0, 0)
  );
  while (currentDate <= stopDate) {
    dates.push(new Date(currentDate));
    currentDate = new Date(
      Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() + 1, 0, 0, 0, 0)
    );
  }
  return dates;
}
export function isDayUnit(unit: LeaveUnit | undefined) {
  if (!unit) throw new Error('unit is undefined');
  return ['days', 'half_days'].includes(unit);
}
export function isHourUnit(unit: LeaveUnit | undefined) {
  if (!unit) throw new Error('unit is undefined');
  return ['hours', 'minutes_30', 'minutes_15', 'minutes_10', 'minutes_5', 'minutes_1'].includes(unit);
}
export function getDatesFromNow(): { pastDate: Date; futureDate: Date } {
  const now = new Date();

  // Create a date 10 years in the past
  const pastDate = new Date(now);
  pastDate.setFullYear(now.getFullYear() - 10);

  // Create a date 10 years in the future
  const futureDate = new Date(now);
  futureDate.setFullYear(now.getFullYear() + 10);

  return { pastDate, futureDate };
}