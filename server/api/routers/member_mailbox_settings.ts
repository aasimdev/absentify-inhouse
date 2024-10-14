import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { MailboxAutomaticRepliesSettingExternalAudience, Prisma, TimeFormat } from '@prisma/client';
import { format } from 'date-fns';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { formatInTimeZone } from 'date-fns-tz';
import * as Sentry from '@sentry/nextjs';
import { ensureTimeZoneAvailability } from '~/helper/ensureTimeZoneAvailability';
import { defaultWorkspaceSelect } from './workspace';
import { hasEnterpriseSubscription } from '~/lib/subscriptionHelper';
import { sendMail } from '~/lib/sendInBlueContactApi';
import { getApproverValue } from '~/lib/getApproverHelper';

/**
 * Default selector for memberMailboxSettings.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
const defaultMemberMailboxSettingsSelect = Prisma.validator<Prisma.MemberMailboxSettingsSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  member_id: true,
  workspace_id: true,
  leave_type_id: true,
  internalReplyMessage: true,
  externalReplyMessage: true,
  externalAudience: true,
  allow_member_edit_out_of_office_message: true
});

export const memberMailboxSettingsRouter = createTRPCRouter({
  // create
  add: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        member_id: z.string(),
        workspace_id: z.string(),
        leave_type_id: z.string(),
        internalReplyMessage: z.string(),
        externalReplyMessage: z.string(),
        externalAudience: z.nativeEnum(MailboxAutomaticRepliesSettingExternalAudience)
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.current_member.id !== input.member_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only change your own mailbox settings'
        });
      }
      if (ctx.current_member.workspace_id != input.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only change your own mailbox settings'
        });
      }

      const [memberMailboxSettings] = await ctx.prisma.$transaction([
        ctx.prisma.memberMailboxSettings.create({
          data: input,
          select: defaultMemberMailboxSettingsSelect
        }),
        ctx.prisma.request.updateMany({
          where: {
            workspace_id: input.workspace_id,
            requester_member_id: input.member_id,
            out_of_office_message_status: 'None',
            details: {
              AND: [{ leave_type_id: input.leave_type_id }, { OR: [{ status: 'APPROVED' }, { status: 'PENDING' }] }]
            }
          },
          data: { out_of_office_message_status: 'MustBeConfigured' }
        })
      ]);
      return memberMailboxSettings;
    }),
  addAllMembersSettings: protectedProcedure
    .input(
      z.object({
        members: z.array(z.object({ id: z.string(), name: z.string() })),
        workspace_id: z.string(),
        leave_type_ids: z.array(z.string()),
        internalReplyMessage: z.string(),
        externalReplyMessage: z.string(),
        externalAudience: z.nativeEnum(MailboxAutomaticRepliesSettingExternalAudience),
        allow_member_edit_out_of_office_message: z.boolean()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        select: defaultWorkspaceSelect,
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('nonExistentWorspace')
        });
      }
      const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      if (ctx.current_member.is_admin !== true || !enterprisePlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('no-access-or-plan')
        });
      }

      const { members, internalReplyMessage, externalReplyMessage, ...inputWithoutMemberIds } = input;
      const settingToCreate = members.flatMap((member) => {
        return inputWithoutMemberIds.leave_type_ids.map((id) => ({
          member_id: member.id,
          externalReplyMessage,
          internalReplyMessage,
          leave_type_id: id,
          workspace_id: inputWithoutMemberIds.workspace_id,
          externalAudience: inputWithoutMemberIds.externalAudience,
          allow_member_edit_out_of_office_message: inputWithoutMemberIds.allow_member_edit_out_of_office_message
        }));
      });
      const ids = members?.map((member) => member.id);
      const [memberMailboxSettings] = await ctx.prisma.$transaction([
        ctx.prisma.memberMailboxSettings.createMany({
          data: settingToCreate
        }),
        ctx.prisma.request.updateMany({
          where: {
            workspace_id: input.workspace_id,
            requester_member_id: {
              in: ids
            },
            out_of_office_message_status: 'None',
            details: {
              AND: [
                { leave_type_id: { in: input.leave_type_ids } },
                { OR: [{ status: 'APPROVED' }, { status: 'PENDING' }] }
              ]
            }
          },
          data: { out_of_office_message_status: 'MustBeConfigured' }
        })
      ]);
      return memberMailboxSettings;
    }),
  // read
  all: protectedProcedure.query(async ({ ctx }) => {
    /**
     * For pagination you can have a look at this docs site
     * @link https://trpc.io/docs/useInfiniteQuery
     */
    return ctx.prisma.memberMailboxSettings.findMany({
      select: defaultMemberMailboxSettingsSelect,
      where: {
        workspace_id: ctx.current_member.workspace_id,
        member_id: ctx.current_member.id
      }
    });
  }),
  allMembersSettings: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string())
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        select: defaultWorkspaceSelect,
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('nonExistentWorspace')
        });
      }
      const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      if (ctx.current_member.is_admin !== true || !enterprisePlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('no-access-or-plan')
        });
      }
      return ctx.prisma.memberMailboxSettings.findMany({
        select: defaultMemberMailboxSettingsSelect,
        where: {
          workspace_id: ctx.current_member.workspace_id,
          member_id: {
            in: input.ids
          }
        }
      });
    }),
  // update
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          internalReplyMessage: z.string(),
          externalReplyMessage: z.string(),
          externalAudience: z.nativeEnum(MailboxAutomaticRepliesSettingExternalAudience)
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      const memberMailboxSettings = await ctx.prisma.memberMailboxSettings.findUnique({
        select: { workspace_id: true, member_id: true },
        where: { id }
      });

      if (!memberMailboxSettings) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'We can not find the mailbox settings you are trying to edit'
        });
      }
      if (ctx.current_member.id !== memberMailboxSettings.member_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only change your own mailbox settings'
        });
      }
      if (ctx.current_member.workspace_id != memberMailboxSettings.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only change your own mailbox settings'
        });
      }
      const memberMailboxSettingsUpdated = await ctx.prisma.memberMailboxSettings.update({
        where: { id },
        data,
        select: defaultMemberMailboxSettingsSelect
      });
      return memberMailboxSettingsUpdated;
    }),
  editAllMailSettings: protectedProcedure
    .input(
      z.object({
        members: z.array(
          z.object({
            id: z.string(),
            name: z.string()
          })
        ),
        leavetypeIds: z.array(z.string()),
        internalReplyMessage: z.string(),
        externalReplyMessage: z.string(),
        externalAudience: z.nativeEnum(MailboxAutomaticRepliesSettingExternalAudience),
        allow_member_edit_out_of_office_message: z.boolean()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        members,
        leavetypeIds,
        internalReplyMessage,
        externalReplyMessage,
        externalAudience,
        allow_member_edit_out_of_office_message
      } = input;

      const workspace = await ctx.prisma.workspace.findUnique({
        select: defaultWorkspaceSelect,
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('nonExistentWorspace')
        });
      }
      const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      if (ctx.current_member.is_admin !== true || !enterprisePlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('no-access-or-plan')
        });
      }
      const memberIds = members.map((member) => member.id);
      try {
        await ctx.prisma.memberMailboxSettings.updateMany({
          where: { member_id: { in: memberIds }, leave_type_id: { in: leavetypeIds } },
          data: {
            externalReplyMessage,
            internalReplyMessage,
            externalAudience,
            allow_member_edit_out_of_office_message
          }
        });

        return {
          message: 'ok'
        };
      } catch (error: any) {
        Sentry.captureException(error);
      }
    }),
  // send testmail
  sendtestmailWithoutSaving: protectedProcedure
    .input(
      z.object({
        testMember: z.object({
          id: z.string()
        }),
        internal: z.boolean(),
        internalReplyMessage: z.string(),
        externalReplyMessage: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        select: defaultWorkspaceSelect,
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('nonExistentWorspace')
        });
      }
      const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      if (ctx.current_member.is_admin !== true || !enterprisePlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('no-access-or-plan')
        });
      }
      const { internal, internalReplyMessage, externalReplyMessage, testMember } = input;

      const member = await ctx.prisma.member.findUnique({
        where: {
          id: testMember.id
        },
        select: {
          id: true,
          name: true,
          email: true,
          date_format: true,
          timezone: true,
          time_format: true,
          firstName: true,
          lastName: true,
          workspace_id: true
        }
      });

      if (!member) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('member-not-found')
        });
      }

      const member_approver = await ctx.prisma.memberApprover.findFirst({
        where: {
          member_id: member.id
        },
        select: {
          approver_member_id: true,
          predecessor_approver_member_approver_id: true,
          approver_member: { select: { name: true, email: true } }
        }
      });

      const today = new Date();
      today.setUTCHours(8, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(18, 0, 0, 0);

      const replace = (text: string) => {
        text = text.replace(/{{firstName}}/g, member.firstName || '');
        text = text.replace(/{{lastName}}/g, member.lastName || '');
        text = text.replace(/{{name}}/g, member.name || '');
        text = text.replace(/{{startDate}}/g, format(today, member.date_format ?? 'MM/dd/yyyy'));
        text = text.replace(
          /{{startTime}}/g,
          formatInTimeZone(
            today,
            ensureTimeZoneAvailability(member.timezone ?? workspace.global_timezone),
            member.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
          )
        );
        text = text.replace(/{{dateOfReturn}}/g, format(tomorrow, member.date_format ?? 'MM/dd/yyyy'));
        text = text.replace(
          /{{timeOfReturn}}/g,
          formatInTimeZone(
            tomorrow,
            ensureTimeZoneAvailability(member.timezone ?? workspace.global_timezone),
            member.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
          )
        );
        // Replacing the placeholders (with and without square brackets)
        text = text.replace(/{{approverName(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'name'
          );
        });

        text = text.replace(/{{approverMail(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'email'
          );
        });

        text = text.replace(/{{managerName(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'name'
          );
        });

        text = text.replace(/{{managerMail(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'email'
          );
        });

        return text;
      };

      if (ctx.session.user.email) {
        await sendMail({
          prisma: ctx.prisma,
          workspace_id: member.workspace_id,
          subject: ctx.t('Test_out_of_office_response'),
          html: internal ? replace(internalReplyMessage) : replace(externalReplyMessage),
          recipients: {
            to: [
              {
                address: ctx.session.user.email.toLowerCase(),
                displayName: ctx.session.user.name
              }
            ]
          }
        });
      }

      return { message: 'ok' };
    }),
  sendtestmail: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        internal: z.boolean()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, internal } = input;
      const [memberMailboxSettings, member_approver, workspace] = await ctx.prisma.$transaction([
        ctx.prisma.memberMailboxSettings.findUnique({
          select: defaultMemberMailboxSettingsSelect,
          where: { id }
        }),
        ctx.prisma.memberApprover.findFirst({
          where: {
            member_id: ctx.current_member.id
          },
          select: {
            approver_member_id: true,
            predecessor_approver_member_approver_id: true,
            approver_member: { select: { name: true, email: true } }
          }
        }),
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { global_timezone: true }
        })
      ]);

      if (!memberMailboxSettings) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'We can not find the mailbox settings you are trying to send'
        });
      }

      if (ctx.current_member.id !== memberMailboxSettings.member_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only send your own mailbox settings'
        });
      }
      if (ctx.current_member.workspace_id != memberMailboxSettings.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only send your own mailbox settings'
        });
      }
      if (workspace == null) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only send your own mailbox settings'
        });
      }
      const today = new Date();
      today.setUTCHours(8, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(18, 0, 0, 0);

      const replace = (text: string) => {
        text = text.replace(/{{firstName}}/g, ctx.current_member.firstName || '');
        text = text.replace(/{{lastName}}/g, ctx.current_member.lastName || '');
        text = text.replace(/{{name}}/g, ctx.current_member.name || '');
        text = text.replace(/{{startDate}}/g, format(today, ctx.current_member.date_format ?? 'MM/dd/yyyy'));
        text = text.replace(
          /{{startTime}}/g,
          formatInTimeZone(
            today,
            ensureTimeZoneAvailability(ctx.current_member.timezone ?? workspace.global_timezone),
            ctx.current_member.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
          )
        );
        text = text.replace(/{{dateOfReturn}}/g, format(tomorrow, ctx.current_member.date_format ?? 'MM/dd/yyyy'));
        text = text.replace(
          /{{timeOfReturn}}/g,
          formatInTimeZone(
            tomorrow,
            ensureTimeZoneAvailability(ctx.current_member.timezone ?? workspace.global_timezone),
            ctx.current_member.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
          )
        );

        // Replacing the placeholders (with and without square brackets)
        text = text.replace(/{{approverName(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'name'
          );
        });

        text = text.replace(/{{approverMail(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'email'
          );
        });
        text = text.replace(/{{managerName(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'name'
          );
        });

        text = text.replace(/{{managerMail(?:\[(\d+)\])?}}/g, (_, index) => {
          // User enters a 1-based index, so we need to subtract 1
          const userIndex = index ? parseInt(index, 10) - 1 : 0;
          return getApproverValue(
            member_approver
              ? [member_approver].map((y) => ({
                  approver_member_id: y.approver_member_id,
                  predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
                  approver_member: y.approver_member
                }))
              : [],
            userIndex,
            'email'
          );
        });
        return text;
      };

      if (ctx.current_member.email) {
        await sendMail({
          prisma: ctx.prisma,
          workspace_id: memberMailboxSettings.workspace_id,
          subject: ctx.t('Test_out_of_office_response'),
          html: internal
            ? replace(memberMailboxSettings.internalReplyMessage)
            : replace(memberMailboxSettings.externalReplyMessage),
          recipients: {
            to: [
              {
                address: ctx.current_member.email.toLowerCase(),
                displayName: ctx.current_member.name ?? ''
              }
            ]
          }
        });
      }

      return { id };
    }),
  // delete
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const memberMailboxSettings = await ctx.prisma.memberMailboxSettings.findUnique({
        where: { id },
        select: { workspace_id: true, member_id: true, leave_type_id: true }
      });
      if (memberMailboxSettings?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only delete your own mailbox settings'
        });
      }
      if (memberMailboxSettings?.member_id != ctx.current_member.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You can only delete your own mailbox settings'
        });
      }

      const [] = await ctx.prisma.$transaction([
        ctx.prisma.request.updateMany({
          where: {
            workspace_id: memberMailboxSettings.workspace_id,
            requester_member_id: memberMailboxSettings.member_id,
            out_of_office_message_status: 'MustBeConfigured',
            details: {
              leave_type_id: memberMailboxSettings.leave_type_id
            }
          },
          data: { out_of_office_message_status: 'None' }
        }),
        ctx.prisma.memberMailboxSettings.delete({ where: { id: id } })
      ]);

      return {
        id
      };
    }),
  deleteAllMailSettings: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
        leavetypeIds: z.array(z.string())
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ids, leavetypeIds } = input;
      const workspace = await ctx.prisma.workspace.findUnique({
        select: defaultWorkspaceSelect,
        where: { id: ctx.current_member.workspace_id }
      });
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('nonExistentWorspace')
        });
      }
      const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
      if (ctx.current_member.is_admin !== true || !enterprisePlan) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('no-access-or-plan')
        });
      }

      const [_, deleted] = await ctx.prisma.$transaction([
        ctx.prisma.request.updateMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            requester_member_id: {
              in: ids
            },
            out_of_office_message_status: 'MustBeConfigured',
            details: {
              leave_type_id: { in: leavetypeIds }
            }
          },
          data: { out_of_office_message_status: 'None' }
        }),
        ctx.prisma.memberMailboxSettings.deleteMany({
          where: { member_id: { in: ids }, leave_type_id: { in: leavetypeIds } }
        })
      ]);

      return {
        deletedCount: deleted.count
      };
    })
});
