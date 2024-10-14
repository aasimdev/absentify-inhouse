import OrganisationLayout from '@modules/settings/organisation/_Layout';
import CalendarSync from '@modules/settings/organisation/Integrations/CalendarSync/Index';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <CalendarSync></CalendarSync>
    </OrganisationLayout>
  );
};

export default Organisation;
