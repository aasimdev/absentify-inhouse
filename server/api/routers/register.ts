import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, registerProcedure, getFingerprint } from '../trpc';
import { ensureAvailabilityOfGetT } from 'lib/monkey-patches';
import { AllowanceUnit, DisplayNameFormat, LeaveUnit, OutlookShowAs, Prisma, Status, TimeFormat } from '@prisma/client';
import { createOrUpdateSendInBlueContact, sendUniversalTransactionalMail } from 'lib/sendInBlueContactApi';
import { countries } from 'lib/countries';
import { createPicture } from './member';
import { addDays, addYears } from 'date-fns';
import { mainLink } from '~/helper/mainLink';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import { inngest } from '~/inngest/inngest_client';
import { updateSmiirl } from '~/helper/smiirl';
import { createPublicHolidayForCountryCode } from './public_holiday';
export const registerRouter = createTRPCRouter({
  findWorkspaceByMicrosoftTenantId: registerProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member?.microsoft_tenantId) return null;
    const currentMember = await ctx.prisma.member.findFirst({
      select: { workspace_id: true, id: true },
      where: {
        microsoft_tenantId: ctx.current_member.microsoft_tenantId + ''
      }
    });
    if (!currentMember) return null;
    const workspace = await ctx.prisma.workspace.findUnique({
      select: { name: true, id: true },
      where: { id: currentMember.workspace_id }
    });
    if (!workspace) {
      return null;
    }
    return workspace;
  }),
  sendInvationReminder: registerProcedure
    .input(
      z.object({
        workspace_id: z.string(),
        user_name: z.string(),
        email: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [admin_members] = await ctx.prisma.$transaction([
        ctx.prisma.member.findMany({
          select: { id: true, email: true, language: true, name: true },
          where: {
            workspace_id: input.workspace_id,
            is_admin: true,
            microsoft_user_id: { not: null }
          }
        })
      ]);

      if (!admin_members) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'no_admin_found'
        });
      }

      if (admin_members.length == 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'no_admin_found'
        });
      }

      for (let index = 0; index < admin_members.length; index++) {
        const admin_user = admin_members[index];

        if (admin_user && admin_user.email) {
          const getT = ensureAvailabilityOfGetT();
          const t = await getT(admin_user.language, 'mails');
          const logo = ctx.current_member?.workspace_id
            ? await ctx.prisma.workspace.findUnique({
                where: { id: ctx.current_member?.workspace_id },
                select: { company_logo_url: true, company_logo_ratio_square: true }
              })
            : null;
          const picture = createPicture(logo?.company_logo_url, logo?.company_logo_ratio_square ? '256x256' : '400x80');
          await sendUniversalTransactionalMail({
            prisma: ctx.prisma,
            workspace_id: input.workspace_id,
            subject: t('absentify_access_request'),
            params: {
              h1: t('h1_access_request'),
              pageTitle: t('pageTitle_access_request'),
              firstLine: t('firstLine_access_request', {
                administrator_full_name: admin_user.name + ''
              }),
              secondLine: t('secondLine_access_request', {
                new_user_name: input.user_name,
                new_user_email: input.email
              }),
              thirdLine: '',
              fourthLine: '',
              buttonText: t('buttonText_access_request'),
              link: `${mainLink}/settings/organisation/users?user_name=${input.user_name}&user_email=${input.email}`,
              teamsLink: null,
              teamsLinkText: null,
              approvers: null,
              company_image_url: logo?.company_logo_url ? picture : null
            },
            to: {
              email: admin_user.email.toLowerCase(),
              name: admin_user.name + ''
            },
            replyTo: {
              email: input.email,
              name: input.user_name
            }
          });
        }
      }
    }),
  getCountry: registerProcedure.query(async ({ ctx }) => {
    let ip = getFingerprint(ctx.req);
    if (ip == '127.0.0.1') ip = '2a03:80:140:e401:b9d4:af4b:216f:60ee';
    if (ip == '::1') ip = '2a03:80:140:e401:b9d4:af4b:216f:60ee';
    let ipData = null;
    try {
      const i = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=407d89a261f042fb9e5f87b58220a212&ip=${ip}`);
      if (i.status == 200) {
        ipData = { ...i.data };
      }
    } catch (_e: any) {
      console.log('error:', _e.message);
      Sentry.captureException(_e);
    }
    return ipData;
  }),
  checkIfInvitationExists: registerProcedure.query(async ({ ctx }) => {
    const invitation = await ctx.prisma.member.findFirst({
      where: {
        email: ctx.session.user.email
      },
      select: { id: true }
    });

    return invitation != null;
  }),
  register: registerProcedure
    .input(
      z.object({
        name: z.string(),
        language: z.string(),
        country_code: z.string(),
        county_code: z.string().nullable(),
        global_date_format: z.string(),
        global_time_format: z.nativeEnum(TimeFormat),
        global_week_start: z.string(),
        global_timezone: z.string(),
        fiscal_year_start_month: z.number(),
        referrer: z.string().nullable(),
        gclid: z.string().nullable()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(input.language, 'backend');

      const workspace = await ctx.prisma.workspace.create({
        data: {
          name: input.name,
          privacy_show_calendarview: true,
          privacy_show_leavetypes: true,
          privacy_show_absences_in_past: true,
          referrer: input.referrer,
          gclid: input.gclid,
          privacy_show_otherdepartments: true,
          global_date_format: input.global_date_format,
          global_time_format: input.global_time_format,
          global_week_start: input.global_week_start,
          global_language: input.language,
          global_timezone: input.global_timezone,
          global_name_format: DisplayNameFormat.Microsoft_DisplayName,
          fiscal_year_start_month: input.fiscal_year_start_month
        },
        select: { id: true, fiscal_year_start_month: true }
      });

      const allowanceType = await ctx.prisma.allowanceType.create({
        data: {
          workspace_id: workspace.id,
          name: t('Vacation_Allowance'),
          allowance_unit: AllowanceUnit.days,
          active: true,
          ignore_allowance_limit: false,
          max_carry_forward: 5
        },
        select: { id: true }
      });

      const leave_Types: Prisma.LeaveTypeCreateManyInput[] = [
        {
          name: t('Holiday'),
          color: '#fcb900',
          icon: 'Sun',
          take_from_allowance: true,
          needs_approval: true,
          maximum_absent: true,
          workspace_id: workspace.id,
          deleted: false,
          leave_unit: LeaveUnit.half_days,
          privacy_hide_leavetype: false,
          outlook_synchronization_show_as: OutlookShowAs.oof,
          position: 0,
          allowance_type_id: allowanceType.id
        },
        {
          name: t('Unpaid_Leave'),
          color: '#00d084',
          icon: 'Coffee',
          take_from_allowance: false,
          needs_approval: true,
          maximum_absent: true,
          workspace_id: workspace.id,
          deleted: false,
          leave_unit: LeaveUnit.half_days,
          privacy_hide_leavetype: false,
          outlook_synchronization_show_as: OutlookShowAs.oof,
          position: 1
        },
        {
          name: t('Sick_Leave'),
          color: '#eb144c',
          icon: 'Frown',
          take_from_allowance: false,
          needs_approval: true,
          maximum_absent: true,
          workspace_id: workspace.id,
          deleted: false,
          leave_unit: LeaveUnit.half_days,
          privacy_hide_leavetype: false,
          outlook_synchronization_show_as: OutlookShowAs.oof,
          outlook_synchronization_subject: t('Absent'),
          position: 2
        },
        {
          name: t('Maternity'),
          color: '#8ed1fc',
          icon: 'NoIcon',
          take_from_allowance: false,
          needs_approval: true,
          maximum_absent: true,
          workspace_id: workspace.id,
          deleted: false,
          leave_unit: LeaveUnit.half_days,
          privacy_hide_leavetype: false,
          outlook_synchronization_show_as: OutlookShowAs.oof,
          position: 3
        },
        {
          name: t('Paternity'),
          color: '#0693e3',
          icon: 'NoIcon',
          take_from_allowance: false,
          needs_approval: true,
          maximum_absent: true,
          workspace_id: workspace.id,
          deleted: false,
          leave_unit: LeaveUnit.half_days,
          privacy_hide_leavetype: false,
          outlook_synchronization_show_as: OutlookShowAs.oof,
          position: 4
        }
      ];

      const [workspaceSchedule, leaveTypes, department, publicHoliday] = await ctx.prisma.$transaction([
        ctx.prisma.workspaceSchedule.create({
          data: {
            friday_am_enabled: true,
            friday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            friday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            friday_pm_enabled: true,
            friday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            friday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            monday_am_enabled: true,
            monday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            monday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            monday_pm_enabled: true,
            monday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            monday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            saturday_am_enabled: false,
            saturday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            saturday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            saturday_pm_enabled: false,
            saturday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            saturday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            sunday_am_enabled: false,
            sunday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            sunday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            sunday_pm_enabled: false,
            sunday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            sunday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            thursday_am_enabled: true,
            thursday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            thursday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            thursday_pm_enabled: true,
            thursday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            thursday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            tuesday_am_enabled: true,
            tuesday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            tuesday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            tuesday_pm_enabled: true,
            tuesday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            tuesday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            wednesday_am_enabled: true,
            wednesday_am_end: new Date(Date.UTC(1970, 1, 1, 12, 0, 0)),
            wednesday_am_start: new Date(Date.UTC(1970, 1, 1, 8, 0, 0)),
            wednesday_pm_enabled: true,
            wednesday_pm_end: new Date(Date.UTC(1970, 1, 1, 17, 0, 0)),
            wednesday_pm_start: new Date(Date.UTC(1970, 1, 1, 13, 0, 0)),
            workspace_id: workspace.id
          },
          select: { id: true }
        }),
        ctx.prisma.leaveType.createMany({ data: leave_Types }),

        ctx.prisma.department.create({
          data: {
            name: t('sample_department'),
            workspace_id: workspace.id,
            default_department_allowances: JSON.stringify([{ id: allowanceType.id, value: 20 }]),
            maximum_absent: 2
          },
          select: { id: true }
        }),
        ctx.prisma.publicHoliday.create({
          data: {
            name:
              countries.find((x) => x.code == input.country_code)?.name +
              (input.county_code
                ? ' - ' +
                  countries
                    .find((x) => x.code == input.country_code)
                    ?.subdivisions?.find((x) => x.code == input.county_code)?.name
                : ''),
            country_code: input.country_code,
            county_code: input.county_code,
            workspace_id: workspace.id
          },
          select: { id: true }
        })
      ]);

      try {
        await createPublicHolidayForCountryCode({
          public_holiday_id: publicHoliday.id,
          workspace_id: workspace.id,
          years: [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1],
          country_code: input.country_code,
          county_code: input.county_code,
          ctx: ctx
        });

        const member = await ctx.prisma.member.create({
          data: {
            workspace_id: workspace.id,
            is_admin: true,
            public_holiday_id: publicHoliday.id,
            name: ctx.session.user.name,
            email: ctx.session.user.email?.toLowerCase(),
            approver_config_department_id: department.id,
            date_format: input.global_date_format,
            time_format: input.global_time_format,
            long_datetime_format:
              input.global_date_format + ' ' + (input.global_time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'),
            week_start: input.global_week_start,
            language: input.language,
            timezone: input.global_timezone,
            microsoft_user_id: ctx.session.user.microsoft_user_id,
            microsoft_tenantId: ctx.session.user.microsoft_tenant_id,
            status: Status.ACTIVE
          },
          select: {
            id: true,
            sendinblue_contact_id: true,
            language: true,
            email_notifications_updates: true,
            firstName: true,
            lastName: true,
            is_admin: true
          }
        });

        await updateSmiirl(ctx.prisma);

        await createOrUpdateSendInBlueContact(member, ctx.prisma);

        if (new Date(Date.UTC(new Date().getFullYear(), workspace.fiscal_year_start_month, 1)) > new Date()) {
          await ctx.prisma.memberAllowance.create({
            data: {
              workspace_id: workspace.id,
              allowance: 30,
              year: new Date().getFullYear() - 1,
              member_id: member.id,
              remaining: 30,
              brought_forward: 0,
              compensatory_time_off: 0,
              leave_types_stats: {},
              taken: 0,
              allowance_type_id: allowanceType.id,
              start: new Date(Date.UTC(new Date().getFullYear() - 1, workspace.fiscal_year_start_month, 1)),
              end: addDays(
                addYears(new Date(Date.UTC(new Date().getFullYear() - 1, workspace.fiscal_year_start_month, 1)), 1),
                -1
              )
            }
          });
        }

        await ctx.prisma.$transaction([
          ctx.prisma.memberAllowance.createMany({
            data: [
              {
                workspace_id: workspace.id,
                allowance: 30,
                year: new Date().getFullYear(),
                member_id: member.id,
                remaining: 30,
                brought_forward: 0,
                compensatory_time_off: 0,
                taken: 0,
                leave_types_stats: {},
                allowance_type_id: allowanceType.id,
                start: new Date(Date.UTC(new Date().getFullYear(), workspace.fiscal_year_start_month, 1)),
                end: addDays(
                  addYears(new Date(Date.UTC(new Date().getFullYear(), workspace.fiscal_year_start_month, 1)), 1),
                  -1
                )
              },
              {
                workspace_id: workspace.id,
                allowance: 30,
                year: new Date().getFullYear() + 1,
                member_id: member.id,
                remaining: 30,
                brought_forward: 0,
                compensatory_time_off: 0,
                taken: 0,
                leave_types_stats: {},
                allowance_type_id: allowanceType.id,
                start: new Date(Date.UTC(new Date().getFullYear() + 1, workspace.fiscal_year_start_month, 1)),
                end: addDays(
                  addYears(new Date(Date.UTC(new Date().getFullYear() + 1, workspace.fiscal_year_start_month, 1)), 1),
                  -1
                )
              }
            ]
          }),
          ctx.prisma.memberDepartment.create({
            data: {
              workspace_id: workspace.id,
              department_id: department.id,
              member_id: member.id,
              manager_type: 'Manager'
            }
          }),
          ctx.prisma.memberApprover.create({
            data: {
              workspace_id: workspace.id,
              approver_member_id: member.id,
              member_id: member.id
            }
          }),
          ctx.prisma.memberAllowanceTypeConfigurtaion.create({
            data: {
              workspace_id: workspace.id,
              member_id: member.id,
              allowance_type_id: allowanceType.id,
              default: true,
              disabled: false
            }
          })
        ]);

        await inngest.send({
          // The event name
          name: 'email_onboarding/user_signup',
          // The event's data
          data: {
            member_id: member.id
          }
        });
      } catch (e: any) {
        await ctx.prisma.workspace.delete({ where: { id: workspace.id } });
        console.log(e);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Error: ${e.message}`
        });
      }

      return workspace;
    })
});
