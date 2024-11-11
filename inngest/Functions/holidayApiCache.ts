import { slugify } from 'inngest';
import { inngest } from '../inngest_client';
import { prisma } from '~/server/db';
import { countries } from '~/lib/countries';
import { HolidayAPI } from 'holidayapi';
interface Task {
  year: number;
  country_code: string;
  lang: string;
}

const sendBatch = async (batch: Task[]) => {
  await inngest.send(
    batch.map((log) => {
      return {
        name: 'holidayapi/fetch',
        data: {
          country_code: log.country_code,
          year: log.year,
          lang: log.lang
        }
      };
    })
  );
};
export const updateHolidayApiCache = inngest.createFunction(
  {
    id: slugify('Update holiday cache'),
    name: 'Update holiday cache'
  },
  { cron: '0 0 */7 * *' },
  async ({}) => {
    const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
    const languages = ['de', 'en', 'es', 'fr', 'hu', 'it', 'pl', 'pt', 'ru', 'tr', 'uk'];
    const tasks = [];

    const batchSize = 50;

    for (let year of years) {
      for (let country_code of countries) {
        for (let lang of languages) {
          tasks.push({ year: year, country_code: country_code.code, lang });
        }
      }
    }

    let i = 0;
    while (i < tasks.length) {
      const batch = tasks.slice(i, Math.min(i + batchSize, tasks.length));
      if (batch.length > 0) {
        await sendBatch(batch);
      }
      i += batchSize;
    }

    return { status: 'Tasks dispatched', taskCount: tasks.length };
  }
);

export const updateHolidayApiCacheLocalDev = inngest.createFunction(
  {
    id: slugify('Update holiday cache-dev'),
    name: 'Update holiday cache'
  },
  { event: 'dev/manual-load_holiday-cache' },
  async ({}) => {
    const years = [2024, 2025];
    const languages = ['de', 'en', 'uk'];
    const tasks = [];

    const batchSize = 50;

    for (let year of years) {
      for (let country_code of [
        { code: 'DE', name: 'Germany' },
        { code: 'CH', name: 'Switzerland' },
        { code: 'UA', name: 'Ukraine' }
      ]) {
        for (let lang of languages) {
          tasks.push({ year: year, country_code: country_code.code, lang });
        }
      }
    }

    const sendBatch = async (batch: Task[]) => {
      await inngest.send(
        batch.map((log) => {
          return {
            name: 'holidayapi/fetch',
            data: {
              country_code: log.country_code,
              year: log.year,
              lang: log.lang
            }
          };
        })
      );
    };

    let i = 0;
    while (i < tasks.length) {
      const batch = tasks.slice(i, Math.min(i + batchSize, tasks.length));
      if (batch.length > 0) {
        await sendBatch(batch);
      }
      i += batchSize;
    }

    return { status: 'Tasks dispatched', taskCount: tasks.length };
  }
);
export const fetchHolidays = inngest.createFunction(
  {
    id: slugify('Fetch holidays for a year, country and language'),
    name: 'Fetch holidays',
    concurrency: { limit: 30 }
  },
  { event: 'holidayapi/fetch' },
  async ({ event }) => {
    const { year, country_code, lang } = event.data;
    const holidayApi = new HolidayAPI({ key: process.env.HOLIDAYAPI });
    const holidays = await holidayApi.holidays({
      subdivisions: true,
      language: lang,
      country: country_code,
      year: year
    });

    if (!holidays.holidays) return;

    const existingHolidays = await prisma.holidayApi.findMany({
      where: { year: year, country: country_code },
      select: { id_year: true }
    });

    const newHolidayIds = holidays.holidays.map((holiday) => holiday.uuid + '_' + year);
    const existingHolidayIds = existingHolidays.map((holiday) => holiday.id_year);

    const holidaysToDelete = existingHolidayIds.filter((id) => !newHolidayIds.includes(id));

    for (let holidayId of holidaysToDelete) {
      await prisma.holidayApi.delete({
        where: { id_year: holidayId }
      });

      await prisma.publicHolidayDay.deleteMany({
        where: { holidayapi_uuid_year: holidayId }
      });
    }

    for (let i2 = 0; i2 < holidays.holidays.length; i2++) {
      const holiday = holidays.holidays[i2];
      if (!holiday) continue;
      await prisma.holidayApi.upsert({
        create: {
          id_year: holiday.uuid + '_' + year,
          subdivisions: holiday.subdivisions ? holiday.subdivisions.join(';') : null,
          country: holiday.country,
          public: holiday.public,
          date: holiday.date,
          observed: holiday.observed,
          year: year
        },
        update: {
          id_year: holiday.uuid + '_' + year,
          subdivisions: holiday.subdivisions ? holiday.subdivisions.join(';') : null,
          country: holiday.country,
          public: holiday.public,
          date: holiday.date,
          observed: holiday.observed,
          year: year
        },
        where: { id_year: holiday.uuid + '_' + year },
        select: { id_year: true }
      });

      await prisma.holidayApiLanguage.upsert({
        create: {
          language: lang,
          name: holiday.name,
          holiday_api_id: holiday.uuid + '_' + year
        },
        update: {
          language: lang,
          name: holiday.name,
          holiday_api_id: holiday.uuid + '_' + year
        },
        where: { holiday_api_id_language: { holiday_api_id: holiday.uuid + '_' + year, language: lang } },
        select: { id: true }
      });
    }

    return {
      status: 'Holidays processed',
      year,
      country: country_code,
      lang,
      holidayCount: holidays.holidays.length
    };
  }
);
