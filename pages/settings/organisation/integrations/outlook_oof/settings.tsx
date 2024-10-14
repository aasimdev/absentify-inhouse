import OrganisationLayout from '@modules/settings/organisation/_Layout';
import OutlookOof from "@modules/settings/organisation/Integrations/OutlookOof/Index";
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <OutlookOof></OutlookOof>
    </OrganisationLayout>
  );
};

export default Organisation;
