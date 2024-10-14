import { PublicHolidayDuration } from '@prisma/client';
import { z } from 'zod';

import { createTRPCRouter, protectedPublicApiV1Procedure } from '~/server/api/trpc';

export const publicHolidaysPublicApiRouter = createTRPCRouter({
  getPublicHolidays: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/public_holidays',
        protect: true,
        tags: ['Public holidays'],
        summary: 'Get all public holidays',
        description: 'Get all public holidays'
      }
    })
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          country_code: z.string().nullable(),
          county_code: z.string().nullable(),
          public_holiday_days: z.array(
            z.object({
              id: z.string(),
              date: z.date(),
              year: z.number(),
              custom_value: z.boolean(),
              duration: z.nativeEnum(PublicHolidayDuration),
              updatedAt: z.date(),
              createdAt: z.date(),
              public_holiday_day_languages: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  language: z.string()
                })
              )
            })
          )
        })
      )
    )
    .query(async ({ ctx }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');

      const public_holidays = await ctx.prisma.publicHoliday.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          country_code: true,
          county_code: true,
          public_holiday_days: {
            select: {
              id: true,
              date: true,
              year: true,
              duration: true,
              updatedAt: true,
              createdAt: true,
              custom_value: true,
              public_holiday_day_languages: {
                select: {
                  id: true,
                  name: true,
                  language: true
                }
              },
              holiday_api: {
                select: {
                  holiday_api_languages: {
                    select: {
                      id: true,
                      name: true,
                      language: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      const adjustedPublicHolidays = public_holidays.map((ph) => ({
        ...ph,
        public_holiday_days: ph.public_holiday_days.map((pp) => {
          if (pp.holiday_api) {
            const { holiday_api_languages } = pp.holiday_api;
            return {
              ...pp,
              public_holiday_day_languages: holiday_api_languages,
              holiday_api: undefined // `holiday_api` entfernen
            };
          }
          return pp;
        })
      }));

      return adjustedPublicHolidays;
    }),
  getPublicHolidayById: protectedPublicApiV1Procedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/public_holidays/{id}',
        protect: true,
        tags: ['Public holidays'],
        summary: 'Read a public holiday by id',
        description: 'Read a public holiday by id'
      }
    })
    .input(
      z.object({
        id: z.string().uuid()
      })
    )
    .output(
      z
        .object({
          id: z.string(),
          name: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          country_code: z.string().nullable(),
          county_code: z.string().nullable(),
          public_holiday_days: z.array(
            z.object({
              id: z.string(),
              date: z.date(),
              year: z.number(),
              custom_value: z.boolean(),
              duration: z.nativeEnum(PublicHolidayDuration),
              updatedAt: z.date(),
              createdAt: z.date(),
              public_holiday_day_languages: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  language: z.string()
                })
              )
            })
          )
        })
        .nullable()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.current_member) throw new Error('no member found');
      if (!ctx.current_member.workspace_id) throw new Error('no workspace found');
      const public_holiday = await ctx.prisma.publicHoliday.findFirst({
        where: { workspace_id: ctx.current_member.workspace_id, id: input.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          country_code: true,
          county_code: true,
          public_holiday_days: {
            select: {
              id: true,
              date: true,
              year: true,
              custom_value: true,
              duration: true,
              updatedAt: true,
              createdAt: true,
              public_holiday_day_languages: {
                select: {
                  id: true,
                  name: true,
                  language: true
                }
              },
              holiday_api: {
                select: {
                  holiday_api_languages: {
                    select: {
                      id: true,
                      name: true,
                      language: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!public_holiday) return null;
      const adjustedPublicHoliday = {
        ...public_holiday,
        public_holiday_days: public_holiday.public_holiday_days.map((pp) => {
          if (pp.holiday_api) {
            const { holiday_api_languages } = pp.holiday_api;
            return {
              ...pp,
              public_holiday_day_languages: holiday_api_languages,
              holiday_api: undefined // `holiday_api` entfernen
            };
          }
          return pp;
        })
      };

      return adjustedPublicHoliday;
    })
});
