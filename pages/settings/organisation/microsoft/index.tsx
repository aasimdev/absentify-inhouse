import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Microsoft from '@modules/settings/organisation/Microsoft/Index';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Microsoft></Microsoft>
    </OrganisationLayout>
  );
};

export default Organisation;
