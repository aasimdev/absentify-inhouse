import { slugify } from 'inngest';
import { inngest } from '../inngest_client';
import { prisma } from '~/server/db';
import { memberRouter } from '~/server/api/routers/member';

export const automaticArchivation = inngest.createFunction(
  {
    id: slugify('Archive automatically'),
    name: 'Archive automatically',
    cancelOn: [{ event: 'group/automatic_archivation_option', match: 'data.group_id' }]
  },
  { event: 'group/automatic_archivation_option' },
  async ({ event, step }) => {
    const { notInGroupMembersFilter, workspace, syncedDepIds } = event.data;
    await step.sleep('sleep-for-10-mins', '10min');
    await step.run('after 10 mins check if you need to automaticaly archive', async () => {
        const withoutOtherDeps = notInGroupMembersFilter.filter(
          (depMem) => depMem.departments.filter((dep) => !syncedDepIds.includes(dep.department.id)).length === 0
        );
        if(withoutOtherDeps.length > 0) {
          const admin = await prisma.member.findFirst({ where: { workspace_id: workspace.id, is_admin: true } });
          for (const member of withoutOtherDeps) {
            try {
              const caller = memberRouter.createCaller({
                prisma: prisma,
                session: {
                  user: admin as any
                },
                current_member: admin,
                req: null
              });
  
              await caller.archive({
                id: member.id,
                data: {
                  status: 'ARCHIVED',
                  workspace_id: member.workspace_id,
                  employment_end_date: member.employment_end_date ? new Date(member.employment_end_date) : new Date(),
                  automatic_change: true,
                }
              });
              await inngest.send({
                name: 'email/automatic_member_archivation',
                data: {
                  archived_member_id: member.id,
                  workspace_id: workspace.id,
                }
              });
            } catch (error) {
              console.log(error);
              continue;
            }
          }
        }
      
      const notInGroupMembers = notInGroupMembersFilter.filter(
        (depMem) => depMem.departments.filter((dep) => !syncedDepIds.includes(dep.department.id)).length > 0
      );
      if(notInGroupMembers.length > 0) {
        const membersDepToDelete = await prisma.memberDepartment.findMany({
          where: {
            member_id: { in: notInGroupMembers.map((mem) => mem.id) },
            manager_type: 'Member',
            department_id: { in: syncedDepIds }
          },
          select: {
            member_id: true
          }
        });
  
        await prisma.memberDepartment.deleteMany({
          where: {
            member_id: { in: membersDepToDelete.map((mem) => mem.member_id) },
            department_id: { in: syncedDepIds }
          }
        });
      }
    });
  }
);
