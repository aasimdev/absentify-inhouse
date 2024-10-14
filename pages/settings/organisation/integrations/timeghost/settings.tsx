import TimeghostSync from '@modules/settings/organisation/Integrations/timeghost/Index';
import OrganisationLayout from '@modules/settings/organisation/_Layout';

import type {NextPage} from 'next';

const Organisation: NextPage = () => {
  return (
    <OrganisationLayout>
      <TimeghostSync></TimeghostSync>
    </OrganisationLayout>
  );
};

export default Organisation;
