import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Switch } from '@headlessui/react';
import { classNames } from 'lib/classNames';
import { api } from '~/utils/api';

import { notifyAlert, notifyError, notifySuccess } from '~/helper/notify';
import ConfirmModal from '@components/confirmModal';

const Microsoft: NextPage = () => {
  const { t, lang } = useTranslation('settings_organisation');
  const { handleSubmit, control, setValue } = useForm<{
    UserReadAll: boolean;
    CalendarsReadWrite: boolean;
    MailboxSettingsReadWrite: boolean;
    GroupReadWriteAll: boolean;
    AI_Bot_enabled: boolean;
  }>();

  const { in_sharePoint, in_teams } = useAbsentify();
  const { data: workspace, refetch: refetchWorkspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const editWorkspace = api.workspace.edit.useMutation();
  const [loadingSwitch, setLoadingSwitch] = useState({
    CalendarsReadWrite: false,
    MailboxSettingsReadWrite: false,
    UserReadAll: false,
    GroupReadWriteAll: false
  });
  const deleteOutOfOfficeConfigurations = api.request.revoke_out_of_office_note_status.useMutation();
  const utils = api.useContext();
  const onSubmit: SubmitHandler<{ UserReadAll: boolean }> = async () => {};
  const { data: scopes } = api.microsoft_scopes.all.useQuery(undefined, { staleTime: 60000 });
  const [textValue, setTextValue] = useState<string | null>(null);
  const CustomLoading = () => {
    return (
      <div className="">
        <div className="w-full py-3">
          <div className="pt-2 animate-pulse flex space-x-4">
            <div className="flex-1 space-y-1 py-1">
              <div className="grid grid-cols-10 gap-4">
                <div className="h-5 bg-gray-700 rounded col-span-4"></div>
              </div>
              <div className="grid grid-cols-10 gap-4">
                <div className="h-5 bg-gray-700 rounded col-span-9"></div>
                <div className="rounded-full bg-gray-700 h-5 w-10"></div>
              </div>
              <div className="grid grid-cols-10 gap-4">
                <div className="h-5 bg-gray-700 rounded col-span-9"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  useEffect(() => {
    if (!scopes) return;
    if (!workspace) return;
    setValue('AI_Bot_enabled', workspace.ai_bot_enabled);

    if (
      !!scopes.scopes?.find((x: string) => x == 'Calendars.ReadWrite') &&
      workspace.microsoft_calendars_read_write == 'PENDING'
    ) {
      workspace.microsoft_calendars_read_write = 'ACTIVATED';
      editWorkspace.mutateAsync(
        {
          id: workspace.id,
          data: workspace
        },
        {
          async onSuccess() {
            await refetchWorkspace();
          },
          onError(error) {
            notifyError(error.message);
          }
        }
      );
    }
    setValue(
      'CalendarsReadWrite',
      !!scopes.scopes?.find((x: string) => x == 'Calendars.ReadWrite') &&
        workspace.microsoft_calendars_read_write == 'ACTIVATED'
    );

    if (scopes.scopes?.find((x: string) => x == 'User.Read.All') && workspace.microsoft_users_read_all == 'PENDING') {
      workspace.microsoft_users_read_all = 'ACTIVATED';
      editWorkspace.mutateAsync(
        {
          id: workspace.id,
          data: workspace
        },
        {
          async onSuccess() {
            await refetchWorkspace();
          },
          onError(error) {
            notifyError(error.message);
          }
        }
      );
    }
    setValue(
      'UserReadAll',
      !!scopes.scopes?.find((x: string) => x == 'User.Read.All') && workspace.microsoft_users_read_all == 'ACTIVATED'
    );

    if (
      scopes.scopes?.find((x: string) => x == 'MailboxSettings.ReadWrite') &&
      workspace.microsoft_mailboxSettings_read_write == 'PENDING'
    ) {
      workspace.microsoft_mailboxSettings_read_write = 'ACTIVATED';
      editWorkspace.mutateAsync(
        {
          id: workspace.id,
          data: workspace
        },
        {
          async onSuccess() {
            await refetchWorkspace();
          },
          onError(error) {
            notifyError(error.message);
          }
        }
      );
    }
    setValue(
      'MailboxSettingsReadWrite',
      !!scopes.scopes?.find((x: string) => x == 'MailboxSettings.ReadWrite') &&
        workspace.microsoft_mailboxSettings_read_write == 'ACTIVATED'
    );

    if (
      scopes.scopes?.find((x: string) => x == 'Group.ReadWrite.All') &&
      workspace.microsoft_groups_read_write_all == 'PENDING'
    ) {
      workspace.microsoft_groups_read_write_all = 'ACTIVATED';
      editWorkspace.mutateAsync(
        {
          id: workspace.id,
          data: workspace
        },
        {
          async onSuccess() {
            await refetchWorkspace();
          },
          onError(error) {
            notifyError(error.message);
          }
        }
      );
    }

    setValue(
      'GroupReadWriteAll',
      !!scopes.scopes?.find((x: string) => x == 'Group.ReadWrite.All') &&
        workspace.microsoft_groups_read_write_all == 'ACTIVATED'
    );
  }, [setValue, scopes, workspace]);

  const handleRevoke = async () => {
    if (!workspace) return;
    await deleteOutOfOfficeConfigurations.mutateAsync(
      { workspace_id: workspace.id },
      {
        async onSuccess() {},
        onError(error) {
          notifyError(error.message);
        }
      }
    );

    workspace.microsoft_mailboxSettings_read_write = 'REVOKED';
    await editWorkspace.mutateAsync(
      {
        id: workspace.id,
        data: workspace
      },
      {
        async onSuccess() {
          await utils.workspace.current.invalidate();
          let link;
          if (lang == 'de')
            link = 'https://support.absentify.com/de/article/azure-ad-absentify-berechtigung-widerrufen-1crq14';
          else link = 'https://support.absentify.com/en/article/revoke-absentify-azure-ad-consent-1ul530x/';

          if (in_teams || in_sharePoint) {
            window.open(link, '_blank');
          } else {
            location.href = link;
          }
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };
  const handleUserRevoke = async () => {
    if (!workspace) return;
    workspace.microsoft_users_read_all = 'REVOKED';
    await editWorkspace.mutateAsync(
      {
        id: workspace.id,
        data: workspace
      },
      {
        async onSuccess() {
          await utils.workspace.current.invalidate();
          let link;
          if (lang == 'de')
            link = 'https://support.absentify.com/de/article/azure-ad-absentify-berechtigung-widerrufen-1crq14';
          else link = 'https://support.absentify.com/en/article/revoke-absentify-azure-ad-consent-1ul530x/';

          if (in_teams || in_sharePoint) {
            window.open(link, '_blank');
          } else {
            location.href = link;
          }
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };
  const handleGroupRevoke = async () => {
    if (!workspace) return;
    workspace.microsoft_groups_read_write_all = 'REVOKED';
    await editWorkspace.mutateAsync(
      {
        id: workspace.id,
        data: workspace
      },
      {
        async onSuccess() {
          await utils.workspace.current.invalidate();

          let link;
          if (lang == 'de')
            link = 'https://support.absentify.com/de/article/azure-ad-absentify-berechtigung-widerrufen-1crq14';
          else link = 'https://support.absentify.com/en/article/revoke-absentify-azure-ad-consent-1ul530x/';

          if (in_teams || in_sharePoint) {
            window.open(link, '_blank');
          } else {
            location.href = link;
          }
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };
  return (
    <form className="divide-y divide-gray-200 dark:divide-teams_brand_border lg:col-span-10" onSubmit={handleSubmit(onSubmit)}>
      <div className="pt-6 divide-y divide-gray-200 dark:divide-teams_brand_border">
        <div className="px-4 sm:px-6">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Microsoft_Integration')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('Microsoft_Integration_Description')} </p>
          </div>
          <ul role="list" className="mt-2 divide-y divide-gray-200 dark:divide-teams_brand_border">
            {scopes && !loadingSwitch.CalendarsReadWrite ? (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Outlook_calendar_synchronization')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Outlook_calendar_synchronization_description')}
                  </Switch.Description>
                </div>
                <Controller
                  control={control}
                  name="CalendarsReadWrite"
                  render={({ field: { value } }) => (
                    <Switch
                      checked={value}
                      onChange={async (val: boolean) => {
                        if (!workspace) return;
                        setLoadingSwitch({ ...loadingSwitch, CalendarsReadWrite: true });
                        workspace.microsoft_calendars_read_write = val ? 'PENDING' : 'REVOKED';
                        await editWorkspace.mutateAsync(
                          {
                            id: workspace.id,
                            data: workspace
                          },
                          {
                            async onSuccess() {
                              await utils.workspace.current.invalidate();
                              let link =
                                'https://login.microsoftonline.com/common/adminconsent?client_id=' +
                                process.env.NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION +
                                '&redirect_uri=https://app.absentify.com/settings/organisation/microsoft';
                              if (!val) {
                                if (lang == 'de')
                                  link =
                                    'https://support.absentify.com/de/article/azure-ad-absentify-berechtigung-widerrufen-1crq14';
                                else
                                  link =
                                    'https://support.absentify.com/en/article/revoke-absentify-azure-ad-consent-1ul530x/';
                              }

                              if (in_teams || in_sharePoint) {
                                window.open(link, '_blank');
                              } else {
                                location.href = link;
                              }
                            },
                            onError(error) {
                              notifyError(error.message);
                            }
                          }
                        );
                        setLoadingSwitch({ ...loadingSwitch, CalendarsReadWrite: false });
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_tbody dark:ring-white',
                        'inline-flex relative flex-shrink-0 ml-4 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block w-5 h-5 bg-white rounded-full ring-0 shadow transition duration-200 ease-in-out transform'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            ) : (
              <CustomLoading />
            )}
            {scopes && !loadingSwitch.MailboxSettingsReadWrite ? (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Outlook_Mailbox_settings')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Outlook_Mailbox_settings_description')}
                  </Switch.Description>
                </div>

                <Controller
                  control={control}
                  name="MailboxSettingsReadWrite"
                  render={({ field: { value } }) => (
                    <Switch
                      checked={value}
                      onChange={async (val: boolean) => {
                        if (!workspace) return;
                        if (!val) {
                          setTextValue('Outlook_Mailbox_settings_revoke_question');
                        } else if (val) {
                          setLoadingSwitch({ ...loadingSwitch, MailboxSettingsReadWrite: true });
                          workspace.microsoft_mailboxSettings_read_write = 'PENDING';
                          await editWorkspace.mutateAsync(
                            {
                              id: workspace.id,
                              data: workspace
                            },
                            {
                              async onSuccess() {
                                await utils.workspace.current.invalidate();
                                let link =
                                  'https://login.microsoftonline.com/common/adminconsent?client_id=' +
                                  process.env.NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION +
                                  '&redirect_uri=https://app.absentify.com/settings/organisation/microsoft';

                                if (in_teams || in_sharePoint) {
                                  window.open(link, '_blank');
                                } else {
                                  location.href = link;
                                }
                              },
                              onError(error) {
                                notifyError(error.message);
                              }
                            }
                          );
                        }
                        setLoadingSwitch({ ...loadingSwitch, MailboxSettingsReadWrite: false });
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_tbody dark:ring-white',
                        'inline-flex relative flex-shrink-0 ml-4 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block w-5 h-5 bg-white rounded-full ring-0 shadow transition duration-200 ease-in-out transform'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            ) : (
              <CustomLoading />
            )}
            {scopes && !loadingSwitch.UserReadAll ? (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Users_settings')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Users_settings_description')}
                  </Switch.Description>
                </div>

                <Controller
                  control={control}
                  name="UserReadAll"
                  render={({ field: { value } }) => (
                    <Switch
                      checked={value}
                      onChange={async (val: boolean) => {
                        if (!workspace) return;

                        if (!val) {
                          setTextValue('Users_settings_revoke_question');
                        } else if (val) {
                          setLoadingSwitch({ ...loadingSwitch, UserReadAll: true });
                          workspace.microsoft_users_read_all = 'PENDING';
                          await editWorkspace.mutateAsync(
                            {
                              id: workspace.id,
                              data: workspace
                            },
                            {
                              async onSuccess() {
                                await utils.workspace.current.invalidate();
                                let link =
                                  'https://login.microsoftonline.com/common/adminconsent?client_id=' +
                                  process.env.NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION +
                                  '&redirect_uri=https://app.absentify.com/settings/organisation/microsoft';

                                if (in_teams || in_sharePoint) {
                                  window.open(link, '_blank');
                                } else {
                                  location.href = link;
                                }
                              },
                              onError(error) {
                                notifyError(error.message);
                              }
                            }
                          );
                          setLoadingSwitch({ ...loadingSwitch, UserReadAll: false });
                        }
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_tbody dark:ring-white',
                        'inline-flex relative flex-shrink-0 ml-4 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block w-5 h-5 bg-white rounded-full ring-0 shadow transition duration-200 ease-in-out transform'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            ) : (
              <CustomLoading />
            )}
            {scopes && !loadingSwitch.GroupReadWriteAll ? (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('Groups_settings')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('Groups_settings_description')}
                  </Switch.Description>
                </div>

                <Controller
                  control={control}
                  name="GroupReadWriteAll"
                  render={({ field: { value } }) => (
                    <Switch
                      checked={value}
                      onChange={async (val: boolean) => {
                        if (!workspace) return;

                        if (!val) {
                          setTextValue('Groups_settings_revoke_question');
                        } else if (val) {
                          setLoadingSwitch({ ...loadingSwitch, GroupReadWriteAll: true });
                          workspace.microsoft_groups_read_write_all = 'PENDING';
                          await editWorkspace.mutateAsync(
                            {
                              id: workspace.id,
                              data: workspace
                            },
                            {
                              async onSuccess() {
                                await utils.workspace.current.invalidate();
                                let link =
                                  'https://login.microsoftonline.com/common/adminconsent?client_id=' +
                                  process.env.NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION +
                                  '&redirect_uri=https://app.absentify.com/settings/organisation/microsoft';

                                if (in_teams || in_sharePoint) {
                                  window.open(link, '_blank');
                                } else {
                                  location.href = link;
                                }
                              },
                              onError(error) {
                                notifyError(error.message);
                              }
                            }
                          );
                          setLoadingSwitch({ ...loadingSwitch, GroupReadWriteAll: false });
                        }
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_tbody dark:ring-white',
                        'inline-flex relative flex-shrink-0 ml-4 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block w-5 h-5 bg-white rounded-full ring-0 shadow transition duration-200 ease-in-out transform'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            ) : (
              <CustomLoading />
            )}
            {scopes ? (
              <Switch.Group as="li" className="flex justify-between items-center py-4">
                <div className="flex flex-col">
                  <Switch.Label as="p" className="text-sm font-medium text-gray-900 dark:text-gray-200" passive>
                    {t('AI_Bot_enabled_settings')}
                  </Switch.Label>
                  <Switch.Description className="text-sm text-gray-500 dark:text-gray-200">
                    {t('AI_Bot_enabled_settings_description')}
                  </Switch.Description>
                </div>

                <Controller
                  control={control}
                  name="AI_Bot_enabled"
                  render={({ field: { value } }) => (
                    <Switch
                      checked={value}
                      onChange={async (val: boolean) => {
                        if (!workspace) return;
                        workspace.ai_bot_enabled = val;

                        await editWorkspace.mutateAsync(
                          {
                            id: workspace.id,
                            data: workspace
                          },
                          {
                            async onSuccess() {
                              await utils.workspace.current.invalidate();
                              notifySuccess(t('Saved_successfully'));
                            },
                            onError(error) {
                              notifyError(error.message);
                            }
                          }
                        );
                      }}
                      className={classNames(
                        value ? 'bg-teams_brand_500 dark:bg-teams_brand_foreground_bg dark:ring-teams_brand_dark_300' : 'bg-gray-200 dark:bg-teams_brand_tbody dark:ring-white',
                        'inline-flex relative flex-shrink-0 ml-4 w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500 dark:ring-1 dark:ring-offset-0'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={classNames(
                          value ? 'translate-x-5' : 'translate-x-0',
                          'inline-block w-5 h-5 bg-white rounded-full ring-0 shadow transition duration-200 ease-in-out transform'
                        )}
                      />
                    </Switch>
                  )}
                />
              </Switch.Group>
            ) : (
              <CustomLoading />
            )}
          </ul>
        </div>
      </div>
      {textValue && (
        <ConfirmModal
          text={t(textValue)}
          handleCallback={
            textValue === 'Outlook_Mailbox_settings_revoke_question'
              ? handleRevoke
              : textValue === 'Users_settings_revoke_question'
              ? handleUserRevoke
              : textValue === 'Groups_settings_revoke_question'
              ? handleGroupRevoke
              : null
          }
          onClose={() => {
            setTextValue(null);
          }}
        />
      )}
    </form>
  );
};

export default Microsoft;
