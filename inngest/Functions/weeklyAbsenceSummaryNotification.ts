import { slugify } from 'inngest';
import { inngest } from '../inngest_client';
import { prisma } from '~/server/db';
import { addDays, format } from 'date-fns';
import { ensureTimeZoneAvailability } from '~/helper/ensureTimeZoneAvailability';
import { planIds } from '~/helper/paddle_config';
import timezones from '~/helper/timezones';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { sendMail } from '~/lib/sendInBlueContactApi';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { de, enUS, es, fr, hu, pl, pt, ru, tr, uk, it } from 'date-fns/locale';
import { createPicture } from '~/server/api/routers/member';
import { AdaptiveCards } from '@microsoft/adaptivecards-tools';
import { ConversationReference, CardFactory } from 'botbuilder';
import { notificationApp } from '~/utils/microsoft_teams/initialize';
import { EndAt, LeaveUnit, NotificationReceivingMethod, Prisma, RequestStatus, StartAt } from '@prisma/client';
import WeeklyAbsenceEmail from '~/email/weeklyAbsenceEmail';
import { defaultMemberScheduleSelect } from '~/server/api/routers/member_schedule';
import { defaultWorkspaceScheduleSelect } from '~/server/api/routers/workspace_schedule';
import { cloneDeep } from 'lodash';
import { getDates, isDayUnit, dateFromDatabaseIgnoreTimezone } from '~/lib/DateHelper';
import {
  CurrentUserIsDepartmentManagerOfMember,
  setRequestStartEndTimesBasedOnScheduleOnDate
} from '~/lib/requestUtilities';
import { defaultImage } from '~/email/birthdayReminder';
export type AbsenceDetails = {
  id: string;
  day: Date;
  fullday: string;
  start: Date;
  end: Date;
  start_at: StartAt;
  end_at: EndAt;
  leave_unit: LeaveUnit;
  leave_type: {
    name: string;
    id: string;
    leave_unit: LeaveUnit;
    color: string;
  };
  requester_member: {
    id: string;
    microsoft_user_id: string | null;
    has_cdn_image: boolean;
    name: string | null;
  };
  status: RequestStatus;
};

export const weeklyAbsenceSummaryNotification = inngest.createFunction(
  {
    id: slugify('Weekly Absence Summary Notification'),
    name: 'Weekly Absence Summary Notification'
  },
  // { cron: '*/1 * * * *' },
  { cron: '3 * * * *' },
  async () => {
    const heute = new Date();
    const wochentag = heute.getDay();

    const relevantPlanIds = Object.keys(planIds).filter(
      (key) => planIds[key] === 'BUSINESS' || planIds[key] === 'BUSINESS_V1' || planIds[key] === 'ENTERPRISE'
    );
    function findTimezonesAt8AM() {
      const nowUTC = new Date(); // current UTC time

      // Filter time zones in which it is 8 a.m.
      const timezonesAt8AM = timezones.filter((timezone) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: ensureTimeZoneAvailability(timezone.tzCode),
          hour: 'numeric',
          hour12: false // Use 24-hour format
        });

        const hour = parseInt(formatter.formatToParts(nowUTC).find((part) => part.type === 'hour')?.value ?? '0', 10);

        return hour === 8; // check whether it is 8 o'clock
      });

      return timezonesAt8AM;
    }

    const timezonesAt8AM = findTimezonesAt8AM();

    if (timezonesAt8AM.length == 0) {
      return { status: 'success', message: 'No timezones at 8 AM' };
    }

    let members = await prisma.member.findMany({
      where: {
        status: 'ACTIVE',
        email_notif_weekly_absence_summary: true,
        email: {
          not: null
        },
        timezone: {
          in: timezonesAt8AM.map((tz) => tz.tzCode) // Zeitzonen, in denen es jetzt 8 Uhr ist
        },
        week_start: wochentag.toString(),
        workspace: {
          subscriptions: {
            some: {
              subscription_plan_id: {
                in: relevantPlanIds // Nur Mitglieder mit einem BUSINESS, BUSINESS_V1 oder ENTERPRISE-Plan
              }
            }
          }
        }
      },
      select: {
        id: true,
        microsoft_user_id: true,
        workspace_id: true,
        workspace: {
          select: {
            id: true,
            subscriptions: {
              select: {
                subscription_plan_id: true,
                status: true,
                past_due_since: true,
                provider: true,
                cancellation_effective_date: true,
                billing_cycle_interval: true,
                quantity: true,
                subscription_id: true
              }
            }
          }
        }
      }
    });

    const membersWithoutSubscription = members.filter((member) => {
      if (!member) return false;
      const subscription = summarizeSubscriptions(member.workspace.subscriptions);
      return !subscription.has_valid_subscription;
    });
    //disable email notifications for members without subscription
    if (membersWithoutSubscription.length > 0) {
      await prisma.member.updateMany({
        where: {
          id: {
            in: membersWithoutSubscription.map((m) => m.id)
          }
        },
        data: {
          email_notif_weekly_absence_summary: false
        }
      });
    }

    const membersWithSubscription = members.filter((member) => {
      if (!member) return false;
      const subscription = summarizeSubscriptions(member.workspace.subscriptions);
      return subscription.has_valid_subscription;
    });

    if (membersWithSubscription.length == 0) {
      return { status: 'success', message: 'No members with subscription' };
    }

    // Preparation of events for all members with upcoming events
    const events = membersWithSubscription.map((member) => ({
      name: 'weekly.absence.summary.email' as const,
      data: {
        member_id: member.id,
        workspace_id: member.workspace_id
      }
    }));

    // Sending all events to Inngest at once
    const batchSize = 1000;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await inngest.send(batch);
    }

    return {
      status: 'success',
      message: `Weekly event emails for ${membersWithSubscription.length} members sent`
    };
  }
);
export const sendWeeklyAbsenceSummaryNotification = inngest.createFunction(
  {
    id: slugify('Send Weekly Absence Summary Notification'),
    name: 'Send Weekly Absence Summary Notification',
    throttle: {
      limit: 10000,
      period: '1h'
    },
    concurrency: {
      limit: 10
    }
  },
  { event: 'weekly.absence.summary.email' },
  async ({ event }) => {
    let [member, workspace, memberSchedule] = await prisma.$transaction([
      prisma.member.findUnique({
        where: {
          id: event.data.member_id
        },
        select: {
          id: true,
          workspace_id: true,
          is_admin: true,
          microsoft_user_id: true,
          date_format: true,
          status: true,
          email: true,
          language: true,
          notifications_receiving_method: true,
          email_notif_weekly_absence_summary: true,
          name: true,
          departments: {
            select: { department_id: true, department: { select: { name: true } } }
          }
        }
      }),
      prisma.workspace.findUnique({
        where: { id: event.data.workspace_id },
        select: {
          privacy_show_otherdepartments: true,
          company_logo_url: true,
          company_logo_ratio_square: true,
          schedule: { select: defaultWorkspaceScheduleSelect }
        }
      }),

      prisma.memberSchedule.findMany({
        where: { workspace_id: event.data.workspace_id },
        select: defaultMemberScheduleSelect,
        orderBy: { from: 'desc' }
      })
    ]);
    if (!member) {
      return { status: 'success', message: 'No member found' };
    }

    if (!member.email_notif_weekly_absence_summary) {
      return { status: 'success', message: 'Member has no email_notif_weekly_absence_summary' };
    }

    if (!member.email) {
      return { status: 'success', message: 'No email found' };
    }

    if (member.status !== 'ACTIVE') {
      return { status: 'success', message: 'Member is not active' };
    }

    if (!workspace) {
      return { status: 'success', message: 'No workspace found' };
    }
    if (!workspace.schedule) {
      return { status: 'success', message: 'No workspace found' };
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = addDays(start, 6);

    let queryFilter: Prisma.RequestWhereInput = {
      workspace_id: member.workspace_id,

      OR: [
        { AND: [{ start: { gte: start } }, { start: { lte: end } }] },
        { AND: [{ end: { gte: start } }, { end: { lte: end } }] },
        { AND: [{ start: { lt: start } }, { end: { gt: end } }] }
      ],
      details: {
        status: {
          in: ['APPROVED', 'PENDING']
        }
      }
    };

    const members = await prisma.memberDepartment.findMany({
      where: { department_id: { in: member.departments.map((d) => d.department_id) } },
      select: { member_id: true }
    });

    queryFilter = {
      ...queryFilter,
      requester_member_id: {
        in: [...members.map((member) => member.member_id)]
      }
    };

    const requests = await prisma.request.findMany({
      where: queryFilter,
      select: {
        id: true,
        end: true,
        start: true,
        end_at: true,
        start_at: true,
        leave_unit: true,
        requester_member_id: true,
        details: {
          select: {
            leave_type: {
              select: {
                name: true,
                id: true,
                leave_unit: true,
                privacy_hide_leavetype: true,
                color: true
              }
            },
            request_approvers: {
              select: {
                approver_member_id: true
              }
            },
            status: true,
            requester_member: {
              select: {
                id: true,
                name: true,
                has_cdn_image: true,
                microsoft_user_id: true,
                status: true,
                departments: {
                  select: {
                    department_id: true,
                    department: { select: { members: { select: { member_id: true, manager_type: true } } } }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { start: 'desc' }
    });

    if (requests.length == 0) {
      return { status: 'success', message: 'No requests found' };
    }

    const getT = ensureAvailabilityOfGetT();
    const t = await getT(member.language, 'mails');

    // Initialisiere die Tage für die kommende Woche (von `start` bis `end`)
    const days = getDates(start, end);

    // Erstelle ein leeres Array, um die Anfragen nach Tagen zu gruppieren
    let requestsPerDay: AbsenceDetails[][] = Array(days.length).fill([]);

    // Durchlaufe alle Abwesenheitsanfragen
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      if (request) {
        const details = request.details;
        if (!details) throw new Error('no details found');
        if (details.requester_member?.status !== 'ACTIVE') continue;

        // Bestimme alle relevanten Tage für die Abwesenheitsanfrage
        const dates = getDates(new Date(request.start), new Date(request.end));
        const memberSchedules = memberSchedule.filter((y) => y.member_id == request.requester_member_id);

        for (let j = 0; j < dates.length; j++) {
          const date = dates[j];

          // Überprüfe, ob der Tag in der relevanten Woche liegt
          if (date && date >= start && date <= end) {
            // Klone die Anfrage, um spezifische Tagesinformationen zu setzen
            const newR = cloneDeep(request);
            setRequestStartEndTimesBasedOnScheduleOnDate(newR, date, memberSchedules, workspace.schedule);

            // Bestimme, ob es sich um einen Ganztages- oder Halbtagesurlaub handelt
            let fullday = t('Full_Day');
            if (isDayUnit(request.leave_unit)) {
              if (j == 0 && request.start_at == 'afternoon') {
                fullday = t('Afternoon');
              }

              if (j == dates.length - 1 && request.end_at == 'lunchtime') {
                fullday = t('Morning');
              }
            } else {
              fullday =
                format(dateFromDatabaseIgnoreTimezone(newR.start), 'HH:mm') +
                ' - ' +
                format(dateFromDatabaseIgnoreTimezone(newR.end), 'HH:mm');
            }
            if (!details.requester_member) continue;

            if (details.leave_type.privacy_hide_leavetype && !member.is_admin) {
              const isApprover = details.request_approvers.some((x) => x.approver_member_id === member.id);
              const isRequester = request.requester_member_id === member.id;
              const isDepartmentManager = CurrentUserIsDepartmentManagerOfMember(member, details.requester_member);

              if (!isApprover && !isRequester && !isDepartmentManager) {
                details.leave_type.name = t('Absent');
                details.leave_type.color = 'blue';
              }
            }

            // Erstelle das Objekt für diese Anfrage mit allen notwendigen Details
            const absenceDetails: AbsenceDetails = {
              id: request.id,
              day: date,
              fullday,
              end: newR.end,
              start: newR.start,
              end_at: newR.end_at,
              start_at: newR.start_at,
              leave_unit: request.leave_unit,
              leave_type: details.leave_type,
              requester_member: details.requester_member,
              status: details.status
            };

            // Finde den Index des aktuellen Tages in der Woche
            const dayIndex = days.findIndex((d) => d.toDateString() === date.toDateString());

            // Falls der Tag gefunden wurde, füge die Anfrage dem jeweiligen Tag hinzu
            if (dayIndex !== -1 && requestsPerDay[dayIndex]) {
              requestsPerDay[dayIndex] = [...requestsPerDay[dayIndex], absenceDetails];
            }
          }
        }
      }
    }

    const locales = {
      de: de,
      en: enUS,
      es: es,
      fr: fr,
      hu: hu,
      it: it,
      pl: pl,
      pt: pt,
      ru: ru,
      tr: tr,
      uk: uk
    };
    const picture = createPicture(
      workspace.company_logo_url,
      workspace.company_logo_ratio_square ? '256x256' : '400x80'
    );

    // Sortiere alle Anfragen pro Tag nach dem Namen des Mitglieds
    requestsPerDay = requestsPerDay.map((dayRequests) =>
      dayRequests.sort((a, b) => {
        // Zuerst nach Datum sortieren
        const dateComparison = a.start.getTime() - b.start.getTime();
        if (dateComparison !== 0) return dateComparison;

        // Bei gleichem Datum nach Name sortieren
        return (a.requester_member.name || '').localeCompare(b.requester_member.name || '');
      })
    );

    if (member.notifications_receiving_method == NotificationReceivingMethod.EmailAndTeamsBot) {
      const mail = await WeeklyAbsenceEmail({
        days,
        requestsPerDay,
        date_format: member.date_format,
        company_image_url: workspace.company_logo_url ? picture : null,
        departments: member.departments.map((d) => d.department).sort((a, b) => a.name.localeCompare(b.name)),
        locale: locales[member.language as keyof typeof locales] || enUS,
        t: t,
        language: member.language
      });

      await sendMail({
        prisma,
        workspace_id: member.workspace_id,
        recipients: {
          to: [
            {
              address: member.email,
              displayName: member.name ?? ''
            }
          ]
        },

        subject: t('weekly-absence-summary'),
        html: mail
      });
    }

    if (
      (member.notifications_receiving_method == NotificationReceivingMethod.TeamsBot ||
        member.notifications_receiving_method == NotificationReceivingMethod.EmailAndTeamsBot) &&
      member.microsoft_user_id
    ) {
      let x = await prisma.teamsBotConversationReferences.findFirst({
        where: { user_aad_id: member.microsoft_user_id },
        select: { ref_data: true }
      });

      if (x) {
        interface CardData {
          pageTitle: string;
          days: {
            weekday: string;
            requests: {
              name: string;
              leaveType: string;
              fullDay: string;
              imageUrl: string;
              pendingText?: string;
            }[];
          }[];
          noAbsencesText: string;
        }

        const adaptor = notificationApp.adapter;
        const noRequests = requestsPerDay.every((requests) => requests.length === 0);

        // CardData für Abwesenheiten erstellen
        const cardData: CardData = {
          pageTitle: t('weekly-absence-summary'),
          days: days.map((day, index) => ({
            weekday: format(day, 'EEEE', { locale: locales[member.language as keyof typeof locales] || enUS }),
            requests:
              requestsPerDay[index]?.map((request) => ({
                name: request.requester_member.name ?? '',
                leaveType: request.leave_type.name,
                fullDay: request.fullday,
                imageUrl: request.requester_member.has_cdn_image
                  ? `https://data.absentify.com/profile-pictures/${request.requester_member.microsoft_user_id}_32x32.jpeg`
                  : defaultImage,
                pendingText:
                  request.leave_type.name != t('Absent') &&
                  request.leave_type.color != 'blue' &&
                  request.status == 'PENDING'
                    ? t('Pending')
                    : ''
              })) ?? []
          })),
          noAbsencesText: noRequests ? t('no-absences-text') : ''
        };

        // Berechne die Gesamtanzahl der Requests
        const totalRequests = cardData.days.reduce((acc, day) => acc + day.requests.length, 0);

        // Adaptive Card erstellen und anzeigen
        const cardJson = {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              text: cardData.pageTitle,
              weight: 'Bolder',
              size: 'Large',
              wrap: true
            },
            {
              type: 'Container',
              id: 'initialRequestsContainer',
              items: (() => {
                const visibleItems = [];
                let displayedRequests = 0;

                for (const day of cardData.days) {
                  if (displayedRequests >= 10) {
                    break;
                  }

                  const remainingRequests = 10 - displayedRequests;
                  const requestsToShow = Math.min(day.requests.length, remainingRequests);

                  // Tag als Überschrift hinzufügen
                  visibleItems.push({
                    type: 'TextBlock',
                    text: day.weekday,
                    weight: 'Bolder',
                    size: 'Medium',
                    wrap: true
                  });

                  if (day.requests.length === 0) {
                    // Wenn keine Anfragen vorhanden sind, Textblock für "keine Anfragen" hinzufügen
                    visibleItems.push({
                      type: 'TextBlock',
                      text: t('no-requests'),
                      weight: 'Lighter',
                      size: 'Medium',
                      wrap: true
                    });
                  } else {
                    // Wenn Anfragen vorhanden sind, Container für Anfragen hinzufügen
                    visibleItems.push({
                      type: 'Container',
                      items: [
                        {
                          $data: day.requests.slice(0, requestsToShow),
                          type: 'ColumnSet',
                          columns: [
                            {
                              type: 'Column',
                              width: 'auto',
                              items: [
                                {
                                  type: 'Image',
                                  url: '${imageUrl}',
                                  size: 'Small',
                                  style: 'Person'
                                }
                              ]
                            },
                            {
                              type: 'Column',
                              width: 'stretch',
                              items: [
                                {
                                  type: 'TextBlock',
                                  text: '${name} - ${leaveType} - ${fullDay} ${pendingText}',
                                  wrap: true
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    });
                  }

                  displayedRequests += requestsToShow;
                }

                return visibleItems;
              })()
            },
            ...(totalRequests > 10
              ? [
                  {
                    type: 'ActionSet',
                    id: 'readMoreButton',
                    actions: [
                      {
                        type: 'Action.ToggleVisibility',
                        title: t('Read_more'),
                        targetElements: ['moreRequestsContainer', 'initialRequestsContainer', 'readMoreButton']
                      }
                    ]
                  },
                  {
                    type: 'Container',
                    id: 'moreRequestsContainer',
                    isVisible: false,
                    items: cardData.days.map((day) => ({
                      type: 'Container',
                      items: [
                        {
                          type: 'TextBlock',
                          text: day.weekday,
                          weight: 'Bolder',
                          size: 'Medium',
                          wrap: true
                        },
                        {
                          $data: day.requests,
                          type: 'ColumnSet',
                          columns: [
                            {
                              type: 'Column',
                              width: 'auto',
                              items: [
                                {
                                  type: 'Image',
                                  url: '${imageUrl}',
                                  size: 'Small',
                                  style: 'Person'
                                }
                              ]
                            },
                            {
                              type: 'Column',
                              width: 'stretch',
                              items: [
                                {
                                  type: 'TextBlock',
                                  text: '${name} - ${leaveType} - ${fullDay} ${pendingText}',
                                  wrap: true
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }))
                  }
                ]
              : [])
          ]
        };

        // Adaptive Card erstellen und versenden
        let adaptiveCard = AdaptiveCards.declare<CardData>(cardJson).render(cardData);

        try {
          await adaptor.continueConversationAsync(
            process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
            x.ref_data as Partial<ConversationReference>,
            async (context) => {
              await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(adaptiveCard)],
                summary: cardData.pageTitle
              });
            }
          );
        } catch (e) {
          console.log('Weekly Absence adaptive card error', e);
        }
      }
    }

    return { status: 'success', message: 'Weekly event email sent' };
  }
);
