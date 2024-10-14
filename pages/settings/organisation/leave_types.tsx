import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Leave_Types from '@modules/settings/organisation/Leave_Types/Leave_Types';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Leave_Types></Leave_Types>
    </OrganisationLayout>
  );
};

export default Organisation;
