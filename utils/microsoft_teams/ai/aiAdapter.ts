import {
  Application,
  preview,
  DefaultConversationState,
  DefaultTempState,
  DefaultUserState,
  TurnState,
  AI
} from '@microsoft/teams-ai';
import { MemoryStorage, MessageFactory, TurnContext } from 'botbuilder';
import { EndAt, LeaveUnit, StartAt } from '@prisma/client';
import { prisma } from '~/server/db';
import { current_member_Select, current_member_SelectOutput } from '~/server/api/trpc';
import { ensureAvailabilityOfGetT } from '~/lib/monkey-patches';
import OpenAI from 'openai';
import { TeamsBot } from '../teamsBot';

interface CustomConversationState extends DefaultConversationState {
  current_member: current_member_SelectOutput;
  leave_types: { id: string; name: string; leave_unit: LeaveUnit }[];
  request_parameters: {
    start: string;
    end: string;
    start_at?: StartAt;
    end_at?: EndAt;
    leave_type_name: string;
    reason?: string;
    leave_type: { id: string; leave_unit: LeaveUnit };
  };
}

interface LeaveRequest {
  start: string;
  end: string;
  start_at?: StartAt;
  end_at?: EndAt;
  leave_type_name: string;
  reason?: string;
}

const { AssistantsPlanner } = preview;

const planner = new AssistantsPlanner({
  apiKey: process.env.OPENAI_KEY + '',
  assistant_id: 'asst_7QwnZIPqKBBEvEZwXsaBMzFZ'
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY + '' });

const storage = new MemoryStorage();
const app = new Application<TurnState<CustomConversationState, DefaultUserState, DefaultTempState>>({
  storage,
  ai: {
    planner
  }
});

export const run = (context: TurnContext) => app.run(context);

export async function callAIModel(content: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }]
  });

  if (response.choices && response.choices[0] && response.choices.length > 0 && response.choices[0].message.content) {
    return response.choices[0].message.content.trim() || '';
  }
}

app.ai.action<String>('get_init_data', async (context, state) => {
  console.log('get_init_data');
  if (!context.activity.from.aadObjectId) {
    return 'Not logged in. Please log in and try again.';
  }

  const current_user = await prisma.member.findFirst({
    where: {
      microsoft_user_id: context.activity.from.aadObjectId
    },
    select: current_member_Select
  });

  if (!current_user) {
    return 'No absentify user found. Please create an absentify company before.';
  }
  // save user to state
  state.conversation.current_member = current_user;

  const leave_types = await prisma.leaveType.findMany({
    where: {
      workspace_id: current_user.workspace_id,
      deleted: false
    },
    select: {
      id: true,
      name: true,
      leave_unit: true
    }
  });
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  return `Member Information:
          Name: ${current_user.firstName} ${current_user.lastName}
          Admin: ${current_user.is_admin ? 'Yes' : 'No'}
          Language: ${current_user.language}
          Timezone: ${current_user.timezone}
          Date Format: ${current_user.date_format}
          Time Format: ${current_user.time_format}


          Available leave types: ${leave_types.map((x) => x.name + ' (' + x.leave_unit + ')').join(', ')}
          
          User Date Information:
          Today: ${now}
          Day of the Week: ${now.toLocaleString(current_user.language, { weekday: 'long' })}
          Date Next Week: ${nextWeek}`;
});

app.ai.action<LeaveRequest>('create_leave_request', async (context, state, leaveRequest) => {
  //for showing the task module card
  let bot = new TeamsBot();
  const current_user = await prisma.member.findFirst({
    where: {
      microsoft_user_id: context.activity.from.aadObjectId
    },
    select: current_member_Select
  });
  if (!current_user) {
    return 'No absentify user found. Please create an absentify company before.';
  }

  // save user to state
  state.conversation.current_member = current_user;

  const leave_types = await prisma.leaveType.findMany({
    where: {
      workspace_id: current_user.workspace_id,
      deleted: false
    },
    select: {
      id: true,
      name: true,
      leave_unit: true,
      reason_mandatory: true
    }
  });

  const leaveType = leave_types.find((leaveType) => {
    return leaveType.name.toLowerCase() == leaveRequest.leave_type_name.toLowerCase();
  });

  if (!leaveType) {
    return (
      'Please select one leave type from the list: ' +
      leave_types.map((x) => x.name + ' (' + x.leave_unit + ')').join(', ')
    );
  }

  state.conversation.request_parameters = {
    start: leaveRequest.start,
    end: leaveRequest.end,
    start_at: leaveRequest.start_at,
    end_at: leaveRequest.end_at,
    leave_type_name: leaveRequest.leave_type_name,
    reason: leaveRequest.reason ? leaveRequest.reason : '',
    leave_type: leaveType as { id: string; leave_unit: LeaveUnit }
  };

  const getT = ensureAvailabilityOfGetT();
  const t = await getT(current_user.language, 'backend');

  const leave = {
    end: state.conversation.request_parameters.end,
    start: state.conversation.request_parameters.start,
    start_at: state.conversation.request_parameters.start_at,
    end_at: state.conversation.request_parameters.end_at,
    leave_type: leaveType as { id: string; name: string; leave_unit: LeaveUnit; reason_mandatory: boolean },
    reason: state.conversation.request_parameters.reason,
    t: t,
    //for adaptive card inside task module
    leave_types,
    current_user
  };
  const reply = MessageFactory.list([bot.getTaskModuleAdaptiveCardOptions(leave)]);
  await context.sendActivity(reply);
  state.deleteConversationState();
  return AI.StopCommandName;
});

app.message(/\/help/, async (context: TurnContext, state) => {
  await app.ai.doAction(context, state, 'get_init_data');
  const commandsText =
    `Here are the available commands:\n` +
    `/help - Get a list of available commands and their usage.\n` +
    `/start - Start a new session with the bot.\n` +
    `You can also create a new absence by typing something like: "Create a vacation absence on 20.6.2024 from morning till the end of the day".`;
  const answerFromAI = await callAIModel(
    'Reformulate to an user friendly and only return the result text in "' +
      state.conversation.current_member.language +
      '" language:' +
      commandsText
  );
  if (answerFromAI) {
    await context.sendActivity(answerFromAI);
  }
});

// Define the start command
app.message(/\/start/, async (context: TurnContext, state) => {
  await app.ai.doAction(context, state, 'get_init_data');
  const welcomeText = 'Welcome! How can I assist you today? You can type /help to see what I can do.';
  const answerFromAI = await callAIModel(
    'Reformulate to an user friendly and only return the result text in "' +
      state.conversation.current_member.language +
      '" language:' +
      welcomeText
  );
  if (answerFromAI) {
    await context.sendActivity(answerFromAI);
  }
});
