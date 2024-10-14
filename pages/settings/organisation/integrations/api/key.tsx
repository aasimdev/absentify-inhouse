import OrganisationLayout from '@modules/settings/organisation/_Layout';
import GenerateKey from '@modules/settings/organisation/Integrations/api/GenerateKey';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <GenerateKey></GenerateKey>
    </OrganisationLayout>
  );
};

export default Organisation;
