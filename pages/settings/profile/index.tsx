import ProfileLayout from '@modules/settings/profile/_Layout';
import General from '@modules/settings/profile/General';
import type { NextPage } from 'next';

const Profile: NextPage = () => {
  return (
    <ProfileLayout>
      <General></General>
    </ProfileLayout>
  );
};

export default Profile;
