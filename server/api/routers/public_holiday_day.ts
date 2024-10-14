import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PublicHolidayDuration } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { ensureAvailabilityOfGetT } from 'lib/monkey-patches';
import { inngest } from '~/inngest/inngest_client';

/**
 * Default selector for publicHolidayDay.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultPublicHolidayDaySelect = Prisma.validator<Prisma.PublicHolidayDaySelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  date: true,
  year: true,
  workspace_id: true,
  custom_value: true,
  public_holiday_id: true,
  duration: true
});

const defaultPublicHolidayDaySelectWithLanguages = Prisma.validator<Prisma.PublicHolidayDaySelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  date: true,
  year: true,
  workspace_id: true,
  public_holiday_id: true,
  duration: true,
  custom_value: true,
  public_holiday_day_languages: {
    select: {
      id: true,
      language: true,
      name: true
    }
  },
  holiday_api: {
    select: {
      holiday_api_languages: {
        select: {
          id: true,
          language: true,
          name: true
        }
      }
    }
  }
});
const languages = ['de', 'en', 'es', 'fr', 'hu', 'it', 'pl', 'pt', 'ru', 'tr', 'uk'];
export const publicHolidayDayRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        date: z.date(),
        public_holiday_id: z.string(),
        duration: z.nativeEnum(PublicHolidayDuration)
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHolidayDay'
        });
      }

      const publicHolidayDay = await ctx.prisma.publicHolidayDay.create({
        data: {
          date: input.date,
          year: input.date.getFullYear(),
          workspace_id: ctx.current_member.workspace_id,
          public_holiday_id: input.public_holiday_id,
          custom_value: true,
          duration: input.duration
        },
        select: { id: true }
      });
      await ctx.prisma.publicHolidayDayLanguage.createMany({
        data: languages.map((lang) => ({
          name: input.name,
          language: lang,
          workspace_id: ctx.current_member.workspace_id,
          public_holiday_day_id: publicHolidayDay.id
        }))
      });

      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });

      const members = await ctx.prisma.member.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true }
      });
      await inngest.send(
        members.map((m) => {
          return {
            name: 'publicHolidayDaySync/create_sync_items_for_member',
            data: {
              member_id: m.id
            }
          };
        })
      );

      return publicHolidayDay;
    }),
  all: protectedProcedure
    .input(
      z.object({
        public_holiday_id: z.string().optional(),
        start: z.date().nullable().optional(),
        end: z.date().nullable().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      /**
       * For pagination you can have a look at this docs site
       * @link https://trpc.io/docs/useInfiniteQuery
       */
      let where: Prisma.PublicHolidayDayWhereInput = {
        workspace_id: ctx.current_member.workspace_id
      };

      if (input.public_holiday_id) where.public_holiday_id = input.public_holiday_id;

      if (input.start && input.end) {
        where.date = { gte: input.start, lte: input.end };
      }
      const publicHolidayDays = await ctx.prisma.publicHolidayDay.findMany({
        select: defaultPublicHolidayDaySelectWithLanguages,
        where: where,
        orderBy: [
          {
            date: 'asc'
          }
        ]
      });

      for (let index = 0; index < publicHolidayDays.length; index++) {
        const element = publicHolidayDays[index];
        if (!element) continue;
        if (element.holiday_api) {
          element.public_holiday_day_languages = element.holiday_api.holiday_api_languages;
        }
        element.public_holiday_day_languages = element.public_holiday_day_languages.filter(
          (lang) => lang.language === ctx.current_member.language
        );
      }

      const publicHolidayDaysWithLanguages = publicHolidayDays.map((hol) => ({
        ...hol,
        name: hol.public_holiday_day_languages[0]?.name
      }));

      return publicHolidayDaysWithLanguages;
    }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const publicHolidayDay = await ctx.prisma.publicHolidayDay.findFirst({
        where: {
          id,
          workspace_id: ctx.current_member.workspace_id
        },
        select: defaultPublicHolidayDaySelectWithLanguages
      });
      if (!publicHolidayDay) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No publicHolidayDay with id '${id}'`
        });
      }

      if (publicHolidayDay.holiday_api) {
        publicHolidayDay.public_holiday_day_languages = publicHolidayDay.holiday_api.holiday_api_languages;
      }

      publicHolidayDay.public_holiday_day_languages = publicHolidayDay.public_holiday_day_languages.filter(
        (lang) => lang.language === ctx.current_member.language
      );

      const publicHolidayDaysWithLanguages = {
        ...publicHolidayDay,
        name: publicHolidayDay.public_holiday_day_languages[0]?.name
      };

      return publicHolidayDaysWithLanguages;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string(),
          date: z.date(),
          year: z.number(),
          workspace_id: z.string(),
          public_holiday_id: z.string(),
          duration: z.nativeEnum(PublicHolidayDuration)
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(ctx.current_member.language, 'backend');
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit publicHolidayDay'
        });
      }
      const publicHolidayDay = await ctx.prisma.publicHolidayDay.update({
        where: { id },
        data,
        select: defaultPublicHolidayDaySelect
      });

      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });
      const members = await ctx.prisma.member.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true }
      });
      await inngest.send(
        members.map((m) => {
          return {
            name: 'publicHolidayDaySync/create_sync_items_for_member',
            data: {
              member_id: m.id
            }
          };
        })
      );
      return publicHolidayDay;
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(ctx.current_member.language, 'backend');
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: t('error_you_have_to_be_admin')
        });
      }
      const publicHolidayDay = await ctx.prisma.publicHolidayDay.findUnique({
        where: { id },
        select: { workspace_id: true, public_holiday_id: true }
      });
      if (publicHolidayDay?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: t('error_you_have_to_be_admin')
        });
      }
      await ctx.prisma.publicHolidayDay.delete({ where: { id: id } });
      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });
      const members = await ctx.prisma.member.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true }
      });
      await inngest.send(
        members.map((m) => {
          return {
            name: 'publicHolidayDaySync/create_sync_items_for_member',
            data: {
              member_id: m.id
            }
          };
        })
      );
      return {
        id
      };
    }),
  getAllLanguages: protectedProcedure
    .input(
      z.object({
        public_holiday_day_id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const publicHolidayDay = await ctx.prisma.publicHolidayDay.findUnique({
        where: { id: input.public_holiday_day_id },
        select: defaultPublicHolidayDaySelect
      });
      if (!publicHolidayDay) return null;
      const publicHolidaLanguages = await ctx.prisma.publicHolidayDayLanguage.findMany({
        where: {
          public_holiday_day_id: publicHolidayDay.id
        }
      });
      return publicHolidaLanguages;
    }),
  editHolidayDay: protectedProcedure
    .input(
      z.object({
        language: z.string(),
        name: z.string(),
        public_holiday_day_id: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { public_holiday_day_id, language, name } = input;

      const publicHolidayDay = await ctx.prisma.publicHolidayDay.findFirst({
        where: { id: public_holiday_day_id },
        select: { custom_value: true }
      });
      if (!publicHolidayDay) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No publicHolidayDay with id '${public_holiday_day_id}'`
        });
      }

      if (!publicHolidayDay.custom_value) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only custom public holiday days can be edited.'
        });
      }

      const result = await ctx.prisma.publicHolidayDayLanguage.updateMany({
        where: { public_holiday_day_id, language },
        data: { name }
      });
      return result;
    })
});
