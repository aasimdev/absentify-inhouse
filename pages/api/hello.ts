// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { AdaptiveCards } from '@microsoft/adaptivecards-tools';
import { CardFactory, ConversationReference, MessageFactory, TeamsInfo } from 'botbuilder';
import { getIronSession } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { getIronSessionConfig } from '~/utils/ironSessionConfig';
import * as msal from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { getMicrosoftGroupsAccessToken, getMicrosoftUsersAccessToken } from 'lib/getMicrosoftAccessToken';
import axios, { AxiosResponse } from 'axios';
import { addDays, addMinutes, addYears } from 'date-fns';
import { inngest } from '~/inngest/inngest_client';
import { logs } from '@microsoft/teams-js';
import { PaddleService } from '~/utils/paddleV2Service';
import fs from 'fs';
import { result, uniqBy } from 'lodash';
import { createOrUpdateSendInBlueContact } from '~/lib/sendInBlueContactApi';
import { defaultMemberSelect } from '~/server/api/routers/member';
import { summarizeSubscriptions } from '~/lib/subscriptionHelper';

export default async function handler(_req: NextApiRequest, _res: NextApiResponse<any>) {
  _res.status(200).json(0);
  return;

  /* try {
    const members = await prisma.member.findMany({where: {
      approver_config_department_id: {
        not: null
      },
    }, 
  select: {
    approver_config_department_id: true, departments: true, id: true,
  }});
  const updates = [];
  for (const member of members) {
    const departmentIds = member.departments.map(dep => dep.department_id);
    if(member.approver_config_department_id && !departmentIds.includes(member.approver_config_department_id)) {
      const promise = prisma.member.update({
        where: {id: member.id},
        data: {approver_config_department_id: departmentIds[0]},
      });
      updates.push(promise);
    }
  }

  await prisma.$transaction(updates);

    _res.status(200).json('Done');
  } catch (error: any) {
    _res.status(400).json(error);
  } */

  //  res.status(200).json('Done');
  /* const batchSize = 10000;
  const totalMembers = await prisma.member.count();
  const totalBatches = Math.ceil(totalMembers / batchSize);

  interface AllowanceType {
    id: string;
    name: string;
    default: boolean;
  }

  interface Member {
    id: string;
    workspace_id: string;
    allowances: {
      id: string;
      allowance_type: AllowanceType;
    }[];
  }
  let members: Member[] = [];

  for (let i = 0; i < totalBatches; i++) {
    const workspacesBatch: Member[] = await prisma.member.findMany({
      select: {
        id: true,
        workspace_id: true,
        allowances: {
          select: {
            id: true,
            allowance_type: { select: { id: true, name: true, default: true } }
          }
        }
      },
      orderBy: { id: 'asc' },
      skip: i * batchSize,
      take: batchSize
    });
    members = members.concat(workspacesBatch);
  }

  // Hilfsfunktion zum Aufteilen der Mitgliederliste in Blöcke von 20
  function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Verarbeite einen Block von Mitgliedern
  async function processMembersBlock(membersBlock: Member[]): Promise<number> {
    let processedMembersCount = 0;

    for (let member of membersBlock) {
      if (!member) continue;

      const workspaceAllowanceTypes = member.allowances.map((a) => a.allowance_type);
      const unique = uniqBy(workspaceAllowanceTypes, 'id');

      await prisma.memberAllowanceTypeConfigurtaion.deleteMany({
        where: { member_id: member.id }
      });

      let crMany = unique.map((u) => ({
        allowance_type_id: u.id,
        member_id: member.id,
        disabled: false,
        default: u.default,
        workspace_id: member.workspace_id
      }));

      await prisma.memberAllowanceTypeConfigurtaion.createMany({
        data: crMany
      });

      processedMembersCount++;
     // console.log(`Created allowance types for member ${member.id}`);
    }

    console.log(`${processedMembersCount} members processed in this block.`);
    return processedMembersCount;
  }

  // Hauptfunktion, um die Liste in Blöcke zu unterteilen und parallel zu verarbeiten
  async function processAllMembers(members: Member[], maxParallelBatches: number = 15) {
    const memberBlocks = chunkArray(members, 20);
    let totalProcessedMembers = 0;
  
    for (let i = 0; i < memberBlocks.length; i += maxParallelBatches) {
      const currentBatch = memberBlocks.slice(i, i + maxParallelBatches);
      await Promise.all(currentBatch.map(block => 
        processMembersBlock(block).then(processedCount => {
          totalProcessedMembers += processedCount;
          console.log(`Block processed. Total processed members: ${totalProcessedMembers}`);
        })
      ));
    }
  
    console.log(`Alle Mitglieder verarbeitet. Gesamt: ${totalProcessedMembers}`);
  }
 */
  // Verwende diese Funktion, um die Verarbeitung zu starten
  //await processAllMembers(members).then(() => console.log('Verarbeitung abgeschlossen.'));
  /* 
   let allAdmins = await prisma.member.findMany({
    where: { is_admin: true, language: 'de', email: { not: '' } },
    select: {
      id: true,
      email: true,
      firstName: true,
      displayName: true,
      lastName: true,
      workspace_id: true,
      microsoft_tenantId: true,
      mobile_phone: true,
      business_phone: true,
      createdAt: true,
      workspace: {
        select: {
          name: true,
          microsoft_users_read_all: true,
          subscriptions: { where: { OR: [{ provider: 'paddle' }, { provider: 'paddle_v2' }] } }
        }
      }
    },
    orderBy: { workspace_id: 'asc' }
  });

  allAdmins = allAdmins.filter((admin) => admin.workspace?.subscriptions.length == 0);

  const ensureMaxLength = (str: string, maxLength: number) =>
    str.length > maxLength ? str.substring(0, maxLength) : str;

  const adminsForCsv = allAdmins.map((admin) => ({
    email: ensureMaxLength(admin.email ?? '', 254),
    firstName: ensureMaxLength(admin.firstName ? admin.firstName : admin.email ?? '', 60),
    lastName: ensureMaxLength(admin.lastName ? admin.lastName : admin.email ?? '', 60),
    workspaceName: ensureMaxLength(admin.workspace ? admin.workspace.name : '', 255),
    displayName: ensureMaxLength(admin.displayName ? admin.displayName : admin.email ?? '', 255),
    mobile_phone: ensureMaxLength(admin.mobile_phone ? admin.mobile_phone : '', 60),
    business_phone: ensureMaxLength(admin.business_phone ? admin.business_phone : '', 60),
    createdAt: admin.createdAt
  }));
  // Erstellen eines CSV Parsers
  const parser = new Parser({
    fields: ['email', 'firstName', 'lastName', 'workspaceName', 'displayName', "mobile_phone", "business_phone", "createdAt"] // Definieren Sie hier Ihre CSV-Spalten
  });
  const csv = parser.parse(adminsForCsv);

  // Schreiben des CSV-Inhalts in eine Datei
  fs.writeFile('admins.csv', csv, function (err) {
    if (err) throw err;
    console.log('Datei wurde erfolgreich gespeichert!');
  }); 
 */
  // if (_req.method !== 'GET') {
  //   res.status(405).json({ error: 'Method not allowed' });
  //   return;
  // }

  //   const session = await getIronSession(req, res, getIronSessionConfig({ _req }));;
  // if (!session.user) return res.status(401).json({ message: 'Unauthorized' });
  // console.log(session.user.id);

  // const subs = await prisma.subscription.findMany({
  //   where: { OR: [{ provider: 'paddle_v2' }, { provider: 'paddle' }] },
  //   select: { workspace_id: true }
  // });

  // for (let index = 0; index < subs.length; index++) {
  //   const sub = subs[index];
  //   if (!sub) continue;
  //   await prisma.workspace.update({
  //     where: { id: sub.workspace_id },
  //     data: { old_pricing: true },
  //     select: { id: true }
  //   });
  // }
  /*   try {
    await PaddleService.updatPrices();
  } catch (e: any) {
    console.log(e.response.config.data);
    console.log(e.response.data.error.errors);
  } */
  /*   async function updateInBatchesWithCursor() {
    const batchSize = 5000; // Anzahl der Datensätze pro Batch
    let lastId = ''; // Initialwert für den Cursor als String
    let updateCount = 0; // Zähler für aktualisierte Datensätze

    while (true) {
      // Datensätze selektieren, die aktualisiert werden sollen, limitiert durch batchSize
      const batch = await prisma.request.findMany({
        where: {
          AND: [
            lastId ? { id: { gt: lastId } } : {}, // Nutzen des Cursors für sequenzielles Abrufen
            { details: { leave_type: { minimum_daily_absence: 'HalfDay' } } }
          ]
        },
        orderBy: { id: 'asc' }, // Sortierung gewährleisten
        take: batchSize // Limit für die Abfrage
      });

      if (batch.length === 0) {
        break; // Abbruch der Schleife, wenn keine weiteren Datensätze vorhanden sind
      }

      // IDs der Datensätze im aktuellen Batch sammeln
      const idsToUpdate = batch.map((record) => record.id);

      // Aktualisieren der ausgewählten Datensätze
      await prisma.request.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { leave_unit: 'half_days' }
      });

      updateCount += idsToUpdate.length; // Zähler aktualisieren
      if (idsToUpdate.length > 0) {
        lastId = idsToUpdate[idsToUpdate.length - 1] + ''; // Cursor für den nächsten Durchlauf sicher aktualisieren
      }
      console.log(`Updated ${updateCount} records so far`);
    }

    console.log('Update completed');
  }

  // Aufrufen der Funktion
  await updateInBatchesWithCursor().then(() => console.log('All records updated')); */

  /* async function updateInBatchesWithCursor() {
    const batchSize = 5000; // Anzahl der Datensätze pro Batch
    let lastId = ''; // Initialwert für den Cursor als String
    let updateCount = 0; // Zähler für aktualisierte Datensätze

    while (true) {
      // Datensätze selektieren, die aktualisiert werden sollen, limitiert durch batchSize
      const batch = await prisma.leaveType.findMany({
        where: {
          AND: [
            lastId ? { id: { gt: lastId } } : {}, // Nutzen des Cursors für sequenzielles Abrufen
            { minimum_daily_absence: 'HalfDay' }
          ]
        },
        orderBy: { id: 'asc' }, // Sortierung gewährleisten
        take: batchSize // Limit für die Abfrage
      });

      if (batch.length === 0) {
        break; // Abbruch der Schleife, wenn keine weiteren Datensätze vorhanden sind
      }

      // IDs der Datensätze im aktuellen Batch sammeln
      const idsToUpdate = batch.map((record) => record.id);

      // Aktualisieren der ausgewählten Datensätze
      await prisma.leaveType.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { leave_unit: 'half_days' }
      });

      updateCount += idsToUpdate.length; // Zähler aktualisieren
      if (idsToUpdate.length > 0) {
        lastId = idsToUpdate[idsToUpdate.length - 1] + ''; // Cursor für den nächsten Durchlauf sicher aktualisieren
      }
      console.log(`Updated ${updateCount} records so far`);
    }

    console.log('Update completed');
  }

  // Aufrufen der Funktion
  await updateInBatchesWithCursor().then(() => console.log('All records updated')); */

  /*   const workspacesWithMultipleAllowanceTypes: { id: string }[] = await prisma.$queryRaw`
  SELECT w.*
  FROM Workspace w
  JOIN AllowanceType at ON w.id = at.workspace_id
  GROUP BY w.id
  HAVING COUNT(at.id) > 1
`;
  console.log(workspacesWithMultipleAllowanceTypes.length);
  for (let index = 0; index < workspacesWithMultipleAllowanceTypes.length; index++) {
    const w = workspacesWithMultipleAllowanceTypes[index];
    if (!w) continue;
    const aTyoes = await prisma.allowanceType.findMany({ where: { workspace_id: w.id } });

    for (let i2 = 0; i2 < aTyoes.length; i2++) {
      const t = aTyoes[i2];
      if (!t) continue;

      const membersWithoutAllowances = await prisma.member.findMany({
        where: {
          workspace_id: w.id,
          allowances: {
            none: { allowance_type_id: t.id } // Dieser Filter sucht nach Members, die keine Einträge in der allowances Relation haben
          }
        },
        select: {
          id: true,
          workspace: {
            select: {
              id: true,
              createdAt: true,
              fiscal_year_start_month: true,
              allowance_types: { select: { id: true } }
            }
          }
        }
      });
      for (let i5 = 0; i5 < membersWithoutAllowances.length; i5++) {
        const member = membersWithoutAllowances[i5];
        if (!member || !member.workspace) continue;

        for (let i3 = 0; i3 < member.workspace.allowance_types.length; i3++) {
          const allowance_type = member.workspace.allowance_types[i3];
          if (!allowance_type) continue;

          await prisma.memberAllowance.create({
            data: {
              workspace_id: member.workspace.id,
              allowance: 0,
              year: member.workspace.createdAt.getFullYear(),
              member_id: member.id,
              remaining: 0,
              brought_forward: 0,
              compensatory_time_off: 0,
              taken: 0,
              allowance_type_id: allowance_type.id,
              start: new Date(
                Date.UTC(member.workspace.createdAt.getFullYear(), member.workspace.fiscal_year_start_month, 1)
              ),
              end: addDays(
                addYears(
                  new Date(
                    Date.UTC(member.workspace.createdAt.getFullYear(), member.workspace.fiscal_year_start_month, 1)
                  ),
                  1
                ),
                -1
              )
            }
          });
        }
        console.log('Created allowances for member index' + i5 + ' of ' + membersWithoutAllowances.length);
      }
      //console.log(membersWithoutAllowances.length);
    }
  } */

  /*    const groupedEntries = await prisma.memberAllowance.groupBy({
    where: {createdAt: {gte: new Date("2024-01-01T00:00:00.000Z")} },
    by: ['member_id', 'year', 'allowance_type_id'],
    _count: {
      id: true,
    },
  });

  console.log(groupedEntries.filter((group) => group._count.id > 1).length)

  for (const group of groupedEntries) {
    if (group._count.id > 1) {
      // Holen Sie die IDs der Duplikate, außer der des ersten Eintrags
      const duplicateEntries = await prisma.memberAllowance.findMany({
        where: {
          member_id: group.member_id,
          year: group.year,
          allowance_type_id: group.allowance_type_id,
        },
        orderBy: {
          createdAt: 'asc', // oder 'desc'
        },
        skip: 1, // Überspringen Sie den ersten Eintrag
      });
  
      // Löschen der Duplikate
      for (const duplicate of duplicateEntries) {
        await prisma.memberAllowance.delete({
          where: {
            id: duplicate.id,
          },
        });
      }
    }
  }  */

  /*  const batchSize = 10000;
  const totalWorkspaces = await prisma.memberAllowance.count();
  const totalBatches = Math.ceil(totalWorkspaces / batchSize);
  let workspaceBatches: { id: string; brought_forward: number }[] = [];
  for (let i = 0; i < totalBatches; i++) {
    const workspacesBatch = await prisma.memberAllowance.findMany({
      select: { id: true, brought_forward: true, member_id: true, workspace_id: true },
      orderBy: { member_id: 'asc' },
      skip: i * batchSize,
      take: batchSize
    });
    workspaceBatches = workspaceBatches.concat(workspacesBatch);
  }

  console.log(workspaceBatches.length); 

  let json = JSON.stringify(workspaceBatches, null, 2);

  // Speichern Sie den JSON-String in einer Datei
  fs.writeFileSync('data.json', json); */

  // updateDataInBatches(oldData);

  //);

  /* const workspacs = await prisma.workspace.findMany({
    where: { microsoft_users_read_all: 'ACTIVATED' },
    select: { id: true, members: { select: { microsoft_tenantId: true } } }
  });

  // Hilfsfunktion, um ein Array in Batches zu teilen
  function chunkArray(myArray: string[], chunk_size: number): string[][] {
    let results: string[][] = [];

    while (myArray.length) {
      results.push(myArray.splice(0, chunk_size));
    }

    return results;
  }

  for (let index = 0; index < workspacs.length; index++) {
    const workspace = workspacs[index];
    if (!workspace || workspace.members.length === 0) continue;

    const uniqueTenantIds = workspace.members.reduce<string[]>((acc, member) => {
      if (member.microsoft_tenantId != null && !acc.includes(member.microsoft_tenantId)) {
        acc.push(member.microsoft_tenantId);
      }
      return acc;
    }, []);

    if (!uniqueTenantIds || uniqueTenantIds.length === 0) continue;

    // Teile die uniqueTenantIds in Batches von 10
    const batches = chunkArray(uniqueTenantIds, 10);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch || batch.length === 0) continue;

      // Erstelle alle Abonnements im aktuellen Batch gleichzeitig
      await Promise.all(batch.map((uniqueTenantId) => createSubscription(uniqueTenantId)));
    }
  } */

  /*   const users = await prisma.member.groupBy({
    by: ['email'],
    _count: {
      email: true
    }
  });

  const duplicateEmails = users.filter((user) => user._count.email > 1).map((user) => user.email);

  const usersWithRequestCounts = await prisma.member.findMany({
    where: {
      email: {
        in: duplicateEmails as string[]
      }
    },
    orderBy: { email: 'asc' },
    select: {
      id: true,
      email: true,
      _count: {
        select: { requests: true }
      },
      is_admin: true,
      workspace_id: true,
      }
  });
  console.log(usersWithRequestCounts)

 // Sortieren Sie die Benutzer nach E-Mail und Anzahl der Anfragen, überspringen Sie dabei null E-Mails
const sortedUsers = usersWithRequestCounts.filter(user => user.email !== null).sort((a:any, b) => {
  if (a.email === b.email) {
    return (b._count?.requests || 0) - (a._count?.requests || 0);
  }
  return a.email?.localeCompare(b.email+ "");
});

// Durchlaufen Sie die sortierte Liste und ändern Sie die E-Mail-Adressen der Duplikate
let lastEmail = '';
let counter = 1;

for (const user of sortedUsers) {
  if (user.email === lastEmail) {
    counter++;
    // Ändern Sie die E-Mail-Adresse des Benutzers
    const newEmail = `${user.email}.${counter}`;
    await prisma.member.update({
      where: { id: user.id },
      data: { email: newEmail },
    });
  } else {
    lastEmail = user.email+"";
    counter = 0; // Zähler zurücksetzen
  } */

  /* let hasMore = true;

  while (hasMore) {
    // Hole 20 User-IDs, die gelöscht werden sollen
    const users = await prisma.user.findMany({
      where: { NOT: { email: null } },
      select: { id: true },
      take: 200,
    });

    // Wenn keine User mehr zum Löschen vorhanden sind, beende die Schleife
    if (users.length === 0) {
      hasMore = false;
      continue;
    }

    // Sammle die IDs der User, die gelöscht werden sollen
    const userIds = users.map((user) => user.id);

    // Lösche die User in einem Batch
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }
  */

  // let x = await prisma.requestDetail.findMany({where: {status : "APPROVED_BY_ANOTHER_MANAGER"}, select: {id: true, requester_member: {select: {email: true}}}})
  /* console.log(x)
  await prisma.requestDetail.delete({where: {id: x[0].id}})
   res.status(200).json({ name: 'John Doe' }); */
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
