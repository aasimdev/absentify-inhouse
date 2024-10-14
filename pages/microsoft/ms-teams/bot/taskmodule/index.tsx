import AddHoliday, { openDialogValuesType } from '@components/calendar/CreateRequest/CreateRequest';
import { GetServerSideProps } from 'next';
import Redis from 'ioredis';

import * as Sentry from '@sentry/nextjs';
import useTranslation from 'next-translate/useTranslation';

export interface LeaveData {
  start: Date;
  end: Date;
  start_at: 'morning' | 'afternoon';
  end_at: 'lunchtime' | 'end_of_day';
  member_id: string;
  leave_type_id: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { configId } = context.query;

  if (typeof configId !== 'string') {
    return { notFound: true };
  }

  const getValues = async (configId: string): Promise<LeaveData | null> => {
    try {
      if (configId) {
        const redis = new Redis(process.env.REDIS_URL + '');
        const value = await redis.get(configId);
        return value ? JSON.parse(value) : null;
      }
    } catch (error) {
      console.error('Network error while retrieving data from Redis:', error);
      Sentry.captureException(error);
    }
    return null;
  };

  // Fetch data from Redis
  const redisValue = await getValues(configId);

  return { props: { taskModuleValues: redisValue } };
};

interface Props {
  taskModuleValues: LeaveData | null;
}

const TaskModulePage = ({ taskModuleValues }: Props) => {
  const { t } = useTranslation('calendar');

  const handleClose = async (status: 'success' | 'cancel') => {
    console.log('status', status);
    const { dialog } = await import('@microsoft/teams-js');
    //await app.initialize();
    await dialog.initialize();
    dialog.url.submit({ status });
  };

  console.log('taskModuleValues', taskModuleValues);
  if (taskModuleValues) {
    const initValues:openDialogValuesType = {
      start: new Date(taskModuleValues.start),
      end: new Date(taskModuleValues.end),
      start_at: taskModuleValues.start_at,
      end_at: taskModuleValues.end_at,
      member_id: taskModuleValues.member_id,
      leave_type_id: taskModuleValues.leave_type_id
    };
    return (
      <div className="px-8 py-0">
        <AddHoliday
          initDateValues={initValues}
          openAsDialog={false}
          showUserSelect={false}
          showDepartmentSelect={false}
          onClose={async (status: 'success' | 'cancel') => {
            await handleClose(status);
          }}
          onError={(errorMessage: string) => {
            console.log(errorMessage);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-gray-100 p-6 rounded-lg">
        <p className="text-red-400">{t('TryAgainTextMessage')}</p>
      </div>
    </div>
  );
};

export default TaskModulePage;
