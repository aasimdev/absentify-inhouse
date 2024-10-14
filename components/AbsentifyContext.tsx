import * as Sentry from '@sentry/browser';
import de from 'date-fns/locale/de';
import es from 'date-fns/locale/es';
import fr from 'date-fns/locale/fr';
import hu from 'date-fns/locale/hu';
import it from 'date-fns/locale/it';
import pl from 'date-fns/locale/pl';
import uk from 'date-fns/locale/uk';
import ru from 'date-fns/locale/ru';
import pt from 'date-fns/locale/pt';
import tr from 'date-fns/locale/tr';

import { useRouter } from 'next/router';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { registerLocale } from 'react-datepicker';
import { api, type RouterOutputs } from '~/utils/api';
import { SubscriptionSummary, summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { Paddle, initializePaddle } from '@paddle/paddle-js';
import { lintrk } from 'nextjs-linkedin-insight-tag';
import { event } from 'nextjs-google-analytics';
import { Crisp } from 'crisp-sdk-web';
registerLocale('es', es);
registerLocale('de', de);
registerLocale('fr', fr);
registerLocale('it', it);
registerLocale('hu', hu);
registerLocale('pl', pl);
registerLocale('uk', uk);
registerLocale('ru', ru);
registerLocale('pt', pt);
registerLocale('tr', tr);

type absentifyContextType = {
  in_teams: boolean;
  in_sharePoint: boolean;
  theme: 'light' | 'dark';
  current_member: RouterOutputs['member']['current'] | null;
  teamsMobile: boolean;
  teamsChatIsSupported: boolean;
  ssoLoading: boolean;
  subscription: SubscriptionSummary;
  paddleInstance: Paddle | null;
  pageTitle: string;
  impersonate: boolean;
  setPageTitle: (title: string) => void;
  setTimelineScrollPos: (p:number) => void,
  timelineScrollPos: number
};
const absentifyContextDefaultValues: absentifyContextType = {
  in_teams: false,
  in_sharePoint: false,
  theme: 'light',
  current_member: null,
  teamsMobile: false,
  teamsChatIsSupported: false,
  ssoLoading: false,
  paddleInstance: null,
  pageTitle: 'absentify',
  impersonate: false,
  setPageTitle: () => {},
  subscription: {
    subscription_id: '',
    provider: null,
    has_valid_subscription: false,
    status: null,
    cancellation_effective_date: null,
    billing_cycle_interval: 'month',
    small_team: 0,
    business: false,
    business_by_user: 0,
    enterprise: 0,
    addons: {
      webhooks: 0,
      multi_manager: false,
      allowance_types: 0,
      calendar_sync: 0,
      departments: 0,
      unlimited_departments: false
    }
  },
  setTimelineScrollPos: () => {},
  timelineScrollPos: 0
};

const AuthContext = createContext<absentifyContextType>(absentifyContextDefaultValues);

export function useAbsentify() {
  return useContext(AuthContext);
}

type Props = {
  children: ReactNode;
};

export function AbsentifyProvider({ children }: Props) {
  const router = useRouter();
  const [teamsChatIsSupported, setTeamsChatIsSupported] = useState(false);
  const [paddleInstance, setPaddleInstance] = useState<Paddle | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [teamsMobile, setTeamsMobile] = useState<boolean>(false);
  const [timelineScrollPos, setTimelineScrollPos] = useState(absentifyContextDefaultValues.timelineScrollPos);
  let in_teams = false;
  let in_sharePoint = false;
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    in_teams = host.includes('teams.absentify.com');
    in_sharePoint = host.includes('sharepoint.absentify.com');
  }

  const { data: session, isSuccess: session_isSuccess } = api.user.session.useQuery(undefined, {
    staleTime: 6000
  });
  const { data: workspace, refetch: refetchWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000,
    enabled: !!session?.member_id
  });
  const [subscription, setSubscription] = useState<SubscriptionSummary>(absentifyContextDefaultValues.subscription);
  const [ssoLoading, setSsoLoading] = useState(false);
  useEffect(() => {
    if (!workspace) return;
    setSubscription(summarizeSubscriptions(workspace.subscriptions));
    if (window && window.$crisp) window.$crisp.push(['set', 'user:company', [workspace.name]]);
  }, [workspace]);
  const { data: current_member } = api.member.current.useQuery(undefined, {
    enabled: !!session?.member_id,
    staleTime: 60000
  });
  const [pageTitle, setPageTitle] = useState(absentifyContextDefaultValues.pageTitle);

  const value = {
    in_teams,
    in_sharePoint,
    theme,
    teamsMobile,
    current_member: current_member ?? null,
    subscription: subscription,
    teamsChatIsSupported,
    ssoLoading: ssoLoading,
    paddleInstance: paddleInstance,
    pageTitle,
    setPageTitle,
    impersonate: session?.impersonate ?? false,
    setTimelineScrollPos,
    timelineScrollPos
  };

  const onClient = typeof window !== 'undefined';
  const checkSSOLogin = async () => {
    if (!onClient) return;
    setSsoLoading(true);
    console.log('run Teams SSO');
    try {
      const { authentication, app } = await import('@microsoft/teams-js');

      console.log('js loaded');
      await app.initialize();
      console.log('app.initialize()');
      console.log('authentication.getAuthToken()');
      const ssoToken = await authentication.getAuthToken();
      if (ssoToken) {
        location.href = location.origin + '/api/auth/signin?ssotoken=' + ssoToken;
      } else {
        console.log('Teams SSO failed, no token');
        Sentry.captureException('Teams SSO failed, no token');
        setSsoLoading(false);
        return;
      }
    } catch (e) {
      setSsoLoading(false);
      console.log('2 Teams SSO failes', JSON.stringify(e));
      Sentry.captureException(e);
    }
  };

  useEffect(() => {
    if (!session_isSuccess) return;

    if (!session) {
      if (router.route == '/teams/auth-start' || router.route == '/teams/auth-end') return;
      if (in_teams && router.query.nosso == null) {
        // check SSO
        console.log('check SSO');
        checkSSOLogin();
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_isSuccess]);
  useEffect(() => {
    if (!current_member) return;
    if (!workspace) return;

    if (!paddleInstance) {
      const x = workspace.subscriptions.find(
        (x) => x.provider == 'paddle' || (x.provider == 'paddle_v2' && x.customer_user_id)
      )?.customer_user_id;

      let pwCustomer: { email?: string; id?: string } = {};

      if (x != null && x != undefined && x != '') {
        pwCustomer = { id: x };
      } else if (current_member.email != null && current_member.email != undefined && current_member.email != '') {
        pwCustomer = { email: current_member.email };
      }

      initializePaddle({
        environment: process.env.NEXT_PUBLIC_PADDLE_SANDBOX == 'true' ? 'sandbox' : 'production',
        token:
          process.env.NEXT_PUBLIC_RUNMODE == 'Development' || process.env.NEXT_PUBLIC_RUNMODE == 'Preview'
            ? 'test_204935de83cb2c699e2e9896650'
            : 'live_4f8a9e1cfdfecafdf549c4acbb9',
        pwAuth: 'a11a7cb143dfe8ae0404793a457d03c4',
        pwCustomer: pwCustomer,
        eventCallback: async (data) => {
          if (data.name === 'checkout.completed') {
            let eventData = data.data;
            if (!eventData) return;

            if (typeof window.lintrk === 'function') lintrk('track', { conversion_id: 11795434 });
            event('purchase', {
              transaction_id: eventData.transaction_id,
              value: eventData.totals.total,
              tax: eventData.totals.tax,
              shipping: 0,
              currency: eventData.currency_code,
              coupon: eventData.discount?.code,
              items: eventData.items?.map((x, y) => {
                return {
                  item_id: x.product.id,
                  item_name: x.product.name,
                  index: y,
                  price: x.recurring_totals?.total,
                  quantity: x.quantity
                };
              })
            });

            await waitForChange();
          }
        }
      })
        .then((paddleInstance: Paddle | undefined) => {
          if (paddleInstance) {
            setPaddleInstance(paddleInstance);
          }
        })
        .catch((err) => console.log(err));
    }
    try {
      if (current_member.email) Crisp.user.setEmail(current_member.email);
      if (current_member.name) Crisp.user.setNickname(current_member.name);
      Crisp.user.setAvatar(
        `https://data.absentify.com/profile-pictures/${current_member.microsoft_user_id}_64x64.jpeg`
      );

      const subscription = summarizeSubscriptions(workspace.subscriptions);

      Crisp.session.setData({
        member_id: current_member.id + '',
        microsoft_user_id: current_member.microsoft_user_id + '',
        workspace_id: workspace.id + '',
        in_teams: in_teams + '',
        in_sharePoint: in_sharePoint + '',
        subscription_status: subscription.status + '',
        subscription_provider: subscription.provider + '',
        subscription_business: subscription.business + '',
        business_by_user: subscription.business_by_user + '',
        subscription_small_team: subscription.small_team + '',
        subscription_enterprise: subscription.enterprise + '',
        subscription_calendar_sync: subscription.addons.calendar_sync + '',
        subscription_departments: subscription.addons.departments + '',
        subscription_multi_manager: subscription.addons.multi_manager + '',
        subscription_allowance_types: subscription.addons.allowance_types + '',
        subscription_unlimited_departments: subscription.addons.unlimited_departments + '',
        subscription_billing_cycle_interval: subscription.billing_cycle_interval + '',
        subscription_cancellation_effective_date: subscription.cancellation_effective_date + ''
      });
    } catch (e) {
      console.log('crisp', e);
    }

    if (localStorage.getItem('redirect_after_login')) {
      const redirectTo = localStorage.getItem('redirect_after_login') as string;
      localStorage.removeItem('redirect_after_login');
      location.href = redirectTo;
      return;
    }
  }, [current_member, workspace]);

  let oldSubscription = '';
  const waitForChange = async () => {
    if (oldSubscription == '') oldSubscription = JSON.stringify(subscription);
    let s = await refetchWorkspace();

    if (s.data && JSON.stringify(summarizeSubscriptions(s.data.subscriptions)) != oldSubscription) {
      location.href = location.origin + '/settings/organisation/upgrade/created';
    } else {
      setTimeout(waitForChange, 1000);
    }
  };
  const init = async () => {
    if (!router.isReady) return;
    if (router.route == '/signup') return;
    /*    if (session === null) {
      localStorage.removeItem('redirectData');
      if (router.pathname == '/microsoft/ms-teams/tab/config')
        localStorage.setItem('microsoft-ms-teams-tab-config', '1');

      return;
    } */

    if (session) {
      Sentry.setUser({
        email: `${session.email}`,
        id: session.id,
        username: `${session.name}`
      });
    }
  };

  useEffect(() => {
    if (!in_teams) return;
    getTheme();
    getTeamsMobile();
    getSubPageId();
    getChatTeamsChatIsSupported();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTheme = async () => {
    if (!onClient) return;
    const { app } = await import('@microsoft/teams-js');
    await app.initialize();
    const context = await app.getContext();
    setTheme(context.app.theme == 'dark' ? 'dark' : 'light');
  };

  const getSubPageId = async () => {
    if (!onClient) return;
    const { app } = await import('@microsoft/teams-js');
    await app.initialize();
    const context = await app.getContext();

    if (context.page.subPageId) {
      const buffer = Buffer.from(context.page.subPageId, 'base64');
      const jsonString = buffer.toString('utf8');
      const jsonData = JSON.parse(jsonString);

      if (!jsonData) return;
      if (!jsonData.member_id) return;
      if (!jsonData.request_id) return;
      setTimeout(() => {
        router.push(`calendar/${jsonData.member_id}?request_id=${jsonData.request_id}`);
      }, 1000);
    }
  };

  const getTeamsMobile = async () => {
    if (in_teams && window.innerWidth < 768) {
      setTeamsMobile(true);
    }
  };
  const getChatTeamsChatIsSupported = async () => {
    if (!onClient) return;
    if (teamsChatIsSupported) return;
    const { app, chat } = await import('@microsoft/teams-js');
    await app.initialize();
    setTeamsChatIsSupported(chat.isSupported());
  };

  return (
    <>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </>
  );
}