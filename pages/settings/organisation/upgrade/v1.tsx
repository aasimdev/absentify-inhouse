import OrganisationLayout from '@modules/settings/organisation/_Layout';
import V1Upgrade from '@modules/settings/organisation/Upgrade/v1';
import type { NextPage } from 'next';
import React from 'react';

const UpgradePage: NextPage = () => {
  return (
    <OrganisationLayout>
      <V1Upgrade></V1Upgrade>
    </OrganisationLayout>
  );
};

export default UpgradePage;
