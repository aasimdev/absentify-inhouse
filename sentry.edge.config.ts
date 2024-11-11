// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_RUNMODE == 'Production') {
  Sentry.init({
    enabled: false,
    dsn: 'https://8ada213c433041278f4541e8b9870816@error.absentify.com/2',

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    beforeSend(event, hint) {
      const error: any = hint.originalException;
      if (
        error &&
        error.message &&
        typeof error.message === 'string' &&
        error.message.includes('Invariant: attempted to hard navigate to the same URL')
      ) {
        return null;
      }
      return event;
    }
  });
}
