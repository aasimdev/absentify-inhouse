import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import {
  ApprovalProcess,
  EndAt,
  LeaveUnit,
  NotificationReceivingMethod,
  RequestApproverStatus,
  StartAt,
  Status,
  TimeFormat
} from '@prisma/client';

import { generateRequestDetailsHtml, generateRequestStatusHeader } from '~/lib/generateRequestDetailsHtml';
import { sendUniversalTransactionalMail } from '~/lib/sendInBlueContactApi';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { createPicture, defaultMemberSelectOutput } from '~/server/api/routers/member';
import { Translate } from 'next-translate';
import * as Sentry from '@sentry/nextjs';
import { sendAdaptiveCard, updateAdaptiveCard } from '~/utils/microsoft_teams/sendAdaptiveCard';
import { slugify } from 'inngest';
import { mainLink } from '~/helper/mainLink';
import { format } from 'date-fns';
import { dateFromDatabaseIgnoreTimezone, isHourUnit } from '~/lib/DateHelper';
import { setRequestStartEndTimesBasedOnSchedule } from '~/lib/requestUtilities';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { formatDuration } from '~/helper/formatDuration';
import { cloneDeep } from 'lodash';
import { RouterOutputs } from '~/utils/api';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';
import { defaultImage } from '~/email/birthdayReminder';
export const notifictaionOnCreatedByAnotherUser = inngest.createFunction(
  {
    id: slugify('Notification: Request created by another user'),
    name: 'Notification: Request created by another user'
  },
  { event: 'request/notifications.created_by_another_user' },
  async ({ event, step }) => {
    const data = event.data;
    await step.run('send notifications', async () => {
      console.log('notifictaionOnCreatedByAnotherUser');
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, allowance_type: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true,
              notifications_receiving_method: true,
              status: true
            }
          }
        }
      });

      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');

      if (!request.requester_member.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      if (request.requester_member.status === Status.INACTIVE) return;
      const getT = ensureAvailabilityOfGetT();
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      const date = await prepareDate(request, schedules, request.workspace.schedule, request.requester_member);
      const fullDate = await prepareDate(
        request,
        schedules,
        request.workspace.schedule,
        request.requester_member,
        true
      );
      const t = await getT(request.requester_member.language ?? 'en', 'mails');
      const approvers = await getApproversForEmail(t, request.details.id);
      let tapprovers = transateApproverStatus(approvers, t);
      const picture = createPicture(
        request.workspace.company_logo_url,
        request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
      );
      const approvedCreator = approvers.find((app) => app.email === data.created_by.email);
      if (request.requester_member.notifications_receiving_method === 'EmailAndTeamsBot') {
        await sendUniversalTransactionalMail({
          prisma: prisma,
          workspace_id: request.workspace_id,
          subject: t('new-leave-request-created', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          params: {
            pageTitle: t('new-leave-request-created', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            h1: t('new-leave-request-created', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
            secondLine: t('created_by_name-created-a-new-leave-request-leave_type_name-for-you', {
              created_by_name: data.created_by.name
            }),
            thirdLine:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('third_line_createad_by_manager', {
                    leave_type_name: request.details.leave_type.name,
                    date: fullDate,
                    status: request.details.status,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          })
                        : ''
                  })
                : t('third_line_createad_by_manager_multiple_days', {
                    leave_type_name: request.details.leave_type.name,
                    date: fullDate,
                    status: request.details.status,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          })
                        : ''
                  }),
            fourthLine:
              approvedCreator?.status === 'APPROVED'
                ? t('forth_line_created_by_manager', { created_by_name: data.created_by.name })
                : '',
            buttonText: t('view-request'),
            link:
              'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
            teamsLinkText: t('view-request-in-teams'),
            teamsLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            approvers: tapprovers,
            company_image_url: request.workspace.company_logo_url ? picture : null,
            reason: request.details.reason ?? t('no_reason')
          },
          to: {
            email: request.requester_member.email,
            name: request.requester_member.name ?? request.requester_member.email
          },
          replyTo: {
            email: data.created_by.email ? data.created_by.email : 'notifications@absentify.com',
            name: data.created_by.name ?? request.requester_member.email
          }
        });
      }
      const activityId = await sendAdaptiveCard(
        prisma,
        {
          pageTitle: t('new-leave-request-created', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          h1: t('new-leave-request-created', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
          secondLine: t('created_by_name-created-a-new-leave-request-leave_type_name-for-you', {
            created_by_name: data.created_by.name
          }),
          thirdLine:
            request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
              ? t('third_line_createad_by_manager', {
                  leave_type_name: request.details.leave_type.name,
                  date: fullDate,
                  status: request.details.status,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    request.requester_member.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            request.requester_member.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        })
                      : ''
                })
              : t('third_line_createad_by_manager_multiple_days', {
                  leave_type_name: request.details.leave_type.name,
                  date: fullDate,
                  status: request.details.status,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    request.requester_member.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            request.requester_member.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        })
                      : ''
                }),
          fourthLine:
            approvedCreator?.status === 'APPROVED'
              ? t('forth_line_created_by_manager', { created_by_name: data.created_by.name })
              : '',
          fifthLine: '',
          buttonText: t('view-request'),
          buttonLink: createTeamsDeepLinkIntoRequestDetail({
            member_id: request.requester_member.id,
            request_id: data.request_id
          }),
          request_id: data.request_id,
          showApprovalActions: false,
          users: tapprovers
        },
        request.requester_member.id
      );
      if (activityId)
        await prisma.request.update({
          where: { id: data.request_id },
          data: { requester_adaptive_card_id: activityId }
        });
    });
    return;
  }
);

export const updatedByAnotherUser = inngest.createFunction(
  {
    id: slugify('Notification: Request updated by another user'),
    name: 'Notification: Request updated by another user'
  },
  { event: 'request/notifications.updated_by_another_user' },
  async ({ event, step }) => {
    const data = event.data;
    await step.run('send notifications', async () => {
      console.log('notifictaionOnUpdatedByAnotherUser');
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, allowance_type: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true,
              notifications_receiving_method: true,
              status: true
            }
          }
        }
      });

      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const receiver = await prisma.member.findUnique({
        where: { id: data.approver_id },
        select: {
          id: true,
          name: true,
          approval_process: true,
          email: true,
          microsoft_user_id: true,
          microsoft_tenantId: true,
          language: true,
          date_format: true,
          time_format: true,
          notifications_receiving_method: true,
          status: true
        }
      });
      if (!receiver) return;
      if (!receiver.email) return;
      if (!receiver.microsoft_user_id) return;
      if (receiver.status === Status.INACTIVE) return;
      const getT = ensureAvailabilityOfGetT();
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      const date = await prepareDate(request, schedules, request.workspace.schedule, receiver);
      const fullDate = await prepareDate(request, schedules, request.workspace.schedule, receiver, true);
      const t = await getT(receiver.language ?? 'en', 'mails');
      const approvers = await getApproversForEmail(t, request.details.id);
      let tapprovers = transateApproverStatus(approvers, t);
      const picture = createPicture(
        request.workspace.company_logo_url,
        request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
      );

      if (receiver.notifications_receiving_method === 'EmailAndTeamsBot') {
        await sendUniversalTransactionalMail({
          prisma: prisma,
          workspace_id: request.workspace_id,
          subject: t('updated_on_your_behalf'),
          params: {
            pageTitle: t('updated_on_your_behalf'),
            h1: t('updated_on_your_behalf'),
            firstLine: t('hey-requester_name', { requester_name: receiver.name }),
            secondLine: t('updated_on_your_behalf_second_line', {
              leave_type_name: request.details.leave_type.name,
              updated_by: data.updated_by.name,
              status: data.updated_by.status === 'APPROVED' ? t('approved_') : t('declined_'),
              requester: request.requester_member.name,
              reason: request.details.reason ? t('reason', { reason: request.details.reason }) : ''
            }),
            thirdLine:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('date', { date: fullDate })
                : t('requested_leave', { date: fullDate }),
            fourthLine: '',
            buttonText: t('view-request'),
            link:
              'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
            teamsLinkText: t('view-request-in-teams'),
            teamsLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            approvers: tapprovers,
            company_image_url: request.workspace.company_logo_url ? picture : null,
            reason: request.details.reason ?? t('no_reason')
          },
          to: {
            email: receiver.email,
            name: receiver.name ?? receiver.email
          },
          replyTo: {
            email: data.updated_by.email ? data.updated_by.email : 'notifications@absentify.com',
            name: data.updated_by.name ? data.updated_by.email : 'notifications@absentify.com'
          }
        });
      }
      const activityId = await sendAdaptiveCard(
        prisma,
        {
          pageTitle: t('updated_on_your_behalf'),
          h1: t('updated_on_your_behalf'),
          firstLine: t('hey-requester_name', { requester_name: receiver.name }),
          secondLine: t('updated_on_your_behalf_second_line', {
            leave_type_name: request.details.leave_type.name,
            updated_by: data.updated_by.name,
            status: data.updated_by.status === 'APPROVED' ? t('approved_') : t('declined_'),
            requester: request.requester_member.name,
            reason: request.details.reason ? t('reason', { reason: request.details.reason }) : ''
          }),
          thirdLine:
            request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
              ? t('date', { date: fullDate })
              : t('requested_leave', { date: fullDate }),
          fourthLine: '',
          fifthLine: '',
          buttonText: t('view-request'),
          buttonLink: createTeamsDeepLinkIntoRequestDetail({
            member_id: request.requester_member.id,
            request_id: data.request_id
          }),
          request_id: data.request_id,
          showApprovalActions: false,
          users: tapprovers
        },
        receiver.id
      );
      if (activityId)
        await prisma.request.update({
          where: { id: data.request_id },
          data: { requester_adaptive_card_id: activityId }
        });
    });
    return;
  }
);

export const notificationTimeghostSyncError = inngest.createFunction(
  { id: slugify('Notification: Timeghost sync error'), name: 'Notification: Timeghost sync error' ,
    retries:0,
  },
  { event: 'request/notifications.timeghost_sync_error' },
  async ({ event, step }) => {
    const data = event.data;
    const timeghost_sync_setting_name = data.timeghost_sync_setting_name;
    const notification_sent = data.timeghost_sync_setting_invalid_apikey_notification_sent;
    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          requester_adaptive_card_id: true,
          workspace: { select: { company_logo_url: true, company_logo_ratio_square: true, id: true } },
          details: {
            select: {
              id: true,
              reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              notifications_receiving_method: true,
              status: true
            }
          }
        }
      });

      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');

      if (!request.requester_member.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      if (request.requester_member.status === Status.INACTIVE) return;
      if(notification_sent) return {message: "Email already sent"};
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(request.requester_member.language ?? 'en', 'mails');
      const picture = createPicture(
        request.workspace.company_logo_url,
        request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
      );

      const allAdmins = await prisma.member.findMany({
        where: {
          workspace_id: request.workspace.id,
          is_admin: true,
          status: Status.ACTIVE
        },
        select: {
          id: true,
          name: true,
          email: true,
          language: true
        }
      });

      for (let index = 0; index < allAdmins.length; index++) {
        const admin = allAdmins[index];
        if (admin) {
          await sendErrorMail(admin, request, t, picture, timeghost_sync_setting_name);
        }
      }
    });
  }
);
export const notificationRequestApproved = inngest.createFunction(
  { id: slugify('Notification: Request approved'), name: 'Notification: Request approved' },
  { event: 'request/notifications.approved' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          createdBy_member_id: true,
          requester_adaptive_card_id: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, allowance_type: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true,
              notifications_receiving_method: true,
              status: true
            }
          }
        }
      });

      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const createdBy =
        request.createdBy_member_id &&
        request.createdBy_member_id !== request.requester_member.id &&
        (await prisma.member.findUnique({
          where: { id: request.createdBy_member_id },
          select: {
            id: true,
            name: true,
            approval_process: true,
            email: true,
            microsoft_user_id: true,
            microsoft_tenantId: true,
            language: true,
            date_format: true,
            notifications_receiving_method: true,
            status: true,
            time_format: true
          }
        }));

      const receivers = [request.requester_member];
      const getT = ensureAvailabilityOfGetT();
      const memT = await getT(request.requester_member?.language ?? 'en', 'mails');
      const findApprovers = await getApproversForEmail(memT, request.details.id);
      if (createdBy && !findApprovers.find((app) => app.approver_member_id === createdBy.id)) {
        receivers.push(createdBy);
      }
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      for (const receiver of receivers) {
        const t = await getT(receiver?.language ?? 'en', 'mails');
        if (!receiver?.email) return;
        if (!receiver.microsoft_user_id) return;
        if (receiver.status === Status.INACTIVE) return;
        const approvers = await getApproversForEmail(t, request.details.id);
        let tapprovers = transateApproverStatus(approvers, t);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );
        const date = await prepareDate(request, schedules, request.workspace.schedule, receiver);
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, receiver, true);
        if (receiver.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({
            prisma: prisma,
            workspace_id: request.workspace_id,
            subject:
              request.createdBy_member_id !== request.requester_member.id && request.createdBy_member_id === receiver.id
                ? t('your-for-someone-else-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    date,
                    other_person: request.requester_member.name
                  })
                : t('your-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date })
                  }),
            params: {
              approvers: tapprovers,
              h1:
                request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                  ? t('your-for-someone-else-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      date,
                      other_person: request.requester_member.name
                    })
                  : t('your-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date })
                    }),
              pageTitle:
                request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                  ? t('your-for-someone-else-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      date,
                      other_person: request.requester_member.name
                    })
                  : t('your-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date })
                    }),
              firstLine: t('hey-requester_name', { requester_name: receiver.name }),
              secondLine:
                tapprovers.length > 1
                  ? t('second_line_accepted_multiple', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date }),
                      additional_html_div:
                        request.createdBy_member_id !== request.requester_member.id &&
                        request.createdBy_member_id === receiver.id
                          ? t('for') + ' ' + request.requester_member.name
                          : ''
                    })
                  : t('second_line_accepted', {
                      additional_html_div:
                        request.createdBy_member_id !== request.requester_member.id &&
                        request.createdBy_member_id === receiver.id
                          ? t('for') + ' ' + request.requester_member.name
                          : ''
                    }),
              thirdLine:
                tapprovers.length > 1
                  ? generateRequestStatusHeader(request.requester_member.approval_process, tapprovers, t, 'APPROVED')
                  : request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('third_line_accepted', {
                      date: fullDate,
                      number_of_days: formatDuration(
                        request.details.workday_absence_duration,
                        receiver.language,
                        request.leave_unit,
                        true,
                        t
                      ),
                      additional_html:
                        request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                          ? t('deducted_from', {
                              allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                              value: formatDuration(
                                request.details.workday_absence_duration,
                                receiver.language,
                                request.leave_unit,
                                true,
                                t
                              )
                            })
                          : ''
                    })
                  : t('third_line_accepted_multiple_days', {
                      date: fullDate,
                      number_of_days: formatDuration(
                        request.details.workday_absence_duration,
                        receiver.language,
                        request.leave_unit,
                        true,
                        t
                      ),
                      additional_html:
                        request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                          ? t('deducted_from', {
                              allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                              value: formatDuration(
                                request.details.workday_absence_duration,
                                receiver.language,
                                request.leave_unit,
                                true,
                                t
                              )
                            })
                          : ''
                    }),
              fourthLine: '',
              fifthLine:
                tapprovers.length > 1
                  ? request.createdBy_member_id !== request.requester_member.id &&
                    request.createdBy_member_id === receiver.id
                    ? t('forth_line_accepted_creator_not_requester', { date: fullDate })
                    : t('forth_line_accepted_multiple_approvers', {
                        date: fullDate,
                        additional_html_div:
                          request.details.workday_absence_duration > 0
                            ? t('forth_additional_html_2')
                            : t('forth_additional_html')
                      })
                  : request.createdBy_member_id !== request.requester_member.id &&
                    request.createdBy_member_id === receiver.id
                  ? t('forth_line_creator_not_requester')
                  : t('forth_line_accepted', {
                      additional_html_div:
                        request.details.workday_absence_duration > 0
                          ? t('forth_additional_html_2')
                          : t('forth_additional_html')
                    }),
              buttonText: t('view-request'),
              link:
                'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              teamsLinkText: t('view-request-in-teams'),
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: receiver.email,
              name: receiver.name ?? receiver.email
            },
            replyTo: {
              email: data.created_by.email ? data.created_by.email : 'notifications@absentify.com',
              name: data.created_by.name ? data.created_by.name : 'notifications@absentify.com'
            }
          });
        }

        if (request.requester_adaptive_card_id) {
          await updateAdaptiveCard(
            prisma,
            {
              h1:
                request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                  ? t('your-for-someone-else-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      date,
                      other_person: request.requester_member.name
                    })
                  : t('your-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date })
                    }),
              pageTitle:
                request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                  ? t('your-for-someone-else-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      date,
                      other_person: request.requester_member.name
                    })
                  : t('your-leave_type_name-was-accepted', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date })
                    }),
              firstLine: t('hey-requester_name', { requester_name: receiver.name }),
              secondLine:
                tapprovers.length > 1
                  ? t('second_line_accepted_multiple', {
                      leave_type_name: request.details.leave_type.name,
                      choose_date:
                        request.start.getDate() === request.end.getDate() ||
                        request.details.workday_absence_duration === 1
                          ? t('on_date', { date })
                          : t('from_date', { date }),
                      additional_html_div:
                        request.createdBy_member_id !== request.requester_member.id &&
                        request.createdBy_member_id === receiver.id
                          ? t('for') + ' ' + request.requester_member.name
                          : ''
                    })
                  : t('second_line_accepted', {
                      additional_html_div:
                        request.createdBy_member_id !== request.requester_member.id &&
                        request.createdBy_member_id === receiver.id
                          ? t('for') + ' ' + request.requester_member.name
                          : ''
                    }),
              thirdLine:  tapprovers.length > 1
              ? request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                ? t('forth_line_accepted_creator_not_requester', { date: fullDate })
                : t('forth_line_accepted_multiple_approvers', {
                    date: fullDate,
                    additional_html_div:
                      request.details.workday_absence_duration > 0
                        ? t('forth_additional_html_2')
                        : t('forth_additional_html')
                  })
              : request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
              ? t('forth_line_creator_not_requester')
              : t('forth_line_accepted', {
                  additional_html_div:
                    request.details.workday_absence_duration > 0
                      ? t('forth_additional_html_2')
                      : t('forth_additional_html')
                }),
              fourthLine:  tapprovers.length > 1
              ? generateRequestStatusHeader(request.requester_member.approval_process, tapprovers, t, 'APPROVED')
              : request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
              ? t('third_line_accepted', {
                  date: fullDate,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    receiver.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            receiver.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        })
                      : ''
                })
              : t('third_line_accepted_multiple_days', {
                  date: fullDate,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    receiver.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            receiver.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        })
                      : ''
                }),  
              fifthLine:'',
              buttonText: t('view-request'),
              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              request_id: data.request_id,
              showApprovalActions: false,
              users: tapprovers
            },
            receiver.id,
            request.requester_adaptive_card_id
          );
        }
        if (!request.requester_adaptive_card_id) {

        const activityId = await sendAdaptiveCard(
          prisma,
          {
            h1:
              request.createdBy_member_id !== request.requester_member.id && request.createdBy_member_id === receiver.id
                ? t('your-for-someone-else-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    date,
                    other_person: request.requester_member.name
                  })
                : t('your-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date })
                  }),
            pageTitle:
              request.createdBy_member_id !== request.requester_member.id && request.createdBy_member_id === receiver.id
                ? t('your-for-someone-else-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    date,
                    other_person: request.requester_member.name
                  })
                : t('your-leave_type_name-was-accepted', {
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date })
                  }),
            firstLine: t('hey-requester_name', { requester_name: receiver.name }),
            secondLine:
              tapprovers.length > 1
                ? t('second_line_accepted_multiple', {
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date }),
                    additional_html_div:
                      request.createdBy_member_id !== request.requester_member.id &&
                      request.createdBy_member_id === receiver.id
                        ? t('for') + ' ' + request.requester_member.name
                        : ''
                  })
                : t('second_line_accepted', {
                    additional_html_div:
                      request.createdBy_member_id !== request.requester_member.id &&
                      request.createdBy_member_id === receiver.id
                        ? t('for') + ' ' + request.requester_member.name
                        : ''
                  }),
            thirdLine: tapprovers.length > 1
            ? request.createdBy_member_id !== request.requester_member.id &&
              request.createdBy_member_id === receiver.id
              ? t('forth_line_accepted_creator_not_requester', { date: fullDate })
              : t('forth_line_accepted_multiple_approvers', {
                  date: fullDate,
                  additional_html_div:
                    request.details.workday_absence_duration > 0
                      ? t('forth_additional_html_2')
                      : t('forth_additional_html')
                })
            : request.createdBy_member_id !== request.requester_member.id &&
              request.createdBy_member_id === receiver.id
            ? t('forth_line_creator_not_requester')
            : t('forth_line_accepted', {
                additional_html_div:
                  request.details.workday_absence_duration > 0
                    ? t('forth_additional_html_2')
                    : t('forth_additional_html')
              }),
            fourthLine: tapprovers.length > 1
            ? generateRequestStatusHeader(request.requester_member.approval_process, tapprovers, t, 'APPROVED')
            : request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
            ? t('third_line_accepted', {
                date: fullDate,
                number_of_days: formatDuration(
                  request.details.workday_absence_duration,
                  receiver.language,
                  request.leave_unit,
                  true,
                  t
                ),
                additional_html:
                  request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                    ? t('deducted_from', {
                        allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                        value: formatDuration(
                          request.details.workday_absence_duration,
                          receiver.language,
                          request.leave_unit,
                          true,
                          t
                        )
                      })
                    : ''
              })
            : t('third_line_accepted_multiple_days', {
                date: fullDate,
                number_of_days: formatDuration(
                  request.details.workday_absence_duration,
                  receiver.language,
                  request.leave_unit,
                  true,
                  t
                ),
                additional_html:
                  request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                    ? t('deducted_from', {
                        allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                        value: formatDuration(
                          request.details.workday_absence_duration,
                          receiver.language,
                          request.leave_unit,
                          true,
                          t
                        )
                      })
                    : ''
              }),
             
            fifthLine: '',
            buttonText: t('view-request'),
            buttonLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            request_id: data.request_id,
            showApprovalActions: false,
            users: tapprovers
          },
          receiver.id
        );
        if (activityId)
          await prisma.request.update({
            where: { id: data.request_id },
            data: { requester_adaptive_card_id: activityId }
          });
        }
      }
    });
  }
);

export const notificationRequestUpdatedToApprovers = inngest.createFunction(
  {
    id: slugify('Notification: Request approved notify the approvers'),
    name: 'Notification: Request approved notify the approvers'
  },
  { event: 'request/notifications.notify_approvers' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification To Approvers', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const getT = ensureAvailabilityOfGetT();
      const reqT = await getT(request.requester_member.language ?? 'en', 'mails');
      if (!request.requester_member.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      const approvers = await getApproversForEmail(reqT, request.details.id);
      let tapprovers = transateApproverStatus(approvers, reqT);
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      for (let index = 0; index < approvers.length; index++) {
        const approver = approvers[index];
        const t = await getT(approver?.language ?? 'en', 'mails');
        if (!approver) continue;
        if (!approver.email) continue;
        if (approver.email == data.created_by.email) continue;
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, approver, true);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );
        if (approver.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({
            prisma: prisma,
            workspace_id: request.workspace_id,
            subject:
              data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
              data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                ? data.approved
                  ? t('another_app_appr_req_one')
                  : t('another_app_dec_req_one')
                : data.approved
                ? t('another_app_accept_req_all_2')
                : t('another_app_dec_req_all_2', { leave_type_name: request.details.leave_type.name }),
            params: {
              pageTitle:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_one')
                    : t('another_app_dec_req_one')
                  : data.approved
                  ? t('another_app_accept_req_all_2')
                  : t('another_app_dec_req_all_2', { leave_type_name: request.details.leave_type.name }),
              h1:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_one')
                    : t('another_app_dec_req_one')
                  : data.approved
                  ? t('another_app_accept_req_all_2')
                  : t('another_app_dec_req_all_2', { leave_type_name: request.details.leave_type.name }),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_line_2_one', {
                        leave_type_name: request.details.leave_type.name,
                        canceler_name: data.created_by.name,
                        requester_name: request.requester_member.name
                      })
                    : t('another_app_dec_req_line_2_one', {
                        leave_type_name: request.details.leave_type.name,
                        canceler_name: data.created_by.name,
                        requester_name: request.requester_member.name,
                        decline_reason: data.decline_reason
                      })
                  : data.approved
                  ? t('another_app_req_appr_line_2_all', {
                      leave_type_name: request.details.leave_type.name,
                      canceler_name: data.created_by.name,
                      requester_name: request.requester_member.name,
                      no: request.details.status === 'APPROVED' ? t('no') : t('further')
                    })
                  : t('another_app_dec_req_line_2_all', {
                      leave_type_name: request.details.leave_type.name,
                      canceler_name: data.created_by.name,
                      requester_name: request.requester_member.name,
                      decline_reason: data.decline_reason
                    }),
              thirdLine:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('date', { date: fullDate })
                  : t('requested_leave', { date: fullDate }),
              fourthLine: '',
              buttonText: t('view-request'),
              link:
                'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLinkText: t('view-request-in-teams'),
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              approvers: tapprovers.length == 1 ? null : tapprovers,
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: approver.email,
              name: approver.name ?? approver.email
            },
            replyTo: {
              email: request.requester_member.email ? request.requester_member.email : 'notifications@absentify.com',
              name: request.requester_member.name ?? request.requester_member.email
            }
          });
        }
        if (approver.approver_member_id)
          await sendAdaptiveCard(
            prisma,
            {
              pageTitle:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_one')
                    : t('another_app_dec_req_one')
                  : data.approved
                  ? t('another_app_accept_req_all_2')
                  : t('another_app_dec_req_all_2', { leave_type_name: request.details.leave_type.name }),
              h1:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_one')
                    : t('another_app_dec_req_one')
                  : data.approved
                  ? t('another_app_accept_req_all_2')
                  : t('another_app_dec_req_all_2', { leave_type_name: request.details.leave_type.name }),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine:
                data.approval_process === ApprovalProcess.Linear_one_has_to_agree ||
                data.approval_process === ApprovalProcess.Parallel_one_has_to_agree
                  ? data.approved
                    ? t('another_app_appr_req_line_2_one', {
                        leave_type_name: request.details.leave_type.name,
                        canceler_name: data.created_by.name,
                        requester_name: request.requester_member.name
                      })
                    : t('another_app_dec_req_line_2_one', {
                        leave_type_name: request.details.leave_type.name,
                        canceler_name: data.created_by.name,
                        requester_name: request.requester_member.name,
                        decline_reason: data.decline_reason
                      })
                  : data.approved
                  ? t('another_app_req_appr_line_2_all', {
                      leave_type_name: request.details.leave_type.name,
                      canceler_name: data.created_by.name,
                      requester_name: request.requester_member.name,
                      no: request.details.status === 'APPROVED' ? t('no') : t('further')
                    })
                  : t('another_app_dec_req_line_2_all', {
                      leave_type_name: request.details.leave_type.name,
                      canceler_name: data.created_by.name,
                      requester_name: request.requester_member.name,
                      decline_reason: data.decline_reason
                    }),
              thirdLine:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('date', { date: fullDate })
                  : t('requested_leave', { date: fullDate }),
              fourthLine: '',
              fifthLine: '',
              buttonText: t('view-request'),
              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              request_id: data.request_id,
              showApprovalActions: false,
              users: tapprovers
            },
            approver.approver_member_id
          );
      }
    });

    await step.run('Send notification to managers', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          createdBy_member_id: true,
          end_at: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true,
              departments: {
                select: {
                  department: {
                    select: {
                      members: {
                        select: {
                          member_id: true,
                          manager_type: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (request.details.status !== 'APPROVED') return;
      //deactivated again for the time being because there was so much negative feedback
      /*   const requestApprovers = (
        await prisma.requestApprover.findMany({
          where: { request_details_id: request?.details.id },
          select: { approver_member_id: true }
        })
      ).map((app) => app.approver_member_id);
      const depHeads = request.requester_member.departments.flatMap((dep) =>
        dep.department.members
          .filter((mem) => mem.manager_type === DepartmentManagerType.Manager)
          .map((mem) => mem.member_id)
      );
      const filteredDepHeads = depHeads.filter(
        (depHead) => !requestApprovers.includes(depHead) && depHead !== request.createdBy_member_id
      );
       const managers = await prisma.member.findMany({
        where: { id: { in: filteredDepHeads } },
        select: {
          id: true,
          name: true,
          approval_process: true,
          email: true,
          microsoft_user_id: true,
          microsoft_tenantId: true,
          language: true,
          date_format: true,
          notifications_receiving_method: true,
          status: true,
          time_format: true
        }
      });
      const getT = ensureAvailabilityOfGetT();
      const reqT = await getT(request.requester_member.language ?? 'en', 'mails');
      if (!request.requester_member.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      const approvers = await getApproversForEmail(reqT, request.details.id);
      let tapprovers = transateApproverStatus(approvers, reqT);
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });
      let schedule = schedules.find(
        (x: any) => x.from && request?.start && x.from <= request?.start
      ) as defaultMemberSelectOutput['schedules'][0];
      if (!schedule) {
        schedule = request.workspace.schedule as defaultMemberSelectOutput['schedules'][0];
      }
    for (const manager of managers) {
        const t = await getT(manager?.language ?? 'en', 'mails');
        if (!manager) continue;
        if (!manager.email) continue;
        if (manager.email == data.created_by.email) continue;
        const fullDate = await prepareDate(request, schedule, manager, true);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );
        if (manager.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({prisma: prisma,
            subject: t('notice_managers'),
            params: {
              pageTitle: t('notice_managers'),
              h1: t('notice_managers'),
              firstLine: t('hey-approver_name', { approver_name: manager.name }),
              secondLine: t('second_line_for_managers', {
                employee_name: request.requester_member.name,
                leave_type_name: request.details.leave_type.name
              }),
              thirdLine:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('date', { date: fullDate })
                  : t('requested_leave', { date: fullDate }),
              fourthLine: '',
              buttonText: t('view-request'),
              link:
                'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLinkText: t('view-request-in-teams'),
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              approvers: tapprovers,
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: manager.email,
              name: manager.name ?? manager.email
            },
            replyTo: {
              email: request.requester_member.email ? request.requester_member.email : 'notifications@absentify.com',
              name: request.requester_member.name ?? request.requester_member.email
            }
          });
        }
      } */
    });
  }
);

export const notificationRequestDeclined = inngest.createFunction(
  { id: slugify('Notification: Request declined'), name: 'Notification: Request declined' },
  { event: 'request/notifications.declined' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          createdBy_member_id: true,
          requester_adaptive_card_id: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              global_time_format: true,
              global_date_format: true,
              schedule: true
            }
          },
          details: {
            select: {
              id: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              notifications_receiving_method: true,
              status: true,
              time_format: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const getT = ensureAvailabilityOfGetT();
      const createdBy =
        request.createdBy_member_id &&
        request.createdBy_member_id !== request.requester_member.id &&
        (await prisma.member.findUnique({
          where: { id: request.createdBy_member_id },
          select: {
            id: true,
            name: true,
            approval_process: true,
            email: true,
            microsoft_user_id: true,
            microsoft_tenantId: true,
            language: true,
            date_format: true,
            notifications_receiving_method: true,
            status: true,
            time_format: true
          }
        }));
      const receivers = [request.requester_member];
      const memT = await getT(request.requester_member?.language ?? 'en', 'mails');
      const findApprovers = await getApproversForEmail(memT, request.details.id);
      if (createdBy && !findApprovers.find((app) => app.approver_member_id === createdBy.id)) {
        receivers.push(createdBy);
      }
      for (const receiver of receivers) {
        if (!receiver) continue;
        const t = await getT(receiver.language ?? 'en', 'mails');
        const approvers = await getApproversForEmail(t, request.details.id);
        if (!receiver?.email) continue;
        if (!receiver.microsoft_user_id) continue;
        if (receiver.status === Status.INACTIVE) continue;
        const schedules = await prisma.memberSchedule.findMany({
          where: { member_id: request.requester_member.id },
          select: defaultMemberScheduleSelect
        });

        const date = await prepareDate(request, schedules, request.workspace.schedule, receiver);
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, receiver, true);
        let tapprovers = transateApproverStatus(approvers, t);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );
        if (receiver.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({
            prisma: prisma,
            workspace_id: request.workspace_id,
            subject: t('your-leave_type_name-request-was-declined', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            params: {
              pageTitle: t('your-leave_type_name-request-was-declined', {
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              h1: t('your-leave_type_name-request-was-declined', {
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              firstLine: t('hey-requester_name', { requester_name: receiver.name }),
              secondLine: t('your-request-was-declined-by-approver_name-for-the-following-reasons-decline_reason', {
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date: fullDate })
                    : t('from_date', { date: fullDate }),
                for_someone:
                  request.createdBy_member_id !== request.requester_member.id &&
                  request.createdBy_member_id === receiver.id
                    ? t('for') + ' ' + request.requester_member.name
                    : ''
              }),
              thirdLine: t('third_line_decline', { reason: data.decline_reason }),
              fourthLine: t('forth_line_decline', {
                decliner_name: data.created_by.name,
                leave_type_name: request.details.leave_type.name
              }),
              fifthLine: t('fifth_line_decline'),
              buttonText: t('view-request'),
              link:
                'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLinkText: t('view-request-in-teams'),
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              approvers: transateApproverStatus(tapprovers, t),
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: receiver.email,
              name: receiver.name ?? receiver.email
            },
            replyTo: {
              email: data.created_by.email ? data.created_by.email : 'notifications@absentify.com',
              name: data.created_by.name ? data.created_by.name : 'notifications@absentify.com'
            }
          });
        }
        if (request.requester_adaptive_card_id) {
          await updateAdaptiveCard(
            prisma,
            {
              pageTitle: t('your-leave_type_name-request-was-declined', {
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              h1: t('your-leave_type_name-request-was-declined', {
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              firstLine: t('hey-requester_name', { requester_name: receiver.name }),
              secondLine: t('your-request-was-declined-by-approver_name-for-the-following-reasons-decline_reason', {
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date: fullDate })
                    : t('from_date', { date: fullDate }),
                for_someone:
                  request.createdBy_member_id !== request.requester_member.id &&
                  request.createdBy_member_id === receiver.id
                    ? t('for') + ' ' + request.requester_member.name
                    : ''
              }),
              thirdLine: t('third_line_decline', { reason: data.decline_reason }),
              fourthLine: t('forth_line_decline', {
                decliner_name: data.created_by.name,
                leave_type_name: request.details.leave_type.name
              }),
              fifthLine: t('fifth_line_decline'),
              buttonText: t('view-request'),
              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              request_id: data.request_id,
              showApprovalActions: false,
              users: tapprovers
            },
            receiver.id,
            request.requester_adaptive_card_id
          );
        }
        const activityId = await sendAdaptiveCard(
          prisma,
          {
            pageTitle: t('your-leave_type_name-request-was-declined', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            h1: t('your-leave_type_name-request-was-declined', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            firstLine: t('hey-requester_name', { requester_name: receiver.name }),
            secondLine: t('your-request-was-declined-by-approver_name-for-the-following-reasons-decline_reason', {
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date: fullDate })
                  : t('from_date', { date: fullDate }),
              for_someone:
                request.createdBy_member_id !== request.requester_member.id &&
                request.createdBy_member_id === receiver.id
                  ? t('for') + ' ' + request.requester_member.name
                  : ''
            }),
            thirdLine: t('third_line_decline', { reason: data.decline_reason }),
            fourthLine: t('forth_line_decline', {
              decliner_name: data.created_by.name,
              leave_type_name: request.details.leave_type.name
            }),
            fifthLine: t('fifth_line_decline'),
            buttonText: t('view-request'),
            buttonLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            request_id: data.request_id,
            showApprovalActions: false,
            users: tapprovers
          },
          receiver.id
        );
        if (activityId)
          await prisma.request.update({
            where: { id: data.request_id },
            data: { requester_adaptive_card_id: activityId }
          });
      }
    });
  }
);

export const notificationRequestCancledByUser = inngest.createFunction(
  { id: slugify('Notification: Request canceld by user'), name: 'Notification: Request canceld by user' },
  { event: 'request/notifications.canceled_by_user' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          createdBy_member_id: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, allowance_type: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const createdBy =
        request.createdBy_member_id &&
        request.createdBy_member_id !== request.requester_member.id &&
        (await prisma.member.findUnique({
          where: { id: request.createdBy_member_id },
          select: {
            id: true,
            name: true,
            approval_process: true,
            email: true,
            microsoft_user_id: true,
            microsoft_tenantId: true,
            language: true,
            date_format: true,
            notifications_receiving_method: true,
            status: true,
            time_format: true
          }
        }));
      const getT = ensureAvailabilityOfGetT();
      const tForApprovers = await getT(request.requester_member?.language ?? 'en', 'mails');
      if (!request.requester_member?.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      const tapprovers = await getApproversForEmail(tForApprovers, request.details.id);
      const approvers = [...tapprovers];
      if (createdBy && createdBy.email && !approvers.find((app) => app.approver_member_id === createdBy.id)) {
        const createByMockedAsApprover = {
          uuid: '',
          status: RequestApproverStatus.APPROVED,
          approver_member_id: createdBy.id,
          predecessor_request_member_approver_id: null,
          name: createdBy.name ?? createdBy.email,
          image: '',
          reason: null,
          email: createdBy.email,
          microsoft_tenantId: createdBy.microsoft_tenantId,
          microsoft_user_id: createdBy.microsoft_user_id,
          language: createdBy.language,
          notifications_receiving_method: createdBy.notifications_receiving_method,
          date_format: createdBy.date_format,
          time_format: createdBy.time_format
        };
        approvers.push(createByMockedAsApprover);
      }
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      for (let index = 0; index < approvers.length; index++) {
        const approver = approvers[index];
        if (!approver) continue;
        if (!approver.email) continue;
        if (approver.email == data.currentUser.email) continue;
        const t = await getT(approver.language ?? 'en', 'mails');
        const date = await prepareDate(request, schedules, request.workspace.schedule, approver);
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, approver, true);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );
        if (approver.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({
            prisma: prisma,
            workspace_id: request.workspace_id,
            subject: t('a-leave_type_name-request-was-cancelled-by-the-employee', {
              canceler_name: request.requester_member.name,
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            params: {
              pageTitle: t('a-leave_type_name-request-was-cancelled-by-the-employee', {
                canceler_name: request.requester_member.name,
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              h1: t('a-leave_type_name-request-was-cancelled-by-the-employee', {
                canceler_name: request.requester_member.name,
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine: t(
                'please-note-the-following-request-was-cancelled-by-employee-name-themselves-the-following-reason-was-given',
                { requester_name: request.requester_member.name }
              ),
              thirdLine: t('cancel_own_request_third_line', {
                requester_name: request.requester_member.name,
                date: fullDate,
                cancel_reason: request.details.cancel_reason
              }),
              fourthLine: t('cancel_own_request_forth_line'),
              buttonText: t('view-request'),
              link:
                'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLinkText: t('view-request-in-teams'),
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              approvers: null,
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: approver.email,
              name: approver.name ?? approver.email
            },
            replyTo: {
              email: request.requester_member?.email ? request.requester_member.email : 'notifications@absentify.com',
              name: request.requester_member.name ?? request.requester_member.email
            }
          });
        }
        if (approver.approver_member_id)
          await sendAdaptiveCard(
            prisma,
            {
              pageTitle: t('a-leave_type_name-request-was-cancelled-by-the-employee', {
                canceler_name: request.requester_member.name,
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              h1: t('a-leave_type_name-request-was-cancelled-by-the-employee', {
                canceler_name: request.requester_member.name,
                leave_type_name: request.details.leave_type.name,
                choose_date:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('on_date', { date })
                    : t('from_date', { date })
              }),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine: t(
                'please-note-the-following-request-was-cancelled-by-employee-name-themselves-the-following-reason-was-given',
                { requester_name: request.requester_member.name }
              ),
              thirdLine: t('cancel_own_request_third_line', {
                requester_name: request.requester_member.name,
                date: fullDate,
                cancel_reason: request.details.cancel_reason
              }),
              fourthLine: t('cancel_own_request_forth_line'),
              fifthLine: '',
              buttonText: t('view-request'),
              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              request_id: data.request_id,
              showApprovalActions: false,
              users: []
            },
            approver.approver_member_id
          );
      }
    });
  }
);

export const notificationRequestCancledBySomeone = inngest.createFunction(
  { id: slugify('Notification: Request canceld by someone'), name: 'Notification: Request canceld by someone' },
  { event: 'request/notifications.canceled_by_someone' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          leave_unit: true,
          requester_adaptive_card_id: true,
          end_at: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              global_date_format: true,
              global_time_format: true,
              schedule: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              notifications_receiving_method: true,
              status: true,
              time_format: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(request.requester_member?.language ?? 'en', 'mails');

      if (!request.requester_member?.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      if (request.requester_member.status === Status.INACTIVE) return;
      const picture = createPicture(
        request.workspace.company_logo_url,
        request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
      );
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });
      let schedule = schedules.find(
        (x: any) => x.from && request?.start && x.from <= request?.start
      ) as defaultMemberSelectOutput['schedules'][0];
      if (!schedule) {
        schedule = request.workspace.schedule as defaultMemberSelectOutput['schedules'][0];
      }
      const date = await prepareDate(request, schedules, request.workspace.schedule, request.requester_member);
      const fullDate = await prepareDate(
        request,
        schedules,
        request.workspace.schedule,
        request.requester_member,
        true
      );
      if (request.requester_member.notifications_receiving_method === 'EmailAndTeamsBot') {
        await sendUniversalTransactionalMail({
          prisma: prisma,
          workspace_id: request.workspace_id,
          subject: t('your-leave_type_name-request-was-canceled', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          params: {
            pageTitle: t('your-leave_type_name-request-was-canceled', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            h1: t('your-leave_type_name-request-was-canceled', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
            secondLine: t('please-note-that-your-leave_type_name-application-has-been-cancelled-by-canceler_name', {
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date: fullDate })
                  : t('from_date', { date: fullDate }),
              canceler_name: data.currentUser.name,
              leave_type_name: request.details.leave_type.name
            }),
            thirdLine: t('third_line_cancel', {
              reason: request.details.cancel_reason,
              additional_html:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('date', { date: fullDate })
                  : t('requested_leave', { date: fullDate })
            }),
            fourthLine: t('forth_line_cancel', { canceler_name: data.currentUser.name }),
            buttonText: t('view-request'),
            link:
              'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
            teamsLinkText: t('view-request-in-teams'),
            teamsLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            approvers: null,
            company_image_url: request.workspace.company_logo_url ? picture : null
          },
          to: {
            email: request.requester_member.email,
            name: request.requester_member.name ?? request.requester_member.email
          },
          replyTo: {
            email: request.requester_member?.email ? request.requester_member.email : 'notifications@absentify.com',
            name: request.requester_member.name ?? request.requester_member.email
          }
        });
      }

      if (request.requester_adaptive_card_id) {
        await updateAdaptiveCard(
          prisma,
          {
            pageTitle: t('your-leave_type_name-request-was-canceled', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            h1: t('your-leave_type_name-request-was-canceled', {
              leave_type_name: request.details.leave_type.name,
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date })
                  : t('from_date', { date })
            }),
            firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
            secondLine: t('please-note-that-your-leave_type_name-application-has-been-cancelled-by-canceler_name', {
              choose_date:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('on_date', { date: fullDate })
                  : t('from_date', { date: fullDate }),
              canceler_name: data.currentUser.name,
              leave_type_name: request.details.leave_type.name
            }),
            thirdLine: t('third_line_cancel', {
              reason: request.details.cancel_reason,
              additional_html:
                request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                  ? t('date', { date: fullDate })
                  : t('requested_leave', { date: fullDate })
            }),
            fourthLine: t('forth_line_cancel', { canceler_name: data.currentUser.name }),
            fifthLine: '',
            buttonText: t('view-request'),
            buttonLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            request_id: data.request_id,
            showApprovalActions: false,
            users: []
          },
          request.requester_member.id,
          request.requester_adaptive_card_id
        );
      }
      const activityId = await sendAdaptiveCard(
        prisma,
        {
          pageTitle: t('your-leave_type_name-request-was-canceled', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          h1: t('your-leave_type_name-request-was-canceled', {
            leave_type_name: request.details.leave_type.name,
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date })
                : t('from_date', { date })
          }),
          firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
          secondLine: t('please-note-that-your-leave_type_name-application-has-been-cancelled-by-canceler_name', {
            choose_date:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('on_date', { date: fullDate })
                : t('from_date', { date: fullDate }),
            canceler_name: data.currentUser.name,
            leave_type_name: request.details.leave_type.name
          }),
          thirdLine: t('third_line_cancel', {
            reason: request.details.cancel_reason,
            additional_html:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('date', { date: fullDate })
                : t('requested_leave', { date: fullDate })
          }),
          fourthLine: t('forth_line_cancel', { canceler_name: data.currentUser.name }),
          fifthLine: '',
          buttonText: t('view-request'),
          buttonLink: createTeamsDeepLinkIntoRequestDetail({
            member_id: request.requester_member.id,
            request_id: data.request_id
          }),
          request_id: data.request_id,
          showApprovalActions: false,
          users: []
        },
        request.requester_member.id
      );
      if (activityId)
        await prisma.request.update({
          where: { id: data.request_id },
          data: { requester_adaptive_card_id: activityId }
        });
    });

    await step.run('Send Notification To Approvers', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          leave_unit: true,
          createdBy_member_id: true,
          end_at: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const getT = ensureAvailabilityOfGetT();
      const reqT = await getT(request.requester_member?.language ?? 'en', 'mails');
      const createdBy =
        request.createdBy_member_id &&
        request.createdBy_member_id !== request.requester_member.id &&
        (await prisma.member.findUnique({
          where: { id: request.createdBy_member_id },
          select: {
            id: true,
            name: true,
            approval_process: true,
            email: true,
            microsoft_user_id: true,
            microsoft_tenantId: true,
            language: true,
            date_format: true,
            notifications_receiving_method: true,
            status: true,
            time_format: true
          }
        }));
      if (!request.requester_member?.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      const tapprovers = await getApproversForEmail(reqT, request.details.id);
      const approvers = [...tapprovers];
      if (createdBy && createdBy.email && !approvers.find((app) => app.approver_member_id === createdBy.id)) {
        const createByMockedAsApprover = {
          uuid: '',
          status: RequestApproverStatus.APPROVED,
          approver_member_id: createdBy.id,
          predecessor_request_member_approver_id: null,
          name: createdBy.name ?? createdBy.email,
          image: '',
          reason: null,
          email: createdBy.email,
          microsoft_tenantId: createdBy.microsoft_tenantId,
          microsoft_user_id: createdBy.microsoft_user_id,
          language: createdBy.language,
          notifications_receiving_method: createdBy.notifications_receiving_method,
          date_format: createdBy.date_format,
          time_format: createdBy.time_format
        };
        approvers.push(createByMockedAsApprover);
      }
      for (let index = 0; index < approvers.length; index++) {
        const approver = approvers[index];
        const t = await getT(approver?.language ?? 'en', 'mails');
        if (!approver) continue;
        if (!approver.email) continue;
        if (approver.email == data.currentUser.email) continue;
        if (approver.approver_member_id === request.requester_member.id) continue;
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, approver, true);
        const picture = createPicture(
          request.workspace.company_logo_url,
          request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
        );

        if (approver.notifications_receiving_method === 'EmailAndTeamsBot') {
          await sendUniversalTransactionalMail({
            prisma: prisma,
            workspace_id: request.workspace_id,
            subject: t('a-request-from-an-employee-of-yours-has-been-cancelled'),
            params: {
              pageTitle: t('a-request-from-an-employee-of-yours-has-been-cancelled'),
              h1: t('a-request-from-an-employee-of-yours-has-been-cancelled'),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine: t('a-leave_type_name-request-from-requester_name-was-cancelled-by-canceler_name', {
                leave_type_name: request.details.leave_type.name,
                canceler_name: data.currentUser.name,
                requester_name: request.requester_member.name
              }),
              thirdLine: t('third_line_cancel', {
                reason: request.details.cancel_reason,
                additional_html:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('date', { date: fullDate })
                    : t('requested_leave', { date: fullDate })
              }),
              fourthLine: '',
              buttonText: t('view-request'),
              link: `${mainLink}/calendar/` + request.requester_member.id + '?request_id=' + data.request_id,
              teamsLinkText: t('view-request-in-teams'),
              teamsLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              approvers: null,
              company_image_url: request.workspace.company_logo_url ? picture : null
            },
            to: {
              email: approver.email,
              name: approver.name ?? approver.email
            },
            replyTo: {
              email: request.requester_member?.email ? request.requester_member.email : 'notifications@absentify.com',
              name: request.requester_member.name ? request.requester_member.email : 'notifications@absentify.com'
            }
          });
        }
        if (approver.approver_member_id)
          await sendAdaptiveCard(
            prisma,
            {
              pageTitle: t('a-request-from-an-employee-of-yours-has-been-cancelled'),
              h1: t('a-request-from-an-employee-of-yours-has-been-cancelled'),
              firstLine: t('hey-approver_name', { approver_name: approver.name }),
              secondLine: t('a-leave_type_name-request-from-requester_name-was-cancelled-by-canceler_name', {
                leave_type_name: request.details.leave_type.name,
                canceler_name: data.currentUser.name,
                requester_name: request.requester_member.name
              }),
              thirdLine: t('third_line_cancel', {
                reason: request.details.cancel_reason,
                additional_html:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('date', { date: fullDate })
                    : t('requested_leave', { date: fullDate })
              }),
              fourthLine: '',
              fifthLine: '',
              buttonText: t('view-request'),
              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: data.request_id
              }),
              request_id: data.request_id,
              showApprovalActions: false,
              users: []
            },
            approver.approver_member_id
          );
      }
    });
  }
);

export const notificationRequestApprovalRequest = inngest.createFunction(
  { id: slugify('Notification: Request approval'), name: 'Notification: Request approval' },
  { event: 'request/notifications.approval_requests' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const getT = ensureAvailabilityOfGetT();

      let request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          createdBy_member_id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          requester_member_id: true,
          workspace_id: true,
          request_details_id: true,
          requester_member: {
            select: { name: true, email: true, approval_process: true, timezone: true }
          },
          workspace: {
            select: {
              id: true,
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_timezone: true,
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              workday_absence_duration: true,
              approval_process: true,
              reason: true,
              leave_type: { select: { name: true, take_from_allowance: true, allowance_type: true, leave_unit: true } }
            }
          }
        }
      });
      if (!request) return;
      if (!request.details) return;
      if (!request.request_details_id) return;
      if (!request.requester_member) return;
      if (!request.requester_member.email) return;
      if (!request.workspace.schedule) return;
      const createdBy =
        request.createdBy_member_id &&
        (await prisma.member.findUnique({
          where: { id: request.createdBy_member_id },
          select: { name: true, email: true }
        }));
      let gApprovers = await prisma.requestApprover.findMany({
        where: { request_details_id: request.request_details_id },
        select: {
          uuid: true,
          status: true,
          approver_member_id: true,
          predecessor_request_member_approver_id: true,
          approver_member: {
            select: {
              id: true,
              name: true,
              email: true,
              language: true,
              microsoft_tenantId: true,
              microsoft_user_id: true,
              date_format: true,
              notifications_receiving_method: true,
              time_format: true,
              timezone: true
            }
          }
        }
      });
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member_id },
        select: defaultMemberScheduleSelect
      });

      let sapprovers = sortApprovers(gApprovers);

      if (
        request.requester_member.approval_process == 'Linear_all_have_to_agree' ||
        request.requester_member.approval_process == 'Linear_one_has_to_agree'
      ) {
        let approver_member_id = sapprovers.find((x) => x.status == 'PENDING')?.approver_member_id;
        if (!approver_member_id) return;
        sapprovers = sapprovers.filter((x) => x.approver_member_id == approver_member_id);
      }

      for (let index = 0; index < sapprovers.length; index++) {
        const approver = sapprovers[index];
        if (!approver) continue;
        if (request.requester_member.approval_process !== 'Parallel_one_has_to_agree' && approver.status !== 'PENDING')
          continue;

        const approver_member = gApprovers.find(
          (x) => x.approver_member_id == approver.approver_member_id
        )?.approver_member;
        if (!approver_member) continue;
        if (!approver_member.email) continue;
        const date = await prepareDate(request, schedules, request.workspace.schedule, approver_member);
        const fullDate = await prepareDate(request, schedules, request.workspace.schedule, approver_member, true);
        const t = await getT(approver_member?.language ?? 'en', 'mails');
        const approvers = await getApproversForEmail(t, request.details.id);
        let tapprovers = transateApproverStatus(approvers, t);

        if (approver_member?.microsoft_user_id) {
          try {
            const picture = createPicture(
              request.workspace.company_logo_url,
              request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
            );
            if (approver_member.notifications_receiving_method === 'EmailAndTeamsBot') {
              await sendUniversalTransactionalMail({
                prisma: prisma,
                workspace_id: request.workspace_id,
                subject: t('you-have-a-leave_type_name-to-approve', {
                  requester_name: request.requester_member.name,
                  leave_type_name: request.details.leave_type.name,
                  choose_date:
                    request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                      ? t('on_date', { date })
                      : t('from_date', { date })
                }),
                params: {
                  pageTitle: t('you-have-a-leave_type_name-to-approve', {
                    requester_name: request.requester_member.name,
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date })
                  }),
                  h1: t('you-have-a-leave_type_name-to-approve', {
                    requester_name: request.requester_member.name,
                    leave_type_name: request.details.leave_type.name,
                    choose_date:
                      request.start.getDate() === request.end.getDate() ||
                      request.details.workday_absence_duration === 1
                        ? t('on_date', { date })
                        : t('from_date', { date })
                  }),
                  firstLine: t('hey-approver_name', { approver_name: approver_member.name }),
                  secondLine: t('second_line_app_or_dec', { leave_type_name: request.details.leave_type.name }),
                  thirdLine:
                    request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                      ? t('details_of_request', {
                          employee_fullname: request.requester_member.name,
                          date: fullDate,
                          leave_time_within_working_hours:
                            request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                              ? ''
                              : t('leave_time_within_working_hours', {
                                  value: formatDuration(
                                    request.details.workday_absence_duration,
                                    approver_member?.language ?? 'en',
                                    request.leave_unit,
                                    true,
                                    t
                                  )
                                }),
                          leave_request_reason:
                            request.details.reason && request.details.reason.trim() !== ''
                              ? t('leave_request_reason', { reason: request.details.reason })
                              : '',
                          additional_html:
                            request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                              ? t('deducted_from', {
                                  allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                                  value: formatDuration(
                                    request.details.workday_absence_duration,
                                    approver_member?.language ?? 'en',
                                    request.leave_unit,
                                    true,
                                    t
                                  )
                                })
                              : '',
                          created_by_another:
                            request.createdBy_member_id !== request.requester_member_id && createdBy
                              ? t('request_created_by', { created_by_name: createdBy.name })
                              : ''
                        })
                      : t('details_of_request_multiple_days', {
                          employee_fullname: request.requester_member.name,
                          date: fullDate,
                          leave_time_within_working_hours:
                            request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                              ? ''
                              : t('leave_time_within_working_hours', {
                                  value: formatDuration(
                                    request.details.workday_absence_duration,
                                    approver_member?.language ?? 'en',
                                    request.leave_unit,
                                    true,
                                    t
                                  )
                                }),
                          leave_request_reason:
                            request.details.reason && request.details.reason.trim() !== ''
                              ? t('leave_request_reason', { reason: request.details.reason })
                              : '',
                          additional_html:
                            request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                              ? t('deducted_from', {
                                  allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                                  value: formatDuration(
                                    request.details.workday_absence_duration,
                                    approver_member?.language ?? 'en',
                                    request.leave_unit,
                                    true,
                                    t
                                  )
                                })
                              : '',
                          created_by_another:
                            request.createdBy_member_id !== request.requester_member_id && createdBy
                              ? t('request_created_by', { created_by_name: createdBy.name })
                              : ''
                        }),
                  fourthLine:
                    tapprovers.length == 1
                      ? ''
                      : generateRequestStatusHeader(request.details.approval_process, tapprovers, t, 'PENDING'),
                  buttonText: t('approve-or-decline'),
                  link:
                    'https://app.absentify.com/calendar/' +
                    request.requester_member_id +
                    '?request_id=' +
                    data.request_id,
                  teamsLinkText: t('approve-or-decline-in-teams'),
                  teamsLink: createTeamsDeepLinkIntoRequestDetail({
                    member_id: request.requester_member_id,
                    request_id: data.request_id
                  }),
                  approvers: tapprovers.length == 1 ? null : tapprovers,
                  company_image_url: request.workspace.company_logo_url ? picture : null
                },
                to: {
                  email: approver_member.email,
                  name: approver_member.name ?? approver_member.email
                },
                replyTo: {
                  email: request.requester_member.email
                    ? request.requester_member.email
                    : 'notifications@absentify.com',
                  name: request.requester_member.name ? request.requester_member.name : 'notifications@absentify.com'
                }
              });
            }

            const activityId = await sendAdaptiveCard(
              prisma,
              {
                pageTitle: t('you-have-a-leave_type_name-to-approve', {
                  requester_name: request.requester_member.name,
                  leave_type_name: request.details.leave_type.name,
                  choose_date:
                    request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                      ? t('on_date', { date })
                      : t('from_date', { date })
                }),
                h1: t('you-have-a-leave_type_name-to-approve', {
                  requester_name: request.requester_member.name,
                  leave_type_name: request.details.leave_type.name,
                  choose_date:
                    request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                      ? t('on_date', { date })
                      : t('from_date', { date })
                }),
                firstLine: t('hey-approver_name', { approver_name: approver_member.name }),
                secondLine: t('second_line_app_or_dec', { leave_type_name: request.details.leave_type.name }),
                thirdLine:
                  request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                    ? t('details_of_request', {
                        employee_fullname: request.requester_member.name,
                        date: fullDate,
                        leave_time_within_working_hours:
                          request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                            ? ''
                            : t('leave_time_within_working_hours', {
                                value: formatDuration(
                                  request.details.workday_absence_duration,
                                  approver_member?.language ?? 'en',
                                  request.leave_unit,
                                  true,
                                  t
                                )
                              }),
                        leave_request_reason:
                          request.details.reason && request.details.reason.trim() !== ''
                            ? t('leave_request_reason', { reason: request.details.reason })
                            : '',
                        additional_html:
                          request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                            ? t('deducted_from', {
                                allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                                value: formatDuration(
                                  request.details.workday_absence_duration,
                                  approver_member?.language ?? 'en',
                                  request.leave_unit,
                                  true,
                                  t
                                )
                              })
                            : '',
                        created_by_another:
                          request.createdBy_member_id !== request.requester_member_id && createdBy
                            ? t('request_created_by', { created_by_name: createdBy.name })
                            : ''
                      })
                    : t('details_of_request_multiple_days', {
                        employee_fullname: request.requester_member.name,
                        date: fullDate,
                        leave_time_within_working_hours:
                          request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                            ? ''
                            : t('leave_time_within_working_hours', {
                                value: formatDuration(
                                  request.details.workday_absence_duration,
                                  approver_member?.language ?? 'en',
                                  request.leave_unit,
                                  true,
                                  t
                                )
                              }),
                        leave_request_reason:
                          request.details.reason && request.details.reason.trim() !== ''
                            ? t('leave_request_reason', { reason: request.details.reason })
                            : '',
                        additional_html:
                          request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                            ? t('deducted_from', {
                                allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                                value: formatDuration(
                                  request.details.workday_absence_duration,
                                  approver_member?.language ?? 'en',
                                  request.leave_unit,
                                  true,
                                  t
                                )
                              })
                            : '',
                        created_by_another:
                          request.createdBy_member_id !== request.requester_member_id && createdBy
                            ? t('request_created_by', { created_by_name: createdBy.name })
                            : ''
                      }),
                fourthLine:
                  tapprovers.length == 1
                    ? ''
                    : generateRequestStatusHeader(request.details.approval_process, tapprovers, t, 'PENDING'),
                fifthLine: '',
                buttonText: t('approve-or-decline'),
                buttonLink: createTeamsDeepLinkIntoRequestDetail({
                  member_id: request.requester_member_id,
                  request_id: data.request_id
                }),
                request_id: data.request_id,
                showApprovalActions: false,
                users: tapprovers.length == 1 ? [] : tapprovers
              },
              approver_member.id
            );
            if (activityId)
              await prisma.requestApprover.update({
                where: { uuid: approver.uuid },
                data: { adaptive_card_id: activityId }
              });
          } catch (e) {
            Sentry.captureException(e);
          }
        }
      }
    });
  }
);

export const notificationRequestUpdateRequester = inngest.createFunction(
  {
    id: slugify('Notification: Update requester about new status'),
    name: 'Notification: Update requester about new status'
  },
  { event: 'request/notifications.update_requester' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          requester_adaptive_card_id: true,
          workspace_id: true,
          workspace: {
            select: {
              company_logo_url: true,
              company_logo_ratio_square: true,
              schedule: { select: defaultWorkspaceScheduleSelect },
              global_date_format: true,
              global_time_format: true
            }
          },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, allowance_type: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              approval_process: true,
              email: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true,
              time_format: true,
              notifications_receiving_method: true,
              status: true
            }
          }
        }
      });
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      if (!request.workspace.schedule) throw new Error('workspace schedule not found');
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(request.requester_member?.language ?? 'en', 'mails');
      if (!request.requester_member?.email) return;
      if (!request.requester_member.microsoft_user_id) return;
      if (request.requester_member.status === Status.INACTIVE) return;
      const picture = createPicture(
        request.workspace.company_logo_url,
        request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
      );
      const approvers = await getApproversForEmail(t, request.details.id);
      let tapprovers = transateApproverStatus([...approvers], t);
      const schedules = await prisma.memberSchedule.findMany({
        where: { member_id: request.requester_member.id },
        select: defaultMemberScheduleSelect
      });

      const fullDate = await prepareDate(
        request,
        schedules,
        request.workspace.schedule,
        request.requester_member,
        true
      );
      const decliner = approvers.findLast((app) => app.status === 'DECLINED');
      const original_approver = approvers.find(
        (app) => app.approver_member_id === data.updated_by?.original_approver_id
      );
      if (request.requester_member.notifications_receiving_method === 'EmailAndTeamsBot') {
        await sendUniversalTransactionalMail({
          prisma: prisma,
          workspace_id: request.workspace_id,
          subject: t('there-is-an-update-to-your-out-of-office-request'),
          params: {
            pageTitle: t('there-is-an-update-to-your-out-of-office-request'),
            h1: t('there-is-an-update-to-your-out-of-office-request'),
            firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
            secondLine: data.updated_by
              ? t('approver_changed', {
                  another_manager_name: data.updated_by.name,
                  original_approver: original_approver?.name,
                  leave_type_name: request.details.leave_type.name
                })
              : t('an-approver-changed-your-leave_type_name-request', {
                  leave_type_name: request.details.leave_type.name
                }),
            thirdLine:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('third_line_updated', {
                    date: fullDate,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          }) +
                          generateRequestStatusHeader(
                            request.requester_member.approval_process,
                            tapprovers,
                            t,
                            'PENDING'
                          )
                        : ''
                  })
                : t('third_line_updated_multiple_days', {
                    date: fullDate,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          }) +
                          generateRequestStatusHeader(
                            request.requester_member.approval_process,
                            tapprovers,
                            t,
                            'PENDING'
                          )
                        : ''
                  }),
            fourthLine: decliner ? t('decliner_reason', { reason: decliner.reason, decliner: decliner.name }) : '',
            buttonText: t('view-request'),
            link:
              'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + data.request_id,
            teamsLinkText: t('view-request-in-teams'),
            teamsLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            approvers: tapprovers,
            company_image_url: request.workspace.company_logo_url ? picture : null
          },
          to: {
            email: request.requester_member.email,
            name: request.requester_member.name ?? request.requester_member.email
          },
          replyTo: {
            email: request.requester_member?.email ? request.requester_member.email : 'notifications@absentify.com',
            name: request.requester_member.name ? request.requester_member.name : 'notifications@absentify.com'
          }
        });
      }

      if (request.requester_adaptive_card_id) {
        await updateAdaptiveCard(
          prisma,
          {
            pageTitle: t('there-is-an-update-to-your-out-of-office-request'),
            h1: t('there-is-an-update-to-your-out-of-office-request'),
            firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
            secondLine: data.updated_by
              ? t('approver_changed', {
                  another_manager_name: data.updated_by.name,
                  original_approver: original_approver?.name,
                  leave_type_name: request.details.leave_type.name
                })
              : t('an-approver-changed-your-leave_type_name-request', {
                  leave_type_name: request.details.leave_type.name
                }),
            thirdLine:
              request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
                ? t('third_line_updated', {
                    date: fullDate,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          }) +
                          generateRequestStatusHeader(
                            request.requester_member.approval_process,
                            tapprovers,
                            t,
                            'PENDING'
                          )
                        : ''
                  })
                : t('third_line_updated_multiple_days', {
                    date: fullDate,
                    number_of_days: formatDuration(
                      request.details.workday_absence_duration,
                      request.requester_member.language,
                      request.leave_unit,
                      true,
                      t
                    ),
                    additional_html:
                      request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                        ? t('deducted_from', {
                            allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                            value: formatDuration(
                              request.details.workday_absence_duration,
                              request.requester_member.language,
                              request.leave_unit,
                              true,
                              t
                            )
                          }) +
                          generateRequestStatusHeader(
                            request.requester_member.approval_process,
                            tapprovers,
                            t,
                            'PENDING'
                          )
                        : ''
                  }),
            fourthLine: decliner ? t('decliner_reason', { reason: decliner.reason, decliner: decliner.name }) : '',
            fifthLine: '',
            buttonText: t('view-request'),
            buttonLink: createTeamsDeepLinkIntoRequestDetail({
              member_id: request.requester_member.id,
              request_id: data.request_id
            }),
            request_id: data.request_id,
            showApprovalActions: false,
            users: tapprovers
          },
          request.requester_member.id,
          request.requester_adaptive_card_id
        );
      }
      const activityId = await sendAdaptiveCard(
        prisma,
        {
          pageTitle: t('there-is-an-update-to-your-out-of-office-request'),
          h1: t('there-is-an-update-to-your-out-of-office-request'),
          firstLine: t('hey-requester_name', { requester_name: request.requester_member.name }),
          secondLine: data.updated_by
            ? t('approver_changed', {
                another_manager_name: data.updated_by.name,
                original_approver: original_approver?.name,
                leave_type_name: request.details.leave_type.name
              })
            : t('an-approver-changed-your-leave_type_name-request', {
                leave_type_name: request.details.leave_type.name
              }),
          thirdLine:
            request.start.getDate() === request.end.getDate() || request.details.workday_absence_duration === 1
              ? t('third_line_updated', {
                  date: fullDate,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    request.requester_member.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            request.requester_member.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        }) +
                        generateRequestStatusHeader(request.requester_member.approval_process, tapprovers, t, 'PENDING')
                      : ''
                })
              : t('third_line_updated_multiple_days', {
                  date: fullDate,
                  number_of_days: formatDuration(
                    request.details.workday_absence_duration,
                    request.requester_member.language,
                    request.leave_unit,
                    true,
                    t
                  ),
                  additional_html:
                    request.details.workday_absence_duration > 0 && request.details.leave_type.allowance_type
                      ? t('deducted_from', {
                          allowance_name: request.details.leave_type.allowance_type?.name ?? t('allowance'),
                          value: formatDuration(
                            request.details.workday_absence_duration,
                            request.requester_member.language,
                            request.leave_unit,
                            true,
                            t
                          )
                        }) +
                        generateRequestStatusHeader(request.requester_member.approval_process, tapprovers, t, 'PENDING')
                      : ''
                }),
          fourthLine: decliner ? t('decliner_reason', { reason: decliner.reason, decliner: decliner.name }) : '',
          fifthLine: '',
          buttonText: t('view-request'),
          buttonLink: createTeamsDeepLinkIntoRequestDetail({
            member_id: request.requester_member.id,
            request_id: data.request_id
          }),
          request_id: data.request_id,
          showApprovalActions: false,
          users: tapprovers
        },
        request.requester_member.id
      );
      if (activityId)
        await prisma.request.update({
          where: { id: data.request_id },
          data: { requester_adaptive_card_id: activityId }
        });
    });
  }
);

export const notificationRequestSendReminder = inngest.createFunction(
  { id: slugify('Notification: Send reminder'), name: 'Notification: Send reminder' },
  { event: 'request/notifications.send_reminder' },
  async ({ event, step }) => {
    const data = event.data;

    await step.run('Send Notification', async () => {
      const request = await prisma.request.findUnique({
        where: { id: data.request_id },
        select: {
          id: true,
          start: true,
          end: true,
          start_at: true,
          end_at: true,
          leave_unit: true,
          workspace_id: true,
          workspace: { select: { company_logo_url: true, company_logo_ratio_square: true } },
          details: {
            select: {
              id: true,
              reason: true,
              cancel_reason: true,
              status: true,
              workday_absence_duration: true,
              leave_type: { select: { take_from_allowance: true, name: true, leave_unit: true } }
            }
          },
          requester_member: {
            select: {
              id: true,
              name: true,
              email: true,
              approval_process: true,
              microsoft_user_id: true,
              microsoft_tenantId: true,
              language: true,
              date_format: true
            }
          }
        }
      });
      const approver_member = await prisma.member.findUnique({
        where: { id: data.member_id },
        select: {
          language: true,
          date_format: true,
          microsoft_user_id: true,
          email: true,
          name: true,
          notifications_receiving_method: true,
          id: true
        }
      });
      if (!approver_member || !approver_member.email) throw new Error('approver_member not found');
      if (!request) throw new Error('request not found');
      if (!request.details) throw new Error('request details not found');
      const getT = ensureAvailabilityOfGetT();
      const t = await getT(approver_member?.language ?? 'en', 'mails');
      let approvers: {
        uuid: string;
        name: string;
        image: string;
        status: RequestApproverStatus;
        approver_member_id: string | null;
      }[] = await getApproversForEmail(t, request.details.id);

      let fromcontingent = '';
      if (request.details.leave_type.take_from_allowance) {
        fromcontingent = t('duration-from-contingent-will-be-used', {
          duration: formatDuration(
            request.details.workday_absence_duration,
            approver_member?.language ?? 'en',
            request.leave_unit,
            true,
            t
          )
        });
      }

      if (approver_member?.microsoft_user_id) {
        try {
          const picture = createPicture(
            request.workspace.company_logo_url,
            request.workspace.company_logo_ratio_square ? '256x256' : '400x80'
          );
          if (approver_member.notifications_receiving_method) {
            await sendUniversalTransactionalMail({
              prisma: prisma,
              workspace_id: request.workspace_id,
              subject: t('reminder_you-have-a-leave_type_name-to-approve', {
                leave_type_name: request.details.leave_type.name
              }),
              params: {
                pageTitle: t('reminder_you-have-a-leave_type_name-to-approve', {
                  leave_type_name: request.details.leave_type.name
                }),
                h1: t('reminder_you-have-a-leave_type_name-to-approve', {
                  leave_type_name: request.details.leave_type.name
                }),
                firstLine: t('hey-approver_name', { approver_name: approver_member.name + '' }),
                secondLine: t('please-process-the-following-leave_type_name-request-from-requester_name', {
                  leave_type_name: request.details.leave_type.name,
                  requester_name: request.requester_member.name
                }),
                thirdLine:
                  generateRequestDetailsHtml(
                    {
                      end: request.end,
                      end_at: request.end_at,
                      start: request.start,
                      start_at: request.start_at
                    },
                    t,
                    approver_member?.date_format + ''
                  ) +
                  ' ' +
                  fromcontingent,
                fourthLine:
                  !approvers || approvers.length == 1
                    ? ''
                    : generateRequestStatusHeader(request.requester_member.approval_process, approvers, t, 'PENDING'),
                buttonText: t('approve-or-decline'),
                link: 'https://app.absentify.com/calendar/' + request.requester_member.id + '?request_id=' + request.id,
                teamsLinkText: t('approve-or-decline-in-teams'),
                teamsLink: createTeamsDeepLinkIntoRequestDetail({
                  member_id: request.requester_member.id,
                  request_id: request.id
                }),
                approvers: !approvers || approvers.length == 1 ? null : approvers,
                company_image_url: request.workspace.company_logo_url ? picture : null
              },
              to: {
                email: approver_member.email,
                name: approver_member.name ?? approver_member.email
              },
              replyTo: {
                email: request.requester_member.email ? request.requester_member.email : 'notifications@absentify.com',
                name: request.requester_member.name ? request.requester_member.name : 'notifications@absentify.com'
              }
            });
          }
          const activityId = await sendAdaptiveCard(
            prisma,
            {
              pageTitle: t('reminder_you-have-a-leave_type_name-to-approve', {
                leave_type_name: request.details.leave_type.name
              }),
              h1: t('reminder_you-have-a-leave_type_name-to-approve', {
                leave_type_name: request.details.leave_type.name
              }),
              firstLine: t('hey-approver_name', { approver_name: approver_member.name + '' }),
              secondLine: t('please-process-the-following-leave_type_name-request-from-requester_name', {
                leave_type_name: request.details.leave_type.name,
                requester_name: request.requester_member.name
              }),
              thirdLine:
                generateRequestDetailsHtml(
                  {
                    end: request.end,
                    end_at: request.end_at,
                    start: request.start,
                    start_at: request.start_at
                  },
                  t,
                  approver_member?.date_format + ''
                ) +
                ' ' +
                fromcontingent,
              fourthLine:
                !approvers || approvers.length == 1
                  ? ''
                  : generateRequestStatusHeader(request.requester_member.approval_process, approvers, t, 'PENDING'),
              fifthLine: '',
              buttonText: t('approve-or-decline'),

              buttonLink: createTeamsDeepLinkIntoRequestDetail({
                member_id: request.requester_member.id,
                request_id: request.id
              }),
              request_id: request.id,
              showApprovalActions: false,
              users: !approvers || approvers.length == 1 ? [] : approvers
            },
            approver_member.id
          );
          const rightApprover = approvers.find((approver) => approver.approver_member_id === data.member_id);
          if (rightApprover) {
            const currentDate = new Date();
            await prisma.requestApprover.update({
              where: { uuid: rightApprover.uuid },
              data: { reminderDate: currentDate }
            });
          }
        } catch (e) {
          console.log(e);
          Sentry.captureException(e);
        }
      }
    });
  }
);

function transateApproverStatus(
  approvers:
    | { name: string; image: string; status: RequestApproverStatus; reason: string | null; email: string | null }[]
    | {
        uuid: string;
        name: string;
        email: string | null;
        image: string;
        status: RequestApproverStatus;
        approver_member_id: string | null;
        reason: string | null;
      }[],
  t: Translate
) {
  approvers = approvers.map((x) => {
    const approverCopy = { ...x };
    if (approverCopy.status == RequestApproverStatus.APPROVED) approverCopy.status = t('Approved');
    if (approverCopy.status == RequestApproverStatus.PENDING) approverCopy.status = t('Pending');
    if (approverCopy.status == RequestApproverStatus.CANCELED) approverCopy.status = t('canceled');
    if (approverCopy.status == RequestApproverStatus.CANCELED_BY_ANOTHER_MANAGER)
      approverCopy.status = t('canceled-by-another-manager');
    if (approverCopy.status == RequestApproverStatus.DECLINED) approverCopy.status = t('declined');
    if (approverCopy.status == RequestApproverStatus.DECLINED_BY_ANOTHER_MANAGER)
      approverCopy.status = t('declined-by-another-manager');
    if (approverCopy.status == RequestApproverStatus.APPROVED_BY_ANOTHER_MANAGER)
      approverCopy.status = t('Approved_by_another_manager');

    return approverCopy;
  });
  return approvers;
}
function sortApprovers(
  approver: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
  }[]
) {
  const items: string[] = [];
  const approvers: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
  }[] = [];
  const first = approver.find((y) => y.predecessor_request_member_approver_id == null);
  if (first) {
    items.push(first.approver_member_id + '');
    approvers.push(first);
  }

  while (true) {
    const next = approver.find((y) => y.predecessor_request_member_approver_id == items[items.length - 1]);
    if (next) {
      // Überprüfe, ob der Genehmigende bereits in der Liste 'approvers' existiert
      if (approvers.includes(next)) {
        console.warn('Zyklischer Verweis gefunden, Schleife wird unterbrochen.');
        break;
      }
      if (next.approver_member_id) items.push(next.approver_member_id + '');
      approvers.push(next);
    } else {
      // Wenn kein nächster Genehmigender gefunden wird, beende die Schleife
      break;
    }
  }

  return approvers;
}
async function getApproversForEmail(t: Translate, request_details_id: string) {
  const a = await prisma.requestApprover.findMany({
    where: { request_details_id: request_details_id },
    select: {
      uuid: true,
      reason: true,
      status: true,
      approver_member_id: true,
      predecessor_request_member_approver_id: true,
      reminderDate: true,
      approver_member: {
        select: {
          name: true,
          has_cdn_image: true,
          email: true,
          microsoft_tenantId: true,
          microsoft_user_id: true,
          language: true,
          notifications_receiving_method: true,
          date_format: true,
          time_format: true
        }
      }
    }
  });

  const sa = sortApproversWithImage(
    a.map((x) => {
      return {
        reminderDate: x.reminderDate,
        approver_member_id: x.approver_member_id,
        predecessor_request_member_approver_id: x.predecessor_request_member_approver_id,
        status: x.status,
        uuid: x.uuid,
        image: x.approver_member?.has_cdn_image
          ? `https://data.absentify.com/profile-pictures/${x.approver_member.microsoft_user_id}_64x64.jpeg`
          : defaultImage,
        name: x.approver_member?.name ?? t('Deleted_User'),
        reason: x.reason,
        email: x.approver_member?.email ?? '',
        microsoft_tenantId: x.approver_member?.microsoft_tenantId ?? null,
        microsoft_user_id: x.approver_member?.microsoft_user_id ?? null,
        language: x.approver_member?.language ?? null,
        notifications_receiving_method: x.approver_member?.notifications_receiving_method ?? null,
        date_format: x.approver_member?.date_format ?? null,
        time_format: x.approver_member?.time_format ?? null
      };
    })
  );
  return sa;
}
function sortApproversWithImage(
  approver: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    name: string;
    image: string;
    reason: string | null;
    email: string | null;
    microsoft_tenantId: string | null;
    microsoft_user_id: string | null;
    language: string | null;
    notifications_receiving_method: NotificationReceivingMethod | null;
    date_format: string | null;
    time_format: string | null;
  }[]
) {
  const items: string[] = [];
  const approvers: {
    uuid: string;
    status: RequestApproverStatus;
    approver_member_id: string | null;
    predecessor_request_member_approver_id: string | null;
    name: string;
    image: string;
    reason: string | null;
    email: string | null;
    microsoft_tenantId: string | null;
    microsoft_user_id: string | null;
    language: string | null;
    notifications_receiving_method: NotificationReceivingMethod | null;
    date_format: string | null;
    time_format: string | null;
  }[] = [];
  const first = approver.find((y) => y.predecessor_request_member_approver_id == null);
  if (first) {
    items.push(first.approver_member_id + '');
    approvers.push(first);
  }

  while (true) {
    const next = approver.find((y) => y.predecessor_request_member_approver_id == items[items.length - 1]);
    if (next) {
      // Überprüfe, ob der Genehmigende bereits in der Liste 'approvers' existiert
      if (approvers.includes(next)) {
        console.warn('Zyklischer Verweis gefunden, Schleife wird unterbrochen.');
        break;
      }
      if (next.approver_member_id) items.push(next.approver_member_id + '');
      approvers.push(next);
    } else {
      // Wenn kein nächster Genehmigender gefunden wird, beende die Schleife
      break;
    }
  }
  return approvers;
}
function removeDateComponent(dateStr: string, removeMonth = false) {
  dateStr = dateStr.replace(/([./ -])?yyyy([./ -])?/, '');

  if (removeMonth) {
    dateStr = dateStr.replace(/([./ -])?MM([./ -])?/, '');
  }

  return dateStr.trim();
}
function formatTimeUTC(date: Date, is24HourFormat: boolean) {
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  if (is24HourFormat) {
    return `${formattedHours}:${formattedMinutes}`;
  } else {
    const hours12 = hours % 12 || 12;
    const amPm = hours < 12 ? 'AM' : 'PM';
    return `${hours12}:${formattedMinutes} ${amPm}`;
  }
}
async function prepareDate(
  request: {
    start: Date;
    end: Date;
    start_at: StartAt;
    end_at: EndAt;
    leave_unit: LeaveUnit;
    details: { leave_type: { leave_unit: LeaveUnit } } | undefined | null;
    workspace: {
      global_time_format: string;
      global_date_format: string;
    };
  },
  memberSchedules: defaultMemberSelectOutput['schedules'],
  workspaceSchedule: RouterOutputs['workspace_schedule']['edit'],
  approver_member: {
    date_format: string | null;
    time_format: string | null;
    language: string | null;
  },
  fullDate: boolean = false
) {
  fullDate;
  if (!approver_member.date_format) approver_member.date_format = request.workspace.global_date_format;
  if (!approver_member.time_format) approver_member.time_format = request.workspace.global_time_format;
  const getT = ensureAvailabilityOfGetT();
  const t = await getT(approver_member?.language ?? 'en', 'mails');
  const notFullDay = isHourUnit(request.leave_unit)
    ? true
    : request.start_at !== 'morning' || request.end_at !== 'end_of_day';

  const r = cloneDeep(request);
  setRequestStartEndTimesBasedOnSchedule(r, memberSchedules, workspaceSchedule);

  const formattedStart = formatTimeUTC(r.start, approver_member.time_format === TimeFormat.H24);

  const formattedEnd = formatTimeUTC(r.end, approver_member.time_format === TimeFormat.H24);

  let date = notFullDay
    ? `${format(dateFromDatabaseIgnoreTimezone(request.start), approver_member.date_format)} ${t(
        'from'
      )} ${formattedStart} - ${formattedEnd}`
    : format(dateFromDatabaseIgnoreTimezone(request.start), approver_member.date_format);
  if (request.start.getDate() !== request.end.getDate()) {
    date = notFullDay
      ? `${format(
          dateFromDatabaseIgnoreTimezone(request.start),
          removeDateComponent(approver_member.date_format, request.start.getMonth() === request.end.getMonth())
        )} ${
          isHourUnit(r.leave_unit) ? formattedStart + ' ' : request.start_at !== 'morning' ? `(${formattedStart}) ` : ''
        }- ${format(dateFromDatabaseIgnoreTimezone(request.end), approver_member.date_format)} ${
          isHourUnit(r.leave_unit) ? formattedEnd : request.end_at !== 'end_of_day' ? `(${formattedEnd})` : ''
        }`
      : `${format(
          dateFromDatabaseIgnoreTimezone(request.start),
          removeDateComponent(approver_member.date_format, request.start.getMonth() === request.end.getMonth())
        )} - ${format(dateFromDatabaseIgnoreTimezone(request.end), approver_member.date_format)}`;
  }
  let fulldayDate = notFullDay
    ? `${format(
        dateFromDatabaseIgnoreTimezone(request.start),
        approver_member.date_format
      )} ${formattedStart} - ${formattedEnd}`
    : format(dateFromDatabaseIgnoreTimezone(request.start), approver_member.date_format);
  if (request.start.getDate() !== request.end.getDate()) {
    fulldayDate = notFullDay
      ? `${format(dateFromDatabaseIgnoreTimezone(request.start), approver_member.date_format)} ${
          isHourUnit(r.leave_unit) ? formattedStart + ' ' : request.start_at !== 'morning' ? `(${formattedStart}) ` : ''
        }- ${format(dateFromDatabaseIgnoreTimezone(request.end), approver_member.date_format)} ${
          isHourUnit(r.leave_unit) ? formattedEnd : request.end_at !== 'end_of_day' ? `(${formattedEnd})` : ''
        }`
      : `${format(dateFromDatabaseIgnoreTimezone(request.start), approver_member.date_format)} - ${format(
          dateFromDatabaseIgnoreTimezone(request.end),
          approver_member.date_format
        )}`;
  }
  return fullDate ? fulldayDate : date;
}
function createTeamsDeepLinkIntoRequestDetail(data: { member_id: string; request_id: string }) {
  const subEntityId = Buffer.from(JSON.stringify(data)).toString('base64');
  return `https://teams.microsoft.com/l/entity/fbd349eb-146f-4e94-af76-df4754f40749/6dd703da-58b7-4dd7-9037-d6476ab068e8?context=${encodeURIComponent(
    '{"subEntityId": "' + subEntityId + '"}'
  )}`;
}
async function sendErrorMail(
  admin: any,
  request: any,
  t: Translate,
  picture: string | null,
  timeghost_sync_setting_name: string
) {
  const subject = t(`sync_request_to_timeghost_failed-subject`);
  const pageTitle = t(`sync_request_to_timeghost_failed-pageTitle`);
  const h1 = t(`sync_request_to_timeghost_failed-h1`, { timeghost_sync_setting_name });
  const firstLine = t(`sync_request_to_timeghost_failed-firstLine`);
  const secondLine = t(`sync_request_to_timeghost_failed-secondLine`);
  const thirdLine = t(`sync_request_to_timeghost_failed-thirdLine`, { timeghost_sync_setting_name });
  const fourthLine = t(`sync_request_to_timeghost_failed-fourthLine`);
  const link = `https://app.absentify.com/${
    request.requester_member.language ?? 'en'
  }/settings/organisation/integrations/timeghost/settings`;
  const teamsLink = `https://teams.cloud.microsoft.com/${
    request.requester_member.language ?? 'en'
  }/settings/organisation/integrations/timeghost/settings`;

  await sendUniversalTransactionalMail({
    prisma: prisma,
    workspace_id: request.workspace_id,
    subject,
    params: {
      pageTitle,
      h1,
      firstLine,
      secondLine,
      thirdLine,
      fourthLine,
      approvers: [],
      buttonText: t('view-settings'),
      link,
      teamsLinkText: t('view-settings-in-teams'),
      teamsLink,
      company_image_url: request.workspace.company_logo_url ? picture : null,
      reason: ''
    },
    to: {
      email: admin.email + '',
      name: admin.name + ''
    },
    replyTo: {
      email: 'notifications@absentify.com',
      name: 'notifications@absentify.com'
    }
  });
}
