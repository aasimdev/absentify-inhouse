import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Export from '@modules/settings/organisation/Export';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Export></Export>
    </OrganisationLayout>
  );
};

export default Organisation;
