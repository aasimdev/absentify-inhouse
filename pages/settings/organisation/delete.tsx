import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Delete from '@modules/settings/organisation/Delete';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Delete></Delete>
    </OrganisationLayout>
  );
};

export default Organisation;
