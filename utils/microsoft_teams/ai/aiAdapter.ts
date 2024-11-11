import {
  Application,
  preview,
  DefaultConversationState,
  DefaultTempState,
  DefaultUserState,
  TurnState,
  AI
} from '@microsoft/teams-ai';
import { ConversationAccount, MemoryStorage, MessageFactory, ResourceResponse, TurnContext } from 'botbuilder';
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
    planner,
    enable_feedback_loop: true
  }
});

export const run = (context: TurnContext) => app.run(context);

function getTextInsideQuotes(inputString: string): string | null {
  // Use regular expression to find the first substring inside double quotes
  const match = inputString.match(/"(.*?)"/);

  // If a match is found, return the first group without the quotes, otherwise return null
  return match && match[1]? match[1] : null;
}

function getTomorrowDate(): string {
  const today = new Date();
  
  // Add one day to the current date
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Extract the day, month, and year
  const day = tomorrow.getDate();
  const month = tomorrow.getMonth() + 1;  // getMonth() is zero-based
  const year = tomorrow.getFullYear();

  // Return the formatted date as "DD.MM.YYYY"
  return `${day}.${month}.${year}`;
}

export async function callAIModel(content: string, context: TurnContext) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
    stream: true
  });

  let fullResponse = '';
  const initialMessage = (await context.sendActivity('...')) as ResourceResponse; // Placeholder message

  if (stream) {
    try {
      for await (const part of stream) {
        const contentPart = part.choices[0]?.delta?.content || '';

        if (contentPart) {
          fullResponse += contentPart;

          // Update the existing message with the new content
          const updatedMessage = {
            type: 'message',
            id: initialMessage.id, // The ID of the message to update
            text: fullResponse // The updated full content so far
          };

          await context.updateActivity(updatedMessage); // Update the same message
        }
      }
    } catch (error) {
      console.error('Error during streaming or updating the activity:', error);
      // Send a message to the user informing them of the error
      const errorMessage = {
        type: 'message',
        text: 'Oops! Something went wrong while processing your request. Please try again later.',
        id: initialMessage.id
      };
      await context.sendActivity(errorMessage); // Send an error message to the user
    }
    return fullResponse;
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
  //show leave type suggested actions
  if (state.conversation.request_parameters.leave_type || state.conversation.request_parameters.leave_type_name) {
    bot.sendSuggestedActions(context, 'leave_type');
  }

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
  const tomorrowDate = getTomorrowDate();
  await app.ai.doAction(context, state, 'get_init_data');
  const commandsText =
    `Here are the available commands:\n` +
    `/help - Get a list of available commands and their usage.\n` +
    `/start - Start a new session with the bot.\n` +
    `You can also create a new absence by typing something like: "Create a vacation absence on ${tomorrowDate} from morning till the end of the day".`;
    //get and display the response from the AI model
  const fullResponse = await callAIModel(
    `Please rephrase the following text to be user-friendly and return the result in "${state.conversation.current_member.language}" language: ${commandsText}`,
    context
  );
  if (fullResponse) {
    let bot = new TeamsBot();
    //get the translated text inside the quotes to set as value for create request suggested action
    const result = getTextInsideQuotes(fullResponse);
    //sent the suggested actions to user
    bot.sendSuggestedActions(context, 'help_command', result ? result : '');
  }
});

// Define the start command
app.message(/\/start/, async (context: TurnContext, state) => {
  await app.ai.doAction(context, state, 'get_init_data');
  const welcomeText = 'Welcome! How can I assist you today? You can type or select /help to see what I can do.';
  await callAIModel(
    `Please rephrase the following text to be user-friendly and return the result in "${state.conversation.current_member.language}" language: ${welcomeText}`,
    context
  );
  let bot = new TeamsBot();
   //sent the suggested actions to user
  bot.sendSuggestedActions(context, 'start_command');
});
