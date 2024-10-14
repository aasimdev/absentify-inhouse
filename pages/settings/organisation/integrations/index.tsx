import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Integrations from '@modules/settings/organisation/Integrations/Index';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Integrations></Integrations>
    </OrganisationLayout>
  );
};

export default Organisation;
