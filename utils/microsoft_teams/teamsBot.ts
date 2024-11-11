import { ActionTypes, CardAction, CardFactory, MessageFactory, TaskModuleRequest, TaskModuleResponse, TeamsActivityHandler, TurnContext } from 'botbuilder';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import { prisma } from '~/server/db';
import { callAIModel, run as runAI } from './ai/aiAdapter';
import { Guid } from 'guid-typescript';
import { current_member_SelectOutput } from '~/server/api/trpc';
import { EndAt, LeaveUnit, StartAt } from '@prisma/client';
import { Translate } from 'next-translate';
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL + '');
export class UISettings {
  width: number;
  height: number;
  title: string;
  id: string;
  buttonTitle: string;

  constructor(width: number, height: number, title: string, id: string, buttonTitle: string) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.id = id;
    this.buttonTitle = buttonTitle;
  }
}

export const TaskModuleId = {
  AdaptiveCard: 'AdaptiveCard'
};

export const TaskModuleUIConstants = {
  AdaptiveCard: new UISettings(640, 550, 'Create a new leave request', TaskModuleId.AdaptiveCard, 'Review')
};
export interface Leave {
  end: string;
  start: string;
  start_at?: StartAt;
  end_at?: EndAt;
  reason?: string;
  leave_type: {
    id: string;
    name: string;
    leave_unit: LeaveUnit;
    reason_mandatory: boolean;
  };
  t: Translate;
  leave_types: { id: string; name: string; leave_unit: LeaveUnit }[];
  current_user: current_member_SelectOutput;
}

export class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      // Sends a message activity to the sender of the incoming activity.
      if (context.activity.value?.id) {
        // await this.removeActionsFromCard(context);
      }

      const member = await prisma.member.findFirst({
        where: {
          microsoft_user_id: context.activity.from.aadObjectId
        },
        select: {
          language: true,
          workspace: { select: { ai_bot_enabled: true } }
        }
      });

      if (member?.workspace.ai_bot_enabled == false) {
        const getT = ensureAvailabilityOfGetT();
        const t = await getT(member.language, 'backend');

        await context.sendActivity({
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                type: 'AdaptiveCard',
                body: [
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_integration_disabled'),
                    weight: 'Bolder',
                    size: 'Large',
                    color: 'Attention'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_integration_disabled_message'),
                    wrap: true,
                    size: 'Medium'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_no_data_sent_message'),
                    wrap: true,
                    size: 'Medium'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_benefits_of_enabling'),
                    weight: 'Bolder',
                    size: 'Medium',
                    spacing: 'Medium'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_benefits_list'),
                    wrap: true,
                    spacing: 'None'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_important_information'),
                    weight: 'Bolder',
                    size: 'Medium',
                    spacing: 'Medium'
                  },
                  {
                    type: 'TextBlock',
                    text: t('azure_ai_costs_covered_message'),
                    wrap: true,
                    spacing: 'None'
                  }
                ],
                actions: [
                  {
                    type: 'Action.OpenUrl',
                    title: t('azure_ai_enable_in_settings'),
                    url: 'https://app.absentify.com/de/settings/organisation/microsoft'
                  }
                ],
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                version: '1.3'
              }
            }
          ]
        });

        return;
      }

      // Überprüfen Sie, ob der Bot eine Nachricht vom Task Module erhält
      if (context.activity.value?.status) {
        await this.handleTaskModuleSubmit(context, context.activity.value.status);
      } else {
        await runAI(context);
      }
      await next();
    });

     this.onMembersAdded(async (_context, next) => {
        // Send welcome message when app installed
        //   await this.sendWelcomeMessage(context);

       // By calling next() you ensure that the next BotHandler is run.
       await next();
    });
  }
  async handleTaskModuleSubmit(context: TurnContext, status: 'success' | 'cancel') {
    let replyText = '';
    if (status === 'success') {
      replyText = 'The task was successfully completed!';
    } else if (status === 'cancel') {
      replyText = 'The task was cancelled.';
    }

    await context.sendActivity(replyText);
  }
  async handleTeamsTaskModuleFetch(
    _context: TurnContext,
    taskModuleRequest: TaskModuleRequest
  ): Promise<TaskModuleResponse> {
    // Called when the user selects an options from the displayed HeroCard or
    // AdaptiveCard.  The result is the action to perform.
    //url: "https://teams.absentify.com/microsoft/ms-teams/tab/config?configId="+ guid,
    let guid = Guid.create().toString();
    const value = {
      start: new Date(taskModuleRequest.data.leave.start),
      end: new Date(taskModuleRequest.data.leave.end),
      start_at: taskModuleRequest.data.leave.start_at,
      end_at: taskModuleRequest.data.leave.end_at,
      member_id: taskModuleRequest.data.leave.current_user.id,
      leave_type_id: taskModuleRequest.data.leave.leave_type.id
    };
    await redis.set(guid, JSON.stringify(value), 'EX', 120); // will be deleted after 2 minutes
    const getT = ensureAvailabilityOfGetT();
    const t = await getT(taskModuleRequest.data.leave.current_user.language, 'backend');
    let taskInfo = {
      height: 0,
      width: 0,
      title: '',
      url: `https://teams.absentify.com/microsoft/ms-teams/bot/taskmodule?configId=` + guid,
      fallbackUrl: 'https://teams.absentify.com/microsoft/ms-teams/bot/taskmodule?configId=' + guid
    };
    // Display an AdaptiveCard to prompt user for text, and post it back via
    // handleTeamsTaskModuleSubmit.
    this.setTaskInfo(taskInfo, TaskModuleUIConstants.AdaptiveCard);
    taskInfo.title = t('create_a_new_leave_request');
    return TaskModuleResponseFactory.toTaskModuleResponse(taskInfo);
  }
  setTaskInfo(taskInfo: { height: number; width: number; title: string }, uiSettings: UISettings) {
    taskInfo.height = uiSettings.height;
    taskInfo.width = uiSettings.width;
    taskInfo.title = uiSettings.title;
  }
  //display user input
  async handleTeamsTaskModuleSubmit(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest
  ): Promise<TaskModuleResponse> {
    // Called when data is being returned from the selected option (see `handleTeamsTaskModuleFetch').

    // Echo the users input back.  In a production bot, this is where you'd add behavior in
    // response to the input.

    const current_user = taskModuleRequest.data.leave.current_user;

    let response = '';
    console.log(taskModuleRequest.data);

    if (taskModuleRequest.data == 'success') {
      response = 'Successfully created the leave request.';
    } else {
      response = 'An error occurred while creating the leave request. Please try again later.';
    }

    await callAIModel(
      `Please rephrase the following text to be user-friendly and return the result in "${current_user.language}" language: The request has been submitted. ${response}. Ask for something else`,
      context
    );

    return {
      task: {
        type: 'message',
        value: ''
      }
    };
  }

  getTaskModuleAdaptiveCardOptions(leave: Leave) {
    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.3',
      type: 'AdaptiveCard',
      body: [
        {
          type: 'TextBlock',
          text: leave.t('ai_bot_prepared_data'),
          weight: 'bolder'
        }
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: leave.t('open_form_button'),
          data: { msteams: { type: 'task/fetch' }, data: TaskModuleUIConstants.AdaptiveCard.id, leave: leave }
        }
      ]
    };

    return CardFactory.adaptiveCard(adaptiveCard);
  }

  async sendWelcomeMessage(context: TurnContext) {
    if (!context) return;

    let lang = 'en';
    if (context.activity.from.aadObjectId) {
      const member = await prisma.member.findFirst({
        where: {
          microsoft_user_id: context.activity.from.aadObjectId
        },
        select: {
          language: true
        }
      });

      if (member) {
        lang = member.language;
      }
    }

    const getT = ensureAvailabilityOfGetT();
    const t = await getT(lang, 'backend');

    await context.sendActivity(t('teams_welcome_message'));
  }

  async sendSuggestedActions(context: TurnContext, type: string, createLeaveRequestTextForSuggestions?: string) {
    if (type === 'leave_type') {
      const member = await prisma.member.findFirst({
        where: {
          microsoft_user_id: context.activity.from.aadObjectId
        },
        select: {
          language: true,
          workspace: { select: { id: true } }
        }
      });
      if (!member) {
        return 'No absentify user found. Please create an absentify company before.';
      }

      const leave_types = await prisma.leaveType.findMany({
        where: {
          workspace_id: member.workspace.id,
          deleted: false
        },
        select: {
          id: true,
          name: true,
          leave_unit: true,
          reason_mandatory: true
        }
      });

      const cardActions: CardAction[] = leave_types.map((leaveType) => ({
        type: ActionTypes.ImBack,
        title: leaveType.name,
        value: leaveType.name
      }));

      let reply = MessageFactory.text('');
      reply.suggestedActions = { actions: cardActions, to: [context.activity.from.id] };
      await context.sendActivity(reply);
    }

    if (type === 'start_command') {

      const cardActions: CardAction[] = [
        {
          type: ActionTypes.ImBack,
          title: 'create a new leave request for tomorrow',
          value: createLeaveRequestTextForSuggestions
        },
        {
          type: ActionTypes.ImBack,
          title: '/help',
          value: '/help'
        }
      ];

      let reply = MessageFactory.text('');
      reply.suggestedActions = { actions: cardActions, to: [context.activity.from.id] };
      await context.sendActivity(reply);
    }

    if (type === 'help_command') {

      const cardActions: CardAction[] = [
        {
          type: ActionTypes.ImBack,
          title: '/start',
          value: '/start'
        }
      ];

      let reply = MessageFactory.text('');
      reply.suggestedActions = { actions: cardActions, to: [context.activity.from.id] };
      await context.sendActivity(reply);
    }
  }
}

class TaskModuleResponseFactory {
  static createResponse(taskModuleInfoOrString: any): TaskModuleResponse {
    if (typeof taskModuleInfoOrString === 'string') {
      return {
        task: {
          type: 'message',
          value: taskModuleInfoOrString
        }
      };
    }

    return {
      task: {
        type: 'continue',
        value: taskModuleInfoOrString
      }
    };
  }

  static toTaskModuleResponse(taskInfo: any): TaskModuleResponse {
    return TaskModuleResponseFactory.createResponse(taskInfo);
  }
}
