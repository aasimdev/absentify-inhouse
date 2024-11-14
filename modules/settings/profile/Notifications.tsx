import type { NextPage } from 'next';
import { useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { api, type RouterOutputs } from '~/utils/api';
import { classNames } from 'lib/classNames';
import useTranslation from 'next-translate/useTranslation';
import { NotificationReceivingMethod, TimeFormat } from '@prisma/client';
import { useAbsentify } from '@components/AbsentifyContext';
import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import Select from 'react-select';

const Email_notifications: NextPage = () => {
  const { t } = useTranslation('settings_profile');
  const { current_member, subscription } = useAbsentify();
  const { data: member, refetch: refetchUser } = api.member.current.useQuery(undefined, { staleTime: 60000 });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const editProfile = api.member.editProfile.useMutation();
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors }
  } = useForm<RouterOutputs['member']['current']>();

  const NotificationsReceivingMethods: { label: string; value: string }[] = [
    { label: t('Teams'), value: NotificationReceivingMethod.TeamsBot },
    { label: t('EmailAndTeams'), value: NotificationReceivingMethod.EmailAndTeamsBot }
  ];

  const onSubmit: SubmitHandler<RouterOutputs['member']['current']> = async (data) => {
    await editProfile.mutateAsync(
      {
        id: data.id,
        data: {
          email_notif_bday_anniv_remind: data.email_notif_bday_anniv_remind,
          email_notif_weekly_absence_summary: data.email_notif_weekly_absence_summary,
          email_notifications_updates: data.email_notifications_updates,
          email_ical_notifications: data.email_ical_notifications,
          language: data.language,
          date_format: data.date_format ? data.date_format : 'MM/dd/yyyy',
          time_format: data.time_format ? data.time_format : TimeFormat.H24,
          week_start: data.week_start ? data.week_start : '0',
          timezone: data.timezone ? data.timezone : 'Europe/Amsterdam',
          display_calendar_weeks: data.display_calendar_weeks,
          notifications_receiving_method: data.notifications_receiving_method
        }
      },
      {
        async onSuccess() {
          await refetchUser();
          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  useEffect(() => {
    if (member) {
      for (let index = 0; index < Object.keys(member).length; index++) {
        const element = Object.keys(member)[index];
        //@ts-ignore
        setValue(element, member[element]);
      }
    }
  }, [member]);

  return (
    <form className="divide-y divide-gray-200 lg:col-span-9" onSubmit={handleSubmit(onSubmit)}>
      {/* Email notifications section */}

      <div className="divide-y divide-gray-200 dark:divide-teams_brand_border pt-6">
        <div className="px-4 sm:px-6">
          <div className="mb-6">
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200"> {t('notifications')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">
              {/*  Ornare eu a volutpat eget vulputate. Fringilla commodo amet. */}
            </p>
          </div>
          <div className="border-b border-gray-900/10 pb-12">
            {workspace && current_member && workspace.microsoft_calendars_read_write !== 'ACTIVATED' && (
              <Switch.Group as="li" className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Calendar_invitations')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    <p>{t('Calendar_invitations_description')}</p>
                    {current_member.is_admin && (
                      <p>
                        <span className="font-medium text-gray-900 dark:text-gray-200">
                          💡{t('Calendar_invitations_description_admin_tip')}:{' '}
                        </span>{' '}
                        {t('Calendar_invitations_description_admin')}
                      </p>
                    )}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="email_ical_notifications"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      checked={value ? value : false}
                      onChange={(val: boolean) => {
                        onChange(val);
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            )}
            <label htmlFor="notifications_receiving_method" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('Notificaions_receving_method')}
            </label>
            <p className="text-sm text-gray-500 mb-2 dark:text-gray-200">{t('Notificaions_receving_method_desc')}</p>
            <Controller
              rules={{ required: true }}
              control={control}
              name="notifications_receiving_method"
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
                  value={value ? NotificationsReceivingMethods.find((x) => x.value === value) : undefined}
                  className="w-full my-react-select-container"
                  classNamePrefix="my-react-select"
                  onChange={(val) => {
                    onChange(val?.value);
                  }}
                  options={NotificationsReceivingMethods}
                />
              )}
            />
            {errors.notifications_receiving_method && <span>{t('This_field_is_required')}</span>}
          </div>
          <ul role="list" className="mt-2 divide-y divide-gray-200 dark:divide-teams_brand_border">
            <Switch.Group as="li" className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                  absentify {' ' + t('updates')}
                </Switch.Label>
                <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">{t('absentify_desc')}</Switch.Description>
              </div>
              <Controller
                control={control}
                name="email_notifications_updates"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    checked={value ? value : false}
                    onChange={(val: boolean) => {
                      onChange(val);
                    }}
                    className={classNames(
                      value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                      'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={classNames(
                        value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                )}
              />
            </Switch.Group>
            {!subscription.business &&
              subscription.business_by_user == 0 &&
              subscription.enterprise == 0 &&
              (current_member?.is_admin ?? false) && (
                <Switch.Group as="li" className="flex justify-between items-center py-4">
                  <div className="flex flex-col">
                    <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                      {t('Birthday_and_anniversary_reminders')}
                    </Switch.Label>
                    <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                      {t('Birthday_and_anniversary_reminders_description')}
                    </Switch.Description>
                  </div>
                  <Controller
                    control={control}
                    name="email_notif_bday_anniv_remind"
                    render={({ field: { value } }) => (
                      <Switch
                        checked={value}
                        onChange={() => {
                          notifyError(t('This_feature_is_not_available_for_your_plan_birthday_anniversary'));
                        }}
                        className={classNames(
                          value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                          'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={classNames(
                            value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                            'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                          )}
                        />
                      </Switch>
                    )}
                  />
                </Switch.Group>
              )}
            {(subscription.business || subscription.business_by_user > 0 || subscription.enterprise > 0) && (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Birthday_and_anniversary_reminders')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Birthday_and_anniversary_reminders_description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="email_notif_bday_anniv_remind"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      checked={value}
                      onChange={(val: boolean) => {
                        onChange(val);
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            )}

            {!subscription.business &&
              subscription.business_by_user == 0 &&
              subscription.enterprise == 0 &&
              (current_member?.is_admin ?? false) && (
                <Switch.Group as="li" className="flex justify-between items-center py-4">
                  <div className="flex flex-col">
                    <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                      {t('Weekly_absence_summary')}
                    </Switch.Label>
                    <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                      {t('Weekly_absence_summary_description')}
                    </Switch.Description>
                  </div>
                  <Controller
                    control={control}
                    name="email_notif_weekly_absence_summary"
                    render={({ field: { value } }) => (
                      <Switch
                        checked={false}
                        onChange={() => {
                          notifyError(t('This_feature_is_not_available_for_your_plan_weekly_absence_summary'));
                        }}
                        className={classNames(
                          value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                          'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={classNames(
                            value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                            'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                          )}
                        />
                      </Switch>
                    )}
                  />
                </Switch.Group>
              )}
            {(subscription.business || subscription.business_by_user > 0 || subscription.enterprise > 0) && (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Weekly_absence_summary')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Weekly_absence_summary_description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="email_notif_weekly_absence_summary"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      checked={value}
                      onChange={(val: boolean) => {
                        onChange(val);
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_dark_550 dark:ring-teams_brand_border' : 'bg-gray-200 dark:bg-teams_dark_mode dark:ring-teams_brand_border',
                        'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5 dark:bg-teams_dark_mode' : 'translate-x-0 dark:bg-teams_brand_gray',
                          'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            )}
          </ul>
        </div>
        <div className="mt-4 flex justify-end px-4 py-4 sm:px-6">
          <button
            type="submit"
            className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_foreground_bg dark:text-gray-200 dark:ring-0"
          >
            {editProfile.isLoading && (
              <div className="-ml-1 mr-3">
                <Loader />
              </div>
            )}
            {t('Save')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default Email_notifications;
