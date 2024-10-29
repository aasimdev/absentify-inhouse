import { api, type RouterOutputs } from '~/utils/api';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useMemo, useState } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { notifySuccess, notifyError } from '~/helper/notify';
import { AllowanceUnit } from '@prisma/client';
import { formatDuration } from '~/helper/formatDuration';
import ConfirmModal from '@components/confirmModal';
import Loader from '@components/calendar/Loader';
import { cloneDeep, orderBy } from 'lodash';
import { InputPicker } from '@components/duration-select/duration-select';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { Switch } from '@headlessui/react';
import { classNames } from '~/lib/classNames';
import { Translate } from 'next-translate';
import { useDarkSide } from '@components/ThemeContext';

export default function Allowance(props: { onClose: Function; currentMember: defaultMemberSelectOutput }) {
  const [theme] = useDarkSide();
  const { t, lang } = useTranslation('allowance');
  const {
    data: userAllowance,
    refetch: refetchMemberAllowance,
    isLoading
  } = api.member_allowance.byMember.useQuery(
    { member_id: props.currentMember.id },
    {
      staleTime: 60000
    }
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const utils = api.useContext();
  const editMemberAllowance = api.member_allowance.edit.useMutation();
  const [editMode, setEditMode] = useState<RouterOutputs['member_allowance']['byMember'][0] | null>(null);

  const { data: allowanceTypes } = api.allowance.allTypes.useQuery(undefined, {
    staleTime: 60000
  });

  const { data: memberData } = api.member.all.useQuery(
    { filter: { ids: [props.currentMember.id] }, limit: 1, page: 1 },
    {
      staleTime: 60000
    }
  );
  const member = useMemo(() => {
    return memberData?.members[0] || null;
  }, [memberData?.members]);

  const allowanceRounded = (
    allowance: RouterOutputs['member_allowance']['byMember'][0],
    value: keyof RouterOutputs['member_allowance']['byMember'][0],
    editModeBoolean = false
  ) => {
    if (editModeBoolean) {
      const allowanceConst = editMode?.id == allowance.id && (editMode[value] as number);

      return allowanceConst && formatDuration(allowanceConst, lang, allowance.allowance_type.allowance_unit, false, t);
    }
    const allowanceConst = editMode?.id != allowance.id && (allowance[value] as number);
    return allowanceConst && formatDuration(allowanceConst, lang, allowance.allowance_type.allowance_unit, false, t);
  };
  if (!member) return <></>;
  if (!allowanceTypes) return <></>;
  return (
    <div className="divide-y divide-gray-200 lg:col-span-9 dark:bg-teams_brand_dark_100 dark:divide-gray-500">
      <div className="py-6 px-4 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Allowance')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200"></p>
        </div>
        {userAllowance && (
          <div>
            {orderBy(member.allowance_type_configurtaions, 'default', 'desc').map((config) => {
              const allowanceType = allowanceTypes.find((x) => x.id === config.allowance_type_id);
              const filteredAllowance = userAllowance.filter(
                (allowance) => allowance.allowance_type_id === config.allowance_type_id
              );
              const allowancePart = (allowance: RouterOutputs['member_allowance']['byMember'][0]) => {
                const broughtForward =
                  (editMode?.id != allowance.id ||
                    (editMode?.id == allowance.id &&
                      filteredAllowance[0] &&
                      filteredAllowance[0].id !== allowance.id)) &&
                  allowance.brought_forward;
                return (
                  broughtForward &&
                  formatDuration(broughtForward, lang, allowance.allowance_type.allowance_unit, false, t)
                );
              };
              if (!config) return null;
              if (!allowanceType) return null;

              return (
                <div key={allowanceType.id} className="p-2 mt-2 shadow rounded-lg dark:text-gray-200">
                  <AllowanceTypeHeadline
                    allowance_type_config={config}
                    allowance_type={allowanceType}
                    currentMember={member}
                    t={t}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-200"></p>
                  {filteredAllowance.length > 0 && (
                    <div
                      key={allowanceType.id}
                      className="mt-6 flex flex-col lg:flex-row overflow-hidden border-b border-gray-200 shadow sm:rounded-lg dark:border-gray-500"
                    >
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500 dark:bg-teams_brand_dark_100 ">
                        <thead className="bg-gray-50 dark:bg-teams_brand_dark_100">
                          <tr>
                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200 "
                            >
                              {t('Year')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200 "
                            >
                              <p
                                className="w-6 truncate md:w-16 dark:text-gray-200"
                                data-tooltip-id="allowance-tooltip"
                                data-tooltip-content={t('Brought_forward')}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              >
                                {t('Brought_forward')}
                              </p>
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200 "
                            >
                              <p
                                className="w-6 truncate md:w-16 dark:text-gray-200"
                                data-tooltip-id="allowance-tooltip"
                                data-tooltip-content={t('Allowance')}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              >
                                {t('Allowance')}
                              </p>
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200 "
                            >
                              <p
                                className="w-6 truncate md:w-16 dark:text-gray-200"
                                data-tooltip-id="allowance-tooltip"
                                data-tooltip-content={t('compensatory_time_off')}
                                data-tooltip-variant="light"
                              >
                                {t('compensatory_time_off')}
                              </p>
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                            >
                              <p
                                className="w-6 truncate md:w-16 dark:text-gray-200"
                                data-tooltip-id="allowance-tooltip"
                                data-tooltip-content={t('Taken')}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              >
                                {t('Taken')}
                              </p>
                            </th>

                            <th
                              scope="col"
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200 "
                            >
                              <p
                                className="w-6 truncate md:w-16 dark:text-gray-200"
                                data-tooltip-id="allowance-tooltip"
                                data-tooltip-content={t('Remaining')}
                                data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                              >
                                {t('Remaining')}
                              </p>
                            </th>

                            <th scope="col" className="relative px-3 py-3 "></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                          {filteredAllowance.map((allowance) =>
                            editMode?.id == allowance.id ? (
                              <tr key={allowance.id} className='dark:bg-teams_brand_dark_100'>
                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-200">
                                  {allowance.start.getUTCFullYear() != allowance.end.getUTCFullYear() && (
                                    <p className='dark:text-gray-200'>{allowance.start.getUTCFullYear() + '-' + allowance.end.getUTCFullYear()} </p>
                                  )}
                                  {allowance.start.getUTCFullYear() == allowance.end.getUTCFullYear() &&
                                    allowance.start.getUTCFullYear()}
                                </td>

                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500" colSpan={4}>
                                  <div className="divide-y divide-gray-200">
                                    <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                                      <div className="sm:col-span-5">
                                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                          {t('Brought_forward')}
                                        </label>
                                        <div className="relative mt-1 ">
                                          {filteredAllowance[0] && filteredAllowance[0].id == allowance.id && (
                                            <InputPicker
                                              unit={allowance.allowance_type.allowance_unit}
                                              value={editMode.brought_forward}
                                              onChange={(x) => {
                                                const y = cloneDeep(editMode);
                                                y.brought_forward = x;
                                                y.remaining =
                                                  y.allowance + y.brought_forward + y.compensatory_time_off - y.taken;
                                                setEditMode(y);
                                              }}
                                                className ="dark:text-gray-200 dark:bg-teams_brand_dark_100 w-full"
                                            />
                                          )}
                                          {filteredAllowance[0] &&
                                            filteredAllowance[0].id != allowance.id &&
                                            (allowance.overwrite_brought_forward ||
                                              editMode.overwrite_brought_forward) && (
                                              <div
                                                className="relative mt-2"
                                                data-tooltip-id="allowance-tooltip"
                                                data-tooltip-content={t('Brought_forward_overwritten')}
                                                data-tooltip-variant="error"
                                              >
                                                <InputPicker
                                                  unit={allowance.allowance_type.allowance_unit}
                                                  value={editMode.brought_forward}
                                                  className="block w-full rounded-md border-0 py-1.5 pr-7 text-red-900 ring-1 ring-inset ring-red-300 placeholder:text-red-300 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:text-gray-200 dark:bg-teams_brand_dark_100"
                                                  onChange={(x) => {
                                                    const y = cloneDeep(editMode);
                                                    y.brought_forward = x;
                                                    y.remaining =
                                                      y.allowance +
                                                      y.brought_forward +
                                                      y.compensatory_time_off -
                                                      y.taken;
                                                    setEditMode(y);
                                                  }}
                                                />

                                                <div className="pointer-events-none absolute inset-y-0 -right-5 flex items-center ">
                                                  <ExclamationCircleIcon
                                                    className="h-5 w-5 text-red-500"
                                                    aria-hidden="true"
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          {filteredAllowance[0] &&
                                            filteredAllowance[0].id != allowance.id &&
                                            !allowance.overwrite_brought_forward &&
                                            !editMode.overwrite_brought_forward && (
                                              <span className="flex dark:text-gray-800">
                                                {allowancePart(allowance)}{' '}
                                                <a
                                                  onClick={async (e) => {
                                                    e.preventDefault();
                                                    setShowConfirmModal(true);
                                                  }}
                                                  className="cursor-pointer text-gray-300 hover:text-gray-900 ml-2 dark:text-gray-200"
                                                >
                                                  {/* edit icon */}
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-5 w-5 dark:text-gray-200"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                  >
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                  </svg>
                                                </a>
                                              </span>
                                            )}
                                        </div>
                                      </div>
                                      <div className="sm:col-span-5">
                                        <label htmlFor="allowance" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                          {t('Allowance')}
                                        </label>
                                        <div className="relative mt-1 ">
                                          <InputPicker
                                            unit={allowance.allowance_type.allowance_unit}
                                            value={editMode.allowance}
                                            onChange={(x) => {
                                              const y = cloneDeep(editMode);
                                              y.allowance = x;
                                              y.remaining =
                                                y.allowance + y.brought_forward + y.compensatory_time_off - y.taken;
                                              setEditMode(y);
                                            }}
                                            className="dark:text-gray-200 dark:bg-teams_brand_dark_100 w-full"
                                          />
                                        </div>
                                      </div>
                                      <div className="sm:col-span-5">
                                        <label htmlFor="compensatory-time-off" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                          {t('compensatory_time_off')}
                                        </label>
                                        <div className="relative mt-1 ">
                                          <InputPicker
                                            unit={allowance.allowance_type.allowance_unit}
                                            value={editMode.compensatory_time_off}
                                            onChange={(x) => {
                                              const y = cloneDeep(editMode);
                                              y.compensatory_time_off = x;
                                              y.remaining =
                                                y.allowance + y.brought_forward + y.compensatory_time_off - y.taken;
                                              setEditMode(y);
                                            }}
                                            
                                            className ="dark:text-gray-200 dark:bg-teams_brand_dark_100 w-full"
                                          />
                                        </div>
                                      </div>
                                      <div className="sm:col-span-5">
                                        <label htmlFor="taken" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                          {t('Taken')}
                                        </label>
                                        <div className="relative mt-1 ">
                                          {allowanceRounded(allowance, 'taken', true)}
                                        </div>
                                      </div>
                                      <div className="sm:col-span-5">
                                        <label htmlFor="remaining" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                          {t('Remaining')}
                                        </label>

                                        <div className="relative mt-1 ">
                                        {allowanceRounded(allowance, 'remaining', true).toString() == 'NaN'
                                            ? '0'
                                            : allowanceRounded(allowance, 'remaining', true)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-4 flex justify-end px-4 py-4 sm:px-6">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setEditMode(null);
                                        }}
                                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
                                      >
                                        {t('Cancel')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          setLoading(true);
                                          e.preventDefault();
                                          await editMemberAllowance.mutateAsync(
                                            { id: editMode.id, data: editMode },
                                            {
                                              async onSuccess() {
                                                await refetchMemberAllowance();
                                                utils.member.all.invalidate();
                                                setLoading(false);
                                                notifySuccess(t('Saved_successfully'));
                                              },
                                              onError(error) {
                                                notifyError(error.message);
                                                setLoading(false);
                                              }
                                            }
                                          );
                                          setEditMode(null);
                                        }}
                                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
                                      >
                                        {loading && (
                                          <div className="-ml-1 mr-3">
                                            <Loader />
                                          </div>
                                        )}

                                        {t('Save')}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr key={allowance.id}>
                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-200">
                                  {allowance.start.getUTCFullYear() != allowance.end.getUTCFullYear() && (
                                    <p>{allowance.start.getUTCFullYear() + '-' + allowance.end.getUTCFullYear()} </p>
                                  )}
                                  {allowance.start.getUTCFullYear() == allowance.end.getUTCFullYear() &&
                                    allowance.start.getUTCFullYear()}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-200">
                                  <span className="flex">
                                    {allowancePart(allowance)}
                                    {allowance.overwrite_brought_forward && (
                                      <div
                                        className="flex items-center ml-3"
                                        data-tooltip-id="allowance-tooltip"
                                        data-tooltip-content={t('Brought_forward_overwritten')}
                                        data-tooltip-variant="error"
                                      >
                                        <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                                      </div>
                                    )}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[100px] overflow-hidden dark:text-gray-200 overflow-ellipsis">
                                  {allowanceRounded(allowance, 'allowance')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[100px] overflow-hidden dark:text-gray-200 overflow-ellipsis">
                                  {allowanceRounded(allowance, 'compensatory_time_off')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[100px] overflow-hidden dark:text-gray-200 overflow-ellipsis">
                                  {allowanceRounded(allowance, 'taken')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[100px] overflow-hidden  dark:text-gray-200 overflow-ellipsis">
                                  {allowanceRounded(allowance, 'remaining')}
                                </td>
                                {editMode?.id !== allowance.id && !isLoading && (
                                  <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-medium flex-shrink-0 w-12 dark:text-gray-200">
                                    <a
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        setEditMode(allowance);
                                      }}
                                      className="cursor-pointer text-gray-300 hover:text-gray-200"
                                    >
                                      {/* edit icon */}
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5 dark:text-gray-200"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                      </svg>
                                    </a>
                                  </td>
                                )}
                              </tr>
                            )
                          )}
                        </tbody>
                        <ReactTooltip
                          id="allowance-tooltip"
                          className="shadow-sm z-50 dark:text-gray-200 dark:bg-teams_dark_mode_core"
                          classNameArrow="shadow-sm "
                          place="top"
                          style={{
                            boxShadow: '0 0 10px rgba(0,0,0,.1)'
                          }}
                        />
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end py-4 px-4 sm:px-6">
        <button
          disabled={false}
          onClick={(e) => {
            e.preventDefault();
            props.onClose(false);
            utils.member.all.invalidate();
          }}
          type="button"
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
        >
          {t('Cancel')}
        </button>
      </div>
      {showConfirmModal && (
        <ConfirmModal
          text={
            <div className="text-left dark:bg-teams_brand_dark_100">
              <h1 className="underline dark:text-gray-200">{t('ManualCarryoverDialog_Title')}</h1>
              <p className="mt-2 dark:text-gray-200">{t('ManualCarryoverDialog_Intro')}</p>
              <ol className="mt-2">
                <li className="dark:text-gray-200">
                  <strong>{t('ManualCarryoverDialog_OverrideSetting')}:</strong>{' '}
                  {t('ManualCarryoverDialog_OverrideSettingDesc')}
                </li>
                <li className="dark:text-gray-200">
                  <strong>{t('ManualCarryoverDialog_SettingCarryover')}:</strong>{' '}
                  {t('ManualCarryoverDialog_SettingCarryoverDesc')}
                </li>
                <li className="dark:text-gray-200">
                  <strong>{t('ManualCarryoverDialog_NoAutomaticAdjustment')}:</strong>{' '}
                  {t('ManualCarryoverDialog_NoAutomaticAdjustmentDesc')}
                </li>
              </ol>
              <p className="mt-2 dark:text-gray-200">{t('ManualCarryoverDialog_Confirmation')}</p>
            </div>
          }
          handleCallback={() => {
            if (!editMode) return;
            const y = cloneDeep(editMode);
            y.overwrite_brought_forward = true;
            setEditMode(y);
          }}
          onClose={() => {
            setShowConfirmModal(false);
          }}
        />
      )}
    </div>
  );
}

const AllowanceTypeHeadline = (props: {
  allowance_type_config: { allowance_type_id: string; disabled: boolean; default: boolean };
  allowance_type: { id: string; name: string; allowance_unit: AllowanceUnit };
  currentMember: defaultMemberSelectOutput;
  t: Translate;
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const { refetch: refetchMemberAllowance } = api.member_allowance.byMember.useQuery(
    { member_id: props.currentMember.id },
    {
      staleTime: 60000
    }
  );

  const { refetch: refetchMember } = api.member.all.useQuery(
    { filter: { ids: [props.currentMember.id] }, limit: 1, page: 1 },
    {
      staleTime: 60000
    }
  );

  const utils = api.useContext();
  const editMemberAllowanceConfiguration = api.member_allowance.editMemberAllowanceConfiguration.useMutation();

  return (
    <div className="flex justify-between items-center mt-4">
      <h2 className="text-lg font-medium leading-6 text-gray-900 mt-4 lg:mt-0 dark:text-gray-200">
        {props.allowance_type.name} ({props.allowance_type.allowance_unit == 'days' && props.t('Days')}
        {props.allowance_type.allowance_unit == 'hours' && props.t('Hours')})
      </h2>
      <div className="flex flex-col justify-end items-end mt-4 sm:mt-0">
        {isLoading && <Loader />}

        {!isLoading && (
          <>
            <Switch.Group as="div" className="flex items-center">
              <Switch.Label as="span" className="mr-3 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-200">{props.t('Default')}:</span>
              </Switch.Label>
              <Switch
                checked={props.allowance_type_config.default}
                onChange={async () => {
                  setIsLoading(true);
                  await editMemberAllowanceConfiguration.mutateAsync(
                    {
                      member_id: props.currentMember.id,
                      allowance_type_id: props.allowance_type_config.allowance_type_id,
                      data: {
                        disabled: props.allowance_type_config.disabled,
                        default: !props.allowance_type_config.default
                      }
                    },
                    {
                      async onSuccess() {
                        notifySuccess(props.t('Saved_successfully'));
                        await refetchMember();
                        await refetchMemberAllowance();

                        utils.member.all.invalidate();
                        setIsLoading(false);
                      },
                      async onError(error) {
                        notifyError(error.message);
                        await refetchMember();
                        await refetchMemberAllowance();

                        utils.member.all.invalidate();
                        setIsLoading(false);
                      }
                    }
                  );
                }}
                className={classNames(
                  props.allowance_type_config.default ? 'bg-teams_brand_600 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand-600 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                )}
              >
                <span
                  className={classNames(
                    props.allowance_type_config.default ? 'translate-x-5' : 'translate-x-0',
                    'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                  )}
                >
                  <span
                    className={classNames(
                      props.allowance_type_config.default
                        ? 'opacity-0 duration-100 ease-out'
                        : 'opacity-100 duration-200 ease-in',
                      'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                    )}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className={classNames(
                      props.allowance_type_config.default
                        ? 'opacity-100 duration-200 ease-in'
                        : 'opacity-0 duration-100 ease-out',
                      'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                    )}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-teams_brand-600" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                    </svg>
                  </span>
                </span>
              </Switch>
            </Switch.Group>
            <Switch.Group as="div" className="flex items-center mt-2">
              <Switch.Label as="span" className="mr-3 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-200">{props.t('Visible')}: </span>
              </Switch.Label>
              <Switch
                checked={!props.allowance_type_config.disabled}
                onChange={async () => {
                  setIsLoading(true);
                  await editMemberAllowanceConfiguration.mutateAsync(
                    {
                      member_id: props.currentMember.id,
                      allowance_type_id: props.allowance_type_config.allowance_type_id,
                      data: {
                        disabled: !props.allowance_type_config.disabled,
                        default: props.allowance_type_config.default
                      }
                    },
                    {
                      async onSuccess() {
                        notifySuccess(props.t('Saved_successfully'));
                        await refetchMember();
                        await refetchMemberAllowance();

                        utils.member.all.invalidate();
                        setIsLoading(false);
                      },
                      async onError(error) {
                        notifyError(error.message);
                        await refetchMember();
                        await refetchMemberAllowance();

                        utils.member.all.invalidate();
                        setIsLoading(false);
                      }
                    }
                  );
                }}
                className={classNames(
                  !props.allowance_type_config.disabled ? 'bg-teams_brand_600 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_dark_100 dark:ring-white',
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand-600 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                )}
              >
                <span
                  className={classNames(
                    !props.allowance_type_config.disabled ? 'translate-x-5' : 'translate-x-0',
                    'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                  )}
                >
                  <span
                    className={classNames(
                      !props.allowance_type_config.disabled
                        ? 'opacity-0 duration-100 ease-out'
                        : 'opacity-100 duration-200 ease-in',
                      'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                    )}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className={classNames(
                      !props.allowance_type_config.disabled
                        ? 'opacity-100 duration-200 ease-in'
                        : 'opacity-0 duration-100 ease-out',
                      'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                    )}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-teams_brand-600" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                    </svg>
                  </span>
                </span>
              </Switch>
            </Switch.Group>
          </>
        )}
      </div>
    </div>
  );
};
