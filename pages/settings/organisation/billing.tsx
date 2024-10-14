import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Billing from '@modules/settings/organisation/Billing/Billing';
import type { NextPage } from 'next';

const BillingPage: NextPage = () => {
  return (<>
    <OrganisationLayout>
      <Billing></Billing>
    </OrganisationLayout></>
  );
};

export default BillingPage;
