import { z } from 'zod';

/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */
const server = z.object({
  NEXT_PUBLIC_MS_PWA: z.string(),
  FILL_SSO_KEY: z.string(),
  NEXT_PUBLIC_AZURE_AD_TENANT_ID: z.string(),
  NEXT_PUBLIC_MSAL_CLIENTID: z.string(),
  NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION: z.string(),
  NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION: z.string(),
  NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION: z.string(),
  NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION: z.string(),
  IRON_SESSION_KEY: z.string(),
  NEXT_PUBLIC_RUNMODE: z.string(),
  NEXT_PUBLIC_PADDLE_API_URL: z.string().url(),
  NEXT_PUBLIC_PADDLE_SANDBOX: z.string(),
  NEXT_PUBLIC_PADDLE_VENDOR_ID: z.string(),
  NEXT_PUBLIC_MAINTENANCE: z.string(),
  HOLIDAYAPI: z.string(),
  SENDINBLUE_API_KEY: z.string(),
  GITHUB_ACTION_SECRET: z.string(),
  MSAL_SECRET_MAILBOX_PERMISSION: z.string(),
  INNGEST_SIGNING_KEY: z.string(),
  INNGEST_EVENT_KEY: z.string(),
  REDIS_URL: z.string(),
  AZURE_BLOB_URL: z.string(),
  NODE_ENV: z.enum(['development', 'test', 'production'])
});

/**
 * Specify your client-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars. To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
const client = z.object({
  // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
});

/**
 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
 * middlewares) or client-side so we need to destruct manually.
 *
 * @type {Record<keyof z.infer<typeof server> | keyof z.infer<typeof client>, string | undefined>}
 */
const processEnv = {
  NEXT_PUBLIC_MS_PWA: process.env.NEXT_PUBLIC_MS_PWA,
  FILL_SSO_KEY: process.env.FILL_SSO_KEY,
  NEXT_PUBLIC_AZURE_AD_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID,
  NEXT_PUBLIC_MSAL_CLIENTID: process.env.NEXT_PUBLIC_MSAL_CLIENTID,
  NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION: process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION,
  NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION: process.env.NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION,
  NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION: process.env.NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION,
  NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION: process.env.NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION,
  IRON_SESSION_KEY: process.env.IRON_SESSION_KEY,
  NEXT_PUBLIC_RUNMODE: process.env.NEXT_PUBLIC_RUNMODE,
  NEXT_PUBLIC_PADDLE_API_URL: process.env.NEXT_PUBLIC_PADDLE_API_URL,
  NEXT_PUBLIC_PADDLE_SANDBOX: process.env.NEXT_PUBLIC_PADDLE_SANDBOX,
  NEXT_PUBLIC_PADDLE_VENDOR_ID: process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID,
  NEXT_PUBLIC_MAINTENANCE: process.env.NEXT_PUBLIC_MAINTENANCE,
  HOLIDAYAPI: process.env.HOLIDAYAPI,
  SENDINBLUE_API_KEY: process.env.SENDINBLUE_API_KEY,
  GITHUB_ACTION_SECRET: process.env.GITHUB_ACTION_SECRET,
  MSAL_SECRET_MAILBOX_PERMISSION: process.env.MSAL_SECRET_MAILBOX_PERMISSION,
  REDIS_URL: process.env.REDIS_URL,
  AZURE_BLOB_URL: process.env.AZURE_BLOB_URL,
  NODE_ENV: process.env.NODE_ENV,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY
};

// Don't touch the part below
// --------------------------

const merged = server.merge(client);

/** @typedef {z.input<typeof merged>} MergedInput */
/** @typedef {z.infer<typeof merged>} MergedOutput */
/** @typedef {z.SafeParseReturnType<MergedInput, MergedOutput>} MergedSafeParseReturn */

let env = /** @type {MergedOutput} */ (process.env);

if (!!process.env.SKIP_ENV_VALIDATION == false) {
  const isServer = typeof window === 'undefined';

  const parsed = /** @type {MergedSafeParseReturn} */ (
    isServer
      ? merged.safeParse(processEnv) // on server we can validate all env vars
      : client.safeParse(processEnv) // on client we can only validate the ones that are exposed
  );

  if (parsed.success === false) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  env = new Proxy(parsed.data, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      // Throw a descriptive error if a server-side env var is accessed on the client
      // Otherwise it would just be returning `undefined` and be annoying to debug
      if (!isServer && !prop.startsWith('NEXT_PUBLIC_'))
        throw new Error(
          process.env.NODE_ENV === 'production'
            ? '❌ Attempted to access a server-side environment variable on the client'
            : `❌ Attempted to access server-side environment variable '${prop}' on the client`
        );
      return target[/** @type {keyof typeof target} */ (prop)];
    }
  });
}

export { env };
