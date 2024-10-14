import OrganisationLayout from '@modules/settings/organisation/_Layout';
import IntegrationDetails from '@modules/settings/organisation/Integrations/details';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <IntegrationDetails integration="calendar_sync"></IntegrationDetails>
    </OrganisationLayout>
  );
};

export default Organisation;
