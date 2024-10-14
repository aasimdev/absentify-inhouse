import OrganisationLayout from '@modules/settings/organisation/_Layout';
import General from '@modules/settings/organisation/General';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <General></General>
    </OrganisationLayout>
  );
};

export default Organisation;
