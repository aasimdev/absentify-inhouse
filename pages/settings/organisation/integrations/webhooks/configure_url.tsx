import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Webhooks from '@modules/settings/organisation/Integrations/Webhooks';
import type { NextPage } from 'next';

const WebhooksUrlConfigPage: NextPage = () => {
  return (
    <OrganisationLayout>
      <Webhooks></Webhooks>
    </OrganisationLayout>
  );
};

export default WebhooksUrlConfigPage;
