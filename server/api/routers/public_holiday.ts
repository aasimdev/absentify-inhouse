import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { inngest } from '~/inngest/inngest_client';

/**
 * Default selector for publicHoliday.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultPublicHolidaySelect = Prisma.validator<Prisma.PublicHolidaySelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  country_code: true,
  county_code: true,
  workspace_id: true
});
export const publicHolidayRouter = createTRPCRouter({
  // create
  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        country_code: z.string(),
        county_code: z.string().nullable().optional(),
        workspace_id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.workspace_id },
        select: { global_language: true }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }

      if (!input.county_code) input.county_code = null;

      const publicHoliday = await ctx.prisma.publicHoliday.create({
        data: {
          name: input.name,
          country_code: input.country_code,
          county_code: input.county_code,
          workspace_id: input.workspace_id
        },
        select: { id: true }
      });

      await createPublicHolidayForCountryCode({
        public_holiday_id: publicHoliday.id,
        workspace_id: input.workspace_id,
        years: [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1],
        country_code: input.country_code,
        county_code: input.county_code,
        ctx: ctx
      });

      return publicHoliday;
    }),
  add_new_year: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        year: z.number()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }

      const [workspace, publicHoliday] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { global_language: true }
        }),
        ctx.prisma.publicHoliday.findUnique({
          where: { id: input.id },
          select: { id: true, country_code: true, county_code: true }
        })
      ]);
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }

      if (!publicHoliday) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add publicHoliday'
        });
      }
      if (!publicHoliday.country_code) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: "Public holiday doesn't have a country code"
        });
      }

      await createPublicHolidayForCountryCode({
        public_holiday_id: input.id,
        workspace_id: ctx.current_member.workspace_id,
        years: [input.year],
        country_code: publicHoliday.country_code,
        county_code: publicHoliday.county_code,
        ctx: ctx
      });

      await inngest.send({
        // The event name
        name: 'workspace/update.member.allowance',
        // The event's data
        data: {
          workspaceId: ctx.current_member.workspace_id
        }
      });

      return publicHoliday;
    }),
  all: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    return ctx.prisma.publicHoliday.findMany({
      select: defaultPublicHolidaySelect,
      where: { workspace_id: ctx.current_member.workspace_id },
      orderBy: [
        {
          name: 'asc'
        }
      ]
    });
  }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const publicHoliday = await ctx.prisma.publicHoliday.findFirst({
        where: { id, workspace_id: ctx.current_member.workspace_id },
        select: defaultPublicHolidaySelect
      });
      if (!publicHoliday) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No publicHoliday with id '${id}'`
        });
      }
      return publicHoliday;
    }),

  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string(),
          workspace_id: z.string()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != input.data.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit publicHoliday'
        });
      }

      const publicHoliday = await ctx.prisma.publicHoliday.update({
        where: { id },
        data,
        select: defaultPublicHolidaySelect
      });
      return publicHoliday;
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const [publicHoliday, members] = await ctx.prisma.$transaction([
        ctx.prisma.publicHoliday.findUnique({
          where: { id },
          select: { workspace_id: true }
        }),
        ctx.prisma.member.findMany({
          where: { public_holiday_id: id },
          select: { id: true }
        })
      ]);

      if (publicHoliday?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (members.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('this-calendar-is-currently-being-used-by-one-or-more-users-remove-it-from-there-first')
        });
      }

      await ctx.prisma.publicHoliday.delete({ where: { id: id } });
      return {
        id
      };
    })
});

export async function createPublicHolidayForCountryCode(input: {
  public_holiday_id: string;
  workspace_id: string;
  years: number[];
  country_code: string;
  county_code: string | null | undefined;
  ctx: {
    prisma: PrismaClient;
  };
}) {
  const readyPublicHolidays = await input.ctx.prisma.holidayApi.findMany({
    where: {
      year: { in: input.years },
      country: input.country_code
    },
    select: {
      id_year: true,
      subdivisions: true,
      country: true,
      public: true,
      date: true,
      observed: true,
      year: true
    }
  });

  const holidays = readyPublicHolidays.filter(
    (x) =>
      x.public &&
      (x.subdivisions && x.subdivisions.length > 0 && input.county_code
        ? x.subdivisions.split(';').find((y) => y == input.county_code)
        : true)
  );

  await input.ctx.prisma.publicHolidayDay.createMany({
    data: holidays.map((h) => {
      const date = new Date(h.date + 'T00:00:00Z');
      return {
        date: date,
        duration: 'FullDay',
        custom_value: false,
        holidayapi_uuid_year: h.id_year,
        public_holiday_id: input.public_holiday_id,
        workspace_id: input.workspace_id,
        year: h.year
      };
    })
  });

  return;
}
