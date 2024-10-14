// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

if(process.env.NEXT_PUBLIC_RUNMODE !== 'Development' && process.env.NEXT_PUBLIC_IS_LOCALHOST !== 'true') {
Sentry.init({
  dsn: "https://8ada213c433041278f4541e8b9870816@error.absentify.com/2",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  beforeSend(event, hint) {
    const error: any = hint.originalException;
    if (error && error.message && typeof error.message === 'string' && error.message.includes("Invariant: attempted to hard navigate to the same URL")) {
      return null;
    }
    return event;
  },

});
}

