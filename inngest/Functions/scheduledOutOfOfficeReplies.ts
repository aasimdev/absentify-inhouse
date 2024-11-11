import { OutOfOfficeMessageStatus } from '@prisma/client';
import { prisma } from '~/server/db';

import {
  out_of_office_reply_select,
  removeOutOfOfficeMessageInUsersProfile,
  setOutOfOfficeMessageInUsersProfile
} from '../../lib/setOutOfOfficeMessageInUsersProfile';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';

export const scheduledOutOfOfficeReplies = inngest.createFunction(
  {
    id: slugify('Scheduled Out Of Office Replies'),
    name: 'Scheduled Out Of Office Replies'
  },
  { cron: '*/5 * * * *' },
  async ({}) => {
    if (process.env.NEXT_PUBLIC_RUNMODE == 'Development') {
      return { status: 'success', message: 'Scheduled Out Of Office Replies for 0 members sent' };
    }
    const today = new Date();
    today.setDate(today.getDate());
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dates = await prisma.request.findMany({
      select: out_of_office_reply_select,
      where: {
        start: { gte: today, lt: tomorrow },
        OR: [
          {
            out_of_office_message_status: OutOfOfficeMessageStatus.MustBeConfigured
          },
          {
            out_of_office_message_status: OutOfOfficeMessageStatus.MustBeRemoved
          }
        ]
      }
    });
    const datesToSet = dates.filter(
      (d) => d.out_of_office_message_status === OutOfOfficeMessageStatus.MustBeConfigured
    );
    if (datesToSet.length > 0) {
      await setOutOfOfficeMessageInUsersProfile(datesToSet);
    }
    const datesToRemove = dates.filter(
      (d) => d.out_of_office_message_status === OutOfOfficeMessageStatus.MustBeRemoved
    );
    if (datesToRemove.length > 0) {
      await removeOutOfOfficeMessageInUsersProfile(datesToRemove);
    }
  }
);
