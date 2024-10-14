/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '~/server/db';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
type CreateContextOptions = {
  session: IronSessionData | null;
  current_member: current_member_SelectOutput | null;
  req: NextApiRequest | null;
};

export const current_member_Select = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  is_admin: true,
  employment_start_date: true,
  employment_end_date: true,
  workspace_id: true,
  birthday: true,
  public_holiday_id: true,
  name: true,
  custom_id: true,
  email: true,
  default_timeline_department_id: true,
  approver_config_department_id: true,
  approver_config_microsoft_profile_manager_sync: true,
  approval_process: true,
  has_cdn_image: true,
  firstName: true,
  lastName: true,
  language: true,
  time_format: true,
  timezone: true,
  date_format: true,
  microsoft_tenantId: true,
  microsoft_user_id: true,
  long_datetime_format: true
});
export type current_member_SelectOutput = Prisma.MemberGetPayload<{
  select: typeof current_member_Select;
}>;
/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-servertrpccontextts
 */
const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    current_member: opts.current_member,
    prisma,
    req: opts.req
  };
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  const requestId = uuidv4();
  res.setHeader('x-request-id', requestId);
  if (req.headers?.host?.includes('api.absentify.com') || req.headers?.['x-invoke-path']?.includes('/api/v1')) {
    return await createPublicApiV1InnerTRPCCOntext(req);
  }

  // Get the session from the server using the getServerSession wrapper function
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  let member = null;

  if (session.user?.id) {
    member = await prisma.member.findUnique({
      where: { microsoft_user_id: session.user.microsoft_user_id },
      select: current_member_Select
    });
  }

  if (session?.user)
    Sentry.setUser({
      email: session.user.email?.toString(),
      id: member?.id,
      username: session.user.name?.toString()
    });
  return createInnerTRPCContext({
    session,
    current_member: member,
    req
  });
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { GetServerSidePropsContext, NextApiRequest } from 'next';
import { Prisma } from '@prisma/client';
import { OpenApiMeta } from 'trpc-openapi';
import { getIronSession, IronSessionData } from 'iron-session';
import { getIronSessionConfig, SessionData } from '~/utils/ironSessionConfig';
import { createTrpcRedisLimiter } from '@trpc-limiter/redis';

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape }) {
      return shape;
    }
  });
async function createPublicApiV1InnerTRPCCOntext(req: NextApiRequest) {
  let apiKey = req.headers['x-api-key'] + '';
  if (!apiKey) apiKey = req.query['apiKey'] + '';
  if (!apiKey) apiKey = req.query['api_key'] + '';
  if (!apiKey) throw new Error('Invalid API key');

  let key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    select: { workspace_id: true, run_as_member_id: true }
  });
  if (!key) throw new Error('Invalid API key');
  if (key.run_as_member_id == null) throw new Error('Invalid API key');

  const z = await prisma.member.findUnique({
    where: { id: key.run_as_member_id },
    select: current_member_Select
  });
  if (!z) throw new Error('No user found');
  console.log(z);
  return createInnerTRPCContext({
    req,
    current_member: z,
    session: {
      user: {
        id: z.microsoft_user_id + '',
        name: z.name + '',
        email: z.email + '',
        microsoft_user_id: z.microsoft_user_id + '',
        microsoft_tenant_id: z.microsoft_tenantId + '',
        member_id: z.id,
        orgName: '',
        language: z.language + '',
        impersonate: false
      }
    }
  });
}

export const getFingerprint = (req: NextApiRequest | GetServerSidePropsContext['req'] | null) => {
  if (!req) return '127.0.0.1';
  let ip = null;
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    // Sicherstellen, dass ipList definiert ist, auch wenn forwarded kein Komma enthält
    const ipList = typeof forwarded === 'string' ? forwarded.split(',') : [forwarded[0]];
    ip = ipList[0]?.split(':')[0]; // Nur IP-Teil extrahieren
  } else {
    ip = req.socket.remoteAddress;
  }

  return ip || '127.0.0.1';
};

const redis = new Redis(process.env.REDIS_URL + '');
const rateLimiter = createTrpcRedisLimiter<typeof t>({
  fingerprint: (ctx) => getFingerprint(ctx.req),
  message: (hitInfo) => `Too many requests, please try again later. ${hitInfo}`,
  max: 15,
  windowMs: 10000,
  redisClient: redis
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/** Reusable middleware that enforces users are logged in before running the procedure. */
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user || !ctx.current_member) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const getT = ensureAvailabilityOfGetT();
  const tr = await getT(ctx.current_member.language, 'backend');

  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
      current_member: { ...ctx.current_member },
      t: tr
    }
  });
});

const enforceUserIsLoggedIn = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: {
        ...ctx.session,
        user: ctx.session.user
      }
    }
  });
});

const enforceUserIsAuthedAndDBAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user || !ctx.current_member) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  if (
    ctx.session.user.microsoft_user_id !== 'f4058fbc-db7f-4572-962b-f6192f0e0b6a' &&
    ctx.session.user.microsoft_user_id !== '8dba184e-2cf4-43a6-b4da-53ee68efac99'
  ) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const getT = ensureAvailabilityOfGetT();
  const tr = await getT(ctx.current_member.language, 'backend');
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
      current_member: { ...ctx.current_member },
      t: tr
    }
  });
});

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

export const protectedDbAdminProcedure = t.procedure.use(enforceUserIsAuthedAndDBAdmin);

export const registerProcedure = t.procedure.use(enforceUserIsLoggedIn);

export const protectedPublicApiV1Procedure = t.procedure.use(enforceUserIsAuthed).use(rateLimiter);
