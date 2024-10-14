import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { Guid } from 'guid-typescript';
import { api } from '~/utils/api';

export const apikeyRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }

    const apiKey = await ctx.prisma.apiKey.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id },
      select: { id: true, key: true }
    });
    if (!apiKey) {
      return null;
    }

    //remove all digits except last 4
    apiKey.key = apiKey.key.replace(/.(?=.{4})/g, '*');

    return apiKey;
  }),

  create: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    //NOTE - useTranslation in backend
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }
    let apiKey = await ctx.prisma.apiKey.findFirst({
      where: { workspace_id: ctx.current_member.workspace_id },
      select: { id: true, key: true }
    });
    if (!apiKey) {
      apiKey = await ctx.prisma.apiKey.create({
        data: {
          description: 'API Key',
          key: Guid.create().toString(),
          workspace_id: ctx.current_member.workspace_id,
          run_as_member_id: ctx.current_member.id,
          valid_until: new Date(1, 0, 2099)
        },
        select: { id: true, key: true }
      });
    } else {
      apiKey = await ctx.prisma.apiKey.update({
        where: { key: apiKey.key },
        data: {
          description: 'API Key',
          key: Guid.create().toString(),
          workspace_id: ctx.current_member.workspace_id,
          run_as_member_id: ctx.current_member.id,
          valid_until: new Date(1, 0, 2099)
        },
        select: { id: true, key: true }
      });
    }

    //remove last 4 digits
    // apiKey.key = apiKey.key.replace(/.(?=.{4})/g, '*');

    return apiKey;
  })
});
