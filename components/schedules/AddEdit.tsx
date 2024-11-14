import 'react-datepicker/dist/react-datepicker.css';

import { QuestionMarkCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { addMinutes } from 'date-fns';
import { dateFromDatabaseIgnoreTimezone, dateToIsoDate, prepareDateForBackend } from 'lib/DateHelper';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import React from 'react';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { CustomHeader } from '@components/CustomHeader';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { TimeField } from '@mui/x-date-pickers/TimeField';
import { setHours, setMinutes, setSeconds } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { useDarkSide } from '@components/ThemeContext';

type Props = {
  value: Date;
  useAmPm: boolean;
  onChange: (...event: any[]) => void;
  disabled: boolean;
  calcFields: (up: boolean) => void;
};

const CustomTimeField = ({ value, useAmPm, onChange, disabled, calcFields }: Props) => {
  const [localTempValue, setLocalTempValue] = useState<Date | null>(value);
  const [theme] = useDarkSide();
  useEffect(() => {
    setLocalTempValue(value);
  }, [value]);
  return (
    <TimeField
      disabled={disabled}
      value={localTempValue ? localTempValue : value}
      ampm={useAmPm}
      onChange={(val) => setLocalTempValue(val)}
      onBlur={() => {
        if (!localTempValue) return;
        const newValue = localTempValue;
        onChange(newValue);
        calcFields(value < newValue);
      }}
      size="small"
      sx={{
        '& .MuiOutlinedInput-root': {
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: 'none'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: 'none'
          }
        },
        '& .MuiInputBase-input': {
          borderRadius: '4px',
          border: '1px solid #333741',
          color: theme === 'dark' ? '#fff' : '#000', 
          '&:hover': {
            border: '1px solid #333741'
          },
          '&:focus': {
            border:  theme === 'dark' ? '1px solid #7479dc' : '1px solid #3d3e66',
            outline: 'none',
            boxShadow: theme === 'dark' ? "none" : '',
            borderColor: theme === 'dark' ? "#7479dc" : ''
          },
          '&.Mui-disabled':{
            WebkitTextFillColor: theme === 'dark' ? 'rgba(255,255,255, 0.38)' : 'rgba(0,0,0, 0.38)'
          }
        },
      }}
    />
  );
};

function convertTimeStringToDate(timeString: string | Date) {
  if (typeof timeString === 'object') return timeString;
  if (!timeString) return null;
  const parts = timeString.split(':');
  if (parts.length !== 3) return null;

  const [hours, minutes, seconds] = parts.map(Number);
  if (
    hours !== undefined &&
    hours >= 0 &&
    hours <= 23 &&
    minutes !== undefined &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds !== undefined &&
    seconds >= 0 &&
    seconds <= 59
  ) {
    const now = new Date();
    return setSeconds(setMinutes(setHours(now, hours), minutes), seconds);
  } else {
    return null;
  }
}
interface AddValue {
  from: Date;
  monday: RowValue;
  tuesday: RowValue;
  wednesday: RowValue;
  thursday: RowValue;
  friday: RowValue;
  saturday: RowValue;
  sunday: RowValue;
}
export default function AddEditSchedule(props: {
  member_id?: string;
  onClose: Function;
  schedule?: defaultMemberSelectOutput['schedules'][0] | RouterOutputs['workspace_schedule']['current'];
  mode: 'member_schedules' | 'workspace_schedules';
  enableEdit: boolean;
  onInvalidate: Function;
}) {
  const { t, lang } = useTranslation('schedules');
  const [loading, setLoading] = useState<boolean>(false);
  const { current_member } = useAbsentify();
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery();
  const editWorskpacseSchdeule = api.workspace_schedule.edit.useMutation();
  const editMemberSchdeule = api.member_schedule.edit.useMutation();
  const addMemberSchdeule = api.member_schedule.add.useMutation();
  const deleteMemberSchdeule = api.member_schedule.delete.useMutation();
  const {
    formState: { errors },
    control,
    setValue,
    handleSubmit
  } = useForm<AddValue>();

  useEffect(() => {
    if (!workspaceSchedule) return;
    if (props.mode == 'member_schedules') {
      let d = (props.schedule as defaultMemberSelectOutput['schedules'][0])?.from;
      if (d == null) {
        d = new Date();
      }

      setValue('from', dateToIsoDate(d));
    }

    setValue('monday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.monday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.monday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.monday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.monday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.monday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.monday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.monday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.monday_pm_end),
      am_enabled: props.schedule ? props.schedule.monday_am_enabled : workspaceSchedule.monday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.monday_pm_enabled : workspaceSchedule.monday_pm_enabled,
      deduct_fullday: props.schedule ? props.schedule.monday_deduct_fullday : workspaceSchedule.monday_deduct_fullday
    });

    setValue('tuesday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.tuesday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.tuesday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.tuesday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.tuesday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.tuesday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.tuesday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.tuesday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.tuesday_pm_end),
      am_enabled: props.schedule ? props.schedule.tuesday_am_enabled : workspaceSchedule.tuesday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.tuesday_pm_enabled : workspaceSchedule.tuesday_pm_enabled,
      deduct_fullday: props.schedule ? props.schedule.tuesday_deduct_fullday : workspaceSchedule.tuesday_deduct_fullday
    });

    setValue('wednesday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.wednesday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.wednesday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.wednesday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.wednesday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.wednesday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.wednesday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.wednesday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.wednesday_pm_end),
      am_enabled: props.schedule ? props.schedule.wednesday_am_enabled : workspaceSchedule.wednesday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.wednesday_pm_enabled : workspaceSchedule.wednesday_pm_enabled,
      deduct_fullday: props.schedule
        ? props.schedule.wednesday_deduct_fullday
        : workspaceSchedule.wednesday_deduct_fullday
    });

    setValue('thursday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.thursday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.thursday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.thursday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.thursday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.thursday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.thursday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.thursday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.thursday_pm_end),
      am_enabled: props.schedule ? props.schedule.thursday_am_enabled : workspaceSchedule.thursday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.thursday_pm_enabled : workspaceSchedule.thursday_pm_enabled,
      deduct_fullday: props.schedule
        ? props.schedule.thursday_deduct_fullday
        : workspaceSchedule.thursday_deduct_fullday
    });

    setValue('friday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.friday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.friday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.friday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.friday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.friday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.friday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.friday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.friday_pm_end),
      am_enabled: props.schedule ? props.schedule.friday_am_enabled : workspaceSchedule.friday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.friday_pm_enabled : workspaceSchedule.friday_pm_enabled,
      deduct_fullday: props.schedule ? props.schedule.friday_deduct_fullday : workspaceSchedule.friday_deduct_fullday
    });

    setValue('saturday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.saturday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.saturday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.saturday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.saturday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.saturday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.saturday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.saturday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.saturday_pm_end),
      am_enabled: props.schedule ? props.schedule.saturday_am_enabled : workspaceSchedule.saturday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.saturday_pm_enabled : workspaceSchedule.saturday_pm_enabled,
      deduct_fullday: props.schedule
        ? props.schedule.saturday_deduct_fullday
        : workspaceSchedule.saturday_deduct_fullday
    });

    setValue('sunday', {
      am_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.sunday_am_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.sunday_am_start),
      am_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.sunday_am_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.sunday_am_end),
      pm_start: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.sunday_pm_start)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.sunday_pm_start),
      pm_end: props.schedule
        ? dateFromDatabaseIgnoreTimezone(props.schedule.sunday_pm_end)
        : dateFromDatabaseIgnoreTimezone(workspaceSchedule.sunday_pm_end),
      am_enabled: props.schedule ? props.schedule.sunday_am_enabled : workspaceSchedule.sunday_am_enabled,
      pm_enabled: props.schedule ? props.schedule.sunday_pm_enabled : workspaceSchedule.sunday_pm_enabled,
      deduct_fullday: props.schedule ? props.schedule.sunday_deduct_fullday : workspaceSchedule.sunday_deduct_fullday
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSchedule]);

  const onSubmit: SubmitHandler<AddValue> = async (data: AddValue) => {
    if (!current_member) return;
    setLoading(true);
    const dataToSave: RouterInputs['workspace_schedule']['edit']['data'] = {
      workspace_id: props.schedule ? props.schedule.workspace_id : `${current_member?.workspace_id}`,
      monday_am_start: prepareDateForBackend(data.monday.am_start),
      monday_am_end: prepareDateForBackend(data.monday.am_end),
      monday_pm_start: prepareDateForBackend(data.monday.pm_start),
      monday_pm_end: prepareDateForBackend(data.monday.pm_end),
      monday_am_enabled: data.monday.am_enabled,
      monday_pm_enabled: data.monday.pm_enabled,
      monday_deduct_fullday: data.monday.deduct_fullday,

      tuesday_am_start: prepareDateForBackend(data.tuesday.am_start),
      tuesday_am_end: prepareDateForBackend(data.tuesday.am_end),
      tuesday_pm_start: prepareDateForBackend(data.tuesday.pm_start),
      tuesday_pm_end: prepareDateForBackend(data.tuesday.pm_end),
      tuesday_am_enabled: data.tuesday.am_enabled,
      tuesday_pm_enabled: data.tuesday.pm_enabled,
      tuesday_deduct_fullday: data.tuesday.deduct_fullday,

      wednesday_am_start: prepareDateForBackend(data.wednesday.am_start),
      wednesday_am_end: prepareDateForBackend(data.wednesday.am_end),
      wednesday_pm_start: prepareDateForBackend(data.wednesday.pm_start),
      wednesday_pm_end: prepareDateForBackend(data.wednesday.pm_end),
      wednesday_am_enabled: data.wednesday.am_enabled,
      wednesday_pm_enabled: data.wednesday.pm_enabled,
      wednesday_deduct_fullday: data.wednesday.deduct_fullday,

      thursday_am_start: prepareDateForBackend(data.thursday.am_start),
      thursday_am_end: prepareDateForBackend(data.thursday.am_end),
      thursday_pm_start: prepareDateForBackend(data.thursday.pm_start),
      thursday_pm_end: prepareDateForBackend(data.thursday.pm_end),
      thursday_am_enabled: data.thursday.am_enabled,
      thursday_pm_enabled: data.thursday.pm_enabled,
      thursday_deduct_fullday: data.thursday.deduct_fullday,

      friday_am_start: prepareDateForBackend(data.friday.am_start),
      friday_am_end: prepareDateForBackend(data.friday.am_end),
      friday_pm_start: prepareDateForBackend(data.friday.pm_start),
      friday_pm_end: prepareDateForBackend(data.friday.pm_end),
      friday_am_enabled: data.friday.am_enabled,
      friday_pm_enabled: data.friday.pm_enabled,
      friday_deduct_fullday: data.friday.deduct_fullday,

      saturday_am_start: prepareDateForBackend(data.saturday.am_start),
      saturday_am_end: prepareDateForBackend(data.saturday.am_end),
      saturday_pm_start: prepareDateForBackend(data.saturday.pm_start),
      saturday_pm_end: prepareDateForBackend(data.saturday.pm_end),
      saturday_am_enabled: data.saturday.am_enabled,
      saturday_pm_enabled: data.saturday.pm_enabled,
      saturday_deduct_fullday: data.saturday.deduct_fullday,

      sunday_am_start: prepareDateForBackend(data.sunday.am_start),
      sunday_am_end: prepareDateForBackend(data.sunday.am_end),
      sunday_pm_start: prepareDateForBackend(data.sunday.pm_start),
      sunday_pm_end: prepareDateForBackend(data.sunday.pm_end),
      sunday_am_enabled: data.sunday.am_enabled,
      sunday_pm_enabled: data.sunday.pm_enabled,
      sunday_deduct_fullday: data.sunday.deduct_fullday
    };
    if (props.mode == 'member_schedules') {
      (dataToSave as RouterInputs['member_schedule']['edit']['data']).from = data.from;
      if (props.member_id)
        (dataToSave as RouterInputs['member_schedule']['edit']['data']).member_id = props.schedule
          ? (props.schedule as RouterInputs['member_schedule']['edit']['data']).member_id
          : props.member_id;

      if ((dataToSave as RouterInputs['member_schedule']['edit']['data']).from) {
        (dataToSave as RouterInputs['member_schedule']['edit']['data']).from = addMinutes(
          (dataToSave as RouterInputs['member_schedule']['edit']['data']).from,
          (dataToSave as RouterInputs['member_schedule']['edit']['data']).from.getTimezoneOffset() * -1
        );
      }

      if (props.schedule) {
        await editMemberSchdeule.mutateAsync(
          {
            id: props.schedule?.id,
            data: dataToSave as RouterInputs['member_schedule']['edit']['data']
          },
          {
            async onSuccess() {
              props.onInvalidate();
              props.onClose(true);
              notifySuccess(t('Saved_successfully'));
            },
            onError(error) {
              notifyError(error.message);
            }
          }
        );
      } else {
        await addMemberSchdeule.mutateAsync(dataToSave as RouterInputs['member_schedule']['edit']['data'], {
          async onSuccess() {
            props.onInvalidate();
            props.onClose(true);
            notifySuccess(t('Saved_successfully'));
          },
          onError(error) {
            notifyError(error.message);
          }
        });
      }
    } else if (props.mode == 'workspace_schedules') {
      if (props.schedule)
        await editWorskpacseSchdeule.mutateAsync(
          { id: props.schedule.id, data: dataToSave },
          {
            async onSuccess() {
              props.onInvalidate();
              props.onClose(true);
              notifySuccess(t('Saved_successfully'));
            },
            onError(error) {
              notifyError(error.message);
            }
          }
        );
    }
  };
  return (
    <form className="w-full border lg:col-span-9 dark:border-teams_brand_tbody_border" onSubmit={handleSubmit(onSubmit)}>
      <div className="py-6 px-4 sm:p-6 lg:pb-8 ">
        {props.mode == 'member_schedules' && (
          <div className="mt-6 flex flex-row space-x-8 lg:justify-between">
            <div className="col-span-6 sm:col-span-4">
              <label htmlFor="from" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('From')}
              </label>
              <Controller
                control={control}
                name="from"
                rules={{ required: true }}
                render={({ field }) => (
                  <DatePicker
                    renderCustomHeader={(props) => <CustomHeader {...props} />}
                    calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                    locale={lang}
                    dateFormat={current_member?.date_format}
                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm dark:bg-transparent dark:text-gray-200 dark:border-teams_brand_border"
                    selected={field.value}
                    onChange={(date: Date) => field.onChange(date)}
                  />
                )}
              />
            </div>
            {props.mode == 'member_schedules' && (
              <div className="col-span-6 grid place-items-end sm:col-span-4">
                {deleteMemberSchdeule.isLoading && (
                  <div className="-ml-1 mr-3">
                    <Loader />
                  </div>
                )}
                {!deleteMemberSchdeule.isLoading && (
                  <a
                    className="cursor-pointer pr-2"
                    onClick={async () => {
                      if (!props.schedule) return;
                      await deleteMemberSchdeule.mutateAsync(
                        { id: props.schedule.id },
                        {
                          async onSuccess() {
                            props.onInvalidate();
                            props.onClose(true);
                            notifySuccess(t('Deleted_successfully'));
                          },
                          onError(error) {
                            notifyError(error.message);
                          }
                        }
                      );
                    }}
                  >
                    <TrashIcon color="red" width={20} className="pb-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        <Controller
          rules={{ required: true }}
          control={control}
          name="monday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={1}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="tuesday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={2}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="wednesday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={3}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="thursday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={4}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="friday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={5}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="saturday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={6}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
        <Controller
          rules={{ required: true }}
          control={control}
          name="sunday"
          render={({ field: { onChange, value } }) => {
            if (!value) return <></>;
            return (
              <Row
                useAmPm={current_member?.time_format === 'H12'}
                enableEdit={props.enableEdit}
                weekday={7}
                onChange={(val: RowValue) => {
                  onChange(val);
                }}
                value={value}
              />
            );
          }}
        />
      </div>
      <div className="mt-4 flex justify-end p-4 sm:px-6">
        <button
          disabled={loading}
          onClick={(e) => {
            e.preventDefault();
            props.onClose(false);
          }}
          type="button"
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-transparent dark:border dark:border-gray-200 dark:text-white"
        >
          {t('Cancel')}
        </button>
        {props.enableEdit && (
          <button
            disabled={loading}
            onClick={() => {
              if (Object.keys(errors).length == 0) {
                handleSubmit(onSubmit)();
              }
            }}
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2"
          >
            {editMemberSchdeule.isLoading ||
              editWorskpacseSchdeule.isLoading ||
              (addMemberSchdeule.isLoading && (
                <div className="-ml-1 mr-3">
                  <Loader />
                </div>
              ))}
            {t('Save')}
          </button>
        )}
      </div>
    </form>
  );
}
interface RowValue {
  am_enabled: boolean;
  pm_enabled: boolean;
  am_start: Date;
  am_end: Date;
  pm_start: Date;
  pm_end: Date;
  deduct_fullday: boolean;
}
function Row(props: { onChange: Function; value: RowValue; weekday: number; enableEdit: boolean; useAmPm: boolean }) {
  const { t } = useTranslation('schedules');
  const { register, control, setValue, watch, getValues } = useForm<RowValue>();
  const watchAmEnabled = watch('am_enabled');
  const watchPmEnabled = watch('pm_enabled');
  const [label, setLabel] = useState(t('Fullday'));
  const [currentValue, setCurrentValue] = useState<RowValue>();
  const [weekdayName, setWeekDayName] = useState(t('Monday'));
  const watchAllFields = watch();
  useEffect(() => {
    if (watchAmEnabled && watchPmEnabled) setLabel(t('Fullday'));
    else if (!watchAmEnabled && !watchPmEnabled) setLabel(t('Not_working'));
    else if (watchAmEnabled && !watchPmEnabled) setLabel(t('Half_day_AM'));
    else if (!watchAmEnabled && watchPmEnabled) setLabel(t('Half_day_PM'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchAmEnabled, watchPmEnabled]);

  const calcFields = (up: boolean) => {
    let amStart = getValues('am_start');
    let amEnd = getValues('am_end');
    let pmStart = getValues('pm_start');
    let pmEnd = getValues('pm_end');

    if (up) {
      if (amStart > amEnd) {
        amEnd = new Date(amStart.getTime() + 30 * 60000);
        setValue('am_end', amEnd);
      }

      if (amEnd > pmStart) {
        pmStart = new Date(amEnd.getTime() + 30 * 60000);
        setValue('pm_start', pmStart);
      }

      if (pmStart > pmEnd) {
        pmEnd = new Date(pmStart.getTime() + 30 * 60000);
        setValue('pm_end', pmEnd);
      }
    } else {
      if (pmEnd < pmStart) {
        pmStart = new Date(pmEnd.getTime() - 30 * 60000);
        setValue('pm_start', pmStart);
      }

      if (pmStart < amEnd) {
        amEnd = new Date(pmStart.getTime() - 30 * 60000);
        setValue('am_end', amEnd);
      }

      if (amEnd < amStart) {
        amStart = new Date(amEnd.getTime() - 30 * 60000);
        setValue('am_start', amStart);
      }
    }

    if (amStart > amEnd) {
      amEnd = new Date(amStart.getTime() + 30 * 60000);
      setValue('am_end', amEnd);
    }
    if (amEnd > pmStart) {
      pmStart = new Date(amEnd.getTime() + 30 * 60000);
      setValue('pm_start', pmStart);
    }
    if (pmStart > pmEnd) {
      pmEnd = new Date(pmStart.getTime() + 30 * 60000);
      setValue('pm_end', pmEnd);
    }

    setValue('am_start', amStart);
    setValue('am_end', amEnd);
    setValue('pm_start', pmStart);
    setValue('pm_end', pmEnd);
  };

  useEffect(() => {
    if (!currentValue) return;
    if (JSON.stringify(watchAllFields) !== JSON.stringify(currentValue)) {
      setCurrentValue(watchAllFields);

      props.onChange(watchAllFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchAllFields]);

  const amEnabled = getValues('am_enabled');
  const pmEnabled = getValues('pm_enabled');
  useEffect(() => {
    if (!props.value) return;
    setCurrentValue(props.value);
    const am_start = convertTimeStringToDate(props.value.am_start);
    const am_end = convertTimeStringToDate(props.value.am_end);
    const pm_start = convertTimeStringToDate(props.value.pm_start);
    const pm_end = convertTimeStringToDate(props.value.pm_end);
    setValue('am_enabled', props.value.am_enabled);
    am_end && setValue('am_end', am_end);
    am_start && setValue('am_start', am_start);
    setValue('pm_enabled', props.value.pm_enabled);
    pm_end && setValue('pm_end', pm_end);
    pm_start && setValue('pm_start', pm_start);
    if (getValues('pm_enabled') == true && getValues('am_enabled') == true) {
      setValue('deduct_fullday', false);
    } else if (getValues('pm_enabled') == false && getValues('am_enabled') == false) {
      setValue('deduct_fullday', false);
    } else {
      setValue('deduct_fullday', props.value.deduct_fullday);
    }

    switch (props.weekday) {
      case 1:
        setWeekDayName(t('Monday'));
        break;
      case 2:
        setWeekDayName(t('Tuesday'));
        break;
      case 3:
        setWeekDayName(t('Wednesday'));
        break;
      case 4:
        setWeekDayName(t('Thursday'));
        break;
      case 5:
        setWeekDayName(t('Friday'));
        break;
      case 6:
        setWeekDayName(t('Saturday'));
        break;
      case 7:
        setWeekDayName(t('Sunday'));
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  const calcIsDisabled = (fieldConfig: boolean) => {
    if (props.enableEdit == false) return true;
    return !fieldConfig;
  };
  return (
    <>
      <div className="mb-3 mt-5  grid grid-cols-2 gap-1 text-left">
        <div>
          <p className="my-auto w-60 font-semibold dark:text-white">
            <>
              {weekdayName} ({label})
            </>
          </p>
        </div>

        <div className="col-span-3 grid grid-cols-6">
          {props.enableEdit ? (
            <input
              {...register('am_enabled', { required: true })}
              className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg focus:ring-teams_brand_450 dark:text-gray-200 dark:bg-teams_dark_mode dark:border-teams_brand_border focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_dark_mode dark:hover:bg-teams_dark_mode dark:hover:border-teams_brand_border dark:focus:outline-0 dark:focus:ring-0"
              type="checkbox"
            />
          ) : (
            <input
              {...register('am_enabled', { required: true })}
              className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg  focus:ring-teams_brand_450 dark:text-gray-200 dark:bg-teams_dark_mode  dark:border-teams_brand_border focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_dark_mode dark:hover:bg-teams_dark_mode dark:hover:border-teams_brand_border dark:focus:outline-0 dark:focus:ring-0"
              type="checkbox"
              style={{ backgroundColor: amEnabled ? 'gray' : 'transparent' }}
              disabled={true}
            />
          )}
          <div className="col-span-2">
            <Controller
              rules={{ required: true }}
              control={control}
              name="am_start"
              render={({ field: { onChange, value } }) => (
                <CustomTimeField
                  value={value}
                  useAmPm={props.useAmPm}
                  onChange={onChange}
                  disabled={calcIsDisabled(watchAmEnabled)}
                  calcFields={calcFields}
                />
              )}
            />
          </div>

          <span className="my-auto mr-2 text-center dark:text-gray-200">{t('to')}</span>
          <div className="col-span-2">
            <Controller
              rules={{ required: true }}
              control={control}
              name="am_end"
              render={({ field: { onChange, value } }) => (
                <CustomTimeField
                  value={value}
                  useAmPm={props.useAmPm}
                  onChange={onChange}
                  disabled={calcIsDisabled(watchAmEnabled)}
                  calcFields={calcFields}
                />
              )}
            />
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-6 ">
          {props.enableEdit ? (
            <input
              {...register('pm_enabled', { required: true })}
              className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg  focus:ring-teams_brand_450 dark:text-gray-200 dark:bg-teams_dark_mode  dark:border-teams_brand_border focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_dark_mode dark:hover:bg-teams_dark_mode dark:hover:border-teams_brand_border dark:focus:outline-0 dark:focus:ring-0"
              type="checkbox"
            />
          ) : (
            <input
              {...register('pm_enabled', { required: true })}
              className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg  focus:ring-teams_brand_450 dark:text-gray-200 dark:bg-teams_dark_mode  dark:border-teams_brand_border focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_dark_mode dark:hover:bg-teams_dark_mode dark:hover:border-teams_brand_border dark:focus:outline-0 dark:focus:ring-0"
              type="checkbox"
              disabled={true}
              style={{ backgroundColor: pmEnabled ? 'gray' : 'transparent' }}
            />
          )}{' '}
          <div className="col-span-2">
            <Controller
              rules={{ required: true }}
              control={control}
              name="pm_start"
              render={({ field: { onChange, value } }) => (
                <CustomTimeField
                  value={value}
                  useAmPm={props.useAmPm}
                  onChange={onChange}
                  disabled={calcIsDisabled(watchPmEnabled)}
                  calcFields={calcFields}
                />
              )}
            />
          </div>
          <span className="my-auto mr-2 text-center dark:text-gray-200">{t('to')}</span>
          <div className="col-span-2">
            <Controller
              rules={{ required: true }}
              control={control}
              name="pm_end"
              render={({ field: { onChange, value } }) => (
                <CustomTimeField
                  value={value}
                  useAmPm={props.useAmPm}
                  onChange={onChange}
                  disabled={calcIsDisabled(watchPmEnabled)}
                  calcFields={calcFields}
                />
              )}
            />
          </div>
        </div>
      </div>
      <div className="has-tooltip  cursor-pointer ">
        {amEnabled && pmEnabled ? (
          <></>
        ) : amEnabled || pmEnabled ? (
          props.enableEdit ? (
            <div className=" mb-6 inline-flex">
              <input
                {...register('deduct_fullday', { required: true })}
                className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg focus:ring-teams_brand_450 dark:text-gray-200 dark:bg-teams_brand_tbody  dark:border-gray-200  focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_brand_tbody  "
                type="checkbox"
              />{' '}
              <label htmlFor="deduct_fullday" className='dark:text-gray-200'>{t('deductFullday')}</label>
              <span
                className="ml-1  flex items-center cursor-pointer dark:text-gray-200 dark:bg-teams_brand_tbody"
                data-tooltip-id="schedule-tooltip"
                data-tooltip-content={t('deduct_fullday_txt')}
                data-tooltip-variant= 'light'
              >
                <QuestionMarkCircleIcon height={12} />
              </span>
              <ReactTooltip
                id="schedule-tooltip"
                place="top"
                className="shadow z-50 dark:bg-teams_brand_tbody dark:text-gray-200"
                classNameArrow="shadow-sm"
                style={{
                  width: '300px',
                  maxWidth: '300px',
                  fontSize: '12px',
                  padding: '10px',
                  lineHeight: '1.5',
                  backgroundColor: '#fff',
                  color: '#000',
                  boxShadow: '0 0 10px rgba(0,0,0,.1)'
                }}
              />
            </div>
          ) : (
            <div className=" mb-6 inline-flex">
              <input
                {...register('deduct_fullday', { required: true })}
                className="my-auto mr-2 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_bg focus:ring-teams_brand_450 dark:bg-teams_brand_tbody dark:text-gray-200  dark:border-gray-200  focus:border-teams_brand_500 focus:ring-teams_brand_500 dark:focus:bg-teams_brand_tbody"
                type="checkbox"
                disabled={true}
                style={{
                  backgroundColor: pmEnabled || amEnabled ? 'gray' : 'transparent'
                }}
              />{' '}
              <label htmlFor="fulldayDeducted">{t('fulldayDeducted')}</label>
            </div>
          )
        ) : (
          <></>
        )}
      </div>
    </>
  );
}
