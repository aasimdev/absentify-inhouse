import { createNextApiHandler } from '@trpc/server/adapters/next';
import * as Sentry from '@sentry/nextjs';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: ({ path, error }) => {
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`);
      Sentry.captureException(error);
    }
  }
});
