import { ConversationReferenceStore, ConversationReferenceStoreAddOptions, PagedData } from '@microsoft/teamsfx';
import { ConversationReference } from 'botbuilder';
import { prisma } from '~/server/db';

export class MyConversationReferenceStore implements ConversationReferenceStore {
  async add(
    key: string,
    reference: Partial<ConversationReference>,
    _options: ConversationReferenceStoreAddOptions
  ): Promise<boolean> {
    if (!reference.user?.aadObjectId) return false;
    await prisma.teamsBotConversationReferences.upsert({
      where: { ref_id: key },
      create: {
        ref_id: key,
        ref_data: reference as any,
        user_aad_id: reference.user.aadObjectId
      },
      update: { ref_data: reference as any },
      select: { id: true }
    });
    return true;
  }

  async remove(key: string, _reference: Partial<ConversationReference>): Promise<boolean> {
    try {
      await prisma.teamsBotConversationReferences.delete({
        where: { ref_id: key }
      });
    } catch (e) {
      return true;
    }

    return true;
  }

  async list(pageSize: number = 10, continuationToken?: string): Promise<PagedData<Partial<ConversationReference>>> {
    const whereClause = continuationToken ? { id: { gt: continuationToken } } : {};

    const results = await prisma.teamsBotConversationReferences.findMany({
      where: whereClause,
      orderBy: {
        ref_id: 'asc'
      },
      take: pageSize,
      select: {
        id: true,
        ref_id: true,
        ref_data: true
      }
    });

    const conversationReferences: Partial<ConversationReference>[] = results.map((row) => {
      return row.ref_data as Partial<ConversationReference>;
    });

    const nextPageToken = results.length === pageSize ? results[results.length - 1]?.id : undefined;

    const pagedData: PagedData<Partial<ConversationReference>> = {
      data: conversationReferences,
      continuationToken: nextPageToken
    };

    return pagedData;
  }
}
