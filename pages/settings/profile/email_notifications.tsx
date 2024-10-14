import ProfileLayout from '@modules/settings/profile/_Layout';
import Email_notifications from '@modules/settings/profile/Notifications';
import type { NextPage } from 'next';

const Email_notificationsPage: NextPage = () => {
  return (
    <ProfileLayout>
      <Email_notifications></Email_notifications>
    </ProfileLayout>
  );
};

export default Email_notificationsPage;
