import { protectedProcedure, createTRPCRouter } from '../trpc';
import {
  getMicrosoftCalendarAccessToken,
  getMicrosoftGroupsAccessToken,
  getMicrosoftMailboxAccessToken,
  getMicrosoftDefaultAppAccessToken,
  getMicrosoftUsersAccessToken
} from 'lib/getMicrosoftAccessToken';
import { decode } from 'jsonwebtoken';

export const microsoftScopesRouter = createTRPCRouter({
  all: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.current_member.microsoft_tenantId) {
      return { scopes: [] };
    }

    const access_token_Default = await getMicrosoftDefaultAppAccessToken(ctx.current_member.microsoft_tenantId);
    const access_token_Calendar = await getMicrosoftCalendarAccessToken(ctx.current_member.microsoft_tenantId);
    const access_token_Mailbox = await getMicrosoftMailboxAccessToken(ctx.current_member.microsoft_tenantId);
    const access_token_Groups = await getMicrosoftGroupsAccessToken(ctx.current_member.microsoft_tenantId);
    const access_token_Users = await getMicrosoftUsersAccessToken(ctx.current_member.microsoft_tenantId);

    if (!access_token_Calendar && !access_token_Default && !access_token_Mailbox) {
      return { scopes: [] };
    }

    let t_Default: any = decode(access_token_Default);
    const t_Calendar: any = decode(access_token_Calendar);
    const t_Mailbox: any = decode(access_token_Mailbox);
    const t_Groups: any = decode(access_token_Groups);
    const t_Users: any = decode(access_token_Users);

    const retScopes = [];
    if (t_Calendar.roles) {
      retScopes.push(...t_Calendar.roles);
    }
    if (t_Users.roles) {
      retScopes.push(...t_Users.roles);
    }
    if (t_Default.roles) {
      retScopes.push(...t_Default.roles);
    }
    if (t_Mailbox.roles) {
      retScopes.push(...t_Mailbox.roles);
    }
    if (t_Groups.roles) {
      retScopes.push(...t_Groups.roles);
    }
    return { scopes: retScopes };
  })
});
