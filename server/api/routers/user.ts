import { Prisma } from '@prisma/client';
import { createTRPCRouter, publicProcedure } from '../trpc';
/**
 * Default selector for user.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultUserSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  email: true,
  is_admin: true,
  has_cdn_image: true,
  microsoft_user_id: true
});

export const userRouter = createTRPCRouter({
  session: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) return null;
    if (!ctx.session.user) return null;
    if (!ctx.session.user.id) return null;
    return ctx.session.user;
  })
});
