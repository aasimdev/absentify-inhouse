import { inngest } from '../inngest_client';
import { reponseToGroupSync } from '~/pages/api/webhooks/graph/groups';

export const responseToGroupChanges = inngest.createFunction(
  { id: 'response/to_group_changes', name: 'response/to_group_changes', 
  rateLimit: {
    key: "event.data.id",
    limit: 1,
    period: "2m",
  }, },
  { event: 'response/to_group_changes' },
  async ({ event, step }) => {
    await step.run('send email', async () => {
      const { id, groupSyncSetting, token } = event.data;
      await reponseToGroupSync(groupSyncSetting, token);
    });
  }
);
