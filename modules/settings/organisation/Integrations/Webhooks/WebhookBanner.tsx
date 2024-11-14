import Link from "next/link";
import React from "react";
import { SubscriptionSummary } from '../../../../../lib/subscriptionHelper'

const WebhookBanner:React.FC<{subscription:SubscriptionSummary; t:Function}> = (props) => {
  const IntegrationPlanBanner:React.FC<{text:string; t:Function}> = (props) => {
    return ( 
      <div className="flex relative z-0 py-5 px-6 w-full items-center text-left bg-teams_brand_50 rounded-md mt-5 dark:bg-teams_dark_mode">
      <div className="w-full text-sm ">
        {props.text}
        <Link href="/settings/organisation/upgrade" className="transition-color duration-200 underline ">
          {props.t('Integrations_description_available_in_plan_2')}
        </Link>
      </div>
    </div>)
  }
  const getWebhookBanner = (subscription:SubscriptionSummary) => {
    const hasBusinessOrHigher = 
      subscription.has_business_V1_subscription || 
      subscription.business || 
      subscription.business_by_user > 0 || 
      subscription.enterprise;

    if(hasBusinessOrHigher) return null;

    const bannerText = subscription.small_team && subscription.small_team > 0
      ? props.t('Integrations_description_available_in_smallplan')
      : props.t('Integrations_description_available_in_plan');

    return <IntegrationPlanBanner text={`${bannerText} `} t={props.t} />;
  }
  return getWebhookBanner(props.subscription)
} ;

export default WebhookBanner;