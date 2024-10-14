import { BotBuilderCloudAdapter } from '@microsoft/teamsfx';
import ConversationBot = BotBuilderCloudAdapter.ConversationBot;
import { MyConversationReferenceStore } from './myConversationReferenceStore';

// Create bot.
export const notificationApp = new ConversationBot({
  adapterConfig: {
    MicrosoftAppId: process.env.NEXT_PUBLIC_MSAL_CLIENTID + '',
    MicrosoftAppPassword: process.env.MSAL_SECRET + '',
    MicrosoftAppType: 'MultiTenant'
  },
  notification: {
    enabled: true,
    store: new MyConversationReferenceStore()
  },
  ssoConfig: {
    aad: {
      scopes: ['openid', 'email', 'profile', 'offline_access', 'User.Read'],
      clientId: process.env.NEXT_PUBLIC_MSAL_CLIENTID,
      clientSecret: process.env.MSAL_SECRET,
      tenantId: 'common'
    }
  }
});
