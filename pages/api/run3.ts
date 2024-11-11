//create syncLogs and request/create_timeghost_time_entries inngest function

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '~/server/db';
import { inngest } from '~/inngest/inngest_client';
import { Prisma, PrismaClient, RequestStatus, SyncStatus } from '@prisma/client';
import { BodyParams, TimeEntry, TimeghostService } from '../../../app/lib/timeghostService';

interface CreateRequestSyncLogEntriesInput {
  workspace_id: string;
  leave_type_ids?: string[];
  department_ids: string[];
  leave_types?: { id: string; sync_as_name: string }[];
}

interface SyncSettings {
  id: string;
  timeghost_workspace_id: string;
}

// Utility to chunk an array into smaller arrays of a specified size
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export function errorText(startDate: Date, status: string) {
  if (status == 'PENDING') {
    return 'Pending: Waiting for approval';
  }
  if (status == 'APPROVED' && startDate > new Date()) {
    return 'Sleeping: Waiting for start date';
  }
  return null;
}

export default async function handler(_req: NextApiRequest, _res: NextApiResponse<any>) {
  async function CreateRequestSyncLogTimeghostEntries(
    input: CreateRequestSyncLogEntriesInput,
    prisma: PrismaClient,
    timeghost_sync_setting: SyncSettings
  ) {
    let skriptLogs: string[] = [];
    const requestSyncLogCreate: Prisma.RequestSyncLogCreateManyInput[] = [];
    const today = new Date();

    if (input.leave_type_ids) {
      // Define base query conditions
      const baseConditions: Prisma.RequestWhereInput = {
        workspace_id: input.workspace_id,
        OR: [{ year: today.getFullYear() }, { year: today.getFullYear() + 1 }],
        details: {
          AND: [
            { NOT: { status: 'CANCELED' } },
            { NOT: { status: 'DECLINED' } },
            {
              leave_type_id: { in: input.leave_type_ids },
              requester_member: {
                departments: {
                  some: {
                    department_id: { in: input.department_ids }
                  }
                }
              }
            }
          ]
        }
      };

      // Fetch requests from the database
      const requests = await prisma.request.findMany({
        where: baseConditions,
        select: {
          id: true,
          start: true,
          details: {
            select: {
              status: true,
              leave_type_id: true
            }
          }
        }
      });
      skriptLogs.push(`Found ${requests.length} requests for syncing  to timeghost`);

      // Process each request
      for (const request of requests) {
        const requestFromDb = await prisma.request.findUnique({
          where: { id: request.id },
          select: {
            id: true,
            start: true,
            end: true,
            start_at: true,
            end_at: true,
            leave_unit: true,
            details: {
              select: {
                status: true,
                requester_member: {
                  select: {
                    microsoft_user_id: true,
                    timezone: true,
                    schedules: true
                  }
                }
              }
            },
            workspace_id: true,
            workspace: { select: { global_timezone: true } }
          }
        });

        if (!requestFromDb || !requestFromDb.details?.requester_member?.schedules) {
          continue;
        }

        const {
          schedules: memberSchedules,
          microsoft_user_id: timeghost_user_id,
          timezone
        } = requestFromDb.details.requester_member;
        const workspaceSchedule = await prisma.workspaceSchedule.findUnique({
          where: { workspace_id: requestFromDb.workspace_id }
        });

        if (!timeghost_user_id || !workspaceSchedule) {
          continue;
        }

        const bodyInput: BodyParams = {
          request: requestFromDb,
          timeEntries: [],
          timeghost_user_id,
          timeghost_workspace_id: timeghost_sync_setting.timeghost_workspace_id,
          memberSchedules,
          workspaceSchedule
        };

        TimeghostService.setBody(bodyInput, timezone ?? requestFromDb.workspace.global_timezone);
        for (const timeEntry of bodyInput.timeEntries) {
          requestSyncLogCreate.push({
            workspace_id: input.workspace_id,
            request_id: request.id,
            sync_type: 'timeghost',
            error: errorText(requestFromDb.start, requestFromDb.details.status),
            timeghost_sync_setting_id: timeghost_sync_setting.id,
            sync_status: SyncStatus.NotSynced,
            timeghost_time_entry: JSON.stringify(timeEntry)
          });
        }
      }
    }

    // Chunking data before inserting into the database
    if (requestSyncLogCreate.length > 0) {
      const chunkSize = 1000; // Set the chunk size, adjust based on your system's capacity
      const chunks = chunkArray(requestSyncLogCreate, chunkSize);

      for (const chunk of chunks) {
        try {
          await prisma.requestSyncLog.createMany({ data: chunk });
        } catch (error) {
          console.error('Error inserting chunk:', error);
          // Optional: Implement retry or logging mechanisms for error handling
        }
      }
      skriptLogs.push(`Inserted ${requestSyncLogCreate.length} records into the database`);
      const logs = await prisma.requestSyncLog.findMany({
        where: { timeghost_sync_setting_id: timeghost_sync_setting.id, sync_status: SyncStatus.NotSynced },
        select: { id: true, request_id: true, timeghost_sync_setting_id: true }
      });

      const events = logs.map((log, index) => ({
        name: 'request/create_timeghost_time_entries' as 'request/create_timeghost_time_entries',
        data: {
          request_id: log.request_id,
          sync_log_id: log.id,
          timeghost_sync_setting_id: log.timeghost_sync_setting_id,
          for_update: false,
          first_event: index === 0
        }
      }));

      // Split events into batches of 2500
      const eventChunks = chunkArray(events, 2500);
      // Send each chunk separately
      for (const chunk of eventChunks) {
        skriptLogs.push(` ${chunk.length} events to inngest`);
        await inngest.send(chunk);
      }

      skriptLogs.push(`Sent ${events.length} events to inngest`);
    }

    return skriptLogs;
  }

  try {
    let logs: string[] = [];
    //workspaces with active sync settings to correct
    let workspacesWithSyncSettings: { name: string; id: string }[] = [{ name: 'ProChance Asset GmbH', id: '6e10fcc1-482a-409d-9dba-052720595046'}];
    logs.push(` ${workspacesWithSyncSettings.length} found!`);

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

      for (const timeghostSyncSetting of active_tg_sync_settings) {
        if (!timeghostSyncSetting) {
          logs.push('No active sync settings found');
        }
        const input = {
          workspace_id: timeghostSyncSetting.workspace_id,
          leave_type_ids: timeghostSyncSetting.timeghostSyncSettingLeaveTypes.map(
            (leave_type) => leave_type.leave_type_id
          ),
          department_ids: timeghostSyncSetting.timeghostSyncSettingDepartments.map(
            (department) => department.department_id
          )
        };

        const syncSetting = {
          id: timeghostSyncSetting.id,
          timeghost_workspace_id: timeghostSyncSetting.timeghost_workspace_id
        };
        logs = await CreateRequestSyncLogTimeghostEntries(input, prisma, syncSetting);
      }
    }
    // Once all the operations are complete, return the logs in the response
    return _res.status(200).json({ message: 'Operations completed', logs });
  } catch (error: any) {
    console.error('Error occurred during the process:', error);
    return _res.status(500).json({ error: 'An error occurred during the process', details: error.message });
  }
}
