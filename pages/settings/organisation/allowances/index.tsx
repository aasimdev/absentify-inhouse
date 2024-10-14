
import AllowancesPage from '@modules/settings/organisation/Allowances/Index';
import OrganisationLayout from '@modules/settings/organisation/_Layout';

import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <AllowancesPage></AllowancesPage>
    </OrganisationLayout>
  );
};

export default Organisation;
