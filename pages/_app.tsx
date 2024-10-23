import '../styles/globals.css';
import { AbsentifyProvider } from '@components/AbsentifyContext';
import BaseLayout from '@components/layout/base';
import Maintenance from '@modules/Maintenance';
import type { AppProps, NextWebVitalsMetric } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { event, GoogleAnalytics } from 'nextjs-google-analytics';
import { LinkedInInsightTag } from 'nextjs-linkedin-insight-tag';
import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import { api } from '~/utils/api';
import dynamic from 'next/dynamic';
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { getAppInsights } from '~/utils/analytics';
import UmamiScript from '~/utils/umami_component';
import { ThemeProvider } from '@components/ThemeContext';

const CrispWithNoSSR = dynamic(() => import('../helper/crisp'), { ssr: false });

/* if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY) {
  appInsights
    .setup(process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .start();
}
 */
/* export function reportWebVitals(metric: NextWebVitalsMetric) {
  event(metric.name, {
    category: metric.label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value), // values must be integers
    label: metric.id, // id unique to current page load
    nonInteraction: true // avoids affecting bounce rate.
  });
} */

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  useEffect(() => {
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    getAppInsights();
    if (process.env.NEXT_PUBLIC_MS_PWA == 'true') {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/serviceWorker.js').then(
            function (registration) {
              console.log('Service Worker registration successful with scope: ', registration.scope);
            },
            function (err) {
              console.log('Service Worker registration failed: ', err);
            }
          );
        });
      }
    }
  }, []);

  const router = useRouter();
  useEffect(() => {
    if (!router) return;
    if (!router.isReady) return;
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('absentify_referrer')) {
        localStorage.setItem(
          'absentify_referrer',
          router.query.referrer ? `${router.query.referrer}` : document?.referrer
        );
      }
      if (!localStorage.getItem('absentify_gclid') && router.query.gclid) {
        localStorage.setItem('absentify_gclid', router.query.gclid + '');
      }
    }
  }, [router, router.isReady]);

  if (process.env.NEXT_PUBLIC_MAINTENANCE === '1') {
    return <Maintenance />;
  }

  return (
    <>
      <UmamiScript />
      <ThemeProvider>
      <AbsentifyProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns} >
          <BaseLayout>
            <Component {...pageProps} />
          </BaseLayout>
          </LocalizationProvider>
      
      </AbsentifyProvider>
      </ThemeProvider>
      <ToastContainer />
      <LinkedInInsightTag />
      <GoogleAnalytics trackPageViews />
      <CrispWithNoSSR />
      <Script
        id="rewardful"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
          (function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`
        }}
      />
    </>
  );
}

export default api.withTRPC(MyApp);
