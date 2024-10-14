import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { createName } from '~/utils/createName';
import { slugify } from 'inngest';

export const updateGlobalNameFornat = inngest.createFunction(
  { id: slugify('Update global name format'), name: 'Update global name format' },
  { event: 'workspace/update.member.name_format' },
  async ({ event, step }) => {
    const workspace_id = event.data.workspaceId;
    const global_name_format = event.data.global_name_format;

    await step.run('Update global name format', async () => {
      const updateInBatches = async (
        members: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
          displayName: string | null;
        }[],
        batchSize = 20
      ) => {
        let toUpdate = [];

        for (let index = 0; index < members.length; index++) {
          const member = members[index];
          if (!member) continue;
          //console.log(index + ' of ' + users.length);
          toUpdate.push(
            prisma.member.updateMany({
              where: { id: member.id },
              data: {
                name: createName(
                  global_name_format,
                  member.firstName,
                  member.lastName,
                  member.displayName,
                  member.email + ''
                )
              }
            })
          );

          // Wenn die Länge von `toUpdate` gleich der `batchSize` ist, führen Sie die Transaktion aus und setzen `toUpdate` zurück
          if (toUpdate.length >= batchSize) {
            await prisma.$transaction(toUpdate);
            toUpdate = [];
          }
        }

        // Führen Sie die letzte Transaktion für verbleibende Elemente aus, falls vorhanden
        if (toUpdate.length > 0) {
          await prisma.$transaction(toUpdate);
        }
      };
      let members = await prisma.member.findMany({
        where: { workspace_id: workspace_id, microsoft_user_id: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true
        }
      });

      // Verwenden Sie diese Funktion und geben Sie die `members` und die gewünschte `batchSize` (50) an
      await updateInBatches(members, 20);
    });

    return { event, body: 'Hello, World!' };
  }
);
