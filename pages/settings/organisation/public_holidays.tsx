import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Public_Holidays from '@modules/settings/organisation/Public_Holidays/Public_Holidays';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <Public_Holidays></Public_Holidays>
    </OrganisationLayout>
  );
};

export default Organisation;
