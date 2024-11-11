import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import Redis from 'ioredis';
import {
  ApprovalProcess,
  MicrosoftAppStatus,
  NotificationReceivingMethod,
  Prisma,
  TimeFormat,
  type PrismaClient,
  Status
} from '@prisma/client';
import { protectedProcedure, createTRPCRouter } from '../trpc';
import { ensureAvailabilityOfGetT } from 'lib/monkey-patches';
import { sendUniversalTransactionalMail } from 'lib/sendInBlueContactApi';
import { summarizeSubscriptions } from 'lib/subscriptionHelper';
import { defaultWorkspaceSelect } from './workspace';
import { type Translate } from 'next-translate';
import { getMicrosoftUsersAccessToken } from 'lib/getMicrosoftAccessToken';
import { BlobServiceClient } from '@azure/storage-blob';
import * as Sentry from '@sentry/nextjs';
import getFileNames from '~/lib/getFileNames';
import { addYears, addDays } from 'date-fns';
import { inngest } from '~/inngest/inngest_client';
import { sign } from 'jsonwebtoken';
import axios from 'axios';
import { updateSmiirl } from '~/helper/smiirl';
const redis = new Redis(process.env.REDIS_URL + '');
/**
 * Default selector for member.
 * It's important to always explicitly say which fields you want to return in order to not leak extra information
 * @see https://github.com/prisma/prisma/issues/9353
 */
export const defaultMemberSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  createdAt: true,
  updatedAt: true,
  is_admin: true,
  employment_start_date: true,
  employment_end_date: true,
  workspace_id: true,
  birthday: true,
  public_holiday_id: true,
  name: true,
  custom_id: true,
  email: true,
  default_timeline_department_id: true,
  approver_config_department_id: true,
  approver_config_microsoft_profile_manager_sync: true,
  approval_process: true,
  language: true,
  time_format: true,
  timezone: true,
  date_format: true,
  long_datetime_format: true,
  week_start: true,
  microsoft_tenantId: true,
  microsoft_user_id: true,
  has_cdn_image: true,
  firstName: true,
  lastName: true,
  display_calendar_weeks: true,
  email_notifications_updates: true,
  email_notif_bday_anniv_remind: true,
  email_notif_weekly_absence_summary: true,
  notifications_receiving_method: true,
  email_ical_notifications: true,
  status: true,
  departments: {
    select: {
      department_id: true,
      department: {
        select: {
          id: true,
          name: true,
          members: {
            select: {
              member_id: true,
              manager_type: true,
              predecessor_manager_id: true
            },
            where: { manager_type: { not: 'Member' } }
          }
        }
      }
    }
  },
  has_approvers: {
    select: {
      approver_member_id: true,
      predecessor_approver_member_approver_id: true,
      approver_member: { select: { name: true, email: true } }
    }
  },
  allowance_type_configurtaions: {
    select: {
      allowance_type_id: true,
      disabled: true,
      default: true
    }
  },
  allowances: {
    select: {
      id: true,
      remaining: true,
      taken: true,
      allowance: true,
      brought_forward: true,
      year: true,
      leave_types_stats: true,
      allowance_type: { select: { id: true, allowance_unit: true } },
      start: true,
      end: true
    }
  },
  schedules: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      member_id: true,
      workspace_id: true,
      from: true,
      monday_am_start: true,
      monday_am_end: true,
      monday_pm_start: true,
      monday_pm_end: true,
      monday_am_enabled: true,
      monday_pm_enabled: true,
      monday_deduct_fullday: true,
      tuesday_am_start: true,
      tuesday_am_end: true,
      tuesday_pm_start: true,
      tuesday_pm_end: true,
      tuesday_am_enabled: true,
      tuesday_pm_enabled: true,
      tuesday_deduct_fullday: true,
      wednesday_am_start: true,
      wednesday_am_end: true,
      wednesday_pm_start: true,
      wednesday_pm_end: true,
      wednesday_am_enabled: true,
      wednesday_pm_enabled: true,
      wednesday_deduct_fullday: true,
      thursday_am_start: true,
      thursday_am_end: true,
      thursday_pm_start: true,
      thursday_pm_end: true,
      thursday_am_enabled: true,
      thursday_pm_enabled: true,
      thursday_deduct_fullday: true,
      friday_am_start: true,
      friday_am_end: true,
      friday_pm_start: true,
      friday_pm_end: true,
      friday_am_enabled: true,
      friday_pm_enabled: true,
      friday_deduct_fullday: true,
      saturday_am_start: true,
      saturday_am_end: true,
      saturday_pm_start: true,
      saturday_pm_end: true,
      saturday_am_enabled: true,
      saturday_pm_enabled: true,
      saturday_deduct_fullday: true,
      sunday_am_start: true,
      sunday_am_end: true,
      sunday_pm_start: true,
      sunday_pm_end: true,
      sunday_am_enabled: true,
      sunday_pm_enabled: true,
      sunday_deduct_fullday: true
    },
    orderBy: [{ from: 'desc' }]
  }
});

export type defaultMemberSelectOutput = Prisma.MemberGetPayload<{
  select: typeof defaultMemberSelect;
}>;

export const createPicture = (logo: string | null | undefined, size: string) => {
  let picture = null;
  if (logo) {
    const image = logo.split('32x32');
    picture = image[0] + size + image[1];
  }
  return picture;
};

export const defaultSessionMemberSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  is_admin: true,
  workspace_id: true,
  status: true,
  email: true,
  name: true
});

export const memberRouter = createTRPCRouter({
  invite: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().nullable(),
        member_department_ids: z.array(z.string()),
        employment_start_date: z.date().nullable(),
        public_holiday_id: z.string(),
        status: z.nativeEnum(Status),
        custom_id: z.string().nullable(),
        defaultAllowances: z.array(
          z.object({
            id: z.string(),
            current_year: z.number(),
            next_year: z.number(),
            default: z.boolean().optional(),
            disabled: z.boolean().optional()
          })
        )
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.member_department_ids.length == 0) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you_have_to_set_one_dep')
        });
      }
      if (!input.member_department_ids[0]) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you_have_to_set_one_dep')
        });
      }
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      input.member_department_ids = Array.from(new Set(input.member_department_ids));

      const [departments, existingMember, allowanceTypes, workspace] = await ctx.prisma.$transaction([
        ctx.prisma.department.findMany({
          where: { id: { in: input.member_department_ids } },
          select: {
            id: true,
            default_department_allowances: true,
            workspace: { select: { name: true, fiscal_year_start_month: true } }
          }
        }),

        ctx.prisma.member.findFirst({
          where: { email: input.email },
          select: { id: true }
        }),
        ctx.prisma.allowanceType.findMany({
          where: { workspace_id: ctx.current_member.workspace_id },
          select: { id: true, max_carry_forward: true, allowance_unit: true }
        }),
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: {
            name: true,
            global_date_format: true,
            global_time_format: true,
            global_language: true,
            global_timezone: true,
            global_week_start: true,
            microsoft_users_read_all: true
          }
        })
      ]);
      if (input.email && existingMember) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('user_already_exists')
        });
      }
      if (departments.length !== input.member_department_ids.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Department not found'
        });
      }
      if (departments.length == 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Department not found'
        });
      }

      const department = departments[0];
      if (!department) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('department_not_found')
        });
      }

      if (!allowanceTypes) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('allowance_not_found')
        });
      }
      if (!workspace) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      let microsoft_user_id: null | string = null;
      let microsoft_tenantId: null | string = null;
      if (workspace.microsoft_users_read_all == MicrosoftAppStatus.ACTIVATED && input.email) {
        try {
          const token = await getMicrosoftUsersAccessToken(ctx.session.user.microsoft_tenant_id);
          if (token) {
            const graphUser = await fetch(
              `https://graph.microsoft.com/v1.0/users?$filter=UserPrincipalName eq '${input.email.toLowerCase()}'&$select=id,displayName`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

            if (graphUser.ok) {
              const x = await graphUser.json();
              if (x.value[0].id) {
                microsoft_user_id = x.value[0].id;
                microsoft_tenantId = ctx.session.user.microsoft_tenant_id;
              }
            }
          }
        } catch (e) {
          Sentry.captureException(e);
        }
      }

      const member = await ctx.prisma.member.create({
        data: {
          public_holiday_id: input.public_holiday_id,
          workspace_id: ctx.current_member.workspace_id,
          employment_start_date: input.employment_start_date,
          is_admin: false,
          name: input.name,
          email: input.email ? input.email.toLowerCase() : null,
          approver_config_department_id: department.id,
          custom_id: input.custom_id,
          status: input.status,
          timezone: workspace.global_timezone,
          language: workspace.global_language,
          date_format: workspace.global_date_format,
          time_format: workspace.global_time_format,
          long_datetime_format:
            workspace.global_date_format + ' ' + (workspace.global_time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'),
          week_start: workspace.global_week_start,
          microsoft_user_id: microsoft_user_id,
          microsoft_tenantId: microsoft_tenantId
        },
        select: defaultMemberSelect
      });
      await updateSmiirl(ctx.prisma);

      const [a1, a2] = await ctx.prisma.$transaction([
        ctx.prisma.memberAllowance.findFirst({
          where: {
            workspace_id: ctx.current_member.workspace_id
          },
          orderBy: {
            year: 'asc'
          },
          select: {
            year: true
          }
        }),
        ctx.prisma.memberAllowance.findFirst({
          where: {
            workspace_id: ctx.current_member.workspace_id
          },
          orderBy: {
            year: 'desc'
          },
          select: {
            year: true
          }
        })
      ]);

      if (input.defaultAllowances.filter((x) => x.default).length > 1) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: ctx.t('only_one__allowance_allowed')
        });
      }
      if (input.defaultAllowances.filter((x) => x.default).length == 0 && input.defaultAllowances[0]) {
        input.defaultAllowances[0].default = true;
      }

      const oldestYear = a1 ? a1.year : new Date().getFullYear();
      const newestYear = a2 ? a2.year : new Date().getFullYear();
      const createAllowances = [];
      let currentYear = new Date().getFullYear();
      for (let i222 = 0; i222 < allowanceTypes.length; i222++) {
        const allowance_type = allowanceTypes[i222];
        if (!allowance_type) continue;
        let annual_allowance_current_year = allowance_type.allowance_unit === 'days' ? 20 : 1200;
        let annual_allowance_next_year = allowance_type.allowance_unit === 'days' ? 20 : 1200;
        if (input.defaultAllowances && input.defaultAllowances.length > 0) {
          const allowance: { id: string; current_year: number; next_year: number } | undefined =
            input.defaultAllowances.find((allowance) => allowance?.id === allowance_type.id);
          if (allowance) {
            annual_allowance_current_year = allowance.current_year;
            annual_allowance_next_year = allowance.next_year;
          }
        }
        const carryForward =
          allowance_type.max_carry_forward < annual_allowance_current_year
            ? allowance_type.max_carry_forward
            : annual_allowance_current_year;

        for (let i2 = oldestYear; i2 <= newestYear; i2++) {
          const allowanceStart = new Date(Date.UTC(i2, department.workspace.fiscal_year_start_month, 1));
          const allowanceEnd = addDays(
            addYears(new Date(Date.UTC(i2, department.workspace.fiscal_year_start_month, 1)), 1),
            -1
          );
          if (i2 === currentYear + 1) {
            createAllowances.push({
              allowance: annual_allowance_next_year,
              year: i2,
              member_id: member.id,
              brought_forward: annual_allowance_current_year,
              compensatory_time_off: 0,
              remaining: annual_allowance_next_year + carryForward,
              taken: 0,
              workspace_id: ctx.current_member.workspace_id,
              start: allowanceStart,
              end: allowanceEnd,
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
                workspace_id: ctx.current_member.workspace_id,
                allowance_type_id: allowance_type.id,
                start: allowanceStart,
                end: allowanceEnd
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
                workspace_id: ctx.current_member.workspace_id,
                allowance_type_id: allowance_type.id,
                start: allowanceStart,
                end: allowanceEnd
              });
            }
          }
        }
      }

      await ctx.prisma.memberAllowance.createMany({ data: createAllowances });

      for (let i222 = 0; i222 < departments.length; i222++) {
        const d = departments[i222];
        if (!d) continue;
        await ctx.prisma.memberDepartment.create({
          data: {
            department_id: d.id,
            member_id: member.id,
            workspace_id: ctx.current_member.workspace_id
          },
          select: { id: true }
        });
      }

      const departmentManagers = await ctx.prisma.memberDepartment.findMany({
        where: {
          department_id: department.id,
          manager_type: 'Manager',
          workspace_id: ctx.current_member.workspace_id
        },
        select: {
          member_id: true,
          manager_type: true,
          predecessor_manager_id: true
        }
      });

      await ctx.prisma.memberApprover.createMany({
        data: departmentManagers.map((x) => {
          return {
            approver_member_id: x.member_id,
            member_id: member.id,
            workspace_id: ctx.current_member.workspace_id,
            predecessor_approver_member_approver_id: x.predecessor_manager_id
          };
        })
      });

      const memberAllowanceTypeConfigurtaions = [];
      for (let index = 0; index < allowanceTypes.length; index++) {
        const allowanceType = allowanceTypes[index];
        if (!allowanceType) continue;
        memberAllowanceTypeConfigurtaions.push({
          member_id: member.id,
          workspace_id: ctx.current_member.workspace_id,
          allowance_type_id: allowanceType.id,
          default: input.defaultAllowances.find((x) => x.id === allowanceType.id)?.default ?? false,
          disabled: input.defaultAllowances.find((x) => x.id === allowanceType.id)?.disabled ?? false
        });
      }

      await ctx.prisma.memberAllowanceTypeConfigurtaion.createMany({
        data: memberAllowanceTypeConfigurtaions
      });

      await inngest.send({
        // The event name
        name: 'member/update.member.allowance',
        // The event's data
        data: {
          workspaceId: member.workspace_id,
          memberId: member.id
        }
      });
      if (member.microsoft_user_id && member.microsoft_tenantId) {
        await inngest.send({
          name: 'member/update.member.profile',
          // The event's data
          data: {
            microsoft_user_id: member.microsoft_user_id,
            microsoft_tenant_id: member.microsoft_tenantId,
            token: null
          }
        });

        await inngest.send({
          name: 'publicHolidayDaySync/create_sync_items_for_member',
          data: {
            member_id: member.id
          }
        });
      }
      if (input.status === Status.ACTIVE && member.email) {
        const getT = ensureAvailabilityOfGetT();
        const t = await getT(member.language, 'mails');
        const logo = ctx.current_member.workspace_id
          ? await ctx.prisma.workspace.findUnique({
              where: { id: ctx.current_member.workspace_id },
              select: { company_logo_url: true, company_logo_ratio_square: true }
            })
          : null;
        const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');

        await sendUniversalTransactionalMail({
          prisma: ctx.prisma,
          workspace_id: ctx.current_member.workspace_id,
          subject: t('You_have_been_invited'),
          params: {
            h1: t('h1_invite'),
            pageTitle: t('pageTitle_invite'),
            firstLine: t('firstLine_invite', { name: member.name }),
            secondLine: t('secondLine_invite', {
              company_name: workspace.name
            }),
            thirdLine: t('thirdLine_invite', {
              invitor: ctx.current_member.name ? ctx.current_member.name : ''
            }),
            fourthLine: t('important_to_know', { employee_email: member.email, admin_email: ctx.current_member.email }),
            buttonText: t('buttonText_invite'),
            link: 'https://app.absentify.com/',
            teamsLink: null,
            teamsLinkText: null,
            approvers: null,
            company_image_url: logo?.company_logo_url ? picture : null
          },
          to: {
            email: member.email.toLowerCase(),
            name: member.name ?? member.email
          },
          replyTo: {
            email: ctx.session.user.email?.toLowerCase() + '',
            name: ctx.current_member.name ? ctx.current_member.name : ''
          }
        });
      }
      try {
        await updateSmiirl(ctx.prisma);
      } catch (e) {}
      inngest.send({
        name: 'brevo/create_or_update_contact',
        data: { member_id: member.id }
      });
      return member;
    }),
  updateMemberEmail: protectedProcedure
    .input(
      z.object({
        member_id: z.string(),
        email: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to add member'
        });
      }
      const validateEmail = (email: string) => {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      };
      if (!validateEmail(input.email)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid email'
        });
      }
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.member_id },
        select: {
          id: true,
          email: true,
          name: true,
          microsoft_user_id: true,
          workspace: { select: { name: true } }
        }
      });
      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found'
        });
      }
      if (member.microsoft_user_id != null) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Member already has an account'
        });
      }

      await ctx.prisma.member.update({
        where: { id: input.member_id },
        data: { email: input.email.toLowerCase(), status: Status.INACTIVE }
      });

      return member;
    }),
  //read
  all: protectedProcedure
    .input(
      z.object({
        filter: z.object({
          status: z.array(z.nativeEnum(Status)).optional(),
          search: z.string().optional(),
          department_ids: z.array(z.string()).optional(),
          ids: z.array(z.string()).optional()
        }),
        limit: z.number().min(1).max(2000),
        page: z.number()
      })
    )
    .query(async ({ ctx, input }) => {
      return await getAllMembers(input, ctx);
    }),
  isManagerOfMembers: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(2000),
        page: z.number()
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.current_member.is_admin) {
        const result = await getAllMembers(
          {
            ...input,
            filter: {
              status: ['ACTIVE', 'INACTIVE'],
              search: input.search
            }
          },
          ctx
        );
        return result;
      }

      const managerOfDepartments = await ctx.prisma.memberDepartment.findMany({
        where: { workspace_id: ctx.current_member.workspace_id, manager_type: 'Manager' },
        select: { department_id: true }
      });
      if (managerOfDepartments.length == 0)
        return { members: [], count: 0, hasNextPage: false, hasPreviousPage: false, currentPage: 0, totalPages: 0 };

      const result = await getAllMembers(
        {
          ...input,
          filter: {
            status: ['ACTIVE', 'INACTIVE'],
            department_ids: managerOfDepartments.map((x) => x.department_id),
            search: input.search
          }
        },
        ctx
      );
      return result;
    }),
  count: protectedProcedure
    .input(
      z.object({
        status: z.array(z.nativeEnum(Status))
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.status) {
        const memberCount = await ctx.prisma.member.count({
          where: { workspace_id: ctx.current_member.workspace_id, status: { in: input.status } }
        });
        return memberCount;
      }
      const memberCount = await ctx.prisma.member.count({
        where: { workspace_id: ctx.current_member.workspace_id }
      });

      return memberCount;
    }),
  adminIds: protectedProcedure.query(async ({ ctx }) => {
    const adminIds = await ctx.prisma.member.findMany({
      where: { workspace_id: ctx.current_member.workspace_id, status: Status.ACTIVE, is_admin: true },
      select: { id: true }
    });

    return adminIds.map((x) => x.id);
  }),
  byEmail: protectedProcedure
    .input(
      z.object({
        email: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      if (!input.email) return null;
      const existingProfile = await ctx.prisma.member.findFirst({
        where: { email: input.email },
        select: {
          id: true,
          status: true,
          workspace_id: true,
          is_admin: true,
          workspace: {
            select: {
              members: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      return existingProfile;
    }),
  checkExistingEmails: protectedProcedure
    .input(
      z.object({
        emails: z.string().array()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingEmails = await ctx.prisma.member.findMany({
        where: { email: { in: input.emails } },
        select: { email: true }
      });

      return existingEmails;
    }),
  current: protectedProcedure.query(async ({ ctx }) => {
    const [member, workspace_departments] = await ctx.prisma.$transaction([
      ctx.prisma.member.findUnique({
        where: { id: ctx.current_member.id },
        select: defaultMemberSelect
      }),
      ctx.prisma.department.findMany({
        where: { workspace_id: ctx.current_member.workspace_id },
        select: { id: true, members: { select: { member_id: true, manager_type: true } } }
      })
    ]);

    if (!member) {
      throw new TRPCError({
        code: 'NOT_FOUND'
      });
    }
    member.allowances = member.allowances.filter((c) => {
      const config = member.allowance_type_configurtaions.find((zz) => zz.allowance_type_id === c.allowance_type.id);
      if (config?.disabled) return false;
      return true;
    });

    const currentUserIsManagerOfDepartments = workspace_departments.filter((dept) => {
      const userInDept = dept.members.find((m) => m.member_id === member.id);
      return userInDept?.manager_type === 'Manager';
    });

    return {
      ...member,
      is_manager:
        currentUserIsManagerOfDepartments.length > 0
          ? {
              is_manager_of_departments: currentUserIsManagerOfDepartments.map((x) => x.id),
              is_manager_of_members: Array.from(
                new Set(
                  currentUserIsManagerOfDepartments.flatMap(
                    (dept) => dept?.members.map((member) => member?.member_id).filter(Boolean) ?? []
                  )
                )
              )
            }
          : null
    };
  }),
  getFrillSsoToken: protectedProcedure.query(async ({ ctx }) => {
    var FrillSSOKey = process.env.FILL_SSO_KEY + '';
    var userData = {
      email: ctx.session.user.email,
      id: ctx.session.user.id,
      name: ctx.session.user.name
    };
    var frillUserToken = sign(userData, FrillSSOKey, { algorithm: 'HS256' });
    return frillUserToken;
  }),
  getMicrosoftManagers: protectedProcedure
    .input(
      z.object({
        member_id: z.string(),
        microsoft_profile_managers_level: z.number()
      })
    )
    .query(async ({ input, ctx }) => {
      const [microsoft_users_read_all, member] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { microsoft_users_read_all: true }
        }),
        ctx.prisma.member.findUnique({
          where: { id: input.member_id },
          select: {
            id: true,
            microsoft_user_id: true,
            microsoft_tenantId: true
          }
        })
      ]);
      if (microsoft_users_read_all?.microsoft_users_read_all != MicrosoftAppStatus.ACTIVATED) return [];
      if (!member) {
        return [];
      }

      if (!member.microsoft_tenantId) {
        return [];
      }

      if (!member.microsoft_user_id) {
        return [];
      }
      const managers = await getMicrosoftProfileManagers(
        member.microsoft_tenantId,
        member.microsoft_user_id,
        input.microsoft_profile_managers_level,
        ctx.prisma,
        ctx.current_member.workspace_id
      );
      return managers;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          is_admin: z.boolean().optional(),
          employment_start_date: z.date().nullable().optional(),
          birthday: z.date().nullable().optional(),
          public_holiday_id: z.string().optional(),
          workspace_id: z.string().optional(),
          member_department_ids: z.array(z.string()).optional(),
          custom_id: z.string().nullable().optional(),
          employment_end_date: z.date().nullable().optional(),
          status: z.nativeEnum(Status).optional(),
          name: z.string().nullable().optional(),
          first_name: z.string().nullable().optional(),
          last_name: z.string().nullable().optional(),
          timezone: z.string().nullable().optional(),
          language: z.string().nullable().optional(),
          date_format: z.string().nullable().optional(),
          time_format: z.nativeEnum(TimeFormat).nullable().optional(),
          week_start: z.string().nullable().optional(),
          display_calendar_weeks: z.boolean().nullable().optional()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      let redisId = await redis.get(ctx.current_member.workspace_id);
      if (!redisId) {
        await redis.set(ctx.current_member.workspace_id, ctx.current_member.workspace_id, 'EX', 5);
      } else {
        while (redisId) {
          await new Promise((r) => setTimeout(r, 500));
          redisId = await redis.get(ctx.current_member.workspace_id);
        }
      }
      const current_member_status = await ctx.prisma.member.findUnique({
        where: { id: ctx.current_member.id },
        select: { status: true }
      });
      if (current_member_status?.status !== 'ACTIVE') {
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you_have_to_be_active')
        });
      }
      if (!ctx.current_member.is_admin) {
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const old_member = await ctx.prisma.member.findUnique({
        where: { id: id },
        select: {
          workspace_id: true,
          public_holiday_id: true,
          id: true,
          is_admin: true,
          name: true,
          firstName: true,
          lastName: true,
          status: true,
          approver_config_department_id: true,
          timezone: true,
          language: true,
          date_format: true,
          time_format: true,
          week_start: true,
          display_calendar_weeks: true
        }
      });

      if (!old_member) {
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('error_workspace_not_found')
        });
      }

      if (ctx.current_member.workspace_id != old_member.workspace_id) {
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit member'
        });
      }

      if (!input.data.employment_end_date) {
        input.data.employment_end_date = null;
      }

      const user_is_manager_in_department = await ctx.prisma.memberDepartment.findMany({
        where: { member_id: id, manager_type: 'Manager' },
        select: {
          department_id: true,
          manager_type: true,
          department: { select: { name: true } }
        }
      });

      const filteredManagerDep = user_is_manager_in_department.filter(
        (department) =>
          department &&
          input.data.member_department_ids != undefined &&
          !input.data.member_department_ids.includes(department.department_id)
      );
      if (filteredManagerDep.length > 0) {
        const mapedDeps = filteredManagerDep.map((dep) => dep.department.name);
        const deps = mapedDeps.join(', ');
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('cant_remove_department') + deps
        });
      }

      const departemnts = await ctx.prisma.department.findMany({
        where: { id: { in: input.data.member_department_ids }, workspace_id: ctx.current_member.workspace_id },
        select: { id: true, members: true }
      });
      if (
        input.data.member_department_ids != undefined &&
        departemnts.length != input.data.member_department_ids.length
      ) {
        redis.del(ctx.current_member.workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('department-ids-not-exists')
        });
      }
      let otherAdmins = null;
      if (old_member.is_admin) {
        otherAdmins = await ctx.prisma.member.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            AND: [{ is_admin: true }, { id: { not: id } }, { status: Status.ACTIVE }]
          }
        });
      }

      if (input.data.status === Status.INACTIVE) {
        if (ctx.current_member.id === input.id) {
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('cannot_inactive_yourself')
          });
        }
        if (old_member.is_admin && (!otherAdmins || otherAdmins.length === 0)) {
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_last_admin_inactive', { employee: ctx.current_member.name })
          });
        }
      }

      if (input.data.status === Status.ARCHIVED) {
        if (ctx.current_member.id === input.id) {
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('cannot_archive_yourself')
          });
        }
        const [isApprover, isManager] = await ctx.prisma.$transaction([
          ctx.prisma.memberApprover.findMany({
            where: { workspace_id: ctx.current_member.workspace_id, approver_member_id: id, NOT: { member_id: id } },
            select: { id: true, member: { select: { name: true } } }
          }),
          ctx.prisma.memberDepartment.findMany({
            where: { workspace_id: ctx.current_member.workspace_id, member_id: id, manager_type: 'Manager' },
            select: { id: true, department: { select: { name: true } } }
          })
        ]);

        if (isApprover.length > 0) {
          let approverOf = isApprover.map((x) => x.member.name).join(', ') + '.';
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_this_user_still_approver', { employee: ctx.current_member.name, approverOf })
          });
        }

        if (isManager.length > 0) {
          let managerOf = isManager.map((x) => x.department.name).join(', ') + '.';
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_this_user_still_manager', { employee: ctx.current_member.name, managerOf })
          });
        }
        if (old_member.is_admin && (!otherAdmins || otherAdmins.length === 0)) {
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_last_admin', { employee: ctx.current_member.name })
          });
        }
        if (!input.data.employment_end_date) {
          redis.del(ctx.current_member.workspace_id);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('error_employee_end_date')
          });
        }
      }
      let approver_config_department_id: string | null = old_member.approver_config_department_id;
      if (
        old_member.approver_config_department_id &&
        !input.data.member_department_ids?.includes(old_member.approver_config_department_id)
      ) {
        approver_config_department_id = input.data.member_department_ids?.[0] ?? null;
        const managers = departemnts[0]?.members.filter((mem) => mem.manager_type === 'Manager');
        if (managers) {
          await ctx.prisma.$transaction([
            ctx.prisma.memberApprover.deleteMany({ where: { member_id: id } }),
            ctx.prisma.memberApprover.createMany({
              data: managers
                .filter((value, index, self) => index === self.findIndex((t) => t.member_id === value.member_id))
                .map((x) => {
                  return {
                    approver_member_id: x.member_id,
                    member_id: id,
                    workspace_id: ctx.current_member.workspace_id,
                    predecessor_approver_member_approver_id: x.predecessor_manager_id
                  };
                })
            })
          ]);
        }
      }

      if (input.data.member_department_ids) {
        await ctx.prisma.$transaction([
          ctx.prisma.memberDepartment.deleteMany({
            where: {
              member_id: id
            }
          }),
          ctx.prisma.memberDepartment.createMany({
            data: input.data.member_department_ids.map((x) => {
              return {
                member_id: id,
                department_id: x,
                workspace_id: ctx.current_member.workspace_id,
                manager_type: user_is_manager_in_department.find((y) => y.department_id == x)?.manager_type ?? 'Member'
              };
            })
          })
        ]);
      }

      const member = await ctx.prisma.member.update({
        where: { id: input.id },
        data: {
          approver_config_department_id,
          employment_end_date: input.data.employment_end_date,
          birthday: input.data.birthday,
          employment_start_date: input.data.employment_start_date,
          public_holiday_id: input.data.public_holiday_id,
          is_admin: input.data.is_admin,
          custom_id: input.data.custom_id,
          status: input.data.status,
          name: input.data.name && input.data.name.trim().length > 0 ? input.data.name : old_member.name,
          firstName:
            input.data.first_name && input.data.first_name.trim().length > 0
              ? input.data.first_name
              : old_member.firstName,
          lastName:
            input.data.last_name && input.data.last_name.trim().length > 0 ? input.data.last_name : old_member.lastName,
          timezone: input.data.timezone ? input.data.timezone : old_member.timezone,
          language: input.data.language ? input.data.language : old_member.language,
          date_format: input.data.date_format ? input.data.date_format : old_member.date_format,
          time_format: input.data.time_format ? input.data.time_format : old_member.time_format,
          week_start: input.data.week_start ? input.data.week_start : old_member.week_start,
          display_calendar_weeks: input.data.display_calendar_weeks
            ? input.data.display_calendar_weeks
            : old_member.display_calendar_weeks
        },
        select: {
          name: true,
          language: true,
          id: true,
          email: true,
          workspace: { select: { name: true } },
          workspace_id: true,
          public_holiday_id: true,
          microsoft_user_id: true,
          microsoft_tenantId: true
        }
      });

      if (old_member.public_holiday_id != input.data.public_holiday_id) {
        await inngest.send({
          // The event name
          name: 'member/update.member.allowance',
          // The event's data
          data: {
            workspaceId: old_member.workspace_id,
            memberId: old_member.id
          }
        });
        await inngest.send({
          name: 'publicHolidayDaySync/create_sync_items_for_member',
          data: {
            member_id: old_member.id
          }
        });
      }
      if (input.data.status === Status.ACTIVE && old_member.status !== Status.ACTIVE && member.email) {
        const getT = ensureAvailabilityOfGetT();
        const t = await getT(member.language, 'mails');
        const logo = ctx.current_member.workspace_id
          ? await ctx.prisma.workspace.findUnique({
              where: { id: ctx.current_member.workspace_id },
              select: { company_logo_url: true, company_logo_ratio_square: true }
            })
          : null;
        const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');

        await sendUniversalTransactionalMail({
          prisma: ctx.prisma,
          workspace_id: ctx.current_member.workspace_id,
          subject: t('You_have_been_invited'),
          params: {
            h1: t('h1_invite'),
            pageTitle: t('pageTitle_invite'),
            firstLine: t('firstLine_invite', { name: member.name }),
            secondLine: t('secondLine_invite', {
              company_name: member.workspace.name
            }),
            thirdLine: t('thirdLine_invite', {
              invitor: ctx.current_member.name ? ctx.current_member.name : ''
            }),
            fourthLine: t('important_to_know', { employee_email: member.email, admin_email: ctx.current_member.email }),
            buttonText: t('buttonText_invite'),
            link: 'https://app.absentify.com/',
            teamsLink: null,
            teamsLinkText: null,
            approvers: null,
            company_image_url: logo?.company_logo_url ? picture : null
          },
          to: {
            email: member.email.toLowerCase(),
            name: member.name ?? member.email
          },
          replyTo: {
            email: ctx.session.user.email?.toLowerCase() + '',
            name: ctx.current_member.name ? ctx.current_member.name : ''
          }
        });
      }
      redis.del(ctx.current_member.workspace_id);

      return member;
    }),
  editProfile: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          language: z.string(),
          email_notif_weekly_absence_summary: z.boolean(),
          email_notif_bday_anniv_remind: z.boolean(),
          email_notifications_updates: z.boolean(),
          email_ical_notifications: z.boolean(),
          date_format: z.string(),
          time_format: z.nativeEnum(TimeFormat),
          week_start: z.string(),
          timezone: z.string(),
          display_calendar_weeks: z.boolean(),
          notifications_receiving_method: z.nativeEnum(NotificationReceivingMethod)
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (ctx.current_member.id != id && !ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      const old_member = await ctx.prisma.member.findUnique({
        where: { id: id },
        select: { workspace_id: true, public_holiday_id: true, id: true }
      });
      if (!old_member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: ctx.t('error_workspace_not_found')
        });
      }

      if (ctx.current_member.workspace_id != old_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit member'
        });
      }

      const member = await ctx.prisma.member.update({
        where: { id: input.id },
        data: {
          ...input.data,
          long_datetime_format:
            input.data.date_format + ' ' + (input.data.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a')
        },
        select: defaultMemberSelect
      });

      inngest.send({
        name: 'brevo/create_or_update_contact',
        data: { member_id: member.id }
      });

      return member;
    }),
  updateApprover: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          approval_process: z.nativeEnum(ApprovalProcess),
          use_microsoft_profile_managers_for_approvers: z.boolean(),
          microsoft_profile_managers_level: z.number().nullable(),
          use_department_settings_for_approvers: z.boolean(),
          approver_department_id: z.string().nullable(),
          approver_member: z.array(
            z.object({
              member_id: z.string(),
              predecessor_manager_id: z.string().nullable()
            })
          )
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const member = await updateApprovers(input.id, input.data, ctx);
      member.allowances = member.allowances.filter((c) => {
        const config = member.allowance_type_configurtaions.find((zz) => zz.allowance_type_id === c.allowance_type.id);
        if (config?.disabled) return false;
        return true;
      });
      return member;
    }),
  checkAndUpdateApprover: protectedProcedure
    .input(
      z.object({
        member_id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const [microsoft_users_read_all, member] = await ctx.prisma.$transaction([
        ctx.prisma.workspace.findUnique({
          where: { id: ctx.current_member.workspace_id },
          select: { microsoft_users_read_all: true }
        }),
        ctx.prisma.member.findUnique({
          where: { id: input.member_id },
          select: {
            id: true,
            approver_config_microsoft_profile_manager_sync: true,
            approval_process: true,
            has_approvers: { select: { approver_member_id: true } },
            microsoft_user_id: true,
            microsoft_tenantId: true
          }
        })
      ]);
      if (microsoft_users_read_all?.microsoft_users_read_all != MicrosoftAppStatus.ACTIVATED) return false;
      if (!member) {
        return false;
      }

      if (!member.microsoft_tenantId) {
        return false;
      }

      if (!member.microsoft_user_id) {
        return false;
      }
      if (!member.approver_config_microsoft_profile_manager_sync) return false;
      const managers = await getMicrosoftProfileManagers(
        member.microsoft_tenantId,
        member.microsoft_user_id,
        member.approver_config_microsoft_profile_manager_sync,
        ctx.prisma,
        ctx.current_member.workspace_id
      );

      let needUpdate = false;
      if (managers.length != member.has_approvers.length) {
        needUpdate = true;
      }
      if (
        managers
          .map((x) => x.member_id)
          .sort()
          .join(',') !=
        member.has_approvers
          .map((x) => x.approver_member_id)
          .sort()
          .join(',')
      ) {
        needUpdate = true;
      }

      if (needUpdate) {
        await updateApprovers(
          member.id,
          {
            approval_process: member.approval_process,
            approver_department_id: null,
            approver_member: [],
            microsoft_profile_managers_level: member.approver_config_microsoft_profile_manager_sync,
            use_department_settings_for_approvers: false,
            use_microsoft_profile_managers_for_approvers: true
          },
          ctx
        );
        return true;
      }
      return false;
    }),

  mailHistory: protectedProcedure
    .input(
      z.object({
        member_id: z.string(),
        limit: z.number().min(1).max(50).optional(),
        page: z.number().optional()
      })
    )
    .query(async ({ input, ctx }) => {
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.member_id },
        select: { id: true, email: true }
      });
      if (!member || !member.email) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found'
        });
      }

      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to see mail history'
        });
      }
      if (!input.limit) input.limit = 50;
      const mailHistory = await ctx.prisma.emailHitsoryRecipientStatus.findMany({
        where: { recipient: member.email },
        orderBy: { emailHistory: { sentAt: 'desc' } },
        take: input.limit,
        skip: input.page ? (input.page - 1) * input.limit : 0,
        select: {
          recipient: true,
          deliveryStatus: true,
          deliveryDetails: true,
          deliveryAttemptTimestamp: true,
          emailHistory: {
            select: {
              subject: true,
              sentAt: true
            }
          }
        }
      });

      return mailHistory;
    }),
  archive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          status: z.nativeEnum(Status),
          workspace_id: z.string(),
          employment_end_date: z.date(),
          automatic_change: z.boolean().optional()
        })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      const { workspace_id } = data;
      let redisId = await redis.get(workspace_id);
      if (!redisId) {
        await redis.set(workspace_id, workspace_id, 'EX', 5);
      } else {
        while (redisId) {
          await new Promise((r) => setTimeout(r, 500));
          redisId = await redis.get(workspace_id);
        }
      }
      const current_member_status = await ctx.prisma.member.findUnique({
        where: { id: ctx.current_member.id },
        select: { status: true }
      });
      if (current_member_status?.status !== 'ACTIVE') {
        redis.del(workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you_have_to_be_active')
        });
      }
      if (!ctx.current_member.is_admin) {
        redis.del(workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }
      if (ctx.current_member.workspace_id != data.workspace_id) {
        redis.del(workspace_id);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You have to be admin to edit member'
        });
      }
      const [isApprover, isManager, old_member] = await ctx.prisma.$transaction([
        ctx.prisma.memberApprover.findMany({
          where: { workspace_id: ctx.current_member.workspace_id, approver_member_id: id, NOT: { member_id: id } },
          select: { id: true, member: { select: { name: true } } }
        }),
        ctx.prisma.memberDepartment.findMany({
          where: { workspace_id: ctx.current_member.workspace_id, member_id: id, manager_type: 'Manager' },
          select: { id: true, department: { select: { name: true } } }
        }),
        ctx.prisma.member.findUnique({
          where: { id: id },
          select: { is_admin: true }
        })
      ]);

      if (isManager.length > 0) {
        let managerOf = isManager.map((x) => x.department.name).join('</li><li>-');
        redis.del(workspace_id);
        if (input.data.automatic_change) {
          await inngest.send({
            name: 'email/failed_automatic_archivation',
            data: {
              failed_member_id: id,
              workspace_id,
              reason: ctx.t('error_this_user_still_manager', {
                employee: ctx.current_member.name,
                managerOf: '<br /><br /><ul> <li>-' + managerOf + '</li></ul><br />'
              })
            }
          });
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_this_user_still_manager', {
            employee: ctx.current_member.name,
            managerOf: '<br /><br /><ul> <li>-' + managerOf + '</li></ul><br />'
          })
        });
      }

      if (isApprover.length > 0) {
        let approverOf = isApprover.map((x) => x.member.name).join('</li><li>-');
        redis.del(workspace_id);
        if (input.data.automatic_change) {
          await inngest.send({
            name: 'email/failed_automatic_archivation',
            data: {
              failed_member_id: id,
              workspace_id,
              reason: ctx.t('error_this_user_still_approver', {
                employee: ctx.current_member.name,
                approverOf: '<br /><br /><ul> <li>-' + approverOf + '</li></ul><br />'
              })
            }
          });
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_this_user_still_approver', {
            employee: ctx.current_member.name,
            approverOf: '<br /><br /><ul> <li>-' + approverOf + '</li></ul><br />'
          })
        });
      }

      let otherAdmins = null;

      if (old_member?.is_admin) {
        otherAdmins = await ctx.prisma.member.findMany({
          where: {
            workspace_id: ctx.current_member.workspace_id,
            AND: [{ is_admin: true }, { id: { not: id } }, { status: Status.ACTIVE }]
          }
        });
      }

      if (input.data.status === Status.INACTIVE) {
        if (ctx.current_member.id === input.id) {
          redis.del(workspace_id);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('cannot_inactive_yourself')
          });
        }
        if (old_member?.is_admin && (!otherAdmins || otherAdmins.length === 0)) {
          redis.del(workspace_id);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_last_admin_inactive', { employee: ctx.current_member.name })
          });
        }
      }
      if (input.data.status === Status.ARCHIVED) {
        if (ctx.current_member.id === input.id) {
          redis.del(workspace_id);
          if (input.data.automatic_change) {
            await inngest.send({
              name: 'email/failed_automatic_archivation',
              data: {
                failed_member_id: id,
                workspace_id,
                reason: ctx.t('cannot_archive_yourself')
              }
            });
          }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ctx.t('cannot_archive_yourself')
          });
        }
        if (old_member?.is_admin && (!otherAdmins || otherAdmins.length === 0)) {
          redis.del(workspace_id);
          if (input.data.automatic_change) {
            await inngest.send({
              name: 'email/failed_automatic_archivation',
              data: {
                failed_member_id: id,
                workspace_id,
                reason: ctx.t('error_last_admin', { employee: ctx.current_member.name })
              }
            });
          }
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.t('error_last_admin', { employee: ctx.current_member.name })
          });
        }
      }

      const member = await ctx.prisma.member.update({
        where: { id: id },
        data: {
          status: data.status,
          employment_end_date: data.employment_end_date
        },
        select: defaultMemberSelect
      });
      redis.del(workspace_id);
      member.allowances = member.allowances.filter((c) => {
        const config = member.allowance_type_configurtaions.find((zz) => zz.allowance_type_id === c.allowance_type.id);
        if (config?.disabled) return false;
        return true;
      });
      return member;
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      if (!ctx.current_member.is_admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      const requestApprover = await ctx.prisma.requestApprover.findMany({
        where: {
          approver_member_id: id,
          request_detail: {
            status: 'PENDING'
          }
        }
      });
      if (requestApprover.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ctx.t('not_approved_requests_before_deletion')
        });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id },
        select: {
          workspace_id: true,
          brevo_contact_id: true,
          has_cdn_image: true,
          microsoft_user_id: true,
          email: true
        }
      });

      if (member?.workspace_id != ctx.current_member.workspace_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_you_have_to_be_admin')
        });
      }

      if (member?.has_cdn_image && member.microsoft_user_id) {
        try {
          const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_URL + '');
          const containerClient = blobServiceClient.getContainerClient('');
          const blobNames = getFileNames(member.microsoft_user_id);
          for (const name of blobNames) {
            const blockBlobClient = containerClient.getBlockBlobClient(name);
            await blockBlobClient.delete();
            console.log('deleted', name);
          }
        } catch (e) {
          Sentry.captureException(e);
        }
      }

      inngest.send({
        name: 'brevo/delete_contact',
        data: { brevo_contact_id_or_email: member.brevo_contact_id + '' || member.email || '' }
      });

      await ctx.prisma.memberApprover.updateMany({
        where: { approver_member_id: id },
        data: { approver_member_id: ctx.current_member.id }
      });

      await ctx.prisma.member.delete({ where: { id: id } });

      await updateSmiirl(ctx.prisma);

      return {
        id
      };
    }),
  change_timeline_department: protectedProcedure
    .input(
      z.object({
        department_id: z.string().nullable()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await ctx.prisma.member.update({
        where: { id: ctx.current_member.id },
        data: { default_timeline_department_id: input.department_id },
        select: { id: true }
      });
      return member;
    }),
  send_admin_mail_from_inactive_user: protectedProcedure.mutation(async ({ ctx }) => {
    await inngest.send({
      name: 'email/inactive_member.tried_to_access_absentify',
      data: {
        inactive_member_id: ctx.current_member.id,
        workspace_id: ctx.current_member.workspace_id
      }
    });
    return { message: 'ok' };
  })
});

const updateApproverZod = z.object({
  approval_process: z.nativeEnum(ApprovalProcess),
  use_microsoft_profile_managers_for_approvers: z.boolean(),
  microsoft_profile_managers_level: z.number().nullable(),
  use_department_settings_for_approvers: z.boolean(),
  approver_department_id: z.string().nullable(),
  approver_member: z.array(
    z.object({
      member_id: z.string(),
      predecessor_manager_id: z.string().nullable()
    })
  )
});

async function getAllMembers(
  input: {
    filter: {
      search?: string | undefined;
      status?: ('INACTIVE' | 'ACTIVE' | 'ARCHIVED')[] | undefined;
      department_ids?: string[] | undefined;
      ids?: string[] | undefined;
    };
    limit: number;
    page: number;
  },
  ctx: {
    current_member: { workspace_id: string; id: string; is_admin: boolean };

    t: Translate;
    prisma: PrismaClient;
  }
) {
  const { page, limit } = input;
  let [workspace, departmentIdsOfUser] = await ctx.prisma.$transaction([
    ctx.prisma.workspace.findUnique({
      where: { id: ctx.current_member.workspace_id },
      select: { privacy_show_otherdepartments: true }
    }),
    ctx.prisma.memberDepartment.findMany({
      where: { member_id: ctx.current_member.id },
      select: { department_id: true, manager_type: true }
    })
  ]);
  if (!workspace) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No workspace found'
    });
  }

  let w: Prisma.MemberWhereInput = {
    workspace_id: ctx.current_member.workspace_id,
    departments: { some: { department_id: { in: departmentIdsOfUser.map((x) => x.department_id) } } }
  };

  if (workspace.privacy_show_otherdepartments || ctx.current_member.is_admin) {
    w = { workspace_id: ctx.current_member.workspace_id };
  }

  if (input.filter.ids) {
    w = { ...w, id: { in: input.filter.ids } };
  }
  if (input.filter.status) {
    w = { ...w, status: { in: input.filter.status } };
  }
  if (input.filter.search) {
    w = {
      ...w,
      OR: [
        { name: { contains: input.filter.search } },
        { email: { contains: input.filter.search } },
        { custom_id: { contains: input.filter.search } }
      ]
    };
  }

  if (input.filter.department_ids && input.filter.department_ids.length > 0) {
    w = {
      ...w,
      departments: { some: { department_id: { in: input.filter.department_ids } } }
    };
  }

  let [count, members] = await ctx.prisma.$transaction([
    ctx.prisma.member.count({
      where: w
    }),
    ctx.prisma.member.findMany({
      take: limit,
      skip: page ? (page - 1) * limit : 0,
      select: defaultMemberSelect,
      where: w,
      orderBy: { name: 'asc' }
    })
  ]);

  if (workspace.privacy_show_otherdepartments || ctx.current_member.is_admin) {
  } else {
    for (let index = 0; index < members.length; index++) {
      const member = members[index];
      if (!member) continue;
      if (
        !member.departments.find((y) =>
          departmentIdsOfUser.find((z) => z.department_id == y.department?.id && z.manager_type != 'Member')
        )
      )
        member.birthday ? member.birthday.setFullYear(0) : null;
    }
  }
  members.map((x) => {
    if (ctx.current_member.is_admin) return x;
    if (x.id === ctx.current_member.id) return x;
    x.departments.forEach((y) => {
      let departmentExists = departmentIdsOfUser.find((z) => {
        return z.department_id === y.department?.id && z.manager_type === 'Manager';
      });

      if (!departmentExists) {
        x.birthday ? x.birthday.setFullYear(0) : null;
      }
    });

    if (x.has_approvers.find((y) => y.approver_member_id == ctx.current_member.id)) return x;

    if (
      x.departments.find((y) =>
        departmentIdsOfUser.find((z) => z.department_id == y.department?.id && z.manager_type != 'Member')
      )
    )
      return x;
    x.allowances = [];
    return x;
  });

  members = members.map((x) => {
    x.allowances = x.allowances.filter((c) => {
      const config = x.allowance_type_configurtaions.find((zz) => zz.allowance_type_id === c.allowance_type.id);
      if (config?.disabled) return false;
      return true;
    });

    return x;
  });

  return {
    members, // Die Mitgliederdaten der aktuellen Seite
    count, // Gesamtanzahl der Einträge
    hasNextPage: page * limit < count, // Gibt true zurück, wenn eine nächste Seite existiert
    hasPreviousPage: page > 1, // Gibt true zurück, wenn eine vorherige Seite existiert
    currentPage: page, // Die aktuelle Seitennummer
    totalPages: Math.ceil(count / limit)
  };
}

export async function updateApprovers(
  member_id: string,
  data: z.infer<typeof updateApproverZod>,
  ctx: {
    current_member: { workspace_id: string };

    t: Translate;
    prisma: PrismaClient;
  }
) {
  if (data.use_microsoft_profile_managers_for_approvers && !data.microsoft_profile_managers_level) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ctx.t('you-have-to-select-a-level-if-you-want-to-use-microsoft-profile-managers-for-approvers')
    });
  }

  const workspace = await ctx.prisma.workspace.findUnique({
    where: { id: ctx.current_member.workspace_id },
    select: defaultWorkspaceSelect
  });
  if (!workspace) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ctx.t('you-have-to-be-admin-to-add-department')
    });
  }
  const subscription = summarizeSubscriptions(workspace.subscriptions);

  if (!subscription.addons.multi_manager && data.approver_member.length > 1 && !(subscription.enterprise > 0)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ctx.t('manager_addon_required')
    });
  }
  if (!subscription.addons.multi_manager && !(subscription.enterprise > 0)) {
    data.approval_process = ApprovalProcess.Linear_all_have_to_agree;
  }

  if (
    !subscription.addons.multi_manager &&
    !(subscription.enterprise > 0) &&
    data.use_microsoft_profile_managers_for_approvers
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ctx.t('manager_addon_required')
    });
  }

  if (data.use_microsoft_profile_managers_for_approvers) {
    const requester_member = await ctx.prisma.member.findUnique({
      where: { id: member_id },
      select: {
        departments: { select: { department_id: true } },
        microsoft_user_id: true,
        microsoft_tenantId: true
      }
    });
    if (!requester_member?.microsoft_user_id) {
      setDefaultDepartmentFallback(requester_member);
    } else if (!requester_member?.microsoft_tenantId) {
      setDefaultDepartmentFallback(requester_member);
    } else if (!data.microsoft_profile_managers_level) {
      setDefaultDepartmentFallback(requester_member);
    } else {
      const managers = await getMicrosoftProfileManagers(
        requester_member.microsoft_tenantId,
        requester_member.microsoft_user_id,
        data.microsoft_profile_managers_level,
        ctx.prisma,
        ctx.current_member.workspace_id
      );

      if (managers.length == 0) {
        setDefaultDepartmentFallback(requester_member);
      } else {
        data.approver_member = managers;
        data.approver_department_id = null;
        data.use_microsoft_profile_managers_for_approvers = true;
      }
    }
  }
  if (!data.use_department_settings_for_approvers) {
    if (data.approver_member.length == 0) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_manager_email_missing')
      });
    }
    if (!(data.approver_member.length === 1 && data.approver_member[0]?.member_id === member_id)) {
      const managerEmails = await ctx.prisma.member.findMany({
        where: { id: { in: data.approver_member.map((y) => y.member_id) } },
        select: { email: true }
      });

      const hasMissingEmail = managerEmails.some((manager) => manager.email == null);

      if (hasMissingEmail) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('error_manager_email_missing')
        });
      }
    }
  }
  if (data.use_department_settings_for_approvers) {
    if (!data.approver_department_id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ctx.t('error_manager_department_missing')
      });
    }

    const departmentManagers = await ctx.prisma.memberDepartment.findMany({
      where: {
        department_id: data.approver_department_id,
        manager_type: 'Manager'
      },
      select: {
        member_id: true,
        manager_type: true,
        predecessor_manager_id: true
      }
    });
    const department = await ctx.prisma.department.findUnique({
      where: { id: data.approver_department_id },
      select: { approval_process: true }
    });
    if (department) data.approval_process = department.approval_process;

    await ctx.prisma.$transaction([
      ctx.prisma.memberApprover.deleteMany({ where: { member_id: member_id } }),
      ctx.prisma.memberApprover.createMany({
        data: departmentManagers
          .filter((value, index, self) => index === self.findIndex((t) => t.member_id === value.member_id))
          .map((x) => {
            return {
              approver_member_id: x.member_id,
              member_id: member_id,
              workspace_id: ctx.current_member.workspace_id,
              predecessor_approver_member_approver_id: x.predecessor_manager_id
            };
          })
      })
    ]);
  } else {
    if (data.approver_member.length > 0) {
      if (!workspace.privacy_show_otherdepartments) {
        await checkApproverAreInSameDepartmentAsMember(ctx.prisma, member_id, { data: data, id: member_id }, ctx.t);
      }
      await ctx.prisma.$transaction([
        ctx.prisma.memberApprover.deleteMany({
          where: { member_id: member_id }
        }),
        ctx.prisma.memberApprover.createMany({
          data: data.approver_member
            .filter((value, index, self) => index === self.findIndex((t) => t.member_id === value.member_id))
            .map((z) => {
              return {
                approver_member_id: z.member_id,
                member_id: member_id,
                workspace_id: ctx.current_member.workspace_id,
                predecessor_approver_member_approver_id: z.predecessor_manager_id
              };
            })
        })
      ]);
    }
  }
  const member = await ctx.prisma.member.update({
    where: { id: member_id },
    data: {
      approval_process: data.approval_process,
      approver_config_department_id: data.use_microsoft_profile_managers_for_approvers
        ? null
        : data.approver_department_id,
      approver_config_microsoft_profile_manager_sync: data.use_microsoft_profile_managers_for_approvers
        ? data.microsoft_profile_managers_level
        : null
    },
    select: defaultMemberSelect
  });
  return member;

  function setDefaultDepartmentFallback(
    requester_member: {
      microsoft_tenantId: string | null;
      microsoft_user_id: string | null;
      departments: { department_id: string }[];
    } | null
  ) {
    data.use_department_settings_for_approvers = true;
    data.use_microsoft_profile_managers_for_approvers = false;
    if (requester_member?.departments[0]) {
      if (!requester_member?.departments[0].department_id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: ctx.t('you-have-to-be-in-a-department-to-use-this-feature')
        });
      }
      data.approver_department_id = requester_member?.departments[0].department_id;
    }
  }
}

export async function getMicrosoftProfileManagers(
  microsoft_tenantId: string,
  microsoft_user_id: string,
  microsoft_profile_managers_level: number,
  prisma: PrismaClient,
  workspace_id: string
) {
  const token = await getMicrosoftUsersAccessToken(microsoft_tenantId);
  const managers = await fetch(
    'https://graph.microsoft.com/v1.0/users/' +
      microsoft_user_id +
      '/?$expand=manager($levels=' +
      microsoft_profile_managers_level +
      ';$select=id,displayName)&$select=id,displayName',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ConsistencyLevel: 'eventual'
      }
    }
  );

  if (managers.ok) {
    const x = await managers.json();
    if (x.manager) {
      const managersList: {
        id: string;
        displayName: string;
      }[] = [];
      managersList.push({
        id: x.manager.id,
        displayName: x.manager.displayName
      });
      let currentManager = x.manager;
      while (currentManager.manager) {
        managersList.push({
          id: currentManager.manager.id,
          displayName: currentManager.manager.displayName
        });
        currentManager = currentManager.manager;
      }
      if (managersList.length == 0) {
        return [];
      } else {
        let manager = await prisma.member.findMany({
          where: { microsoft_user_id: { in: managersList.map((x) => x.id) } },
          select: {
            email: true,
            id: true,
            status: true,
            workspace_id: true
          }
        });
        manager = manager.filter((x) => x.status !== Status.ARCHIVED);
        manager = manager.filter((x) => x.workspace_id == workspace_id);
        if (manager.length == 0) {
          return [];
        } else if (manager.find((z) => z.email == null)) {
          return [];
        } else {
          const approver_member: {
            member_id: string;
            predecessor_manager_id: string | null;
          }[] = [];
          if (manager.length != 0) {
            for (let index = 0; index < manager.length; index++) {
              const mana = manager[index];
              if (mana) {
                if (approver_member.length == 0)
                  approver_member.push({
                    member_id: mana.id,
                    predecessor_manager_id: null
                  });
                else {
                  const last = approver_member[approver_member.length - 1];
                  if (last)
                    approver_member.push({
                      member_id: mana.id,
                      predecessor_manager_id: last.member_id
                    });
                }
              }
            }
          }
          if (manager.length == 0) {
            return [];
          }
          return approver_member;
        }
      }
    }
  }

  return [];
}

async function checkApproverAreInSameDepartmentAsMember(
  prisma: PrismaClient,
  id: string,
  input: {
    id: string;
    data: {
      approval_process:
        | 'Linear_all_have_to_agree'
        | 'Linear_one_has_to_agree'
        | 'Parallel_all_have_to_agree'
        | 'Parallel_one_has_to_agree';
      approver_member: {
        member_id: string;
        predecessor_manager_id: string | null;
      }[];
      use_department_settings_for_approvers: boolean;
      approver_department_id: string | null;
    };
  },
  t: Translate
) {
  const memberDepartments = await prisma.memberDepartment.findMany({
    where: { member_id: id },
    select: { department_id: true }
  });
  const approverDepartments = await prisma.memberDepartment.findMany({
    where: {
      member_id: { in: input.data.approver_member.map((y) => y.member_id) }
    },
    select: { department_id: true, member_id: true }
  });

  const foundMemberIds: string[] = [];
  for (let i2 = 0; i2 < approverDepartments.length; i2++) {
    const approverDepartment = approverDepartments[i2];
    if (approverDepartment && foundMemberIds.includes(approverDepartment.member_id)) continue;
    if (approverDepartment && memberDepartments.find((x) => x.department_id == approverDepartment.department_id)) {
      foundMemberIds.push(approverDepartment.member_id);
    }
  }

  for (let i3 = 0; i3 < approverDepartments.length; i3++) {
    const dep = approverDepartments[i3];
    if (dep && !foundMemberIds.includes(dep.member_id)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: t('managers-must-be-in-the-same-department-as-the-member')
      });
    }
  }
}
