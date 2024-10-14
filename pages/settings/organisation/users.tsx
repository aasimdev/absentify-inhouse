import OrganisationLayout from '@modules/settings/organisation/_Layout';
import Users from '@modules/settings/organisation/Users/Users';
import type { NextPage } from 'next';
import useTranslation from 'next-translate/useTranslation';

const UsersPage: NextPage = () => {
  const { t } = useTranslation('users');
  return (
    <OrganisationLayout>
      <Users></Users>
    </OrganisationLayout>
  );
};

export default UsersPage;
