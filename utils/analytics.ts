import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsightsInstance: ApplicationInsights;

export const getAppInsights = () => {
  if (
    !process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY ||
    !process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTIONSTRING
  ) {
    console.log('App Insights instrumentation key or connection string not found');
    return;
  }

  if (!appInsightsInstance) {
    appInsightsInstance = new ApplicationInsights({
      config: {
        connectionString: process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTIONSTRING,
        instrumentationKey:
          process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY,
      },
    });
    appInsightsInstance.loadAppInsights();
  }
  return appInsightsInstance;
};