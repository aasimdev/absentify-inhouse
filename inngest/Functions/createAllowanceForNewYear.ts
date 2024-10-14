import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';

export const createAllowanceForNewYear = inngest.createFunction(
  { id: slugify('Create Member allowance for New Year'), name: 'Create Member allowance for New Year' },
  { event: 'member_allowances/start_create_allowance_new_year' },
  async ({ step }) => {
    const batchSize = 1000;
    const totalWorkspaces = await prisma.workspace.count();
    const totalBatches = Math.ceil(totalWorkspaces / batchSize);
    const workspaceBatches = [];
    for (let i = 0; i < totalBatches; i++) {
      const workspacesBatch = await prisma.workspace.findMany({
        select: { id: true },
        skip: i * batchSize,
        take: batchSize
      });
      workspaceBatches.push(workspacesBatch);
    }

    const events = workspaceBatches.map((workspaces) => ({
      name: 'member_allowances/create_missing_allowances_for_workspace_members' as 'member_allowances/create_missing_allowances_for_workspace_members',
      data: {
        workspaces
      }
    }));

    await step.sendEvent('member_allowances/create_missing_allowances_for_workspace_members', events);
  }
);

export const createMissingAllowancesForWorkspaceMembers = inngest.createFunction(
  { id: 'Create_missing_allowances_for_workspace_members', name: 'Create missing allowances for workspace members' },
  {
    event: 'member_allowances/create_missing_allowances_for_workspace_members',
    concurrency: {
      limit: 10
    }
  },
  async ({ event, step }) => {
    const { workspaces } = event.data;

    for (let index = 0; index < workspaces.length; index++) {
      const workspace = workspaces[index];
      if (!workspace) continue;
      const members = await prisma.member.findMany({
        where: { workspace_id: workspace.id },
        select: {
          id: true
        }
      });
      if (!members || members.length === 0) return;

      const events = members.map((member) => ({
        name: 'member/update.member.allowance' as 'member/update.member.allowance',
        data: {
          workspaceId: workspace.id,
          memberId: member.id
        }
      }));
      await step.sendEvent('member/update.member.allowance', events);
    }
  }
);
