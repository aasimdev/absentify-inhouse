import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';

export const defaultDepartmentAllowancesScript = inngest.createFunction(
  {
    id: slugify('Give old departments default allowances'),
    name: 'Give old departments default allowances',
    concurrency: {
      limit: 10
    }
  },
  { event: 'script/default_department_allowances' },
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
      name: 'script/prepare_workspaces' as 'script/prepare_workspaces',
      data: {
        workspaces
      }
    }));

    await step.sendEvent('script/prepare_workspaces', events);
  }
);

export const prepareDepartmentsAllowances = inngest.createFunction(
  {
    id: slugify('Prepare workspaces for Department Allowances'),
    name: 'Prepare workspaces for Department Allowances',
    concurrency: {
      limit: 10
    }
  },
  { event: 'script/prepare_workspaces' },
  async ({ event, step }) => {
    const { workspaces } = event.data;

    const events = workspaces.map((workspace) => ({
      name: 'script/create_default_department_allowances' as 'script/create_default_department_allowances',
      data: {
        workspace
      }
    }));

    await step.sendEvent('script/create_default_department_allowances', events);
  });

export const createDefaultDepartmentAllowances = inngest.createFunction(
  {
    id: slugify('Create default department allowances'),
    name: 'Create default department allowances',
    concurrency: {
      limit: 10
    }
  },
  { event: 'script/create_default_department_allowances' },
  async ({ event }) => {
    const { workspace } = event.data;

    const departments = await prisma.department.findMany({
      where: { workspace_id: workspace.id },
      select: { id: true, default_department_allowances: true }
    });
    const allowances = await prisma.allowanceType.findMany({ where: { workspace_id: workspace.id } });
    const mapedAllowances = allowances.map((allowance) => ({
      id: allowance.id,
      value: allowance.allowance_unit === 'days' ? 20 : 1200
    }));
    const updates = [];
    for (const department of departments) {
      if (
        !department.default_department_allowances ||
        (typeof department.default_department_allowances === 'string' &&
          department.default_department_allowances.trim() === '')
      ) {
        updates.push(
          prisma.department.update({
            where: { id: department.id },
            data: { default_department_allowances: JSON.stringify(mapedAllowances) }
          })
        );
      }
    }
    await prisma.$transaction(updates);
  }
);
