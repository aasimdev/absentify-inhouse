import { withSentryConfig } from '@sentry/nextjs';
import MillionLint from '@million/lint';
import nextTranslate from 'next-translate-plugin';
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
!process.env.SKIP_ENV_VALIDATION && (await import('./env.mjs'));

/** @type {import("next").NextConfig} */
let config = nextTranslate({
  i18n: {
    localeDetection: false
  },
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/rw.js',
        destination: 'https://r.wdfl.co/rw.js'
      },
      {
        source: '/stats/:match*',
        destination: 'https://analytics.absentify.com/:match*'
      }
    ];
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains'
          },
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://teams.live.com https://*.teams.live.com https://*.skype.com https://*.sharepoint.com https://*.office.com https://outlook.office.com https://outlook.office365.com https://*.microsoft365.com https://*.teams.microsoft.us https://*.gov.teams.microsoft.us;"
          }
        ]
      }
    ];
  }
});

const sentryWebpackPluginOptions = {
  silent: true,
  org: 'absentify',
  project: 'absentify-nextjs',
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true
};

if (process.env.NEXT_PUBLIC_RUNMODE == 'Production') {
  config = withSentryConfig(config, sentryWebpackPluginOptions);
}
if (process.env.NEXT_PUBLIC_IS_LOCALHOST === 'true') {
  config = MillionLint.next({ rsc: true })(config);
}

export default config;
