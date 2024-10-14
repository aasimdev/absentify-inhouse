import AdTeamsGroupSync from "@modules/settings/organisation/Integrations/AdTeamsGroupSync/Index";
import OrganisationLayout from '@modules/settings/organisation/_Layout';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <AdTeamsGroupSync></AdTeamsGroupSync>
    </OrganisationLayout>
  );
};

export default Organisation;