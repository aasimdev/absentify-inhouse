import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Switch, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { RouterOutputs, api } from '~/utils/api';
import 'react-datepicker/dist/react-datepicker.css';
import { useAbsentify } from '@components/AbsentifyContext';
import { read, utils as xlsxUtils } from 'xlsx';
import { CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import { addMinutes, isValid } from 'date-fns';
import { notifyError, notifySuccess } from '~/helper/notify';
import GroupCheckboxList from './GroupCheckboxList';
import { Tooltip as ReactTooltip, Tooltip } from 'react-tooltip';
import Loader from '@components/calendar/Loader';
import { Status } from '@prisma/client';
import { useDarkSide } from '@components/ThemeContext';

export default function ImportModal(props: { open: boolean; onClose: Function }) {
  const [theme] = useDarkSide();
  const { t, lang } = useTranslation('users');
  const [loading, setLoading] = useState<boolean>(false);
  const [emptyError, setEmptyError] = useState(false);
  const utils = api.useContext();
  const downloadImportExcel = api.workspace.getImportExcelFile.useMutation();
  const [dataFromExcel, setDataFromExcel] = useState<
    {
      name: string;
      email?: string;
      department: string;
      publicHoliday: string;
      employment_start_date: Date | undefined;
      custom_id?: string;
      account_enabled: string;
      validationStatus: 'valid' | 'invalid' | 'skip' | 'pending';
      errorMessage?: string;
      invited: boolean;
      public_holiday_id?: string;
      member_department_ids?: string[];
      default_allowances: Allowance[];
    }[]
  >([]);

  const { data: allowanceTypes } = api.allowance.allTypes.useQuery(undefined, { staleTime: 60000 });
  const inviteMember = api.member.invite.useMutation();
  const { data: departments } = api.department.all.useQuery(undefined, { staleTime: 60000 });
  const { data: public_holidays } = api.public_holiday.all.useQuery(undefined, { staleTime: 60000 });

  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });

  const { data: groups, isLoading: groupsLoading } = api.workspace.getMicrosoftGroups.useQuery(undefined, {
    staleTime: 60000,
    enabled: workspace?.microsoft_groups_read_write_all == 'ACTIVATED'
  });

  const [steps, setSteps] = useState<
    { id: string; name: string; status: 'current' | 'upcoming' | 'complete'; key: string; position: number }[]
  >([
    {
      id: t('Step', { number: 1 }),
      name: t('Download_Template'),
      status: 'current',
      key: 'download_template',
      position: 0
    },
    { id: t('Step', { number: 2 }), name: t('Upload_Excel'), status: 'upcoming', key: 'upload_excel', position: 1 },
    { id: t('Step', { number: 3 }), name: t('Validate_Data'), status: 'upcoming', key: 'validate_data', position: 2 },
    { id: t('Step', { number: 4 }), name: t('Invite_Users'), status: 'upcoming', key: 'invite_users', position: 3 }
  ]);

  const cancelButtonRef = useRef(null);
  function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
  }
  const checkExistingEmails = api.member.checkExistingEmails.useMutation();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const { current_member } = useAbsentify();
  useEffect(() => {
    // Reset selected groups if groups data changes
    setSelectedGroups([]);
  }, [groups]);

  useEffect(() => {
    if (!workspace) return;
    if (!groups) return;
    if (workspace.microsoft_groups_read_write_all == 'ACTIVATED') {
      setSteps([
        {
          id: t('Step', { number: 1 }),
          name: t('populate-excel'),
          status: 'current',
          key: 'populate_excel',
          position: 0
        },
        {
          id: t('Step', { number: 2 }),
          name: t('Download_Template'),
          status: 'upcoming',
          key: 'download_template',
          position: 1
        },
        { id: t('Step', { number: 3 }), name: t('Upload_Excel'), status: 'upcoming', key: 'upload_excel', position: 2 },
        {
          id: t('Step', { number: 4 }),
          name: t('Validate_Data'),
          status: 'upcoming',
          key: 'validate_data',
          position: 3
        },
        { id: t('Step', { number: 5 }), name: t('Invite_Users'), status: 'upcoming', key: 'invite_users', position: 4 }
      ]);
    }
  }, [workspace, groups]);

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };
  const inviteAllUsers = async () => {
    for (let index = 0; index < dataFromExcel.length; index++) {
      const excelLine = dataFromExcel[index];
      if (!excelLine) continue;
      if (!excelLine.public_holiday_id) continue;
      if (!excelLine.member_department_ids) continue;
      if (excelLine.validationStatus == 'skip') {
        excelLine.invited = true;
        setDataFromExcel(dataFromExcel);
        continue;
      }

      let employment_start_date = null;
      if (excelLine.employment_start_date)
        employment_start_date = addMinutes(
          new Date(excelLine.employment_start_date),
          new Date(excelLine.employment_start_date).getTimezoneOffset() * -1
        );

      await inviteMember.mutateAsync(
        {
          email: excelLine.email ? excelLine.email : null,
          employment_start_date: employment_start_date,
          name: excelLine.name,
          public_holiday_id: excelLine.public_holiday_id,
          member_department_ids: excelLine.member_department_ids,
          custom_id: excelLine.custom_id ?? null,
          status: excelLine.account_enabled == Status.ACTIVE ? Status.ACTIVE : Status.INACTIVE,
          defaultAllowances: excelLine.default_allowances
        },
        {
          onSuccess: async () => {
            excelLine.invited = true;
            setDataFromExcel(dataFromExcel);
          },
          onError: (error) => {
            excelLine.errorMessage = error.message;
            setDataFromExcel(dataFromExcel);
          }
        }
      );
    }
    setLoading(false);
    if (typeof umami !== 'undefined') {
      umami.track('InviteUsers', { user_count: dataFromExcel.length });
    }
    await utils.member.all.invalidate();
  };

  type Data = {
    name: string;
    email?: string | undefined;
    department: string;
    publicHoliday: string;
    employment_start_date: Date | undefined;
    custom_id?: string;
    account_enabled: string;
    validationStatus: 'valid' | 'invalid' | 'skip' | 'pending';
    errorMessage?: string | undefined;
    invited: boolean;
    public_holiday_id?: string | undefined;
    member_department_ids?: string[] | undefined;
    default_allowances: PreAllowance[];
  };

  type DataWithAllowances = Data & {
    default_allowances: Allowance[];
  };

  const validateData = async (d: Data[]) => {
    if (!departments) return;
    if (!public_holidays) return;
    if (!allowanceTypes) return;
    let existingEmails = await checkExistingEmails.mutateAsync({
      emails: d.map((x) => x.email).filter(notEmpty) as string[]
    });
    if (d.length === 0) {
      setEmptyError(true);
      return;
    }

    for (let index = 0; index < d.length; index++) {
      const excelLine = d[index];
      if (!excelLine) continue;
      excelLine.validationStatus = 'valid';
      if (existingEmails.find((x) => x.email?.toLowerCase() === excelLine.email)) {
        excelLine.validationStatus = 'skip';
        excelLine.errorMessage = t('AccountAlreadyExists') + ' ' + t('we-skip-this-entry');
      }

      if (!excelLine.department) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Department_is_required');
        continue;
      }

      if (!excelLine.publicHoliday) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Public_Holiday_is_required');
        continue;
      }
      if (!excelLine.default_allowances || allowanceTypes.length !== excelLine.default_allowances.length) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('allowances_required');
        continue;
      }
      const nonExistedAllowances = excelLine.default_allowances
        .filter((allowance) => !allowanceTypes.find((al) => al.id === allowance.id))
        .map((al) => al.name);
      const defaultAllowanceHourly = excelLine.default_allowances
        .filter(
          (allowance) =>
            (allowance.current_year == null || allowance.next_year == null) &&
            allowanceTypes.find((al) => al.id === allowance.id)?.allowance_unit === 'hours'
        )
        .map((al) => al.name);
      const defaultAllowanceDaily = excelLine.default_allowances
        .filter(
          (allowance) =>
            (allowance.current_year == null || allowance.next_year == null) &&
            allowanceTypes.find((al) => al.id === allowance.id)?.allowance_unit === 'days'
        )
        .map((al) => al.name);
      if (nonExistedAllowances.length > 0 || defaultAllowanceHourly.length > 0 || defaultAllowanceDaily.length > 0) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage =
          (nonExistedAllowances.length > 0
            ? t('the_allowance_not_exist', { allowanceNames: nonExistedAllowances }) + ' '
            : '') +
          (defaultAllowanceHourly.length > 0
            ? t('these_allowances_invalid_hours', { allowanceNames: defaultAllowanceHourly }) + ' '
            : '') +
          (defaultAllowanceDaily.length > 0
            ? t('the_allowances_invalid_days', { allowanceNames: defaultAllowanceDaily })
            : '');
        continue;
      }
      (excelLine.default_allowances as Allowance[]) = [...excelLine.default_allowances] as Allowance[];

      let departmentNames = excelLine.department.split(';');
      let departmentIds: string[] = [];
      let allDepartmentsExist = true;

      departmentNames.forEach((departmentName) => {
        let department = departments.find((x) => x.name.trim() === departmentName.trim());
        if (!department) {
          allDepartmentsExist = false;
          excelLine.validationStatus = 'invalid';
          excelLine.errorMessage = t('Department_does_not_exist') + `: ${departmentName.trim()}`;
          return;
        }
        departmentIds.push(department.id);
      });

      if (allDepartmentsExist) {
        excelLine.member_department_ids = departmentIds;
      }

      let publicHoliday = public_holidays.find((x) => x.name == excelLine.publicHoliday);
      if (!publicHoliday) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Public_Holiday_does_not_exist');
        continue;
      }
      excelLine.public_holiday_id = publicHoliday.id;

      if (excelLine.email && !validateEmail(excelLine.email)) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Email_is_invalid');
        continue;
      }

      if (excelLine.employment_start_date && !isValid(excelLine.employment_start_date)) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Date_is_invalid');
        continue;
      }

      if (
        !(
          excelLine.account_enabled == t('Account_Enabled_Value_Active') ||
          excelLine.account_enabled == t('Account_Enabled_Value_Inactive')
        )
      ) {
        excelLine.validationStatus = 'invalid';
        excelLine.errorMessage = t('Account_Enabled_Value_is_invalid');
        continue;
      } else {
        excelLine.account_enabled =
          excelLine.account_enabled == t('Account_Enabled_Value_Active') ? Status.ACTIVE : Status.INACTIVE;
      }
    }
    setDataFromExcel(d as DataWithAllowances[]);
  };

  interface Allowance {
    id: string;
    current_year: number;
    next_year: number;
  }

  interface PreAllowance {
    id: string;
    name: string;
    current_year: number | null;
    next_year: number | null;
  }

  const parseValue = (value: number | object | string, allowanceUnit: string): number | null => {
    if (typeof value === 'number' && allowanceUnit === 'days') {
      return value;
    } else if (value instanceof Date && allowanceUnit === 'hours') {
      const hours = value.getHours();
      const minutes = value.getMinutes();
      return hours * 60 + minutes;
    }
    return null;
  };

  const createAllowanceObject = (
    name: string,
    value: number | object | string,
    allowances: { [key: string]: PreAllowance }
  ) => {
    // Find the last open bracket index
    const lastOpenBracketIndex = name.lastIndexOf('(');

    // Extract allowance name from the string
    const allowanceName = name.substring(0, lastOpenBracketIndex).trim();

    // Find the type ID from the allowanceTypes or default to allowanceName
    const allowanceType =
      allowanceTypes?.find((allowance) => allowance.name.trim() === allowanceName)?.id || allowanceName;

    // Extract unit between the brackets
    const allowanceUnit = name.substring(lastOpenBracketIndex + 1, name.indexOf(')', lastOpenBracketIndex)).trim();

    // Extract the year information (e.g., "current" or "next")
    const yearMatch = name.match(/\b(current|next)\b/);
    const year = yearMatch ? yearMatch[0].toLowerCase() : null;

    if (!year) return null; // If year is not found, return null

    // Initialize the allowance entry if it doesn't exist
    if (!allowances[allowanceType]) {
      allowances[allowanceType] = {
        id: allowanceType,
        name: allowanceName,
        current_year: 0,
        next_year: 0
      };
    }

    // Parse the value based on the unit
    const parsedValue: number | null = parseValue(value, allowanceUnit);

    // Update the allowance for the respective year
    if (allowances && allowances[allowanceType]) {
      (allowances[allowanceType] as PreAllowance)[year === 'current' ? 'current_year' : 'next_year'] = parsedValue;
    }
  };
  const handleUpload = (e: any) => {
    try {
      e.preventDefault();
      setLoading(true);
      var files = e.target.files,
        f = files[0];
      var reader = new FileReader();
      reader.onload = function (e) {
        if (!e) return;
        var data = e.target?.result;
        let readedData = read(data, { type: 'binary', cellDates: true });
        const wsname = readedData.SheetNames[0];
        if (!wsname) return;
        const ws = readedData.Sheets[wsname];
        if (!ws) return;
        /* Convert array to json*/
        const dataParse = xlsxUtils.sheet_to_json(ws, { header: 1 });
        const columnNames = dataParse.shift() as string[];
        const allowanceNames = columnNames?.slice(7);

        let array = [];
        for (let index = 0; index < dataParse.length; index++) {
          const element = dataParse[index] as string[];
          if (element[0]?.toString().trim() == '') continue;
          if (element[1]?.trim() == '') continue;
          if (element[2]?.toLowerCase() == '') continue;
          const allowancesSliced = (dataParse[index] as (number | Date)[]).slice(7);
          const default_allowances = allowanceNames.map((name, index) => ({
            [name]: allowancesSliced[index]
          }));
          const allowances: { [key: string]: PreAllowance } = {};

          default_allowances.forEach((entry) => {
            const key = Object.keys(entry)[0];
            if (key !== undefined && (entry[key] !== undefined || entry[key] !== null)) {
              createAllowanceObject(key, entry[key] as string | number | object, allowances);
            }
          });
          const allowanceArray: PreAllowance[] = Object.entries(allowances).map(([key, value]) => ({
            id: key,
            name: value.name,
            current_year: value.current_year,
            next_year: value.next_year
          }));
          array.push({
            name: element[0],
            email: element[1]?.toLowerCase(),
            department: element[2],
            publicHoliday: element[3],
            employment_start_date: element[4],
            custom_id: element[5]?.toString(),
            account_enabled: element[6]?.toString() ?? t('Account_Enabled_Value_Inactive'),
            default_allowances: allowanceArray,
            validationStatus: 'pending',
            invited: false
          });
        }
        //@ts-ignore
        setDataFromExcel(array);

        let currentStep = steps.find((x) => x.status == 'current');
        if (currentStep) {
          currentStep.status = 'complete';
          let nextSTep = steps[currentStep.position + 1];
          if (nextSTep) nextSTep.status = 'current';

          setSteps(steps);
          setLoading(false);
          //@ts-ignore
          validateData(array);
        }
      };
      reader.readAsBinaryString(f);
    } catch (error: any) {
      setLoading(false);
      notifyError(t('error_while_uploading'));
    }
  };

  const downloadTemplate = async () => {
    if (!current_member) return;
    setLoading(true);

    const importExcel = await downloadImportExcel.mutateAsync({ selectedGroups: selectedGroups });
    const mediaType = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,';

    window.location.href = `${mediaType}${importExcel.base64File}`;
    notifySuccess(t('template_generation_successfully'));
    let currentStep = steps.find((x) => x.status == 'current');
    if (currentStep) {
      currentStep.status = 'complete';
      let nextSTep = steps[currentStep.position + 1];
      if (nextSTep) nextSTep.status = 'current';

      setSteps(steps);
    }

    setLoading(false);
  };
  const hiddenFileInput = useRef(null);
  const handleSelectAll = () => {
    if (!groups) return;
    const allGroupIds = groups.map((group) => group.id);
    setSelectedGroups(allGroupIds);
  };

  const handleUnselectAll = () => {
    setSelectedGroups([]);
  };

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="overflow-y-auto fixed inset-0 z-30"
        initialFocus={cancelButtonRef}
        onClose={() => {
          if (!loading) props.onClose();
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
            <div className="inline-block overflow-hidden px-4 pt-5 pb-4 text-left align-bottom bg-white rounded-lg shadow-xl transition-all transform sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6 dark:bg-teams_brand_tbody">
              <nav aria-label="Progress">
                <ol role="list" className="space-y-4 md:flex md:space-y-0 md:space-x-8">
                  {steps.map((step) => (
                    <li key={step.name} className="md:flex-1">
                      {step.status === 'complete' ? (
                        <span className="group pl-4 py-2 flex flex-col border-l-4 border-teams_brand_foreground_bg  md:pl-0 md:pt-4 md:pb-0 md:border-l-0 md:border-t-4">
                          <span className="text-xs text-teams_brand_foreground_bg font-semibold tracking-wide uppercase ">
                            {step.id}
                          </span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      ) : step.status === 'current' ? (
                        <span
                          className="pl-4 py-2 flex flex-col border-l-4 border-teams_brand_foreground_bg md:pl-0 md:pt-4 md:pb-0 md:border-l-0 md:border-t-4"
                          aria-current="step"
                        >
                          <span className="text-xs text-teams_brand_foreground_bg font-semibold tracking-wide uppercase">
                            {step.id}
                          </span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      ) : (
                        <span className="group pl-4 py-2 flex flex-col border-l-4 border-gray-200  md:pl-0 md:pt-4 md:pb-0 md:border-l-0 md:border-t-4">
                          <span className="text-xs text-gray-500 font-semibold tracking-wide uppercase">{step.id}</span>
                          <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="border-t border-gray-200 mt-5 dark:border-teams_brand_border"></div>
              {steps.find((x) => x.status == 'current')?.key == 'populate_excel' && (
                <div className="bg-white  mt-5 dark:bg-teams_brand_tbody">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">{t('import-teams-ad-users')}</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-100">
                          <p>{t('import-teams-ad-users-description')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5">
                      {groupsLoading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}
                      {groupsLoading == false && groups && (
                        <>
                          <div className="ml-3 mb-3 p-2 pl-0 pb-1 border-b border-gray-200 md:w-9/12 w-11/12">
                            <button onClick={handleSelectAll}>
                              <span className={`text-base pr-1.5 hover:text-teams_brand_600 dark:text-gray-200 ${selectedGroups.length} `}>
                                {' '}
                                {t('select_all')}
                              </span>{' '}
                            </button>
                            <button onClick={handleUnselectAll}>
                              <span className={`text-base hover:text-teams_brand_600 dark:text-gray-200 `}> | {t('unselect_all')}</span>
                            </button>
                          </div>
                          <GroupCheckboxList
                            groups={groups}
                            selectedGroups={selectedGroups}
                            onGroupSelectionChange={(
                              isChecked: boolean,
                              group: RouterOutputs['workspace']['getMicrosoftGroups'][0]
                            ) => {
                              if (isChecked) {
                                setSelectedGroups([...selectedGroups, group.id]);
                              } else {
                                setSelectedGroups(selectedGroups.filter((groupId) => groupId !== group.id));
                              }
                            }}
                          />
                        </>
                      )}
                    </div>
                    <div className="mt-4 py-4 px-4 flex justify-end sm:px-6">
                      <button
                        type="button"
                        onClick={() => {
                          props.onClose();
                        }}
                        className="bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        type="submit"
                        onClick={async () => {
                          setLoading(true);
                          let currentStep = steps.find((x) => x.status == 'current');
                          if (currentStep) {
                            currentStep.status = 'complete';
                            let nextSTep = steps[currentStep.position + 1];
                            if (nextSTep) nextSTep.status = 'current';
                            setSteps(steps);
                            await inviteAllUsers();
                          }
                        }}
                        disabled={dataFromExcel.filter((x) => x.validationStatus == 'invalid').length > 0}
                        className={classNames(
                          'ml-5 bg-teams_brand_foreground_1 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-teams_brand_foreground_bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1',
                          dataFromExcel.filter((x) => x.validationStatus == 'invalid').length > 0
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        )}
                      >
                        {t('Next')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {steps.find((x) => x.status == 'current')?.key == 'download_template' && (
                <div className="bg-white  mt-5 dark:bg-teams_brand_tbody dark:border dark:border-teams_brand_border dark:rounded">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">{t('Download_Excel_Template')}</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-200">
                          <p>{t('Download_Excel_Template_description')}</p>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-0 sEm:ml-6 sm:flex-shrink-0 sm:flex sm:items-center">
                        <button
                          onClick={() => {
                            downloadTemplate();
                          }}
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                        >
                          {loading && (
                            <div className="-ml-1 mr-3">
                              <Loader />
                            </div>
                          )}
                          {t('Download')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {steps.find((x) => x.status == 'current')?.key == 'upload_excel' && (
                <div className="bg-white  mt-5 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:rounded">
                  <div className="px-2 py-5 sm:p-2">
                    <div className="sm:flex sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">{t('Upload_Excel_File')}</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-200">
                          <p>{t('Upload_Excel_File_description')}</p>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex-shrink-0 sm:flex sm:items-center">
                        <input
                          type="file"
                          accept=".xls,.xlsx"
                          name="file"
                          ref={hiddenFileInput}
                          style={{ display: 'none' }}
                          onChange={handleUpload}
                          className='dark:bg-teams_brand_dark_400 dark:text-gray-200'
                        />
                        <button
                          onClick={() => {
                            if (hiddenFileInput.current) (hiddenFileInput.current as any).click();
                          }}
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-teams_brand_foreground_bg hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 sm:text-sm"
                        >
                          {loading && (
                            <div className="-ml-1 mr-3">
                              <Loader />
                            </div>
                          )}
                          {t('Upload')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {steps.find((x) => x.status == 'current')?.key == 'validate_data' && (
                <div className="px-4 sm:px-6 lg:px-8 mt-5">
                  {emptyError ? (
                    <>
                      <div className="flex">
                        <div className="flex-shrink-0 pt-1">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="flex">
                          <div className="ml-3 flex flex-col justify-center align-middle">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">{t('no_users_found')}</h3>
                            <div className="mt-2 text-sm text-gray-900 dark:text-gray-200">
                              <p className="mb-4">{t('no_users_found_description')}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className=" inline-flex align-middle w-20 self-center justify-center rounded-md bg-teams_brand_foreground_bg px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus:ring-teams_brand_500 sm:col-start-2"
                            onClick={() => {
                              props.onClose();
                            }}
                          >
                            {t('ok')}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sm:flex sm:items-center">
                        <div className="sm:flex-auto">
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{t('Upload_Excel_File_description_2')}</p>
                        </div>
                        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none"></div>
                      </div>
                      <div className="mt-8 flex flex-col">
                        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                              <table className="min-w-full divide-y divide-gray-300 dark:bg-teams_brand_tbody dark:divide-teams_brand_border">
                                <thead className="bg-gray-50 dark:bg-teams_brand_thead">
                                  <tr>
                                    <th
                                      scope="col"
                                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-teams_brand_th"
                                    >
                                      {t('Name')}
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-teams_brand_th"
                                    >
                                      {t('Email')}
                                    </th>

                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 dark:text-teams_brand_th">
                                      <span className="sr-only">{t('Status')}</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_tbody dark:divide-teams_brand_tbody_border">
                                  {dataFromExcel.map((person) => (
                                    <tr key={person.email}>
                                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                                        {person.name}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-white">
                                        {person.email ?? '-'}
                                      </td>
                                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 dark:text-white">
                                        {person.validationStatus == 'pending' && (
                                          <div className="-ml-1 mr-3">
                                            <Loader />
                                          </div>
                                        )}
                                        {person.validationStatus == 'valid' && (
                                          <CheckCircleIcon height={24} color="green" />
                                        )}
                                        {person.validationStatus == 'skip' && (
                                          <span className="cursor-pointer ml-1 flex items-center">
                                            <span
                                              data-tooltip-id="excel-tooltip"
                                              data-tooltip-content={person.errorMessage}
                                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                            >
                                              <ExclamationCircleIcon height={24} color="blue" />
                                            </span>
                                          </span>
                                        )}
                                        {person.validationStatus == 'invalid' && (
                                          <span className="cursor-pointer ml-1 flex items-center">
                                            <span
                                              data-tooltip-id="excel-tooltip"
                                              data-tooltip-content={person.errorMessage}
                                              data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                            >
                                              <ExclamationCircleIcon height={24} color="red" />
                                            </span>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <ReactTooltip
                                  id="excel-tooltip"
                                  className="shadow-sm z-50"
                                  classNameArrow="shadow-sm"
                                  place="top"
                                  opacity={1}
                                  style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                                />
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 py-4 px-4 flex justify-end sm:px-6">
                        <button
                          type="button"
                          onClick={() => {
                            props.onClose();
                          }}
                          className="bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1 dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                        >
                          {t('Cancel')}
                        </button>
                        <button
                          type="submit"
                          onClick={async () => {
                            setLoading(true);
                            let currentStep = steps.find((x) => x.status == 'current');
                            if (currentStep) {
                              currentStep.status = 'complete';
                              let nextSTep = steps[currentStep.position + 1];
                              if (nextSTep) nextSTep.status = 'current';

                              setSteps(steps);
                              await inviteAllUsers();
                            }
                          }}
                          disabled={
                            dataFromExcel.filter((x) => x.validationStatus == 'invalid').length > 0 ||
                            dataFromExcel.length === 0
                          }
                          className={classNames(
                            'ml-5 bg-teams_brand_foreground_1 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-teams_brand_foreground_bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1',
                            dataFromExcel.filter((x) => x.validationStatus == 'invalid').length > 0
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          )}
                        >
                          {t('Invite_all_users')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {steps.find((x) => x.status == 'current')?.key == 'invite_users' && (
                <div className="px-4 sm:px-6 lg:px-8 mt-5 dark:bg-teams_brand_tbody">
                  <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{t('Upload_Excel_File_description_2')}</p>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none"></div>
                  </div>
                  <div className="mt-8 flex flex-col">
                    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                      <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg ">
                          <table className="min-w-full divide-y divide-gray-300 dark:bg-teams_brand_tbody dark:divide-teams_brand_border">
                            <thead className="bg-gray-50 dark:bg-teams_brand_thead">
                              <tr>
                                <th
                                  scope="col"
                                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-teams_brand_th"
                                >
                                  {t('Name')}
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-teams_brand_th">
                                  {t('Email')}
                                </th>

                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 dark:text-teams_brand_th">
                                  <span className="sr-only">{t('Invited')}</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_tbody dark:divide-teams_brand_tbody_border">
                              {dataFromExcel.map((person) => (
                                <tr key={person.email}>
                                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                                    {person.name}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-white">{person.email}</td>
                                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 dark:text-white">
                                    {person.invited == false && (
                                      <div className="-ml-1 mr-3">
                                        <Loader />
                                      </div>
                                    )}
                                    {person.invited && person.validationStatus == 'skip' && (
                                      <span className="cursor-pointer ml-1 flex items-center ">
                                        <span
                                          data-tooltip-id="step-tooltip"
                                          data-tooltip-content={person.errorMessage}
                                          data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                        >
                                          <CheckCircleIcon height={24} color="blue" />
                                        </span>
                                      </span>
                                    )}
                                    {person.invited && person.validationStatus != 'skip' && (
                                      <CheckCircleIcon height={24} color="green" />
                                    )}
                                    {person.errorMessage && person.validationStatus != 'skip' && (
                                      <span className="cursor-pointer ml-1 flex items-center">
                                        <span
                                          data-tooltip-id="step-tooltip"
                                          data-tooltip-content={person.errorMessage}
                                          data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                        >
                                          <ExclamationCircleIcon height={24} color="red" />
                                        </span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 py-4 px-4 flex justify-end sm:px-6">
                    <button
                      type="submit"
                      onClick={() => {
                        props.onClose();
                      }}
                      disabled={loading}
                      className={classNames(
                        'ml-5 bg-teams_brand_foreground_1 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-teams_brand_foreground_bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_border_1 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0',
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      )}
                    >
                      {t('Finish')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Transition.Child>
          <ReactTooltip
            id="step-tooltip"
            className="shadow-sm z-50 "
            classNameArrow="shadow-sm"
            place="top"
            opacity={1}
            style={{ width: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
          />
        </div>
      </Dialog>
    </Transition.Root>
  );
}
