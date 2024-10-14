import { prisma } from '~/server/db';
import { inngest } from '../inngest_client';
import { slugify } from 'inngest';
import { WebhookHistoryStatus, LeaveUnit } from '@prisma/client';
import { addDays } from 'date-fns';
import { dateFromDatabaseIgnoreTimezone } from '~/lib/DateHelper';
import * as Sentry from '@sentry/nextjs';
import axios, { AxiosResponse } from 'axios';
import { webhookSelect, WebhookHistorySelect } from '~/server/api/routers/webhook_setting';
import { serializeError } from 'serialize-error';

export const deleteOldWebhookHistoryAttempts = inngest.createFunction(
  {
    id: slugify('Delete Old Webhook History Attempts'),
    name: 'Delete Old Webhook History Attempts'
  },
  { cron: '0 22 * * *' },
  async () => {
    await prisma.webhookHistoryAttempt.deleteMany({
      where: {
        createdAt: { lte: addDays(new Date(), -30) }
      }
    });

    return { success: true };
  }
);

export const processWebhook = inngest.createFunction(
  {
    id: slugify('Process Webhook'),
    name: 'Process Webhook'
  },
  { event: 'process.webhook' },
  async ({ event, step }) => {
    const { id } = event.data;
    const webhookHistory = await prisma.webhookHistory.findUnique({
      where: { id },
      select: webhookSelect
    });

    if (!webhookHistory) {
      return { success: false, message: 'Webhook history not found' };
    }

    if (webhookHistory.status === 'ERROR' || webhookHistory.status === 'SUCCESS') {
      return { success: true };
    }

    webhookHistory.request.start = dateFromDatabaseIgnoreTimezone(webhookHistory.request.start);
    webhookHistory.request.end = dateFromDatabaseIgnoreTimezone(webhookHistory.request.end);

    const request = webhookHistory.request as any;

    if (!webhookHistory.request.details) return;
    request.duration = webhookHistory.request.details.duration;
    const details = webhookHistory.request.details as any;
    details.deducted = webhookHistory.request.details.workday_absence_duration;

    details.approver_member =
      webhookHistory.request.details.status === 'APPROVED'
        ? webhookHistory.request.details.request_approvers.find((y: any) => y.status === 'APPROVED')
            ?.status_changed_by_member ?? null
        : null;
    details.approved_date =
      webhookHistory.request.details.status === 'APPROVED'
        ? webhookHistory.request.details.request_approvers.find((y: any) => y.status === 'APPROVED')
            ?.status_change_date ?? null
        : null;
    details.decline_reason =
      webhookHistory.request.details.status === 'DECLINED'
        ? webhookHistory.request.details.request_approvers.find((y: any) => y.status === 'DECLINED')?.reason ?? null
        : null;
    details.declined_by_member =
      webhookHistory.request.details.status === 'DECLINED'
        ? webhookHistory.request.details.request_approvers.find((y: any) => y.status === 'DECLINED')
            ?.status_changed_by_member ?? null
        : null;
    details.declined_date =
      webhookHistory.request.details.status === 'DECLINED'
        ? webhookHistory.request.details.request_approvers.find((y: any) => y.status === 'DECLINED')
            ?.status_change_date ?? null
        : null;

    const runResult = await runWebhook(webhookHistory, false);
    if (runResult.sleepAndRetry) {
      const waitTime = calculateWaitTime(runResult.attempt);
      await step.sleep(`Retry attempt ${runResult.attempt}: Waiting for ${waitTime / 1000} seconds`, waitTime);
      inngest.send({ name: 'process.webhook', data: { id } });
    }

    return { success: true };
  }
);

function calculateWaitTime(attempt: number) {
  const baseWaitTime = 60000; // 1 Minute in Millisekunden
  const maxWaitTime = 8 * 60 * 60 * 1000; // 8 Stunden in Millisekunden
  const waitTime = Math.min(baseWaitTime * Math.pow(2, attempt - 1), maxWaitTime);
  return waitTime;
}

interface CustomAxiosResponse<T = any> extends AxiosResponse<T> {
  duration: number;
}

async function runWebhook(webhookHistory: WebhookHistorySelect, retry: boolean) {
  if (webhookHistory) {
    const { webhookHistoryAttempts } = webhookHistory;
    if (webhookHistoryAttempts.length < 10 || retry) {
      try {
        axios.interceptors.request.use(
          (config: any) => {
            config.metadata = { startTime: new Date() };
            return config;
          },
          (error) => {
            return Promise.reject(error);
          }
        );

        axios.interceptors.response.use(
          (response: any) => {
            response.config.metadata.endTime = new Date();
            response.duration = response.config.metadata.endTime - response.config.metadata.startTime;
            return response;
          },
          (error) => {
            error.config.metadata.endTime = new Date();
            error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
            return Promise.reject(error);
          }
        );

        const response: CustomAxiosResponse = await axios.post(
          webhookHistory.webhook_setting.url,
          webhookHistory.request,
          {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'json'
          }
        );

        await prisma.$transaction([
          prisma.webhookHistoryAttempt.create({
            data: {
              request_data: JSON.stringify({
                url: webhookHistory.webhook_setting.url,
                method: 'POST',
                data: webhookHistory.request
              }),
              response_data: JSON.stringify({
                http_code: response.status,
                redirect_url: response.headers.location,
                content_type: response.headers['content-type'],
                total_time: response.duration,
                response_body: JSON.stringify(response.data),
                status_text: response.statusText
              }),
              url: webhookHistory.webhook_setting.url,
              webhook_history_id: webhookHistory.id
            }
          }),
          prisma.webhookHistory.update({
            where: { id: webhookHistory.id },
            data: {
              status: WebhookHistoryStatus.SUCCESS
            }
          })
        ]);
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            if (
              webhookHistory.webhook_setting.source === 'MicrosoftPowerAutomate' &&
              (error.response.status === 400 || error.response.status === 404)
            ) {
              await prisma.webhookSetting.delete({
                where: { id: webhookHistory.webhook_setting.id }
              });
              return { sleepAndRetry: false, attempt: webhookHistoryAttempts.length };
            }

            await prisma.webhookHistoryAttempt.create({
              data: {
                request_data: JSON.stringify({
                  url: webhookHistory.webhook_setting.url,
                  method: 'POST',
                  data: webhookHistory.request
                }),
                response_data: JSON.stringify({
                  http_code: error.response.status,
                  redirect_url: error.response.headers.location,
                  content_type: error.response.headers['content-type'],
                  total_time: 0,
                  response_body: JSON.stringify(error.response.data),
                  status_text: error.response.statusText
                }),
                url: webhookHistory.webhook_setting.url,
                webhook_history_id: webhookHistory.id
              }
            });
            return { sleepAndRetry: true, attempt: webhookHistoryAttempts.length };
          }
        }

        Sentry.captureException(error);
        const errorData = serializeError(error);

        await prisma.webhookHistoryAttempt.create({
          data: {
            request_data: JSON.stringify({
              url: webhookHistory.webhook_setting.url,
              method: 'POST',
              data: webhookHistory.request
            }),
            response_data: JSON.stringify(errorData),
            url: webhookHistory.webhook_setting.url,
            webhook_history_id: webhookHistory.id
          }
        });
        return { sleepAndRetry: true, attempt: webhookHistoryAttempts.length };
      }
    } else {
      await prisma.webhookHistory.update({
        where: { id: webhookHistory.id },
        data: {
          status: WebhookHistoryStatus.ERROR
        }
      });
    }
  }
  return { sleepAndRetry: false, attempt: 0 };
}
