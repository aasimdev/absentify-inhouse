// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureTimeZoneAvailability } from '~/helper/ensureTimeZoneAvailability';
import { planIds } from '~/helper/paddle_config';
import timezones from '~/helper/timezones';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';
import { prisma } from '~/server/db';
import { inngest } from '~/inngest/inngest_client';
export default async function handler(_req: NextApiRequest, _res: NextApiResponse<any>) {
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

      return true; // check whether it is 8 o'clock
    });

    return timezonesAt8AM;
  }

  const timezonesAt8AM = findTimezonesAt8AM();

  if (timezonesAt8AM.length == 0) {
    return { status: 'success', message: 'No timezones at 8 AM' };
  }

  let members = await prisma.member.findMany({
    where: {
      email_notif_bday_anniv_remind: true,
      status: 'ACTIVE',
      email: {
        not: null
      },
      timezone: {
        in: timezonesAt8AM.map((tz) => tz.tzCode) // Zeitzonen, in denen es jetzt 8 Uhr ist
      },
      // week_start: wochentag.toString(),
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

  members = members.filter(
    (member) =>
      member.workspace.id == '757a02d8-88b0-431b-909c-d23c0183c70b' ||
      member.workspace.id == '80c45166-c663-4a57-ad2f-9d925afbf11a'
  );

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

  _res.status(200).json('Done');

  return;
}
