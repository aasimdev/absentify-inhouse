//trigger request/delete_timeghost_sync_setting inngest function so that all sleeping functions will be canceled and update original active timeghostSyncSettings to "deleted:true"

import { inngest } from '~/inngest/inngest_client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';

export default async function handler(_req: NextApiRequest, _res: NextApiResponse<any>) {
  try {
    let logs: string[] = [];
     //workspaces with active sync settings to correct
     let workspacesWithSyncSettings: { name: string; id: string }[] = [{ name: 'ProChance Asset GmbH', id: '6e10fcc1-482a-409d-9dba-052720595046' }];
    logs.push(` ${workspacesWithSyncSettings.length}  workspace(s) found!`);

    for (const workspace of workspacesWithSyncSettings) {
      const active_tg_sync_settings = await prisma.timeghostSyncSetting.findMany({
        where: {
          workspace_id: workspace.id,
          deleted: false,
          requestSyncLogs : {
            some: {}
          }
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
            select: { leave_type: { select: { id: true } },timeghost_sync_setting_id: true,leave_type_id: true },

          },
          timeghostSyncSettingDepartments: {
            select: { department: { select: { id: true } }, timeghost_sync_setting_id:true, department_id: true }
          }
        }
      });

      for (const timeghostSyncSetting of active_tg_sync_settings) {
        if (!timeghostSyncSetting) {
          return _res.status(400).json('No active sync settings found');
        }

        await inngest.send({
          name: 'request/delete_timeghost_sync_setting',
          data: {
            timeghost_sync_setting_id: timeghostSyncSetting.id,
            deletePastSyncsInTg: true
          }
        });

        // Log the triggering of the event
        logs.push(`Step 1: 'request/delete_timeghost_sync_setting' is triggered for '${timeghostSyncSetting.name}'`);

        await prisma.timeghostSyncSetting.update({
          where: { id: timeghostSyncSetting.id },
          data: { deleted: true }
        });

        // Log the update action in the database
        logs.push(`Step 2: '${timeghostSyncSetting.name}' updated to deleted in the database`);
      }
    }
    // Once all the operations are complete, return the logs in the response
    return  _res.status(200).json({ message: 'Operations completed', logs });
  } catch (error: any) {
    console.error('Error occurred during the process:', error);
    return _res.status(500).json({ error: 'An error occurred during the process', details: error.message });
  }
}
