import { AdaptiveCards } from '@microsoft/adaptivecards-tools';
import { notificationApp } from './initialize';
import notificationTemplate from '~/utils/microsoft_teams/adaptiveCards/notification-default.json';
import { PrismaClient } from '@prisma/client';
import { CardFactory, ConversationReference, MessageFactory, ResourceResponse } from 'botbuilder';
import TurndownService from 'turndown';
interface CardUserData {
  image: string;
  name: string;
  status: string;
}
interface CardData {
  pageTitle: string;
  h1: string;
  firstLine: string;
  secondLine: string;
  thirdLine: string;
  fourthLine: string;
  fifthLine: string;
  users: CardUserData[];
  showApprovalActions: boolean;
  request_id: string;
  buttonLink: string;
  buttonText: string;
}

export async function sendAdaptiveCard(
  prisma: PrismaClient,
  cardData: CardData,
  receiver_member_id: string
): Promise<string | undefined> {
  const user = await prisma.member.findUnique({
    where: { id: receiver_member_id },
    select: { notifications_receiving_method: true, microsoft_user_id: true }
  });
  if (!user) return;
  //if (user.notifications_receiving_method == 'Email') return;
  if (!user.microsoft_user_id) return;
  let x = await prisma.teamsBotConversationReferences.findFirst({
    where: { user_aad_id: user.microsoft_user_id },
    select: { ref_data: true }
  });

  if (!x) return;

  var turndownService = new TurndownService();
  cardData.firstLine = turndownService.turndown(cardData.firstLine);
  cardData.secondLine = turndownService.turndown(cardData.secondLine);
  cardData.thirdLine = turndownService.turndown(cardData.thirdLine);
  cardData.fourthLine = turndownService.turndown(cardData.fourthLine);
  cardData.fifthLine = turndownService.turndown(cardData.fifthLine);
  // cardData.h1 = turndownService.turndown(cardData.h1)
  //cardData.pageTitle = turndownService.turndown(cardData.pageTitle)

  let ac: ResourceResponse | undefined;
  const adaptor = notificationApp.adapter;
  let adaptiveCard = AdaptiveCards.declare<CardData>(notificationTemplate).render(cardData);
  try {
    await adaptor.continueConversationAsync(
      process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
      x.ref_data as Partial<ConversationReference>,
      async (context) => {
        const activity = await context.sendActivity({
          attachments: [CardFactory.adaptiveCard(adaptiveCard)],
          summary: cardData.pageTitle
        });
        ac = activity;
      }
    );
  } catch (e) {
    console.log(e);
  }
  if (!ac) return;
  return ac.id;
}
export async function updareAdaptiveCard(
  prisma: PrismaClient,
  cardData: CardData,
  receiver_member_id: string,
  activityId: string
) {
  const user = await prisma.member.findUnique({
    where: { id: receiver_member_id },
    select: { notifications_receiving_method: true, microsoft_user_id: true }
  });
  if (!user) return;
  //if (user.notifications_receiving_method == 'Email') return;
  if (!user.microsoft_user_id) return;
  let x = await prisma.teamsBotConversationReferences.findFirst({
    where: { user_aad_id: user.microsoft_user_id },
    select: { ref_data: true }
  });

  if (!x) return;
  let ac;
  const adaptor = notificationApp.adapter;
  let adaptiveCard = AdaptiveCards.declare<CardData>(notificationTemplate).render(cardData);
  try {
    await adaptor.continueConversationAsync(
      process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
      x.ref_data as Partial<ConversationReference>,
      async (context) => {
        var activity = MessageFactory.attachment(CardFactory.adaptiveCard(adaptiveCard));
        activity.id = activityId;
        activity.summary = cardData.pageTitle;
        await context.updateActivity(activity);
      }
    );
  } catch (e) {
    console.log(e);
  }
}
