import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Departments from '@modules/settings/organisation/Departments/Departments';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Departments></Departments>
    </OrganisationLayout>
  );
};

export default Organisation;
