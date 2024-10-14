import {
  type MemberSchedule,
  OutOfOfficeMessageStatus,
  Prisma,
  TimeFormat,
  type WorkspaceSchedule
} from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import axios from 'axios';
import { format } from 'date-fns';
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { decode } from 'jsonwebtoken';
import { getMicrosoftMailboxAccessToken } from 'lib/getMicrosoftAccessToken';
import { getDayStartAndEndTimeFromschedule, getscheduleFreeTimes } from 'lib/requestUtilities';
import { prisma } from '~/server/db';
import { ensureAvailabilityOfGetT } from './monkey-patches';
import { ensureTimeZoneAvailability } from '~/helper/ensureTimeZoneAvailability';
import { hasEnterpriseSubscription } from './subscriptionHelper';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { sendMail } from './sendInBlueContactApi';
import { getApproverValue } from './getApproverHelper';

export const out_of_office_reply_select = Prisma.validator<Prisma.RequestSelect>()({
  id: true,
  start: true,
  start_at: true,
  out_of_office_message_status: true,
  end: true,
  end_at: true,
  workspace_id: true,
  workspace: {
    select: {
      global_timezone: true,
      schedule: {
        select: {
          monday_am_start: true,
          monday_am_end: true,
          monday_pm_start: true,
          monday_pm_end: true,
          monday_am_enabled: true,
          monday_pm_enabled: true,
          tuesday_am_start: true,
          tuesday_am_end: true,
          tuesday_pm_start: true,
          tuesday_pm_end: true,
          tuesday_am_enabled: true,
          tuesday_pm_enabled: true,
          wednesday_am_start: true,
          wednesday_am_end: true,
          wednesday_pm_start: true,
          wednesday_pm_end: true,
          wednesday_am_enabled: true,
          wednesday_pm_enabled: true,
          thursday_am_start: true,
          thursday_am_end: true,
          thursday_pm_start: true,
          thursday_pm_end: true,
          thursday_am_enabled: true,
          thursday_pm_enabled: true,
          friday_am_start: true,
          friday_am_end: true,
          friday_pm_start: true,
          friday_pm_end: true,
          friday_am_enabled: true,
          friday_pm_enabled: true,
          saturday_am_start: true,
          saturday_am_end: true,
          saturday_pm_start: true,
          saturday_pm_end: true,
          saturday_am_enabled: true,
          saturday_pm_enabled: true,
          sunday_am_start: true,
          sunday_am_end: true,
          sunday_pm_start: true,
          sunday_pm_end: true,
          sunday_am_enabled: true,
          sunday_pm_enabled: true
        }
      },
      subscriptions: {
        select: {
          status: true,
          subscription_plan_id: true,
          cancellation_effective_date: true
        }
      }
    }
  },
  details: {
    select: {
      leave_type_id: true,
      request_approvers: {
        select: {
          approver_member_id: true,
          predecessor_request_member_approver_id: true,
          approver_member: { select: { name: true, email: true } }
        }
      },
      requester_member: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          microsoft_tenantId: true,
          microsoft_user_id: true,
          date_format: true,
          time_format: true,
          language: true,
          timezone: true,
          public_holiday: {
            select: {
              public_holiday_days: { select: { date: true, year: true } }
            }
          },
          schedules: {
            select: {
              from: true,
              monday_am_start: true,
              monday_am_end: true,
              monday_pm_start: true,
              monday_pm_end: true,
              monday_am_enabled: true,
              monday_pm_enabled: true,
              tuesday_am_start: true,
              tuesday_am_end: true,
              tuesday_pm_start: true,
              tuesday_pm_end: true,
              tuesday_am_enabled: true,
              tuesday_pm_enabled: true,
              wednesday_am_start: true,
              wednesday_am_end: true,
              wednesday_pm_start: true,
              wednesday_pm_end: true,
              wednesday_am_enabled: true,
              wednesday_pm_enabled: true,
              thursday_am_start: true,
              thursday_am_end: true,
              thursday_pm_start: true,
              thursday_pm_end: true,
              thursday_am_enabled: true,
              thursday_pm_enabled: true,
              friday_am_start: true,
              friday_am_end: true,
              friday_pm_start: true,
              friday_pm_end: true,
              friday_am_enabled: true,
              friday_pm_enabled: true,
              saturday_am_start: true,
              saturday_am_end: true,
              saturday_pm_start: true,
              saturday_pm_end: true,
              saturday_am_enabled: true,
              saturday_pm_enabled: true,
              sunday_am_start: true,
              sunday_am_end: true,
              sunday_pm_start: true,
              sunday_pm_end: true,
              sunday_am_enabled: true,
              sunday_pm_enabled: true
            }
          }
        }
      }
    }
  }
});

const selectRequestOfUsers = {
  id: true,
  start: true,
  end: true,
  start_at: true,
  end_at: true
};
export type out_of_office_reply_selectOutput = Prisma.RequestGetPayload<{
  select: typeof out_of_office_reply_select;
}>;
export type requests_of_users_selectOutput = Prisma.RequestGetPayload<{
  select: typeof selectRequestOfUsers;
}>;

export async function setOutOfOfficeMessageInUsersProfile(dates: out_of_office_reply_selectOutput[]) {
  function replace(text: string, start: Date, request: out_of_office_reply_selectOutput, end: Date, timezone: string) {
    text = text.replace(/{{firstName}}/g, request.details?.requester_member?.firstName || '');
    text = text.replace(/{{lastName}}/g, request.details?.requester_member?.lastName || '');
    text = text.replace(/{{name}}/g, request.details?.requester_member?.name || '');
    text = text.replace(
      /{{startDate}}/g,
      format(start, request.details?.requester_member?.date_format ?? 'MM/dd/yyyy')
    );
    text = text.replace(
      /{{startTime}}/g,
      formatInTimeZone(
        start,
        ensureTimeZoneAvailability(timezone),
        request.details?.requester_member?.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
      )
    );
    text = text.replace(
      /{{dateOfReturn}}/g,
      format(end, request.details?.requester_member?.date_format ?? 'MM/dd/yyyy')
    );
    text = text.replace(
      /{{timeOfReturn}}/g,
      formatInTimeZone(
        end,
        ensureTimeZoneAvailability(timezone),
        request.details?.requester_member?.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
      )
    );

    // Replacing the placeholders (with and without square brackets)
    text = text.replace(/{{managerName(?:\[(\d+)\])?}}/g, (_, index) => {
      // User enters a 1-based index, so we need to subtract 1
      const userIndex = index ? parseInt(index, 10) - 1 : 0;
      return getApproverValue(request.details?.request_approvers || [], userIndex, 'name');
    });

    text = text.replace(/{{managerMail(?:\[(\d+)\])?}}/g, (_, index) => {
      // User enters a 1-based index, so we need to subtract 1
      const userIndex = index ? parseInt(index, 10) - 1 : 0;
      return getApproverValue(request.details?.request_approvers || [], userIndex, 'email');
    });

    text = text.replace(/{{approverName(?:\[(\d+)\])?}}/g, (_, index) => {
      // User enters a 1-based index, so we need to subtract 1
      const userIndex = index ? parseInt(index, 10) - 1 : 0;
      return getApproverValue(request.details?.request_approvers || [], userIndex, 'name');
    });

    text = text.replace(/{{approverMail(?:\[(\d+)\])?}}/g, (_, index) => {
      // User enters a 1-based index, so we need to subtract 1
      const userIndex = index ? parseInt(index, 10) - 1 : 0;
      return getApproverValue(request.details?.request_approvers || [], userIndex, 'email');
    });

    return text;
  }
  for (let index = 0; index < dates.length; index++) {
    const request = dates[index];
    if (request) {
      if (!request.details) continue;
      if (!request.details.requester_member) continue;
      if (request.details.requester_member?.microsoft_tenantId) {
        try {
          const access_token = await getMicrosoftMailboxAccessToken(
            request.details.requester_member.microsoft_tenantId
          );
          const decodedToken: any = decode(access_token);
          let schedule = request.details.requester_member.schedules.find(
            (x: any) => x.from && x.from <= request.start
          ) as defaultMemberSelectOutput['schedules'][0];
          if (!schedule) {
            schedule = request.workspace.schedule as defaultMemberSelectOutput['schedules'][0];
          }
          const { start } = getDayStartAndEndTimeFromschedule(
            request.start,
            request.start_at == 'morning' ? 'morning' : 'afternoon',
            request.end_at == 'lunchtime' ? 'lunchtime' : 'end_of_day',
            schedule
          );

          if (request.start_at == 'morning') {
            start.setUTCHours(0, 1, 0, 0);
          }
          const date = new Date();
          const now = zonedTimeToUtc(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
          const now_run = utcToZonedTime(
            now,
            ensureTimeZoneAvailability(request.details?.requester_member?.timezone ?? request.workspace.global_timezone)
          );
          if (request.start_at != 'morning' && now_run.getHours() < start.getUTCHours()) {
            continue;
          }

          const [memberMailboxSettings, requestsOfUser] = await prisma.$transaction([
            prisma.memberMailboxSettings.findFirst({
              where: {
                member_id: request.details.requester_member.id,
                workspace_id: request.workspace_id,
                leave_type_id: request.details.leave_type_id
              }
            }),
            prisma.request.findMany({
              select: selectRequestOfUsers,
              where: {
                workspace_id: request.workspace_id,
                start: { gte: request.end },
                requester_member_id: request.details.requester_member.id,
                details: {
                  AND: [
                    { NOT: { status: 'CANCELED' } },
                    { NOT: { status: 'PENDING' } },
                    { NOT: { status: 'DECLINED' } },
                    {
                      OR: [
                        { leave_type: { sync_option: { not: 'OnlyApproved' } } },
                        {
                          AND: [{ leave_type: { sync_option: 'OnlyApproved' } }, { status: 'APPROVED' }]
                        }
                      ]
                    },
                    { leave_type: { outlook_synchronization_show_as: { notIn: ['workingElsewhere'] } } }
                  ]
                }
              }
            })
          ]);
          const nextWorkingDay = getNextWorkingDate(
            request,
            schedule,
            request.details.requester_member.public_holiday.public_holiday_days,
            requestsOfUser
          );

          if (!nextWorkingDay) {
            const admins = await prisma.member.findMany({
              where: { workspace_id: request.workspace_id, is_admin: true },
              select: { name: true, email: true }
            });

            await sendMailToAdminsIfOutOfOfficeMessgeCantBeConfigured({
              workspace_id: request.workspace_id,
              member: {
                email: request.details.requester_member.email ?? '',
                name: request.details.requester_member.name ?? '',
                language: request.details.requester_member.language,
                microsoft_tenantId: request.details.requester_member.microsoft_tenantId
              },
              admins
            });
            await sendMailToUserIfOutOfOfficeMessgeCantBeConfigured({
              workspace_id: request.workspace_id,
              member: {
                email: request.details.requester_member.email ?? '',
                name: request.details.requester_member.name ?? '',
                language: request.details.requester_member.language
              },
              internalReplyMessage: replace(
                memberMailboxSettings?.internalReplyMessage ?? '',
                start,
                request,
                request.end,
                request.details?.requester_member?.timezone ?? request.workspace.global_timezone
              ),
              externalReplyMessage: replace(
                memberMailboxSettings?.externalReplyMessage ?? '',
                start,
                request,
                request.end,
                request.details?.requester_member?.timezone ?? request.workspace.global_timezone
              )
            });
            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.Error
              }
            });
            continue;
          }

          const end = getDayStartAndEndTimeFromschedule(
            nextWorkingDay.date,
            nextWorkingDay.freeTimes.itsFreeMorning ? 'afternoon' : 'morning',
            nextWorkingDay.freeTimes.itsFreeAfternoon ? 'lunchtime' : 'end_of_day',
            schedule
          ).start;

          if (
            now_run.getDate() == end.getDate() &&
            now_run.getMonth() == end.getMonth() &&
            now_run.getFullYear() == end.getFullYear() &&
            now_run.getHours() > end.getUTCHours()
          ) {
            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.None
              }
            });
            continue;
          }
          if (
            decodedToken.roles &&
            decodedToken.roles.find((x: string) => x == 'MailboxSettings.ReadWrite') &&
            memberMailboxSettings
          ) {
            await axios.patch(
              `https://graph.microsoft.com/v1.0/users/${request.details.requester_member.microsoft_user_id}/mailboxSettings`,
              {
                automaticRepliesSetting: {
                  status: 'scheduled',
                  externalAudience: memberMailboxSettings.externalAudience,
                  internalReplyMessage: replace(
                    memberMailboxSettings.internalReplyMessage +
                      (hasEnterpriseSubscription(request.workspace.subscriptions)
                        ? ''
                        : `<br/><hr/>This out-of-office note was automatically configured by <a href='https://absentify.com?ooo-source=${request.id}'>absentify</a>. 🚀 `),
                    start,
                    request,
                    end,
                    request.details?.requester_member?.timezone ?? request.workspace.global_timezone
                  ),
                  externalReplyMessage: replace(
                    memberMailboxSettings.externalReplyMessage +
                      (hasEnterpriseSubscription(request.workspace.subscriptions)
                        ? ''
                        : `<br/><hr/>This out-of-office note was automatically configured by <a href='https://absentify.com?ooo-source=${request.id}'>absentify</a>. 🚀 `),
                    start,
                    request,
                    end,
                    request.details?.requester_member?.timezone ?? request.workspace.global_timezone
                  ),
                  scheduledStartDateTime: {
                    dateTime: start.toISOString().replace('.000Z', ''),
                    timeZone: request.details?.requester_member?.timezone ?? request.workspace.global_timezone // 'Europe/Berlin'
                  },
                  scheduledEndDateTime: {
                    dateTime: end.toISOString().replace('.000Z', ''),
                    timeZone: request.details?.requester_member?.timezone ?? request.workspace.global_timezone // 'Europe/Berlin'
                  }
                }
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${access_token}`
                }
              }
            );
            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.Configured
              }
            });
          } else {
            const admins = await prisma.member.findMany({
              where: { workspace_id: request.workspace_id, is_admin: true },
              select: { name: true, email: true }
            });

            await sendMailToAdminsIfOutOfOfficeMessgeCantBeConfigured({
              workspace_id: request.workspace_id,
              member: {
                email: request.details.requester_member.email ?? '',
                name: request.details.requester_member.name ?? '',
                language: request.details.requester_member.language,
                microsoft_tenantId: request.details.requester_member.microsoft_tenantId
              },
              admins
            });
            await sendMailToUserIfOutOfOfficeMessgeCantBeConfigured({
              workspace_id: request.workspace_id,
              member: {
                email: request.details.requester_member.email ?? '',
                name: request.details.requester_member.name ?? '',
                language: request.details.requester_member.language
              },
              internalReplyMessage: replace(
                memberMailboxSettings?.internalReplyMessage ?? '',
                start,
                request,
                end,
                request.details?.requester_member?.timezone ?? request.workspace.global_timezone
              ),
              externalReplyMessage: replace(
                memberMailboxSettings?.externalReplyMessage ?? '',
                start,
                request,
                end,
                request.details?.requester_member?.timezone ?? request.workspace.global_timezone
              )
            });
            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.Error
              }
            });
          }
        } catch (e) {
          console.log(e);
          Sentry.captureException(e);
          await prisma.request.update({
            where: { id: request.id },
            select: { id: true },
            data: {
              out_of_office_message_status: OutOfOfficeMessageStatus.Error
            }
          });
        }
      }
    }
  }
}

export async function removeOutOfOfficeMessageInUsersProfile(dates: out_of_office_reply_selectOutput[]) {
  for (let index = 0; index < dates.length; index++) {
    const request = dates[index];
    if (request) {
      const date = new Date();
      const now = zonedTimeToUtc(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
      const now_run = utcToZonedTime(
        now,
        ensureTimeZoneAvailability(request.details?.requester_member?.timezone ?? request.workspace.global_timezone)
      );

      if (
        request.details?.requester_member?.microsoft_user_id &&
        request.details?.requester_member?.microsoft_tenantId &&
        request.start_at != 'morning' &&
        ((now_run.getDate() == request.start.getDate() &&
          now_run.getMonth() == request.start.getMonth() &&
          now_run.getFullYear() == request.start.getFullYear()) ||
          (now_run >= request.start && now_run <= request.end))
      ) {
        const access_token = await getMicrosoftMailboxAccessToken(request.details.requester_member.microsoft_tenantId);
        const decodedToken: any = decode(access_token);
        if (decodedToken.roles && decodedToken.roles.find((x: string) => x == 'MailboxSettings.ReadWrite')) {
          try {
            await axios.patch(
              `https://graph.microsoft.com/v1.0/users/${request.details.requester_member.microsoft_user_id}/mailboxSettings`,
              {
                automaticRepliesSetting: {
                  status: 'disabled'
                }
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${access_token}`
                }
              }
            );

            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.None
              }
            });
          } catch (e: any) {
            console.log(e);
            Sentry.captureException(e);
            await prisma.request.update({
              where: { id: request.id },
              select: { id: true },
              data: {
                out_of_office_message_status: OutOfOfficeMessageStatus.Error
              }
            });
          }
        }
      } else {
        await prisma.request.update({
          where: { id: request.id },
          select: { id: true },
          data: { out_of_office_message_status: OutOfOfficeMessageStatus.None }
        });
      }
    }
  }
}
function getNextWorkingDate(
  request: out_of_office_reply_selectOutput,
  schedule: MemberSchedule | WorkspaceSchedule,
  holidays: { date: Date; year: number }[],
  requestsOfUser: requests_of_users_selectOutput[]
) {
  let date = request.end;
  const addDays = function (days: number) {
    // @ts-ignore
    const date = new Date(this.valueOf());
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  };
  if (request.end_at == 'end_of_day') {
    date = addDays.call(date, 1);
  }
  const allDates = [];
  for (let index = 0; index < requestsOfUser.length; index++) {
    const request = requestsOfUser[index];
    if (request) allDates.push(...getDates(request));
  }

  let retVal = null;
  let attempts = 0; // Zähler für die Anzahl der Versuche
  const maxAttempts = 1825; // Maximale Anzahl der Versuche, um 5 Jahre abzudecken

  while (retVal == null && attempts < maxAttempts) {
    const freeTimes = getscheduleFreeTimes(date, schedule);
    const holiday = holidays.find(
      (x) =>
        x.date.getDate() == date.getDate() &&
        x.date.getMonth() == date.getMonth() &&
        x.date.getFullYear() == date.getFullYear()
    );
    if (holiday) {
      date = addDays.call(date, 1);
    } else if (freeTimes.itsFreeAfternoon && freeTimes.itsFreeMorning) {
      date = addDays.call(date, 1);
    } else {
      const findDateInAllRequests = allDates.filter((x) => x.date.toISOString() == date.toISOString());
      if (findDateInAllRequests && findDateInAllRequests.length == 2) {
        date = addDays.call(date, 1);
      } else if (
        findDateInAllRequests &&
        findDateInAllRequests[0] &&
        findDateInAllRequests[0].start_at == 'morning' &&
        findDateInAllRequests[0].end_at == 'end_of_day'
      ) {
        date = addDays.call(date, 1);
      } else if (findDateInAllRequests && findDateInAllRequests[0]) {
        retVal = {
          date,
          freeTimes: {
            itsFreeMorning: findDateInAllRequests[0].start_at == 'morning',
            itsFreeAfternoon: findDateInAllRequests[0].end_at == 'end_of_day'
          }
        };
      } else {
        retVal = { date, freeTimes };
      }
    }
    attempts++;
  }
  if (retVal == null) {
    return null;
  }
  return retVal;
}
function getDates(request: requests_of_users_selectOutput) {
  const dates = [];
  let currentDate = request.start;

  const addDays = function (days: number) {
    // @ts-ignore
    const date = new Date(this.valueOf());
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  };
  while (currentDate <= request.end) {
    dates.push({
      date: currentDate,
      start_at: request.start.toISOString() == currentDate.toISOString() ? request.start_at : 'morning',
      end_at: request.end.toISOString() == currentDate.toISOString() ? request.end_at : 'end_of_day'
    });
    currentDate = addDays.call(currentDate, 1);
  }
  return dates;
}

async function sendMailToUserIfOutOfOfficeMessgeCantBeConfigured(props: {
  member: { name: string; email: string; language: string };
  workspace_id: string;
  internalReplyMessage: string;
  externalReplyMessage: string;
}) {
  const getT = ensureAvailabilityOfGetT();
  const t = await getT(props.member.language, 'backend');

  try {
    await sendMail({
      prisma: prisma,
      workspace_id: props.workspace_id,
      recipients: {
        to: [
          {
            address: props.member.email,
            displayName: props.member.name
          }
        ]
      },
      subject: t('We_cant_set_ooo_message'),
      html: `${t('We_cant_set_ooo_message_body')}<br/><br/>${t(
        'We_cant_set_ooo_message_body_2'
      )} https://outlook.office.com/mail/options/mail/automaticReplies<br/><hr/>${
        props.internalReplyMessage
      }<br/><hr/>${props.externalReplyMessage}<br/><hr/><br/>${t('We_cant_set_ooo_message_footer')}<br/><br/>${t(
        'We_cant_set_ooo_message_footer_1'
      )}https://feedback.absentify.com/b/7mlokrm5/feature-ideas/idea/new`
    });
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
  }
}
async function sendMailToAdminsIfOutOfOfficeMessgeCantBeConfigured(props: {
  workspace_id: string;
  member: {
    name: string;
    email: string;
    language: string;
    microsoft_tenantId: string;
  };
  admins: {
    name: string | null;
    email: string | null;
  }[];
}) {
  const getT = ensureAvailabilityOfGetT();
  const t = await getT(props.member.language, 'backend');
  for (let index = 0; index < props.admins.length; index++) {
    const element = props.admins[index];
    if (element?.email) {
      try {
        await sendMail({
          prisma: prisma,
          workspace_id: props.workspace_id,
          recipients: {
            to: [
              {
                address: element.email,
                displayName: element.name ?? ''
              }
            ]
          },
          subject: t('We_cant_set_ooo_message_subject'),
          html:
            `${t('We_cant_set_ooo_message_admin_body')
              .replace('{{name}}', props.member.name)
              .replace('{{email}}', props.member.email)}<br/>${t('We_cant_set_ooo_message_admin_body_2')} ` +
            `https://login.microsoftonline.com/${props.member.microsoft_tenantId}/adminconsent?client_id=${process.env.NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION}&redirect_uri=https://app.absentify.com/settings/organisation/microsoft` +
            ` <br/><hr/><br/>${t('We_cant_set_ooo_message_footer')}<br/><br/>${t(
              'We_cant_set_ooo_message_footer_1'
            )}https://feedback.absentify.com/b/7mlokrm5/feature-ideas/idea/new`
        });
      } catch (e) {
        console.log(e);
        Sentry.captureException(e);
      }
    }
  }
}
