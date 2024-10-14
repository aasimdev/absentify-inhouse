import ProfileLayout from '@modules/settings/profile/_Layout';
import AutomaticReplies from '@modules/settings/profile/AutomaticReplies';
import type { NextPage } from 'next';

const Organisation: NextPage = () => {
  return (
    <ProfileLayout>
      <AutomaticReplies></AutomaticReplies>
    </ProfileLayout>
  );
};

export default Organisation;
