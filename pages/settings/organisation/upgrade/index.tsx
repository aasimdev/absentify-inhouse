import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Upgrade from '@modules/settings/organisation/Upgrade/Index';
import type { NextPage } from 'next';
import React from 'react';

const UpgradePage: NextPage = () => {
  return (
    <OrganisationLayout>
      <Upgrade></Upgrade>
    </OrganisationLayout>
  );
};

export default UpgradePage;
