import { EndAt, LeaveUnit, StartAt } from '@prisma/client';
import { Attachment, CardFactory } from 'botbuilder';
import { Translate } from 'next-translate';

export async function SummaryRequestCard(leave: {
  end: string;
  start: string;
  start_at?: StartAt;
  end_at?: EndAt;
  reason?: string;
  leave_type: {
    id: string;
    name: string;
    leave_unit: LeaveUnit;
  };
  t: Translate;
}): Promise<Attachment> {
  const facts = [
    {
      title: 'Leave Type: ',
      value: `${leave.leave_type.name}`
    },
    {
      title: 'Start date: ',
      value: new Date(leave.start).toDateString()
    },
    {
      title: 'End date: ',
      value: new Date(leave.end).toDateString()
    }
  ];

  // Conditionally add "Start at" and "End at" if leaveUnit is "day(s)"
  if (
    leave.leave_type.leave_unit === 'days' ||
    (leave.leave_type.leave_unit === 'half_days' && leave.start_at && leave.end_at)
  ) {
    facts.push(
      {
        title: 'Start at: ',
        value: leave.start_at == 'morning' ? 'Morning' : 'Afternoon'
      },
      {
        title: 'End at: ',
        value: leave.end_at === 'end_of_day' ? 'End of the day' : 'Lunchtime'
      }
    );
  }

  // Conditionally add "Reason" if it's not empty
  if (leave.reason) {
    facts.push({
      title: 'Reason: ',
      value: leave.reason
    });
  }

  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        text: 'Summary of your leave request:',
        weight: 'bolder',
        size: 'medium'
      },
      {
        type: 'Container',
        items: [
          {
            type: 'FactSet',
            facts: facts
          }
        ]
      }
    ]
  });
}
