//create syncLogs and request/create_timeghost_time_entries inngest function

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';

export default async function handler(_req: NextApiRequest, _res: NextApiResponse<any>) {
  try {
    let logs: string[] = [];
    //workspaces with active sync settings to correct
    let workspacesWithSyncSettings: { name: string; id: string }[] = [
      { name: 'ProChance Asset GmbH', id: '6e10fcc1-482a-409d-9dba-052720595046' },
    ];
    logs.push(` ${workspacesWithSyncSettings.length} workspace(s) found!`);
   
    const toDeletedSyncSettings = await prisma.timeghostSyncSetting.findMany({
      where: {
        OR: [
          {
            AND: [
              { workspace_id: '45b0efb8-35ab-4826-a400-b27731a206d1' },
              { id: 'd81a6a5a-61d7-4946-8bf5-363b0516d441' }
            ]
          },
          {
            AND: [
              { workspace_id: '4a372238-0282-48f1-a53d-f0e182416fb8' },
              { id: 'e7605540-f5b8-4033-b725-e5d3dffabeb2' }
            ]
          },
          {
            AND: [
              { workspace_id: 'ea865725-30af-4f59-a568-db87e4f78b89' },
              { id: 'd3589e28-b009-48c8-863a-f618cac41df9' }
            ]
          },
          {
            AND: [
              { workspace_id: 'c8f827d9-5602-4d35-8013-a53a3a5270e5' },
              { id: '30782da7-9155-4c9c-8d35-a85e36c1902a' }
            ]
          },
          {
            AND: [
              { workspace_id: 'a4fbd9aa-48a4-4510-bb13-560c61126642' },
              { id: 'd6389c6a-5ca9-4b8a-b8d9-27f042efe464' }
            ]
          }
        ]
      }
    });

    if (!toDeletedSyncSettings.length) {
      logs.push(`No sync settings to delete found!`);
    }
    for (const syncSetting of toDeletedSyncSettings) {
      logs.push(` ${syncSetting.name} sync settings deleted from db!`);
      await prisma.timeghostSyncSetting.delete({ where: { id: syncSetting.id } });
    }
    

    // Loop through each workspace and its active sync settings - duplicate active timeghostSyncSettings in the database, before deleteing them
    for (const workspace of workspacesWithSyncSettings) {
      const active_tg_sync_settings = await prisma.timeghostSyncSetting.findMany({
        where: {
          workspace_id: workspace.id,
          deleted: false
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          workspace_id: true,
          name: true,
          description: true,
          deleted: true,
          timeghost_workspace_id: true,
          timeghost_api_access_token: true,
          invalid_apikey_notification_sent: true,
          timeghostSyncSettingLeaveTypes: {
            select: { leave_type: { select: { id: true } }, timeghost_sync_setting_id: true, leave_type_id: true }
          },
          timeghostSyncSettingDepartments: {
            select: { department: { select: { id: true } }, timeghost_sync_setting_id: true, department_id: true }
          }
        }
      });
      logs.push(`Found ${active_tg_sync_settings.length} active tg sync settings in ${workspace.name} !`);

      for (const timeghostSyncSetting of active_tg_sync_settings) {
        if (!timeghostSyncSetting) {
          return _res.status(400).json('No active sync settings found');
        }

        const createdSyncSetting = await prisma.timeghostSyncSetting.create({
          data: {
            name: timeghostSyncSetting.name,
            description: timeghostSyncSetting.description,
            workspace_id: timeghostSyncSetting.workspace_id,
            timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id,
            timeghost_api_access_token: timeghostSyncSetting.timeghost_api_access_token,
            invalid_apikey_notification_sent: timeghostSyncSetting.invalid_apikey_notification_sent
          },
          select: { id: true, deleted: true, timeghost_workspace_id: true }
        });

        await prisma.$transaction([
          prisma.timeghostSyncSettingDepartment.createMany({
            data: timeghostSyncSetting.timeghostSyncSettingDepartments.map((department) => ({
              timeghost_sync_setting_id: createdSyncSetting.id,
              department_id: department.department_id
            }))
          }),

          prisma.timeghostSyncSettingLeaveType.createMany({
            data: timeghostSyncSetting.timeghostSyncSettingLeaveTypes.map((leave_type) => ({
              timeghost_sync_setting_id: createdSyncSetting.id,
              leave_type_id: leave_type.leave_type_id
            }))
          })
        ]);
        logs.push(` '${timeghostSyncSetting.name}' copie created!`);
      }
    }
    // Once all the operations are complete, return the logs in the response
    return _res.status(200).json({ message: 'Operations completed', logs });
  } catch (error: any) {
    console.error('Error occurred during the process:', error);
    return _res.status(500).json({ error: 'An error occurred during the process', details: error.message });
  }
}
