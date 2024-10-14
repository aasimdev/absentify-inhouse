import OrganisationLayout from '@modules/settings/organisation/_Layout';
import History from '@modules/settings/organisation/Integrations/Webhooks/History';
import type { NextPage } from 'next';

const HistoryPage: NextPage = () => {
  return (
    <OrganisationLayout>
      <History></History>
    </OrganisationLayout>
  );
};

export default HistoryPage;
