import OrganisationLayout from '@modules/settings/organisation/_Layout';
import IntegrationDetails from '@modules/settings/organisation/Integrations/details';
import type { NextPage } from 'next';

const WebhooksPage: NextPage = () => {
  return (
    <OrganisationLayout>
     <IntegrationDetails integration="webhooks"></IntegrationDetails>
    </OrganisationLayout>
  );
};

export default WebhooksPage;
