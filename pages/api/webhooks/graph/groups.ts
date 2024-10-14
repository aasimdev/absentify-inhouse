// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
//import * as Sentry from '@sentry/nextjs';
import { Status } from '@prisma/client';
import { getMicrosoftGroupsAccessToken } from '~/lib/getMicrosoftAccessToken';
import axios from 'axios';
import { prisma } from '~/server/db';
import { addDays, addYears } from 'date-fns';
import { inngest } from '~/inngest/inngest_client';
import { defaultMemberSelect, memberRouter } from '~/server/api/routers/member';
import { defaultWorkspaceSelect } from '~/server/api/routers/workspace';
import { defaultDepartmentSelect, departmentRouter } from '~/server/api/routers/department';
import { updateSmiirl } from '~/helper/smiirl';
import * as Sentry from '@sentry/nextjs';

interface Data {
  changeType: string;
  clientState: string;
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    id: string;
    organizationId: string;
    'members@delta':
      | {
          id: string;
          '@removed': string | undefined;
        }[]
      | undefined;
    'owner@delta':
      | {
          id: string;
          '@removed': string | undefined;
        }[]
      | undefined;
  };
  subscriptionExpirationDateTime: Date;
  subscriptionId: string;
  tenantId: string;
}
export interface MicrosoftMemberOptionalMail {
  '@odata.type': string;
  id: string;
  displayName: string;
  givenName: string;
  mail: string | null;
  preferredLanguage: string;
  surname: string;
  userPrincipalName: string;
  accountEnabled: boolean;
}

export interface MicrosoftMember {
  '@odata.type': string;
  id: string;
  displayName: string;
  givenName: string;
  mail: string;
  preferredLanguage: string;
  surname: string;
  userPrincipalName: string;
  accountEnabled: boolean;
}

interface GraphApiResponse {
  data: {
    value: MicrosoftMemberOptionalMail[];
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let validationToken = req.query['validationToken'];

  // If a validation token is present, we need to respond within 5 seconds by
  // returning the given validation token. This only happens when a new
  // webhook is being added
  if (validationToken) {
    res.status(200).send(validationToken);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webHookData: Data[] = req.body.value;
  if (!webHookData || !webHookData[0] || webHookData.length === 0) {
    res.status(200).json({ message: 'Notification received without expected data' });
    return;
  }

  try {
    let token = null;
    for (let i = 0; i < webHookData.length; i++) {
      const data = webHookData[i];
      if (!data) continue;
      try {
        const microsoft_tenant_id = data.tenantId;
        const group_id = data.resourceData.id;
        const members = data.resourceData['members@delta'];
        const owners = data.resourceData['owner@delta'];

        if ((!owners || owners.length === 0) && (!members || members.length === 0)) {
          console.log('No member changes found');
          continue;
        }
        const id = JSON.stringify({
          owners,
          members
        });

        if (!token || (webHookData[i - 1]?.tenantId && microsoft_tenant_id !== webHookData[i - 1]?.tenantId)) {
          token = await getMicrosoftGroupsAccessToken(microsoft_tenant_id);
        }
        const groupSyncSetting = await prisma.groupSyncSetting.findUnique({ where: { group_id } });

        if (!groupSyncSetting) {
          console.log('No group setting found');
          continue;
        }

        await inngest.send({
          name: 'response/to_group_changes',
          data: {
            id,
            groupSyncSetting,
            token
          }
        });
      } catch (e) {
        console.error(e);
        Sentry.captureException(e);
        continue;
      }
    }

    res.status(200).json({ ok: 'ok' });
  } catch (error: any) {
    console.log(error.message);
    Sentry.captureException(error);
    res.status(400).json(error.message);
  }
}

type GroupSyncSetting = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string;
  group_id: string;
  automatic_account_create_option: boolean;
  manager_change_option: boolean;
  remove_from_department_option: boolean;
  workspace_id: string;
};

export const reponseToGroupSync = async (groupSyncSetting: GroupSyncSetting, token: string) => {
  try {
    const syncedDeps = await prisma.departmentGroupSyncSetting.findMany({
      where: {
        group_sync_setting_id: groupSyncSetting.id
      },
      select: {
        department: {
          select: defaultDepartmentSelect
        }
      }
    });
    const syncedDepartments = syncedDeps.map((dep) => ({ ...dep.department }));
    const syncedDepIds = syncedDepartments.map((dep) => dep.id);
    if (!syncedDepartments || !syncedDepartments[0] || syncedDepartments.length === 0) {
      console.log('department no found');
      return null;
    }

    const {
      data: { value: groupMembers }
    }: GraphApiResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/groups/${groupSyncSetting.group_id}/members?$select=id,displayName,givenName,mail,preferredLanguage,surname,userPrincipalName,accountEnabled`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    const {
      data: { value: owners }
    }: GraphApiResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/groups/${groupSyncSetting.group_id}/owners?$select=id,displayName,givenName,mail,preferredLanguage,surname,userPrincipalName,accountEnabled`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    const notUniqueMembers = [...owners, ...groupMembers];

    const members: MicrosoftMember[] = [];
    const seenMails = new Set();
    notUniqueMembers.forEach((member) => {
      if (!member.mail) {
        member.mail = member.userPrincipalName;
      }
    });
    for (const member of notUniqueMembers as MicrosoftMember[]) {
      if (!seenMails.has(member.mail)) {
        members.push(member);
        seenMails.add(member.mail);
      }
    }
    if (!members || members.length === 0) {
      console.log('No members or owners found in group');
      return null;
    }
    const memberIds = members.map((mem) => mem.id).filter(id => !!id);
    const memberMails = members.map((mem) => mem.mail.toLowerCase()).filter(mail => mail && mail.trim().length > 0);
    const workspace = await prisma.workspace.findFirst({
      where: { departments: { some: { id: syncedDepartments[0].id } } },
      select: defaultWorkspaceSelect
    });
    if (!workspace) {
      console.log('workspace no found');
      return null;
    }
    const workspaceMembers = await prisma.member.findMany({
      where: { workspace_id: syncedDepartments[0].workspace_id },
      select: {
        id: true,
        microsoft_user_id: true,
        email: true,
        status: true,
        departments: {
          select: {
            department_id: true
          }
        }
      }
    });
    let createdOwners: {
      id: string;
    }[] = [];
    let existedOwnersAndNotManagers: {
      id: string;
    }[] = [];
    const membersAlreadyExistInAbsentify = await prisma.member.findMany({where: {
      OR: [
        { email: { in: memberMails } },
        { microsoft_user_id: { in: memberIds } },
      ],
    },
    select: {
      id: true,
      microsoft_user_id: true,
      email: true,
      status: true,
      departments: {
        select: {
          department_id: true
        }
      }
    }
  });
  const existingMembersIds = membersAlreadyExistInAbsentify.filter(mem => !!mem.microsoft_user_id).map(mem => mem.microsoft_user_id);
  const existingMembersMails = membersAlreadyExistInAbsentify.filter(mem => !!mem.email).map(mem => mem.email?.toLowerCase());
    const filterMembers = members.filter(
      (member) =>
        !existingMembersIds.includes(member.id) && !existingMembersMails.includes(member.mail.toLowerCase())
    );
    const newlyAddedButArchivedMembers = workspaceMembers.filter((member) => {
      return (
        ((member.microsoft_user_id && memberIds.includes(member.microsoft_user_id)) ||
          (member.email && memberMails.includes(member.email?.toLowerCase()))) &&
        member.status === 'ARCHIVED'
      );
    });
    if (newlyAddedButArchivedMembers.length > 0 && groupSyncSetting.automatic_account_create_option) {
      const admin = await prisma.member.findFirst({ where: { workspace_id: workspace.id, is_admin: true } });
      const caller = memberRouter.createCaller({
        prisma: prisma,
        session: {
          user: admin as any
        },
        current_member: admin,
        req: null
      });
      for (const member of newlyAddedButArchivedMembers) {
        try {
          await caller.edit({
            id: member.id,
            data: {
              status: 'ACTIVE'
            }
          });
        } catch (error) {
          console.log(error);
          Sentry.captureException(error);
          continue;
        }
      }
    }

    const depMembers = await prisma.member.findMany({
      where: { departments: { some: { department_id: { in: syncedDepIds } } } },
      select: defaultMemberSelect
    });
    const notInGroupMembersFilter = depMembers.filter(
      (member) => member.email && !memberMails.includes(member.email)
    );

    if (notInGroupMembersFilter.length > 0 && groupSyncSetting.remove_from_department_option) {
      await inngest.send({
        name: 'group/automatic_archivation_option',
        data: {
          group_id: groupSyncSetting.group_id,
          notInGroupMembersFilter,
          workspace,
          syncedDepIds
        }
      });
    }

    const ownerIds = owners.map((owner) => owner.id);
    owners.forEach((member) => {
      if (!member.mail) {
        member.mail = member.userPrincipalName;
      }
    });
    const ownerMails = (owners as MicrosoftMember[]).map((owner) => owner.mail.toLowerCase());
    if (groupSyncSetting.manager_change_option) {
      existedOwnersAndNotManagers = workspaceMembers.filter((workspaceMember) => {
        if (
          (workspaceMember.microsoft_user_id && !ownerIds.includes(workspaceMember.microsoft_user_id)) ||
          (workspaceMember.email && !ownerMails.includes(workspaceMember.email.toLowerCase()))
        )
          return false;
        const depsIds = workspaceMember.departments.map((dep) => dep.department_id);
        const missingManager = syncedDepartments.filter(
          (dep) =>
            !depsIds.includes(dep.id) ||
            !dep.members.find((mem) => mem.member_id === workspaceMember.id && mem.manager_type === 'Manager')
        );
        return missingManager.length > 0;
      });
    }

    const existedMembersWithoutNewDeps = workspaceMembers.filter((member) => {
      if (
        (member.microsoft_user_id && !memberIds.includes(member.microsoft_user_id)) ||
        (member.email && !memberMails.includes(member.email.toLowerCase()))
      )
        return false;
      const depsIds = member.departments.map((dep) => dep.department_id);
      const missingDeps = syncedDepIds.filter((depId) => !depsIds.includes(depId));
      return missingDeps.length > 0;
    });

    if (existedMembersWithoutNewDeps.length > 0) {
      const dataDeps = existedMembersWithoutNewDeps.flatMap((mem) => {
        const depsIds = mem.departments.map((dep) => dep.department_id);
        const missingDeps = syncedDepIds.filter((depId) => !depsIds.includes(depId));
        return missingDeps.map((depId) => ({
          department_id: depId,
          member_id: mem.id,
          workspace_id: workspace.id
        }));
      });
      await createDeps(dataDeps, syncedDepIds, existedMembersWithoutNewDeps, workspace.id);
    }

    if (filterMembers.length > 0 && groupSyncSetting.automatic_account_create_option) {
      const filteredMemsMails = filterMembers.map((mem) => mem.mail.toLowerCase());

      const [allowanceType, publicHoliday] = await prisma.$transaction([
        prisma.allowanceType.findMany({
          where: { workspace_id: workspace?.id },
          select: { id: true, max_carry_forward: true, allowance_unit: true }
        }),
        prisma.publicHoliday.findFirst({
          where: { workspace_id: workspace?.id }
        })
      ]);

      if (publicHoliday && allowanceType.length > 0) {
        const data = filterMembers.map((member) => ({
          public_holiday_id: publicHoliday.id,
          workspace_id: workspace.id,
          employment_start_date: new Date(),
          is_admin: false,
          name: member.displayName,
          email: member.mail ? member.mail.toLowerCase() : null,
          approver_config_department_id: syncedDepartments[0]!.id,
          custom_id: null,
          status: Status.INACTIVE,
          timezone: workspace.global_timezone,
          language: workspace.global_language,
          date_format: workspace.global_date_format,
          time_format: workspace.global_time_format,
          week_start: workspace.global_week_start
        }));

        await prisma.member.createMany({ data });

        await updateSmiirl(prisma); 

        const createdMembers = await prisma.member.findMany({ where: { email: { in: filteredMemsMails } } });

        const [a1, a2] = await prisma.$transaction([
          prisma.memberAllowance.findFirst({
            where: {
              workspace_id: workspace.id
            },
            orderBy: {
              year: 'asc'
            },
            select: {
              year: true
            }
          }),
          prisma.memberAllowance.findFirst({
            where: {
              workspace_id: workspace.id
            },
            orderBy: {
              year: 'desc'
            },
            select: {
              year: true
            }
          })
        ]);

        const defaultAllowances =
          typeof syncedDepartments[0].default_department_allowances === 'string'
            ? JSON.parse(syncedDepartments[0].default_department_allowances)
            : null;
        const oldestYear = a1 ? a1.year : new Date().getFullYear();
        const newestYear = a2 ? a2.year : new Date().getFullYear();
        const createAllowances = [];
        let currentYear = new Date().getFullYear();
        for (const member of createdMembers) {
          for (let i222 = 0; i222 < allowanceType.length; i222++) {
            const allowance_type = allowanceType[i222];
            if (!allowance_type) continue;
            let annual_allowance_current_year = allowance_type.allowance_unit === 'days' ? 20 : 1200;
            let annual_allowance_next_year = allowance_type.allowance_unit === 'days' ? 20 : 1200;
            if (Array.isArray(defaultAllowances) && defaultAllowances.length > 0) {
              const allowance: { id: string; value: number } | undefined = defaultAllowances.find(
                (allowance) => allowance?.id === allowance_type.id
              );
              if (allowance) {
                annual_allowance_current_year = allowance.value;
                annual_allowance_next_year = allowance.value;
              }
            }
            const carryForward =
              allowance_type.max_carry_forward < annual_allowance_current_year
                ? allowance_type.max_carry_forward
                : annual_allowance_current_year;
            for (let i2 = oldestYear; i2 <= newestYear; i2++) {
              if (i2 === currentYear + 1) {
                createAllowances.push({
                  allowance: annual_allowance_next_year,
                  year: i2,
                  member_id: member.id,
                  brought_forward: annual_allowance_current_year,
                  compensatory_time_off: 0,
                  remaining: annual_allowance_next_year + carryForward,
                  taken: 0,
                  workspace_id: workspace.id,
                  start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
                  end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1),
                  allowance_type_id: allowance_type.id
                });
              } else {
                if (i2 === currentYear) {
                  createAllowances.push({
                    allowance: annual_allowance_current_year,
                    year: i2,
                    member_id: member.id,
                    brought_forward: 0,
                    compensatory_time_off: 0,
                    remaining: annual_allowance_current_year,
                    taken: 0,
                    workspace_id: workspace.id,
                    allowance_type_id: allowance_type.id,
                    start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
                    end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1)
                  });
                } else {
                  createAllowances.push({
                    allowance: 0,
                    year: i2,
                    member_id: member.id,
                    brought_forward: 0,
                    compensatory_time_off: 0,
                    remaining: 0,
                    taken: 0,
                    workspace_id: workspace.id,
                    allowance_type_id: allowance_type.id,
                    start: new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)),
                    end: addDays(addYears(new Date(Date.UTC(i2, workspace.fiscal_year_start_month, 1)), 1), -1)
                  });
                }
              }
            }
          }
        }

        await prisma.memberAllowance.createMany({ data: createAllowances });
        const dataDeps = createdMembers.flatMap((mem) => {
          return syncedDepartments.map((dep) => ({
            department_id: dep.id,
            member_id: mem.id,
            workspace_id: workspace.id
          }));
        });

        const memberAllowanceTypeConfigurtaions: {
          member_id: string;
          workspace_id: string;
          allowance_type_id: string;
          default: boolean;
          disabled: boolean;
        }[] = [];
        for (let index = 0; index < createAllowances.length; index++) {
          const allowanceType = createAllowances[index];
          if (!allowanceType) continue;
          if (
            memberAllowanceTypeConfigurtaions.find(
              (x) => x.member_id === allowanceType.member_id && x.allowance_type_id == allowanceType.allowance_type_id
            )
          )
            continue;
          memberAllowanceTypeConfigurtaions.push({
            member_id: allowanceType.member_id,
            workspace_id: allowanceType.workspace_id,
            allowance_type_id: allowanceType.allowance_type_id,
            default: memberAllowanceTypeConfigurtaions.length === 0 ? true : false,
            disabled: false
          });
        }

        await prisma.memberAllowanceTypeConfigurtaion.createMany({
          data: memberAllowanceTypeConfigurtaions
        });

        await createDeps(dataDeps, syncedDepIds, createdMembers, workspace.id);
        await inngest.send(
          createdMembers.map((member) => ({
            name: 'member/update.member.allowance',
            data: {
              workspaceId: member.workspace_id,
              memberId: member.id
            }
          }))
        );

        if (owners.length > 0 && groupSyncSetting.manager_change_option) {
          createdOwners = createdMembers.filter(
            (created) => created.email && ownerMails.includes(created.email.toLowerCase())
          );
        }
        await inngest.send(
          createdMembers.map((created_member) => ({
            name: 'email/automatic_member_creation',
            data: {
              created_member_id: created_member.id,
              workspace_id: workspace.id
            }
          }))
        );
      }
    }
    let managersThatAreNotOwners: {
      id: string;
    }[] = [];

    if (groupSyncSetting.manager_change_option) {
      managersThatAreNotOwners = depMembers.filter((member) => {
        const managersToRemove = syncedDepartments.filter(
          (dep) =>
            dep.members.filter(
              (mem) =>
                mem.member_id === member.id &&
                mem.manager_type === 'Manager' &&
                ((member.microsoft_user_id && !ownerIds.includes(member.microsoft_user_id)) ||
                  (member.email?.toLowerCase() && !ownerMails.includes(member.email.toLowerCase())))
            ).length > 0
        );
        return managersToRemove.length > 0;
      });
    }

    const managerIds = managersThatAreNotOwners.map((man) => man.id);
    const admin = await prisma.member.findFirst({ where: { workspace_id: workspace.id, is_admin: true } });
    const caller = departmentRouter.createCaller({
      prisma: prisma,
      session: {
        user: admin as any
      },
      current_member: admin,
      req: null
    });
    for (const department of syncedDepartments) {
      if (!department) continue;
      try {
        const owners = [...createdOwners, ...existedOwnersAndNotManagers];
        const managers = department.members
          .filter((member) => !managerIds.includes(member.member_id) && member.manager_type === 'Manager')
          .map((mem) => ({ id: mem.member_id }));
        const unitedManagers = [...managers, ...owners];
        if (unitedManagers.length === 0) continue;
        const manager_member = unitedManagers
          .filter((value, index, self) => index === self.findIndex((t) => t.id === value.id))
          .map((value, index) => ({
            member_id: value.id,
            predecessor_manager_id: unitedManagers[index - 1]?.id || null
          }));
        await caller.edit({
          id: department.id,
          data: {
            workspace_id: department.workspace_id,
            manager_member,
            changed_by_webhook: true
          }
        });
      } catch (error) {
        console.log(error);
        Sentry.captureException(error);
        continue;
      }
    }
  } catch (error) {
    console.log(error);
    Sentry.captureException(error);
  }
};

export const createDeps = async (
  dataDeps: {
    department_id: string;
    member_id: string;
    workspace_id: string;
  }[],
  syncedDepIds: string[],
  members: { id: string }[],
  workspace_id: string
) => {
  try {
    await prisma.memberDepartment.createMany({ data: dataDeps });

    const departmentManagers = await prisma.memberDepartment.findMany({
      where: {
        department_id: { in: syncedDepIds },
        manager_type: 'Manager'
      },
      select: {
        member_id: true,
        manager_type: true,
        predecessor_manager_id: true
      }
    });

    const dataApprover: {
      approver_member_id: string;
      member_id: string;
      workspace_id: string;
      predecessor_approver_member_approver_id: string | null;
    }[] = [];

    members.forEach((member) => {
      departmentManagers.forEach((x) => {
        const approverData = {
          approver_member_id: x.member_id,
          member_id: member.id,
          workspace_id,
          predecessor_approver_member_approver_id: x.predecessor_manager_id
        };

        dataApprover.push(approverData);
      });
    });

    await prisma.memberApprover.createMany({
      data: dataApprover
    });
  } catch (error) {
    console.log(error);
    Sentry.captureException(error);
  }
};
