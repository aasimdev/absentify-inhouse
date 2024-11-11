import { slugify } from 'inngest';
import { inngest } from '../inngest_client';
import { prisma } from '~/server/db';
import { format } from 'date-fns';
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
import notificationTemplate from '~/utils/microsoft_teams/adaptiveCards/birthdayAndAnniversaryNotification.json';
import { NotificationReceivingMethod } from '@prisma/client';
import WeeklyEventEmail, { defaultImage } from '~/email/birthdayReminder';
// Function to check if a date is within the next 12 days (only day and month)
function isDateWithinNext12Days(date: Date) {
  const heute = new Date();
  const monthDay = `${date.getMonth() + 1}-${date.getDate()}`;
  for (let i = 0; i <= 12; i++) {
    const checkDate = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + i);
    const checkMonthDay = `${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
    if (monthDay === checkMonthDay) {
      return true;
    }
  }
  return false;
}
export const birthdayAndAnniversaryNotification = inngest.createFunction(
  {
    id: slugify('Birthday and Anniversary Notification'),
    name: 'Birthday and Anniversary Notification'
  },
  { cron: '15 * * * *' },
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

    const members = await prisma.member.findMany({
      where: {
        email_notif_bday_anniv_remind: true,
        status: 'ACTIVE',
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
        is_admin: true,
        departments: {
          select: {
            department_id: true,
            manager_type: true
          }
        },
        workspace: {
          select: {
            id: true,
            privacy_show_otherdepartments: true,
            members: {
              select: {
                id: true,
                name: true,
                status: true,
                birthday: true,
                microsoft_user_id: true,
                has_cdn_image: true,
                employment_start_date: true,
                departments: {
                  select: {
                    department_id: true
                  }
                }
              }
            },
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
          email_notif_bday_anniv_remind: false
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

    const filteredMembers = membersWithSubscription.map((member) => {
      // Check whether the current user is an admin or whether the visibility of all members in the workspace is activated
      if (member.workspace.privacy_show_otherdepartments || member.is_admin) {
        return member;
      }
      // Filtering the members that the user is allowed to see
      const visibleMembers = member.workspace.members.filter((workspaceMember) => {
        // Check whether the user and the member are in the same department
        return workspaceMember.departments.some((memberDepartment) => {
          return memberDepartment.department_id === member.departments.find((dep) => dep.department_id)?.department_id;
        });
      });

      return {
        ...member,
        workspace: {
          ...member.workspace,
          members: visibleMembers
        }
      };
    });

    // Filtering of members with a birthday or anniversary within the next 8 days
    const membersWithUpcomingEvents = filteredMembers.filter((member) => {
      if (!member || !member.workspace || !member.workspace.members) return false;
      return member.workspace.members.some((memberDetails) => {
        if (memberDetails.status === 'ARCHIVED') {
          return false;
        }
        const hasUpcomingBirthday = memberDetails.birthday && isDateWithinNext12Days(new Date(memberDetails.birthday));
        const hasUpcomingEmploymentStart =
          memberDetails.employment_start_date && isDateWithinNext12Days(new Date(memberDetails.employment_start_date));
        return hasUpcomingBirthday || hasUpcomingEmploymentStart;
      });
    });

    if (membersWithUpcomingEvents.length == 0) {
      return { status: 'success', message: 'No members with upcoming events' };
    }

    // Preparation of events for all members with upcoming events
    const events = membersWithUpcomingEvents.map((member) => ({
      name: 'weekly.birthday.anniversary.email' as const,
      data: {
        member_id: member.id
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
      message: `Weekly event emails for ${membersWithUpcomingEvents.length} members sent`
    };
  }
);
export const sendWeeklyBirthdayAndAnniversaryEmail = inngest.createFunction(
  {
    id: slugify('Send Weekly Birthday and Anniversary Email'),
    name: 'Send Weekly Birthday and Anniversary Email',
    throttle: {
      limit: 5000,
      period: '1h'
    },
    concurrency: {
      limit: 10
    }
  },
  { event: 'weekly.birthday.anniversary.email' },
  async ({ event }) => {
    type EventDetails = {
      member_id: string;
      microsoft_user_id: string | null;
      has_cdn_image: boolean;
      date: Date;
      name: string | null;
    };
    const member = await prisma.member.findUnique({
      where: {
        id: event.data.member_id
      },
      select: {
        id: true,
        is_admin: true,
        workspace_id: true,
        notifications_receiving_method: true,
        language: true,
        microsoft_user_id: true,
        email: true,
        name: true,
        status: true,
        date_format: true,
        departments: {
          select: {
            department_id: true,
            manager_type: true
          }
        },
        workspace: {
          select: {
            id: true,
            privacy_show_otherdepartments: true,
            company_logo_url: true,
            company_logo_ratio_square: true,
            members: {
              select: {
                id: true,
                name: true,
                status: true,
                birthday: true,
                microsoft_user_id: true,
                has_cdn_image: true,
                employment_start_date: true,
                departments: {
                  select: {
                    department_id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!member) {
      return { status: 'success', message: 'No member found' };
    }
    if (!member.email) {
      return { status: 'success', message: 'No email found' };
    }

    if (member.status !== 'ACTIVE') {
      return { status: 'success', message: 'Member is not active' };
    }

    const usersWithBirthdayInNextDays: EventDetails[] = [];
    const usersWithAnniversaryInNextDays: EventDetails[] = [];

    let visibleMembers = member.workspace.members;

    if (!member.workspace.privacy_show_otherdepartments && !member.is_admin) {
      visibleMembers = member.workspace.members.filter((workspaceMember) => {
        // Check whether the user and the member are in the same department
        return workspaceMember.departments.some((memberDepartment) => {
          return memberDepartment.department_id === member.departments.find((dep) => dep.department_id)?.department_id;
        });
      });
    }

    visibleMembers.forEach((memberDetails) => {
      if (memberDetails.status === 'ARCHIVED') {
        return;
      }
      const birthdayDate = memberDetails.birthday ? new Date(memberDetails.birthday) : null;
      const employmentStartDate = memberDetails.employment_start_date
        ? new Date(memberDetails.employment_start_date)
        : null;

      if (birthdayDate && isDateWithinNext12Days(birthdayDate)) {
        usersWithBirthdayInNextDays.push({
          member_id: memberDetails.id,
          microsoft_user_id: memberDetails.microsoft_user_id,
          has_cdn_image: memberDetails.has_cdn_image,
          date: birthdayDate,
          name: memberDetails.name
        });
      }

      if (employmentStartDate && isDateWithinNext12Days(employmentStartDate)) {
        usersWithAnniversaryInNextDays.push({
          member_id: memberDetails.id,
          microsoft_user_id: memberDetails.microsoft_user_id,
          has_cdn_image: memberDetails.has_cdn_image,
          date: employmentStartDate,
          name: memberDetails.name
        });
      }
    });
    const sortEventsByDateAscending = (events: EventDetails[]): EventDetails[] => {
      return events.sort((a, b) => {
        const dateA = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate());
        const dateB = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate());
        return dateA.getTime() - dateB.getTime();
      });
    };

    const getBirthdayText = (birthDate: Date, is_admin: boolean): string => {
      if (!is_admin) {
        return '';
      }
      const today = new Date();
      const birthYear = birthDate.getFullYear();
      const currentYear = today.getFullYear();

      // Calculate the age
      let age = currentYear - birthYear;

      // Check whether the birthday is still coming up this year or is today
      const nextBirthday = new Date(birthDate);
      nextBirthday.setFullYear(currentYear);

      return ' - ' + t('multiple-years-old', { age });
    };
    const getAnniversaryText = (startDate: Date): string => {
      const today = new Date();
      const startYear = startDate.getFullYear();
      const currentYear = today.getFullYear();

      // Calculate the years since the start date
      let years = currentYear - startYear;

      // Check whether the anniversary is in the future
      const nextAnniversary = new Date(startDate);
      nextAnniversary.setFullYear(currentYear);

      if (years === 0) {
        return ' - ' + t('first-working-day');
      } else if (years === 1) {
        return ' - ' + t('1-year-anniversary');
      } else {
        return ' - ' + t('multiple-years-anniversary', { years });
      }
    };
    const removeYearFromDateFormat = (formatString: string) => {
      return formatString
        .replace(/^yyyy[\s\-\/.]?/g, '') //Removes 'yyyy' at the beginning including the separator
        .replace(/[\s\-\/.]?yyyy/g, '') //Removes 'yyyy' in the middle or at the end
        .trim(); // Removes any leading or trailing spaces
    };

    const getT = ensureAvailabilityOfGetT();
    const t = await getT(member.language, 'mails');

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
      member.workspace.company_logo_url,
      member.workspace.company_logo_ratio_square ? '256x256' : '400x80'
    );

    if (member.notifications_receiving_method == NotificationReceivingMethod.EmailAndTeamsBot) {
      const mail = await WeeklyEventEmail({
        birthdayEvents: sortEventsByDateAscending(usersWithBirthdayInNextDays),
        anniversaryEvents: sortEventsByDateAscending(usersWithAnniversaryInNextDays),
        link: 'https://app.absentify.com',
        company_image_url: member.workspace.company_logo_url ? picture : null,
        date_format: member.date_format,
        is_admin: member.is_admin,
        locale: locales[member.language as keyof typeof locales] || enUS,
        t: t
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

        subject: t('Weekly-birthdays-and-anniversaries'),
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
          birthdayEvents: {
            name: string;
            date: string;
            imageUrl: string;
          }[];
          anniversaryEvents: {
            name: string;
            date: string;
            imageUrl: string;
          }[];
          anniversaryTitle: string;
          noUpcomingAnniversariesText: string;
          noUpcomingAnniversariesTextVisible: boolean;
          birthdayTitle: string;
          noUpcomingBirthdaysText: string;
          noUpcomingBirthdaysTextVisible: boolean;
        }

        const adaptor = notificationApp.adapter;

        const cardData: CardData = {
          pageTitle: t('upcoming-birthdays-and-anniversaries'),
          anniversaryTitle: `🎉 ${t('upcoming-anniversaries')}`,
          noUpcomingAnniversariesText: t('no-upcoming-anniversaries'),
          noUpcomingAnniversariesTextVisible: usersWithAnniversaryInNextDays.length == 0,
          birthdayTitle: `🎂 ${t('upcoming-birthdays')}`,
          noUpcomingBirthdaysText: t('no-upcoming-birthdays'),
          birthdayEvents: sortEventsByDateAscending(usersWithBirthdayInNextDays).map((user) => {
            const birthDate = new Date(user.date);
            const today = new Date();
            // Set the year of the birthday to the current year
            birthDate.setFullYear(today.getFullYear());

            // If the birthday is in January and the current date is in December, the birthday is next year
            if (today.getMonth() === 11 && birthDate.getMonth() === 0) {
              birthDate.setFullYear(today.getFullYear() + 1);
            }

            let weekday = '';
            if (birthDate.getDate() === today.getDate() && birthDate.getMonth() === today.getMonth()) {
              weekday = t('today');
            } else {
              weekday = format(birthDate, 'EEEE', {
                locale: locales[member.language as keyof typeof locales] || enUS
              });
            }

            const formattedDate = `${weekday}, ${format(birthDate, removeYearFromDateFormat(member.date_format), {
              locale: locales[member.language as keyof typeof locales] || enUS
            })}`;
            return {
              name: user.name + getBirthdayText(user.date, member.is_admin),
              date: formattedDate,
              imageUrl: user.has_cdn_image
                ? `https://data.absentify.com/profile-pictures/${user.microsoft_user_id}_64x64.jpeg`
                : defaultImage
            };
          }),
          noUpcomingBirthdaysTextVisible: usersWithBirthdayInNextDays.length == 0,
          anniversaryEvents: sortEventsByDateAscending(usersWithAnniversaryInNextDays).map((user) => {
            const anniversaryDate = new Date(user.date);
            const today = new Date();

            // Set the year of the anniversary date to the current year
            anniversaryDate.setFullYear(today.getFullYear());

            //If the anniversary is in January and the current date is in December, the anniversary is next year
            if (today.getMonth() === 11 && anniversaryDate.getMonth() === 0) {
              anniversaryDate.setFullYear(today.getFullYear() + 1);
            }

            let weekday = '';
            if (anniversaryDate.getDate() === today.getDate() && anniversaryDate.getMonth() === today.getMonth()) {
              weekday = t('today');
            } else {
              weekday = format(anniversaryDate, 'EEEE', {
                locale: locales[member.language as keyof typeof locales] || enUS
              });
            }

            const formattedDate = `${weekday}, ${format(anniversaryDate, removeYearFromDateFormat(member.date_format), {
              locale: locales[member.language as keyof typeof locales] || enUS
            })}`;
            return {
              name: user.name + getAnniversaryText(user.date),
              date: formattedDate,
              imageUrl: user.has_cdn_image
                ? `https://data.absentify.com/profile-pictures/${user.microsoft_user_id}_64x64.jpeg`
                : defaultImage
            };
          })
        };

        let adaptiveCard = AdaptiveCards.declare<CardData>(notificationTemplate).render(cardData);

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
          console.log('Birthday adaptivecard error', e);
        }
      }
    }
    return { status: 'success', message: 'Weekly event email sent' };
  }
);
