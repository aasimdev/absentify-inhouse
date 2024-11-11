import 'react-datepicker/dist/react-datepicker.css';
import { useAbsentify } from '@components/AbsentifyContext';
import { Dialog, Switch, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { addMinutes, differenceInDays } from 'date-fns';
import Link from 'next/link';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import Select from 'react-select';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { api, type RouterInputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import { useRouter } from 'next/router';
import { Status } from '@prisma/client';
import { CustomHeader } from '@components/CustomHeader';
import { InputPicker } from '@components/duration-select/duration-select';
import { getFiscalYearStartAndEndDates } from '~/lib/requestUtilities';
import { getDatesFromNow } from '~/lib/DateHelper';
import { useDarkSide } from '@components/ThemeContext';

export default function InviteModal(props: { open: boolean; onClose: Function }) {
  const [theme] = useDarkSide();
  const { t, lang } = useTranslation('users');
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const utils = api.useContext();
  const cancelButtonRef = useRef(null);
  const { subscription } = useAbsentify();
  const { pastDate, futureDate } = getDatesFromNow();
  const [defaultAllowances, setDefaultAllowances] = useState<
    {
      id: string;
      current_year: number;
      next_year: number;
    }[]
  >([]);
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    getValues
  } = useForm<RouterInputs['member']['invite']>();
  const employment_start_date_watch = watch('employment_start_date');
  const { data: hasAccount } = api.member.byEmail.useQuery(
    { email: getValues('email') ?? '' },
    {
      enabled: watch('email') != null
    }
  );
  const { data: allowanceTypes, isLoading: isLoadingAllowanceTypes } = api.allowance.allTypes.useQuery(undefined, {
    staleTime: 60000
  });
  const [change, setChange] = useState(false);
  const addOrUpdateAllowance = (allowanceType: { id: string; current_year: number; next_year: number }) => {
    if (!change && depMemIds && depMemIds[0]) {
      const department = departments?.find((dep) => dep.id === depMemIds[0]);
      if (department && typeof department.default_department_allowances === 'string') {
        const default_allowance = JSON.parse(department.default_department_allowances)?.find(
          (allowance: { id: string }) => allowance.id === allowanceType.id
        );
        if (
          default_allowance &&
          (default_allowance.value !== allowanceType.current_year ||
            default_allowance.value !== allowanceType.next_year)
        ) {
          setChange(true);
        }
      }
    }

    const isDuplicate = defaultAllowances.some((allowance) => allowance.id === allowanceType.id);

    if (!isDuplicate) {
      setDefaultAllowances((prev) => [...prev, allowanceType]);
    } else {
      setDefaultAllowances((prev) =>
        prev.map((allowance) => (allowance.id === allowanceType.id ? allowanceType : allowance))
      );
    }
  };
  const depMemIds: string[] = watch('member_department_ids');

  useEffect(() => {
    if (change || !departments || !depMemIds || !depMemIds[0] || !workspace) return;

    const department = departments.find((dep) => dep.id === depMemIds[0]);
    if (!department || typeof department.default_department_allowances !== 'string') return;

    const default_allowances = JSON.parse(department.default_department_allowances);
    if (!default_allowances?.length || default_allowances.length === 0) return;

    const employmentStartDate = employment_start_date_watch ? new Date(employment_start_date_watch) : null;

    const { lastDayOfYear } = getFiscalYearStartAndEndDates(
      workspace.fiscal_year_start_month,
      new Date().getFullYear()
    );

    if (!employmentStartDate) {
      const allowances = default_allowances.map((allowance: { id: string; value: string }) => ({
        id: allowance.id,
        current_year: allowance.value,
        next_year: allowance.value
      }));
      setDefaultAllowances(allowances);
      return;
    }

    // Calculation of the months between the start date and the end of the year
    const employmentMonth = employmentStartDate.getMonth() + 1; // months are 0-based in JavaScript
    const endMonth = lastDayOfYear.getMonth() + 1; // End of the month of the financial year

    // Calculate the number of full months the employee will work
    const monthsWorked = endMonth - employmentMonth + 1;

    const allowances = default_allowances.map((allowance: { id: string; value: string }) => {
      const fullYearAllowance = parseFloat(allowance.value);

      // Calculation of the pro rata quota based on full months
      let suggestedAllowance = (fullYearAllowance / 12) * monthsWorked;

      // Rounding to 0.5
      suggestedAllowance = Math.round(suggestedAllowance * 2) / 2;

      return {
        id: allowance.id,
        current_year: suggestedAllowance.toString(),
        next_year: fullYearAllowance.toString()
      };
    });

    setDefaultAllowances(allowances);
  }, [depMemIds, employment_start_date_watch, workspace]);

  const message = (
    <div>
      <div>{t('AccountAlreadyExistsInOtherWorkspaceAlone')}</div>
      <a
        href="https://support.absentify.com/en/article/delete-company-account-cyz6jd/"
        target="_blank"
        className=" underline"
      >
        {t('AccountAlreadyExistsInOtherWorkspaceAloneLink')}
      </a>
    </div>
  );

  const inviteMember = api.member.invite.useMutation();
  const { current_member } = useAbsentify();
  const onSubmit: SubmitHandler<RouterInputs['member']['invite']> = async (data: RouterInputs['member']['invite']) => {
    if (!current_member) return;
    setLoading(true);
    console.log({ hasAccount });
    if (hasAccount && hasAccount.status === 'ARCHIVED' && hasAccount.workspace_id === workspace?.id) {
      notifyError(t('AccountAlreadyExistsInSameWorkspaceArchived'));
      setLoading(false);
      return;
    }

    if (hasAccount && hasAccount.status === 'ACTIVE' && hasAccount.workspace_id === workspace?.id) {
      notifyError(t('AccountAlreadyExistsInSameWorkspaceActive'));
      setLoading(false);
      return;
    }

    if (hasAccount && hasAccount.status === 'INACTIVE' && hasAccount.workspace_id === workspace?.id) {
      notifyError(t('AccountAlreadyExistsInSameWorkspaceInactive'));
      setLoading(false);
      return;
    }

    if (
      hasAccount &&
      hasAccount.workspace_id !== workspace?.id &&
      (hasAccount.workspace.members.length === 1 || hasAccount.is_admin)
    ) {
      notifyError(message);
      setLoading(false);
      return;
    }

    if (hasAccount && hasAccount.workspace_id !== workspace?.id && hasAccount.workspace.members.length > 1) {
      notifyError(t('AccountAlreadyExistsInOtherWorkspaceWithOthers'));
      setLoading(false);
      return;
    }

    if (data.employment_start_date) {
      data.employment_start_date = addMinutes(
        data.employment_start_date,
        data.employment_start_date.getTimezoneOffset() * -1
      );
    }
    let status: Status = Status.INACTIVE;
    if (!data.email || data.email.trim().length === 0) {
      status = Status.ACTIVE;
    }

    await inviteMember.mutateAsync(
      {
        email: data.email ? data.email.toLowerCase() : null,
        employment_start_date: data.employment_start_date,
        name: data.name,
        public_holiday_id: data.public_holiday_id,
        member_department_ids: data.member_department_ids,
        custom_id: null,
        status,
        defaultAllowances: defaultAllowances.map((allowance) => {
          return {
            ...allowance,
            current_year: parseFloat(allowance.current_year + ""),
            next_year: parseFloat(allowance.next_year + "")
          };
        })
      },
      {
        onSuccess: async () => {
          await utils.member.all.invalidate();
          notifySuccess(t('User_created_successfully'));
          if (typeof umami !== 'undefined') umami.track('InviteAUser');
          setLoading(false);
          props.onClose();
        },
        onError: (error) => {
          notifyError(error.message);

          setLoading(false);
        }
      }
    );
  };

  const { data: departments, isLoading: isLoadingDepartments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: PUBLIC_HOLIDAYS } = api.public_holiday.all.useQuery(undefined, {
    staleTime: 60000
  });

  useEffect(() => {
    if (router.query.user_name && router.query.user_email) {
      setValue('name', router.query.user_name as string);
      setValue('email', router.query.user_email as string);
      delete router.query.user_name;
      delete router.query.user_email;
      router.push({ pathname: router.pathname });
    }
  }, [router]);
  if (isLoadingDepartments || isLoadingAllowanceTypes) {
    return <div></div>;
  }

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-30 overflow-y-auto"
        initialFocus={cancelButtonRef}
        onClose={() => {
          if (!loading) props.onClose();
        }}
      >
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500/75 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
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
            <div className="z-30 inline-block overflow-visible px-4 pt-5 pb-4 text-left align-bottom bg-white rounded-lg shadow-xl transition-all transform sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-teams_brand_dark_100">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                    {t('add_new_user')}
                  </Dialog.Title>
                  <form className="divide-y divide-gray-200" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                      <div className="sm:col-span-5">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('name')}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            {...register('name', { required: true })}
                            type="text"
                            name="name"
                            id="name"
                            autoComplete="name"
                            className={`block w-full min-w-0 grow rounded-md  ${
                              errors.name ? 'border-red-400 ' : 'border-gray-300'
                            }  focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200`}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="email" className="inline-flex text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('Email')}

                          <span
                            className="ml-1 flex items-center cursor-pointer"
                            data-tooltip-id="info-tooltip"
                            data-tooltip-variant="light"
                          >
                            <InformationCircleIcon className="ml-2 -mb-1 h-5 w-5 text-orange-500" aria-hidden="true" />
                          </span>
                          <ReactTooltip
                            id="info-tooltip"
                            className="z-50 shadow-sm dark:bg-teams_dark_mode_core dark:text-gray-200"
                            classNameArrow="shadow-sm"
                            place="top"
                            opacity={1}
                            style={{ maxWidth: '300px', boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                            clickable
                          >
                            {
                              <div className="overflow-auto">
                                {!subscription.has_valid_subscription ? (
                                  <h1 className="text-sm font-semibold dark:text-gray-200">
                                    {t('UserWithoutEmailHeadlineWithoutSubscription')}
                                  </h1>
                                ) : (
                                  <h1 className='dark:text-gray-200'>{t('UserWithoutEmailHeadlineWithSubscription')}</h1>
                                )}

                                <p className="mt-2 text-sm">{t('UserWithoutEmailDescription')}</p>

                                {!subscription.has_valid_subscription && (
                                  <p className="mt-2 text-sm hover:text-teams_brand_500 hover:underline dark:text-gray-200">
                                    <Link href={'/settings/organisation/upgrade'} className="mt-3 font-semibold dark:text-gray-200">
                                      {t('Upgrade')} --{'>'}
                                    </Link>
                                  </p>
                                )}
                              </div>
                            }
                          </ReactTooltip>
                        </label>

                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            {...register('email', {
                              required: !subscription.has_valid_subscription
                            })}
                            type="email"
                            name="email"
                            id="email"
                            autoComplete="email"
                            className={`block w-full min-w-0 grow rounded-md ${
                              errors.email ? 'border-red-400 ' : 'border-gray-300'
                            }  focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200`}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('department')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          {departments && departments[0] && (
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              defaultValue={[departments[0].id]}
                              name="member_department_ids"
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    menuPortal: (base) => ({
                                      ...base,
                                      zIndex: 9999
                                    }),

                                    control: (base) => ({
                                      ...base,
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  // menuPortalTarget={document.body}
                                  value={value ? departments.find((x) => x.id === value[0]) : undefined}
                                  defaultValue={departments[0]}
                                  onChange={(val) => {
                                    if (val) {
                                      onChange([val.id]);
                                    }
                                  }}
                                  getOptionLabel={(option) => `${option.name}`}
                                  getOptionValue={(option) => option.id}
                                  options={departments}
                                  className="w-full my-react-select-container"
                                  classNamePrefix="my-react-select"
                                />
                              )}
                            />
                          )}
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <label htmlFor="public_holiday_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('Public_holidays')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          {PUBLIC_HOLIDAYS && PUBLIC_HOLIDAYS[0] && (
                            <Controller
                              rules={{ required: true }}
                              control={control}
                              name="public_holiday_id"
                              defaultValue={PUBLIC_HOLIDAYS[0].id}
                              render={({ field: { onChange, value } }) => (
                                <Select
                                  styles={{
                                    menuPortal: (base) => ({
                                      ...base,
                                      zIndex: 9999
                                    }),

                                    control: (base) => ({
                                      ...base,
                                      '*': {
                                        boxShadow: 'none !important'
                                      }
                                    })
                                  }}
                                  // menuPortalTarget={document.body}
                                  value={value ? PUBLIC_HOLIDAYS.find((x) => x.id === value) : undefined}
                                  className="w-full my-react-select-container"
                                  classNamePrefix="my-react-select"
                                  onChange={(val) => {
                                    onChange(val?.id);
                                  }}
                                  getOptionLabel={(option) => `${option.name}`}
                                  getOptionValue={(option) => option.id}
                                  options={PUBLIC_HOLIDAYS}


                                  />
                              )}
                            />
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label htmlFor="employmentStartDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('EmploymentStartDate')}
                          <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          control={control}
                          rules={{ required: true }}
                          name="employment_start_date"
                          render={({ field }) => (
                            <DatePicker
                              renderCustomHeader={(props) => <CustomHeader {...props} />}
                              calendarStartDay={current_member?.week_start ? parseInt(current_member?.week_start) : 0}
                              locale={lang}
                              minDate={pastDate}
                              maxDate={futureDate}
                              dateFormat={current_member?.date_format}
                              className={`block w-full min-w-0 grow rounded-md ${
                                errors.employment_start_date ? 'border-red-400 ' : 'border-gray-300'
                              }   focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100 dark:text-gray-200`}
                              selected={field.value}
                              onChange={(date: Date) => field.onChange(date)}
                            />
                          )}
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <div>
                          <div className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('default_allowances')}</div>
                          {allowanceTypes &&
                            allowanceTypes.length > 0 &&
                            allowanceTypes.map((allowanceType) => {
                              const allowance = defaultAllowances.find(
                                (allowance) => allowance.id === allowanceType.id
                              ) as
                                | {
                                    id: string;
                                    current_year: number;
                                    next_year: number;
                                  }
                                | undefined;
                              return (
                                <div className="mt-4" key={allowanceType.id}>
                                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{allowanceType.name}</span>
                                  <span className="block text-sm text-gray-700 mt-2 dark:text-gray-200">
                                    {t('Annual_allowance_current_year')}
                                  </span>
                                  <div className="mt-1 flex rounded-md shadow-sm dark:text-gray-200 dark:bg-teams_brand_dark_100">
                                    {
                                      <InputPicker
                                        unit={allowanceType.allowance_unit}
                                        value={allowance?.current_year ? allowance.current_year : 0}
                                        onChange={(val) => {
                                          if (typeof val === 'number') {
                                            addOrUpdateAllowance({
                                              id: allowanceType.id,
                                              current_year: val,
                                              next_year: allowance?.next_year || 0
                                            });
                                          }
                                        }}
                                        className ="dark:bg-teams_brand_dark_100 dark:text-gray-200 rounded-md focus:border-teams_brand_500 focus:ring-teams_brand_500"
                                      />
                                    }
                                  </div>
                                  <span className="block text-sm text-gray-700 mt-2 dark:text-gray-200">
                                    {t('Annual_allowance_next_year')}
                                  </span>
                                  <div className="mt-1 flex rounded-md shadow-sm">
                                    {
                                      <InputPicker
                                        unit={allowanceType.allowance_unit}
                                        value={allowance?.next_year ? allowance.next_year : 0}
                                        onChange={(val) => {
                                          if (typeof val === 'number') {
                                            addOrUpdateAllowance({
                                              id: allowanceType.id,
                                              next_year: val,
                                              current_year: allowance?.current_year || 0
                                            });
                                          }
                                        }}
                                       className ="dark:bg-teams_brand_dark_100 dark:text-gray-200 rounded-md focus:border-teams_brand_500 focus:ring-teams_brand_500"
                                      />
                                    }
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end p-4 sm:px-6">
                      <button
                        disabled={loading}
                        onClick={(e) => {
                          e.preventDefault();
                          props.onClose();
                        }}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        disabled={loading}
                        type="submit"
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_300 dark:text-gray-200 dark:ring-0 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                      >
                        {loading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Save')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
