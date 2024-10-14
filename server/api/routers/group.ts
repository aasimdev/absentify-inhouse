import { getMicrosoftGroupsAccessToken, getMicrosoftUsersAccessToken } from '~/lib/getMicrosoftAccessToken';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import axios from 'axios';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { MicrosoftMember, MicrosoftMemberOptionalMail, reponseToGroupSync } from '~/pages/api/webhooks/graph/groups';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { SizedImage, resizeImages } from '~/inngest/Functions/updateMemberProfile';
import * as Sentry from '@sentry/nextjs';

type Group = {
  id: string;
  displayName: string;
  description: string;
  securityEnabled: boolean;
  visibility: string;
  mail: string;
};

interface GraphApiResponse {
  data: {
    '@odata.context': string;
    value: Group[];
  };
}

interface GraphApiMemberResponse {
  data: {
    value: MicrosoftMemberOptionalMail[];
  };
}

export const groupRouter = createTRPCRouter({
  allGroupSettings: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findFirst({
      where: { id: ctx.current_member.workspace_id },
      select: { id: true, microsoft_groups_read_write_all: true }
    });
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }
    if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    const groupSettings = await ctx.prisma.groupSyncSetting.findMany({
      where: { workspace_id: ctx.current_member.workspace_id }
    });
    return groupSettings;
  }),
  all: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.prisma.workspace.findFirst({
      where: { id: ctx.current_member.workspace_id },
      select: { id: true, microsoft_groups_read_write_all: true }
    });
    if (!ctx.current_member.is_admin) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_you_have_to_be_admin')
      });
    }
    if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    if (!ctx.current_member?.microsoft_tenantId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_microsoft_groups_not_activated')
      });
    }
    const access_token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
    let groups: Group[] = [];
    let nextLink = `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,securityEnabled,visibility,mail`;

    while (nextLink) {
      let res = await axios.get(nextLink, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      groups = groups.concat(res.data.value);
      nextLink = res.data['@odata.nextLink'];
    }

    return groups;
  }),
  searchByName: protectedProcedure
    .input(
      z.object({
        searchString: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findFirst({
        where: { id: ctx.current_member.workspace_id },
        select: { id: true, microsoft_groups_read_write_all: true }
      });
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_microsoft_groups_not_activated')
        });
      }
      if (!ctx.current_member?.microsoft_tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_microsoft_groups_not_activated')
        });
      }
      const access_token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
      let groups: Group[] = [];
      let nextLink = `https://graph.microsoft.com/v1.0/groups?$filter=contains(displayName, '${input.searchString}')&$select=id,displayName,description,securityEnabled,visibility,mail`;

      while (nextLink) {
        let res = await axios.get(nextLink, {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });
        if (groups.length > 0) groups = groups.concat(res.data.value);
        nextLink = res.data['@odata.nextLink'];
      }

      return groups;
    }),
  getGroupMembersWithPhotos: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      async function doesBlobExist(containerClient: ContainerClient, blobName: string): Promise<boolean> {
        const blobClient = containerClient.getBlobClient(blobName);
        return await blobClient.exists();
      }
      try {
        const workspace = await ctx.prisma.workspace.findFirst({
          where: { id: ctx.current_member.workspace_id },
          select: { id: true, microsoft_groups_read_write_all: true }
        });
        if (!ctx.current_member.is_admin) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_you_have_to_be_admin')
          });
        }
        if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        if (!ctx.current_member?.microsoft_tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        const token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
        const { id } = input;
        const {
          data: { value: owners }
        }: GraphApiMemberResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/groups/${id}/owners?$select=id,displayName,givenName,mail,preferredLanguage,surname,userPrincipalName,accountEnabled`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        const {
          data: { value: groupMembers }
        }: GraphApiMemberResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/groups/${id}/members?$select=id,displayName,givenName,mail,preferredLanguage,surname,userPrincipalName,accountEnabled`,
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
        const memIds = members.map((mem) => mem.id);
        const absentifyMembers = await ctx.prisma.member.findMany({ where: { microsoft_user_id: { in: memIds } } });
        const absentifyMemIds = absentifyMembers.map((mem) => mem.microsoft_user_id);
        const absentifyMails = absentifyMembers.map((mem) => mem.email?.toLowerCase());
        const microsoftMembers = members.filter(
          (member) => !absentifyMemIds.includes(member.id) && !absentifyMails.includes(member.mail?.toLowerCase())
        );
        const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_URL + '');
        const containerClient = blobServiceClient.getContainerClient('');
        const imageSizes: Array<number> = [32, 64, 128, 256, 512];
        const usertoken = await getMicrosoftUsersAccessToken(ctx.current_member.microsoft_tenantId);
        const failedMemberIds: string[] = [];
        for (const member of microsoftMembers) {
          try {
            const arrayBufferReponse = await axios.get(
              `https://graph.microsoft.com/v1.0/users/${member.id}/photo/$value`,
              {
                responseType: 'arraybuffer',
                headers: {
                  Authorization: `Bearer ${usertoken}`,
                  'Content-Type': 'image/jpg'
                }
              }
            );
            const fileBuffer = arrayBufferReponse.data;
            const resizedImages: SizedImage[] = await resizeImages(fileBuffer, imageSizes, member.id);
            for (let index = 0; index < resizedImages.length; index++) {
              const image = resizedImages[index];
              if (!image) continue;
              if (await doesBlobExist(containerClient, image.filename)) {
                continue;
              }
              const blockBlobClient = containerClient.getBlockBlobClient(image.filename);
              const blobOptions = { blobHTTPHeaders: { blobContentType: 'image/jpeg' } };
              await blockBlobClient.uploadData(image.buffer, blobOptions);
            }
          } catch (error: any) {
            console.error(`Err ${member.displayName}:`, error.name);
            failedMemberIds.push(member.id);
            continue;
          }
        }

        const mappedAbsentify = absentifyMembers.map((member) => ({
          abentify_microsoft_id: member.id,
          microsoft_user_id: member.microsoft_user_id,
          displayName: member.name,
          mail: member.email,
          givenName: member.firstName,
          surname: member.lastName,
          has_cdn_image: member.has_cdn_image
        }));
        const mappedMicrosoft = microsoftMembers.map((member) => ({
          abentify_microsoft_id: member.id,
          microsoft_user_id: member.id,
          displayName: member.displayName,
          mail: member.mail?.toLowerCase(),
          givenName: member.givenName,
          surname: member.surname,
          has_cdn_image: failedMemberIds.includes(member.id) ? false : true
        }));

        const result: {
          abentify_microsoft_id: string;
          microsoft_user_id: string | null;
          displayName: string | null;
          mail: string | null;
          givenName: string | null;
          surname: string | null;
          has_cdn_image: boolean;
        }[] = [...mappedAbsentify, ...mappedMicrosoft];
        return result;
      } catch (error: any) {
        console.log('error', error);
        Sentry.captureException(error);
      }
    }),
  getOwnersByDep: protectedProcedure
    .input(
      z.object({
        department_id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const groupSyncSettings = await ctx.prisma.groupSyncSetting.findMany({
        where: {
          departments: { some: { department_id: input.department_id } }
        }
      });
      return groupSyncSettings;
    }),
  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        group_id: z.string(),
        department_ids: z.array(z.string()),
        automatic_account_create_option: z.boolean(),
        manager_change_option: z.boolean(),
        remove_from_department_option: z.boolean()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const workspace = await ctx.prisma.workspace.findFirst({
          where: { id: ctx.current_member.workspace_id },
          select: { id: true, microsoft_groups_read_write_all: true }
        });
        if (!ctx.current_member.is_admin) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_you_have_to_be_admin')
          });
        }
        if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        if (!ctx.current_member?.microsoft_tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        const token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
        const groupSyncSetting = await ctx.prisma.groupSyncSetting.create({
          data: {
            name: input.name,
            description: input.description,
            group_id: input.group_id,
            automatic_account_create_option: input.automatic_account_create_option,
            manager_change_option: input.manager_change_option,
            remove_from_department_option: input.remove_from_department_option,
            workspace_id: ctx.current_member.workspace_id
          }
        });
        await ctx.prisma.departmentGroupSyncSetting.createMany({
          data: input.department_ids.map((id) => ({
            department_id: id,
            group_sync_setting_id: groupSyncSetting.id
          }))
        });
        await reponseToGroupSync(groupSyncSetting, token);
      } catch (error: any) {
        console.log(error);
        throw new TRPCError(error.message);
      }
    }),
  edit: protectedProcedure
    .input(
      z.object({
        synced_group_setting_id: z.string(),
        name: z.string(),
        description: z.string(),
        group_id: z.string(),
        department_ids: z.array(z.string()),
        automatic_account_create_option: z.boolean(),
        manager_change_option: z.boolean(),
        remove_from_department_option: z.boolean()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const workspace = await ctx.prisma.workspace.findFirst({
          where: { id: ctx.current_member.workspace_id },
          select: { id: true, microsoft_groups_read_write_all: true }
        });
        if (!ctx.current_member.is_admin) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_you_have_to_be_admin')
          });
        }
        if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        if (!ctx.current_member?.microsoft_tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_microsoft_groups_not_activated')
          });
        }
        const token = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
        await ctx.prisma.groupSyncSetting.findUnique({
          where: { id: input.synced_group_setting_id }
        });
        const groupSyncSetting = await ctx.prisma.groupSyncSetting.update({
          where: { id: input.synced_group_setting_id },
          data: {
            name: input.name,
            description: input.description,
            group_id: input.group_id,
            automatic_account_create_option: input.automatic_account_create_option,
            manager_change_option: input.manager_change_option,
            remove_from_department_option: input.remove_from_department_option
          }
        });
        await ctx.prisma.departmentGroupSyncSetting.deleteMany({
          where: {
            group_sync_setting_id: input.synced_group_setting_id
          }
        });
        await ctx.prisma.departmentGroupSyncSetting.createMany({
          data: input.department_ids.map((id) => ({
            department_id: id,
            group_sync_setting_id: groupSyncSetting.id
          }))
        });

        await reponseToGroupSync(groupSyncSetting, token);
      } catch (error: any) {
        console.log(error);
        throw new TRPCError(error.message);
      }
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findFirst({
        where: { id: ctx.current_member.workspace_id },
        select: { id: true, microsoft_groups_read_write_all: true }
      });
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_microsoft_groups_not_activated')
        });
      }
      await ctx.prisma.departmentGroupSyncSetting.deleteMany({
        where: {
          group_sync_setting_id: input.id
        }
      });
      await ctx.prisma.groupSyncSetting.delete({ where: { id: input.id } });
    }),
  getSyncedDepartmentsForGroup: protectedProcedure
    .input(
      z.object({
        group_setting_id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findFirst({
        where: { id: ctx.current_member.workspace_id },
        select: { id: true, microsoft_groups_read_write_all: true }
      });
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (workspace?.microsoft_groups_read_write_all != 'ACTIVATED') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_microsoft_groups_not_activated')
        });
      }
      const departmentGroupSyncSetting = await ctx.prisma.departmentGroupSyncSetting.findMany({
        where: { group_sync_setting_id: input.group_setting_id }
      });
      return departmentGroupSyncSetting;
    })
});
