import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { updateMemberAllowances, updateMemberRequestDetailsDurations } from '~/lib/updateMemberAllowances';
import { slugify } from 'inngest';

export const updateAllWorkspaceMemberAllowance = inngest.createFunction(
  { id: slugify('Update all workspace member allowance'), name: 'Update all workspace member allowance' },
  {
    event: 'workspace/update.member.allowance',
    concurrency: {
      limit: 10
    }
  },
  async ({ event, step }) => {
    const workspace_id = event.data.workspaceId;

    const members = await step.run('Fetch members', async () => {
      return prisma.member.findMany({ where: { workspace_id }, select: { id: true } });
    });

    // Send all events to Inngest, which triggers any functions listening to
    // the given event names.
    await step.sendEvent(
      'update member allowance',
      members.map((member) => {
        return {
          name: 'member/update.member.allowance',
          data: {
            workspaceId: workspace_id,
            memberId: member.id
          }
        };
      })
    );

    return { count: members.length };
  }
);

export const updateMemberAllowance = inngest.createFunction(
  {
    id: slugify('Update member allowance'),
    name: 'Update member allowance',
    concurrency: {
      limit: 50
    }
  },
  { event: 'member/update.member.allowance' },
  async ({ event, step }) => {
    const workspace_id = event.data.workspaceId;
    const member_id = event.data.memberId;

    await step.run('updateMemberAllowances', async () => {
      await updateMemberAllowances(prisma, workspace_id, member_id);
    });
    await step.run('updateMemberRequestDetailsDurations', async () => {
      await updateMemberRequestDetailsDurations(prisma, workspace_id, member_id);
    });
  }
);
