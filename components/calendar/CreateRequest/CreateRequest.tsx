import 'react-datepicker/dist/react-datepicker.css';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatDate, convertLocalDateToUTC, isHourUnit, isDayUnit } from 'lib/DateHelper';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select, { InputActionMeta, components } from 'react-select';
import { api, type RouterInputs, type RouterOutputs } from '~/utils/api';
import {
  deductFullday,
  findscheduleOnDate,
  getDayStartAndEndTimeFromscheduleOnClient,
  getFiscalYearStartAndEndDates
} from '../../../lib/requestUtilities';
import { notifyError } from '~/helper/notify';
import Loader from '../Loader';
import { EndAt, StartAt, Status, TimeFormat } from '@prisma/client';
import { CustomHeader } from '@components/CustomHeader';
import { formatDuration } from '~/helper/formatDuration';
import { classNames } from '~/lib/classNames';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { uniq, orderBy, debounce } from 'lodash';
import ProfileImage from '@components/layout/components/ProfileImage';
import { addDays } from 'date-fns';
import BulkRequestStatus, { BulkRequestStatusHandle } from './BulkRequestStatus';
export type openDialogValuesType = {
  start: Date;
  end: Date;
  start_at: StartAt;
  end_at: EndAt;
  member_id: string | null;
  leave_type_id?: string;
  department_id?: string | null;
};

export default function CreateRequest(props: {
  initDateValues: openDialogValuesType;
  openAsDialog: boolean;
  showUserSelect: boolean;
  showDepartmentSelect: boolean;
  onClose: Function;
  onError?: Function;
}) {
  const { t } = useTranslation('calendar');
  const cancelButtonRef = useRef(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState<RouterOutputs['leave_type']['all'][0]>();
  const handleSelectedLeaveType = (selectedLeaveType: RouterOutputs['leave_type']['all'][0]) => {
    if (selectedLeaveType) setSelectedLeaveType(selectedLeaveType);
  };

  const renderForm = (additionalProps = {}) => (
    <Form
      initDateValues={props.initDateValues}
      openAsDialog={props.openAsDialog}
      showUserSelect={props.showUserSelect}
      showDepartmentSelect={props.showDepartmentSelect}
      onClose={props.onClose}
      onError={props.onError}
      {...additionalProps}
    />
  );

  if (!props.openAsDialog && props.initDateValues && props.onClose) {
    return renderForm();
  }
  if (props.openAsDialog && !selectedLeaveType)
    return <div className="hidden">{renderForm({ getSelectedLeaveType: handleSelectedLeaveType })}</div>;
  return (
    <Transition.Root show={props.initDateValues != null} as={Fragment}>
      <Dialog
        as="div"
        className="overflow-y-auto fixed inset-0 z-30"
        initialFocus={cancelButtonRef}
        onClose={() => {
          //    not close on click outside
        }}
      >
        <div className="flex justify-center items-end px-4 pt-4 pb-20 min-h-screen text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="z-30 inline-block overflow-visible px-4 pt-5 pb-4 text-left align-bottom bg-white dark:bg-teams_brand_dark_100 rounded-lg shadow-xl transition-all transform sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                    {t('Book_time_off')}
                  </Dialog.Title>
                  {props.initDateValues &&
                    props.onClose &&
                    props.openAsDialog &&
                    renderForm({ getSelectedLeaveType: handleSelectedLeaveType })}
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

const Form: React.FC<{
  initDateValues: openDialogValuesType;
  openAsDialog: boolean;
  showUserSelect: boolean;
  showDepartmentSelect: boolean;
  onClose: Function;
  onError?: Function;
  getSelectedLeaveType?: Function;
}> = (props) => {
  const { t, lang } = useTranslation('calendar');
  const utils = api.useContext();
  const { current_member } = useAbsentify();
  const [durationIsLoading, setDurationIsLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [durationSum, setDurationSum] = useState<number>(0);
  const [outsideOfSchedule, setOutsideOfSchedule] = useState<boolean>(false);
  const [minDateMaxDateStart, setMinDateMaxDateStart] = useState<{ min: Date; max: Date } | null>(null);
  const [minDateMaxDateEnd, setMinDateMaxDateEnd] = useState<{ min: Date; max: Date } | null>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState<RouterOutputs['leave_type']['all'][0]>();
  const [memebersSelectable, setMemebersSelectable] = useState<defaultMemberSelectOutput[]>([]);
  const [selectedRequester, setSelectedRequester] = useState<defaultMemberSelectOutput>();
  const { register, handleSubmit, setValue, watch, getValues, setError, clearErrors, formState, control } =
    useForm<RouterInputs['request']['add']>();
  const watchStart = watch('start');
  const watchEnd = watch('end');
  const watchStartAt = watch('start_at');
  const watchEndAt = watch('end_at');
  const watchRequesterMemberId = watch('requester_member_id');
  const onSetSelectedLeaveType = useCallback(
    (selectedLeaveType: RouterOutputs['leave_type']['all'][0]) => {
      if (props.getSelectedLeaveType) props.getSelectedLeaveType(selectedLeaveType);
    },
    [props.getSelectedLeaveType]
  );
  const { data: requestMemberData, isLoading: requestMemberIsLoading } = api.member.all.useQuery(
    {
      filter: {
        ids: props.initDateValues.member_id
          ? current_member
            ? uniq([watchRequesterMemberId, props.initDateValues.member_id, current_member.id]).filter((x) => x)
            : uniq([watchRequesterMemberId, props.initDateValues.member_id]).filter((x) => x)
          : []
      },
      page: 1,
      limit: 3
    },
    {
      staleTime: 60000
    }
  );
  const requester_member = useMemo(() => {
    return requestMemberData?.members || [];
  }, [requestMemberData?.members]);

  const [searchtext, setSearchText] = useState<string | undefined>('');
  const { data: membersData, isLoading } = api.member.isManagerOfMembers.useQuery(
    {
      search: searchtext || undefined,
      page: 1,
      limit: 25
    },
    {
      staleTime: 60000
    }
  );
  const members = useMemo(() => {
    let x = membersData?.members || [];
    if (searchtext) return x;
    for (let index = 0; index < requester_member.length; index++) {
      const element = requester_member[index];
      if (!element) continue;
      if (x.find((y) => y.id == element.id)) continue;
      x.push(element);
    }

    //order by name
    x = orderBy(x, 'name', 'asc');

    return x;
  }, [membersData?.members, requester_member, searchtext]);
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspaceSchedule } = api.workspace_schedule.current.useQuery(undefined, { staleTime: 60000 });

  const createRequst = api.request.add.useMutation();
  const calcRequestDuration = api.request.calcRequestDuration.useMutation();
  const findRangeOverlap = api.request.findRangeOverlap.useMutation();
  const { data: leave_typesData } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: string; name: string }>();
  const [departmentDropDownValues, setDepartmentDropDownValues] = useState<{ id: string; name: string }[]>();
  const leave_types = leave_typesData?.filter((x) => {
    if (!x.allowance_type_id) return true;
    if (
      selectedRequester?.allowance_type_configurtaions.find((y) => y.allowance_type_id == x.allowance_type_id)?.disabled
    )
      return false;
    return true;
  });

  const bulkRequestStatusRef = useRef<BulkRequestStatusHandle>(null);

  const [startBulkRequest, setStartBulkRequest] = useState<boolean>(false);

  const start_at_values = [
    { label: t('Morning'), value: 'morning' },
    { label: t('Afternoon'), value: 'afternoon' }
  ];

  const [end_at_values, setEnd_at_values] = useState([
    { label: t('Lunchtime'), value: 'lunchtime' },
    { label: t('End_of_Day'), value: 'end_of_day' }
  ]);

  const [start_times_values, setStart_times_values] = useState<
    { label: string; value: { hour: number; minute: number } }[]
  >([]);

  const [end_times_values, setEnd_times_values] = useState<
    { label: string; value: { hour: number; minute: number } }[]
  >([]);

  useEffect(() => {
    if (selectedLeaveType) onSetSelectedLeaveType(selectedLeaveType);
  }, [selectedLeaveType, onSetSelectedLeaveType]);
  const { data: membersCount } = api.member.count.useQuery(
    {
      status: ['ACTIVE', 'INACTIVE']
    },
    {
      staleTime: 60000
    }
  );
  useEffect(() => {
    if (!members) return;
    if (!departments) return;
    if (!current_member) return;
    if (selectedDepartment) return;
    if (!membersCount) return;

    let departmentDropDownValues: { id: string; name: string }[] = [];
    if (membersCount < 250 && departments.length > 1 && current_member.is_admin) {
      departmentDropDownValues.push({
        id: '1',
        name: t('All_departments')
      });
    }

    for (let index = 0; index < departments.length; index++) {
      const department = departments[index];
      if (!department) continue;
      if (
        current_member.is_admin ||
        current_member.is_manager?.is_manager_of_departments.find((x) => x == department.id)
      )
        departmentDropDownValues.push({
          id: department.id,
          name: department.name
        });
    }

    if (departmentDropDownValues.length == 2) departmentDropDownValues.shift();

    setDepartmentDropDownValues(departmentDropDownValues);

    if (departmentDropDownValues.length > 0) setSelectedDepartment(departmentDropDownValues[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, current_member, departments, membersCount]);

  useEffect(() => {
    if (!props.initDateValues) return;

    setValue('start', props.initDateValues.start);
    setValue('end', props.initDateValues.end);

    setValue('start_at', props.initDateValues.start_at);
    setValue('end_at', props.initDateValues.end_at);
    if (props.initDateValues.member_id) setValue('requester_member_id', props.initDateValues.member_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initDateValues]);

  useEffect(() => {
    if (props.initDateValues.leave_type_id && leave_types && leave_types.length > 0) {
      // Check if givenLeaveTypeId exists in leave_types
      const foundLeaveType = leave_types.find((x) => x.id === props.initDateValues.leave_type_id);
      if (foundLeaveType) {
        props.initDateValues.leave_type_id = undefined;
        setSelectedLeaveType(foundLeaveType);
        setValue('leave_type_id', foundLeaveType.id);
      }
    }
    if (selectedLeaveType) return;
    if (leave_types && leave_types[0] && !leave_types?.find((x) => x.id == getValues('leave_type_id'))) {
      setSelectedLeaveType(leave_types[0]);
      setValue('leave_type_id', leave_types[0].id);
    }
    if (selectedLeaveType) return;
    if (leave_types && leave_types[0]) {
      setSelectedLeaveType(leave_types[0]);
      setValue('leave_type_id', leave_types[0].id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leave_types, props.initDateValues]);

  useEffect(() => {
    if (!members) return;
    if (!watchRequesterMemberId) return;

    setSelectedRequester(members.find((x) => x.id == watchRequesterMemberId));
  }, [members, watchRequesterMemberId]);

  useEffect(() => {
    if (!current_member) return;
    if (!departments) return;
    if (!members) return;
    if (!current_member) return;

    if (!current_member.is_manager && !current_member.is_admin) {
      setMemebersSelectable(members.filter((x) => x.id == current_member.id));
      return;
    }

    setMemebersSelectable(members.filter((x) => x.status !== Status.ARCHIVED));
  }, [current_member, departments, members]);

  useEffect(() => {
    if (!workspace) return;
    if (!current_member) return;
    if (!departments) return;
    if (!selectedRequester) return;
    if (selectedRequester.allowances.length == 0) return;
    //find oldes allowance for the selected member
    const oldestAllowance = selectedRequester.allowances.reduce((prev, current) => {
      return prev.year < current.year ? prev : current;
    });
    //find newest allowance for the selected member
    const newestAllowance = selectedRequester.allowances.reduce((prev, current) => {
      return prev.year > current.year ? prev : current;
    });

    const current_member_is_manager_of_requester = !!current_member.is_manager?.is_manager_of_members.find(
      (x) => x == selectedRequester.id
    );

    const endFiscalRange = getFiscalYearStartAndEndDates(workspace.fiscal_year_start_month, newestAllowance.year);

    if (current_member.is_admin) {
      // If Admin then in the first Allowance up to the last of the user's allowance
      let startFiscalRange = getFiscalYearStartAndEndDates(workspace.fiscal_year_start_month, oldestAllowance.year);

      setMinDateMaxDateStart({ min: startFiscalRange.firstDayOfYear, max: endFiscalRange.lastDayOfYear });
      setMinDateMaxDateEnd({ min: watchStart, max: endFiscalRange.lastDayOfYear });
    } else if (current_member_is_manager_of_requester) {
      // If manager then current financial year until the last of the user's allowance
      let startYear = new Date().getFullYear();
      let startFiscalRange = getFiscalYearStartAndEndDates(workspace.fiscal_year_start_month, startYear);
      if (startFiscalRange.firstDayOfYear > new Date()) {
        startFiscalRange = getFiscalYearStartAndEndDates(workspace.fiscal_year_start_month, startYear - 1);
      }

      setMinDateMaxDateStart({ min: startFiscalRange.firstDayOfYear, max: endFiscalRange.lastDayOfYear });
      setMinDateMaxDateEnd({ min: watchStart, max: endFiscalRange.lastDayOfYear });
    } else {
      //If normal user then only from 30 days ago until the end of the last allowance financial year
      setMinDateMaxDateStart({ min: addDays(new Date(), -30), max: endFiscalRange.lastDayOfYear });
      setMinDateMaxDateEnd({ min: watchStart, max: endFiscalRange.lastDayOfYear });
    }

    if (watchEnd < watchStart) {
      setValue('end', watchStart);
    }
    if (watchEnd > endFiscalRange.lastDayOfYear) {
      setValue('end', endFiscalRange.lastDayOfYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, current_member, selectedRequester, watchStart, departments]);

  const noOptionsMessage = (obj: { inputValue: string }) => {
    if (obj.inputValue.trim().length === 0) {
      return null;
    }
    return 'No matching members found';
  };

  function getStartEndAndTimeValues(leave_type_id: string) {
    if (!leave_types) return { start_time_values: [], end_time_values: [] };
    const leaveType = leave_types.find((x) => x.id == leave_type_id);
    if (!leaveType) return { start_time_values: [], end_time_values: [] };
    function formatTime(hour: number, minute: string) {
      let hour12 = hour;
      let amPm = '';

      if (current_member?.time_format == TimeFormat.H12) {
        amPm = hour < 12 ? 'AM' : 'PM';
        hour12 = hour % 12;
        hour12 = hour12 === 0 ? 12 : hour12; // Converts 0 to 12 for the 12-hour format
      }

      return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${amPm}`.trim();
    }
    let values: { label: string; value: { hour: number; minute: number } }[] = [];

    if (leaveType.leave_unit == 'hours') {
      for (let index = 0; index < 24; index++) {
        const timeLabel = formatTime(index, '00');
        values = [
          ...values,
          {
            label: timeLabel,
            value: {
              hour: index + 0,
              minute: 0
            }
          }
        ];
      }
    } else if (leaveType.leave_unit == 'minutes_30') {
      for (let index = 0; index < 48; index++) {
        const hour = Math.floor(index / 2);
        const minute = index % 2 === 0 ? '00' : '30';
        const timeLabel = formatTime(hour, minute);

        values = [...values, { label: timeLabel, value: { hour, minute: parseInt(minute) } }];
      }
    } else if (leaveType.leave_unit == 'minutes_15') {
      for (let index = 0; index < 96; index++) {
        const hour = Math.floor(index / 4);
        const minute = index % 4 == 0 ? '00' : index % 4 == 1 ? '15' : index % 4 == 2 ? '30' : '45';
        const timeLabel = formatTime(hour, minute);

        values = [
          ...values,
          {
            label: timeLabel,
            value: { hour, minute: parseInt(minute) }
          }
        ];
      }
    } else if (leaveType.leave_unit == 'minutes_10') {
      for (let index = 0; index < 144; index++) {
        const hour = Math.floor(index / 6);
        const minute =
          index % 6 == 0
            ? '00'
            : index % 6 == 1
            ? '10'
            : index % 6 == 2
            ? '20'
            : index % 6 == 3
            ? '30'
            : index % 6 == 4
            ? '40'
            : '50';
        const timeLabel = formatTime(hour, minute);

        values = [
          ...values,
          {
            label: timeLabel,
            value: { hour, minute: parseInt(minute) }
          }
        ];
      }
    } else if (leaveType.leave_unit == 'minutes_5') {
      for (let index = 0; index < 288; index++) {
        const hour = Math.floor(index / 12);
        const minute =
          index % 12 == 0
            ? '00'
            : index % 12 == 1
            ? '05'
            : index % 12 == 2
            ? '10'
            : index % 12 == 3
            ? '15'
            : index % 12 == 4
            ? '20'
            : index % 12 == 5
            ? '25'
            : index % 12 == 6
            ? '30'
            : index % 12 == 7
            ? '35'
            : index % 12 == 8
            ? '40'
            : index % 12 == 9
            ? '45'
            : index % 12 == 10
            ? '50'
            : '55';
        const timeLabel = formatTime(hour, minute);

        values = [
          ...values,
          {
            label: timeLabel,
            value: { hour, minute: parseInt(minute) }
          }
        ];
      }
    }
    const start_time_values = [...values];
    const end_time_values = [...values];

    return { start_time_values, end_time_values };
  }
  useEffect(() => {
    if (!selectedLeaveType) return;
    if (!members) return;
    if (!workspaceSchedule) return;
    if (!selectedRequester) return;
    clearErrors('end');
    const start = getValues('start');
    const end = getValues('end');
    const startSchedule = findscheduleOnDate(start, workspaceSchedule, selectedRequester.schedules);
    if (isHourUnit(selectedLeaveType.leave_unit)) {
      setValue('start_at', undefined);
      setValue('end_at', undefined);

      const start_and_end_time_values = getStartEndAndTimeValues(selectedLeaveType.id);

      setStart_times_values(start_and_end_time_values.start_time_values);

      if (start.getDate() == end.getDate()) {
        setEnd_times_values(
          start_and_end_time_values.end_time_values.filter((x) => {
            // Calculate the total time in minutes for start and end
            const startTotalMinutes = start.getHours() * 60 + start.getMinutes();
            const endTotalMinutes = x.value.hour * 60 + x.value.minute;

            // Compare the total time in minutes
            return endTotalMinutes > startTotalMinutes;
          })
        );
      } else {
        setEnd_times_values(start_and_end_time_values.end_time_values);
      }

      if (start.getHours() == 0 && start.getMinutes() == 0) {
        let x = getDayStartAndEndTimeFromscheduleOnClient(start, 'morning', 'lunchtime', startSchedule);

        let l = new Date(start);
        l.setHours(x.start.getUTCHours(), x.start.getUTCMinutes(), 0, 0);
        setValue('start', l);
      }
    } else {
      if (getValues('start_at') == undefined) {
        setValue('start_at', 'morning');
      }
      if (getValues('end_at') == undefined) {
        setValue('end_at', 'end_of_day');
      }
      if (end.getHours() !== 0 && end.getMinutes() !== 0) {
        setValue('end', new Date(end.setHours(0, 0, 0, 0)));
      }
      if (start.getHours() !== 0 && start.getMinutes() !== 0) {
        setValue('start', new Date(start.setHours(0, 0, 0, 0)));
      }

      if (selectedLeaveType.leave_unit == 'days') {
        setValue('end_at', 'end_of_day');
        setValue('start_at', 'morning');
      } else {
        if (formatDate(start) == formatDate(end)) {
          const start_at = getValues('start_at');
          if (start_at == 'afternoon') {
            setEnd_at_values([{ label: t('End_of_Day'), value: 'end_of_day' }]);
            setValue('end_at', 'end_of_day');
          } else {
            setEnd_at_values([
              { label: t('Lunchtime'), value: 'lunchtime' },
              { label: t('End_of_Day'), value: 'end_of_day' }
            ]);
          }
        } else {
          setEnd_at_values([
            { label: t('Lunchtime'), value: 'lunchtime' },
            { label: t('End_of_Day'), value: 'end_of_day' }
          ]);
        }

        const deductHoleDayStart = deductFullday(start, startSchedule);
        if (deductHoleDayStart) {
          setValue('start_at', 'morning');
        }
        const deductHoleDayEnd = deductFullday(
          end,
          findscheduleOnDate(end, workspaceSchedule, selectedRequester.schedules)
        );
        if (deductHoleDayEnd) {
          setValue('end_at', 'end_of_day');
        }
      }
    }

    if (getValues('start') > getValues('end')) {
      setValue('end', getValues('start'));
    }

    if (!props.showDepartmentSelect) {
      setDurationIsLoading(true);
      findRangeOverlap
        .mutateAsync({
          start: convertLocalDateToUTC(getValues('start')),
          start_at: getValues('start_at'),
          end: convertLocalDateToUTC(getValues('end')),
          end_at: getValues('end_at'),
          requester_member_id: getValues('requester_member_id')
        })
        .then((data) => {
          if (data) {
            if (data.overlap) {
              setError('end', {
                type: 'validate',
                message: t('Overlap_with_another_request')
              });
            }
            setDurationIsLoading(false);
          }
        });

      calcRequestDurationFunc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchStart, watchEnd, watchStartAt, watchEndAt, selectedLeaveType, selectedRequester]);
  function findInMap<K, V>(
    map: Map<K, V>,
    predicate: (value: V, key: K, map: Map<K, V>) => boolean
  ): [K, V] | undefined {
    let result: [K, V] | undefined;

    map.forEach((value, key) => {
      if (!result && predicate(value, key, map)) {
        result = [key, value];
      }
    });

    return result;
  }

  async function calcRequestDurationFunc() {
    if (!selectedLeaveType) return;
    setDurationIsLoading(true);
    const duration = await calcRequestDuration.mutateAsync({
      duration: {
        start: convertLocalDateToUTC(getValues('start')),
        start_at: getValues('start_at'),
        end: convertLocalDateToUTC(getValues('end')),
        end_at: getValues('end_at')
      },
      leave_type_id: getValues('leave_type_id'),
      requester_member_id: getValues('requester_member_id'),
      requester_member_public_holiday_id: `${selectedRequester?.public_holiday_id}`
    });
    setDurationIsLoading(false);
    if (!duration) return;

    if (isDayUnit(selectedLeaveType?.leave_unit)) {
      setDurationSum(duration.total.workday_duration_in_days);
    } else {
      setDurationSum(duration.total.workday_duration_in_minutes);
      setOutsideOfSchedule(duration.total.outside_of_schedule);
    }

    if (duration.total.allowanceEnough == false) {
      setError('end', {
        type: 'validate',
        message: t('The_contingent_is_not_enough_for_the_request')
      });
    }
  }
  const getErrorMessageHandler = (errorMessage: string) => {
    if (props.onError) {
      props.onError(errorMessage);
    }
  };

  const onSubmit: SubmitHandler<RouterInputs['request']['add']> = async (data: RouterInputs['request']['add']) => {
    if (selectedLeaveType?.reason_mandatory && data.reason.trim().length === 0) {
      notifyError(t('Reason_cannot'));
      setLoading(false);
      return;
    }
    if (current_member?.id && current_member.workspace_id) {
      if (selectedLeaveType?.leave_unit == 'days') {
        data.start_at = 'morning';
        data.end_at = 'end_of_day';
      }

      if (props.showDepartmentSelect && departments) {
        if (!selectedDepartment) return;

        if (bulkRequestStatusRef.current && selectedDepartment) {
          setStartBulkRequest(true);
          bulkRequestStatusRef.current.triggerFunction(data);
        }

        return;
      }
      await createRequst.mutateAsync(
        {
          end: convertLocalDateToUTC(data.end),
          end_at: data.end_at,
          leave_type_id: data.leave_type_id,
          reason: data.reason,
          requester_member_id: data.requester_member_id,
          start: convertLocalDateToUTC(data.start),
          start_at: data.start_at
        },
        {
          async onSuccess() {
            utils.member_allowance.byMember.invalidate();
            utils.request.allOfUserByDay.invalidate();
            props.onClose('success');
          },
          onError(error) {
            notifyError(error.message);
            getErrorMessageHandler(error.message);
            setLoading(false);
          }
        }
      );
    }
  };
  const hasDecimal = (num: number) => {
    return !!(num % 1);
  };

  const findClosestTimeValue = (
    startOrEnd: 'start' | 'end',
    date: Date,
    timeValues: {
      label: string;
      value: {
        hour: number;
        minute: number;
      };
    }[]
  ): {
    label: string;
    value: {
      hour: number;
      minute: number;
    };
  } | null => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    let closestDiff = Number.MAX_VALUE;
    let closestTimeValueReturn: {
      label: string;
      value: {
        hour: number;
        minute: number;
      };
    } | null = null;

    for (let index = 0; index < timeValues.length; index++) {
      const timeValue = timeValues[index];
      if (!timeValue) continue;
      const diffHours = Math.abs(timeValue.value.hour - hours);
      const diffMinutes = Math.abs(timeValue.value.minute - minutes);
      const totalDiff = diffHours * 60 + diffMinutes; // Conversion of hours to minutes for comparison

      if (totalDiff < closestDiff) {
        closestDiff = totalDiff;
        closestTimeValueReturn = timeValue;
      }
    }

    if (startOrEnd == 'start' && closestTimeValueReturn) {
      const d = new Date(getValues('start'));
      d.setHours(closestTimeValueReturn.value.hour, closestTimeValueReturn.value.minute, 0, 0);
      if (getValues('start').getTime() != d.getTime()) setValue('start', d);
    } else if (startOrEnd == 'end' && closestTimeValueReturn) {
      const d = new Date(getValues('end'));
      d.setHours(closestTimeValueReturn.value.hour, closestTimeValueReturn.value.minute, 0, 0);
      if (getValues('end').getTime() != d.getTime()) setValue('end', d);
    }
    return closestTimeValueReturn;
  };
  const DropdownIndicator = (props: any) => {
    return (
      components.DropdownIndicator && (
        <components.DropdownIndicator {...props}>
          <MagnifyingGlassIcon width={22} />
        </components.DropdownIndicator>
      )
    );
  };
  const handleInputChange = (inputText: string, meta: InputActionMeta) => {
    if (meta.action !== 'input-blur' && meta.action !== 'menu-close') {
      handleSearchDebounced(inputText);
    }
  };

  const formatOptionLabel = (option: defaultMemberSelectOutput) => {
    return (
      <div className="flex justify-between">
        <div className="flex-grow ">
          <div className="flex grow items-center">
            <ProfileImage member={option} tailwindSize="6" />
            <p className="ml-1 text-sm font-medium text-gray-900">{option.name}</p>
          </div>
        </div>
      </div>
    );
  };
  const handleSearchDebounced = useRef(debounce((searchText) => setSearchText(searchText), 300)).current;

  return (
    <div>
      {!startBulkRequest && (
        <form className="bg-white dark:bg-teams_brand_dark_100 p-4 rounded">
          <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
            {props.showUserSelect && (
              <div className="sm:col-span-3">
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-white">
                  {t('Who_for')}
                </label>
                <div className="mt-1 dark:text-white">
                  {(requestMemberIsLoading || isLoading) && memebersSelectable?.length == 0 && <Loader />}
                  {!(requestMemberIsLoading || isLoading) &&
                    memebersSelectable?.length == 1 &&
                    selectedRequester &&
                    !searchtext && <div className="dark:text-white">{selectedRequester.name}</div>}
                  {(searchtext || memebersSelectable?.length > 1) && (
                    <Controller
                      rules={{ required: true }}
                      control={control}
                      name="requester_member_id"
                      defaultValue={props.initDateValues.member_id ?? memebersSelectable[0]?.id}
                      render={({ field: { onChange, value } }) => (
                        <Select
                          value={value ? memebersSelectable.find((x) => x.id == value) : undefined}
                          options={memebersSelectable}
                          components={{
                            IndicatorSeparator: () => null,
                            DropdownIndicator
                          }}
                          styles={{
                            control: (base) => ({
                              ...base,
                              flexDirection: 'row-reverse',
                              '*': {
                                boxShadow: 'none !important'
                              }
                            }),
                            clearIndicator: (base: any) => ({
                              ...base,
                              position: 'absolute',
                              right: 0
                            })
                          }}
                          className="w-full"
                          formatOptionLabel={formatOptionLabel}
                          onInputChange={handleInputChange}
                          isLoading={isLoading || requestMemberIsLoading}
                          filterOption={null}
                          getOptionValue={(option) => option.id}
                          noOptionsMessage={noOptionsMessage}
                          onChange={(val) => {
                            if (val) {
                              onChange(val.id);
                            }
                          }}
                        />
                      )}
                    />
                  )}
                </div>
              </div>
            )}
            {props.showDepartmentSelect && (
              <div className="sm:col-span-3">
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-white">
                  {t('Who_for')}
                </label>
                <div className="mt-1">
                  {current_member &&
                    selectedDepartment &&
                    departmentDropDownValues &&
                    departmentDropDownValues.length > 1 && (
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                        value={selectedDepartment}
                        className="block w-full sm:max-w-xs sm:text-sm my-react-select-container"
                        classNamePrefix="my-react-select"
                        onChange={(val) => {
                          if (val) setSelectedDepartment(val);
                        }}
                        getOptionLabel={(option) => `${option.name}`}
                        getOptionValue={(option) => option.id}
                        options={departmentDropDownValues}
                      />
                    )}
                  {current_member &&
                    selectedDepartment &&
                    departmentDropDownValues &&
                    departmentDropDownValues.length == 1 && (
                      <span className="font-medium sm:pt-2 text-gray-700 text-sm">
                        {departmentDropDownValues[0]?.name}
                      </span>
                    )}
                </div>
              </div>
            )}
            <div
              className={`${props.showUserSelect || props.showDepartmentSelect ? 'sm:col-span-3' : 'sm:col-span-6'} `}
            >
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 dark:text-white">
                {t('Leave_type')}
              </label>
              <div className="mt-1">
                {leave_types?.[0] && (
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="leave_type_id"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        value={value ? leave_types.find((x) => x.id == value) : undefined}
                         className="block w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                        onChange={(val) => {
                          if (val) setSelectedLeaveType(val);

                          onChange(val?.id);
                        }}
                        getOptionLabel={(option) =>
                          option.name + (option.take_from_allowance ? ` (${t('Deductable')})` : '')
                        }
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                        getOptionValue={(option) => option.id}
                        options={leave_types}
                      />
                    )}
                  />
                )}
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-white">
                {t('Starting')}
              </label>
              <div className="mt-1">
                <Controller
                  control={control}
                  name="start"
                  rules={{
                    required: true
                  }}
                  render={({ field }) => (
                    <DatePicker
                      renderCustomHeader={(props) => <CustomHeader {...props} />}
                      calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                      locale={lang}
                      dateFormat={current_member?.date_format}
                      minDate={minDateMaxDateStart?.min}
                      maxDate={minDateMaxDateStart?.max}
                      className={
                        formState.errors.start
                          ? 'block w-full rounded-md border-red-300 pr-10 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm bg-white dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white'
                          : 'block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm bg-white dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white'
                      }
                      selected={field.value}
                      wrapperClassName="w-full"
                      onChange={(date: Date) => {
                        field.onChange(date);
                        clearErrors('start');
                      }}
                    />
                  )}
                />
                {formState.errors.start?.type === 'validate' && (
                  <div className="mt-2 inline-flex">
                    <div className="pointer-events-none relative inset-y-0  right-0 flex items-center">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                    </div>
                    <p className=" ml-2 text-sm text-red-600" id="email-error">
                      {formState.errors.start.message}
                    </p>
                  </div>
                )}
              </div>
              {selectedLeaveType?.leave_unit == 'half_days' && (
                <div className="mt-1">
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="start_at"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                        className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                        value={value ? start_at_values.find((x) => x.value == value) : undefined}
                        onChange={(val) => {
                          onChange(val?.value);
                        }}
                        options={start_at_values}
                      />
                    )}
                  />
                </div>
              )}
              {start_times_values.length > 0 && isHourUnit(selectedLeaveType?.leave_unit) && (
                <div className="mt-1">
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="start"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        value={findClosestTimeValue('start', value, start_times_values)}
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                       className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                        onChange={(val) => {
                          if (!val) return;

                          const d = new Date(getValues('start'));
                          d.setHours(val.value.hour, val.value.minute, 0, 0);

                          onChange(d);
                        }}
                        options={start_times_values}
                      />
                    )}
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 dark:text-white">
                {t('Ending')}
              </label>
              <div className="mt-1">
                <Controller
                  control={control}
                  name="end"
                  rules={{
                    required: true
                  }}
                  render={({ field }) => (
                    <DatePicker
                      renderCustomHeader={(props) => <CustomHeader {...props} />}
                      calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                      minDate={minDateMaxDateEnd?.min}
                      maxDate={minDateMaxDateEnd?.max}
                      locale={lang}
                      dateFormat={current_member?.date_format}
                      className={
                        formState.errors.end
                          ? 'block w-full rounded-md border-red-300 pr-10 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm bg-white dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white'
                          : 'block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm bg-white dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white'
                      }
                      selected={field.value}
                      wrapperClassName="w-full"
                      onChange={(date: Date) => {
                        field.onChange(date);
                        clearErrors('end');
                      }}
                    />
                  )}
                />

                {formState.errors.end?.type === 'validate' && (
                  <div className="mt-2 inline-flex">
                    <div className="pointer-events-none relative inset-y-0  right-0 flex items-center">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                    </div>
                    <p className=" ml-2 text-sm text-red-600" id="email-error">
                      {formState.errors.end.message}
                    </p>
                  </div>
                )}
              </div>
              {selectedLeaveType?.leave_unit == 'half_days' && (
                <div className="mt-1">
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="end_at"
                    defaultValue="end_of_day"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                       className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                        value={value ? end_at_values.find((x) => x.value == value) : undefined}
                        onChange={(val) => {
                          onChange(val?.value);
                        }}
                        options={end_at_values}
                      />
                    )}
                  />
                </div>
              )}
              {end_times_values.length > 0 && isHourUnit(selectedLeaveType?.leave_unit) && (
                <div className="mt-1">
                  <Controller
                    rules={{ required: true }}
                    control={control}
                    name="end"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        value={findClosestTimeValue('end', value, end_times_values)}
                        styles={{
                          control: (base) => ({
                            ...base,
                            '*': {
                              boxShadow: 'none !important'
                            }
                          })
                        }}
                    className="w-full my-react-select-container"
                        classNamePrefix="my-react-select"
                        onChange={(val) => {
                          if (!val) return;
                          const d = new Date(getValues('end'));
                          d.setHours(val.value.hour, val.value.minute, 0, 0);

                          onChange(d);
                        }}
                        options={end_times_values}
                      />
                    )}
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-white">
                {selectedLeaveType?.reason_mandatory ? (
                  <>
                    <span>{t('Reason')}</span>
                    <span className=" text-red-500">*</span>
                  </>
                ) : (
                  t('Reason_Optional')
                )}
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <input
                  {...register('reason', { required: false })}
                  type="text"
                  placeholder={selectedLeaveType?.reason_hint_text ? selectedLeaveType?.reason_hint_text : ''}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm bg-white dark:bg-transparent dark:border-teams_brand_dark_400 dark:text-white"
                />
              </div>
            </div>
          </div>
          {!props.showDepartmentSelect && (
            <div>
              {selectedLeaveType?.take_from_allowance && isDayUnit(selectedLeaveType.leave_unit) && (
                <div className="border-y border-gray-200 mt-4 dark:border-teams_brand_dark_400">
                  <div className="flex justify-center px-4 pt-4 sm:px-6 ">
                    <span className="mr-2 mt-2 dark:text-white">{t('Takes')}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-300">
                      {!durationIsLoading && durationSum >= 0 && parseInt(`${durationSum}`)}
                      {!durationIsLoading && <span className="ml-0.5">{hasDecimal(durationSum) && '½'}</span>}
                      {durationIsLoading && (
                        <div className="mx-3">
                          <Loader />
                        </div>
                      )}
                    </span>
                    <span className="ml-2 mt-2 dark:text-white">
                      {durationSum > 1 ? t('days') : t('day')}{' '}
                      {t('from_allowance', { allowance: selectedLeaveType?.allowance_type?.name })}
                    </span>
                  </div>
                  <span className="flex justify-center my-2"></span>
                </div>
              )}
              {selectedLeaveType?.take_from_allowance && isHourUnit(selectedLeaveType.leave_unit) && (
                <div className="border-y border-gray-200 mt-4">
                  <div className=" flex justify-center px-4 pt-4 sm:px-6 ">
                    <span className="mr-2 mt-2">{t('Takes')}</span>
                    <span className="flex h-10 w-20 items-center justify-center rounded-full bg-blue-300">
                      {!durationIsLoading && formatDuration(durationSum, lang, 'hours', true, t)}

                      {durationIsLoading && (
                        <div className="mx-3">
                          <Loader />
                        </div>
                      )}
                    </span>
                    <span className="ml-2 mt-2">
                      {t('from_allowance', { allowance: selectedLeaveType?.allowance_type?.name })}
                    </span>
                  </div>
                  <span className="flex justify-center my-2 text-red-400 px-4  sm:px-6 text-sm">
                    {outsideOfSchedule && t('Outside_of_schedule')}
                  </span>
                </div>
              )}
              {!selectedLeaveType?.take_from_allowance && (
                <div className="border-y border-gray-200 mt-4">
                  <div className=" flex  justify-center px-4 pt-4 sm:px-6">
                    <span className=" mt-2 dark:text-white">{t('No_deduction_from_allowance')}</span>
                  </div>
                  <span className="flex justify-center my-2"></span>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-end p-4 sm:px-6">
            <button
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                props.onClose('cancel');
              }}
              className={`${
                loading
                  ? ' bg-gray-300 text-gray-500 '
                  : ' border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 '
              } inline-flex justify-center rounded-md px-4 py-2 text-sm  font-medium  shadow-sm dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white`}
            >
              {t('Cancel')}
            </button>

            <button
              disabled={loading || (selectedLeaveType?.reason_mandatory && watch('reason')?.trim().length === 0)}
              type="button"
              onClick={() => {
                setLoading(true);
                if (Object.keys(formState.errors).length == 0) {
                  handleSubmit(onSubmit)();
                } else {
                  setLoading(false);
                }
              }}
              className={classNames(
                selectedLeaveType?.reason_mandatory && watch('reason')?.trim().length === 0
                  ? 'bg-gray-300 text-black hover:bg-gray-400'
                  : 'bg-green-600 hover:bg-teams_brand_background_2 text-white dark:bg-teams_brand_dark_300',
                'ml-5 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
              )}
            >
              {loading && (
                <div className="-ml-1 mr-3">
                  <Loader />
                </div>
              )}
              {t('Send_request')}
            </button>
          </div>
        </form>
      )}
      <div>
        <BulkRequestStatus
          department_id={selectedDepartment?.id ?? '1'}
          onClose={() => props.onClose()}
          ref={bulkRequestStatusRef}
        />
      </div>
    </div>
  );
};
