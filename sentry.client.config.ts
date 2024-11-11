// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_RUNMODE == 'Production') {
  Sentry.init({
    dsn: 'https://8ada213c433041278f4541e8b9870816@error.absentify.com/2',

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.05,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    replaysOnErrorSampleRate: 1.0,

    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.001,

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
    },

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: []
  });
}
