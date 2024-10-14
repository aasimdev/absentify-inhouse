import type { NextPage } from 'next';
import { useEffect, useRef, useState } from 'react';
import useTranslation from 'next-translate/useTranslation';
import { classNames } from 'lib/classNames';
import { api, type RouterOutputs } from '~/utils/api';
import { CheckIcon, ChevronUpDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAbsentify } from '@components/AbsentifyContext';
import { Combobox, Switch } from '@headlessui/react';
import { Icon } from '@components/Icon';
import { type LeaveType, MailboxAutomaticRepliesSettingExternalAudience } from '@prisma/client';
import 'quill/dist/quill.snow.css';

import { notifySuccess, notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';
import ConfirmModal from '@components/confirmModal';
const ReactQuill = typeof window === 'object' ? require('react-quill') : () => false;

const AutomaticReplies: NextPage = () => {
  const { t } = useTranslation('settings_profile');

  const { current_member } = useAbsentify();
  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: member_mailbox_settings, refetch: refetch_member_mailbox_settings } =
    api.member_mailbox_settings.all.useQuery(undefined, {
      staleTime: 60000
    });
  const editMailboxSetting = api.member_mailbox_settings.edit.useMutation();
  const addMailboxSetting = api.member_mailbox_settings.add.useMutation();
  const deleteMailboxSetting = api.member_mailbox_settings.delete.useMutation();
  const sendTestMailMailboxSetting = api.member_mailbox_settings.sendtestmail.useMutation();
  const [outOfOfficeExternalMessage, setOutOfOfficeExternalMessage] = useState<string>('');
  const [outOfOfficeInternalMessage, setOutOfOfficeInternalMessage] = useState<string>('');
  const [valueForDelete, setValueForDelete] = useState<boolean>(false);
  const variables = [
    { value: '{{startDate}}', name: t('Startdate') },
    { value: '{{startTime}}', name: t('Starttime') },
    { value: '{{dateOfReturn}}', name: t('DateOfReturn') },
    { value: '{{timeOfReturn}}', name: t('TimeOfReturn') },
    { value: '{{approverName}}', name: t('ApproverName') },
    { value: '{{approverMail}}', name: t('ApproverEmail') },
    { value: '{{name}}', name: t('FullName') }
  ];
  const [query, setQuery] = useState('');
  const [checkedExternal, setCheckedExternal] = useState(false);
  const [checkedOnlyContacts, setCheckedOnlyContacts] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<RouterOutputs['leave_type']['all'][0] | null>();
  const [selectedMailboxSetting, setSelectedMailboxSetting] = useState<
    RouterOutputs['member_mailbox_settings']['all'][0] | null
  >();
  const outOfOfficeExternalMessageRef = useRef(null);
  const outOfOfficeInternalMessageRef = useRef(null);

  const modules = {
    toolbar: [['bold', 'italic', 'underline', 'strike']]
  };
  function replaceNamePlaecholder(
    text: string,
    current_member: { firstName: string | null; lastName: string | null; name: string | null }
  ) {
    let firstName = current_member.firstName || '';
    let lastName = current_member.lastName || '';

    if (!firstName && current_member.name) {
      firstName = current_member.name;
    }

    return text.replaceAll('{{firstName}}', firstName).replaceAll('{{lastName}}', lastName);
  }
  const save = async () => {
    if (!selectedMailboxSetting) return;

    selectedMailboxSetting.internalReplyMessage = outOfOfficeInternalMessage.replaceAll('<p><br></p>', '');
    selectedMailboxSetting.externalReplyMessage = outOfOfficeExternalMessage.replaceAll('<p><br></p>', '');
    if (!checkedExternal) {
      selectedMailboxSetting.externalAudience = 'none';
    } else {
      if (checkedOnlyContacts) {
        selectedMailboxSetting.externalAudience = 'contactsOnly';
      } else {
        selectedMailboxSetting.externalAudience = 'all';
      }
    }

    await editMailboxSetting.mutateAsync(
      { id: selectedMailboxSetting.id, data: selectedMailboxSetting },
      {
        async onSuccess() {
          await refetch_member_mailbox_settings();

          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  const placeholder = '';

  const formats = ['bold', 'italic', 'underline', 'strike'];

  const filteredPeople =
    query === ''
      ? leave_types
      : leave_types?.filter((leave_type) => {
          return leave_type.name.toLowerCase().includes(query.toLowerCase());
        });

  useEffect(() => {
    if (!leave_types) {
      return;
    }
    if (!selectedLeaveType && leave_types[0] != null) setSelectedLeaveType(leave_types[0]);
  }, [leave_types]);

  useEffect(() => {
    if (!member_mailbox_settings) return;
    if (!selectedLeaveType) return;
    if (!current_member) return;

    const selected = member_mailbox_settings.find((x) => x.leave_type_id == selectedLeaveType.id);
    setSelectedMailboxSetting(selected);

    if (selected) {
      setCheckedExternal(selected.externalAudience != 'none');
      setCheckedOnlyContacts(selected.externalAudience == 'contactsOnly');
      setOutOfOfficeExternalMessage(selected.externalReplyMessage);
      setOutOfOfficeInternalMessage(selected.internalReplyMessage);
    } else {
      setOutOfOfficeExternalMessage(replaceNamePlaecholder(t('outOfOfficeExternalMessagePlaceholder'), current_member));
      setOutOfOfficeInternalMessage(replaceNamePlaecholder(t('outOfOfficeInternalMessagePlaceholder'), current_member));
    }
  }, [selectedLeaveType, member_mailbox_settings, current_member]);

  const handleDelete = async () => {
    if (!selectedMailboxSetting) return;
    await deleteMailboxSetting.mutateAsync(
      { id: selectedMailboxSetting.id },
      {
        async onSuccess() {
          await refetch_member_mailbox_settings();
          notifySuccess(t('Deleted_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  return (
    <form className="divide-y divide-gray-200 lg:col-span-9">
      <div className="divide-y divide-gray-200 pt-6">
        <div className="px-4 sm:px-6">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900">{t('Microsoft_AutomaticReplies')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('Microsoft_AutomaticReplies_Description')} </p>
            <p className="mt-1 text-sm text-gray-500">
              {t('Microsoft_AutomaticReplies_Description_2') + ' '}
              <a
                className="cursor-pointer underline"
                href="https://feedback.absentify.com/roadmap/create-automatic-out-of-office-replies-in-outlook"
                target="_blank"
              >
                {t('Microsoft_AutomaticReplies_Description_Link')}
              </a>
              {' 😊'}
            </p>
          </div>
          <div className="px-4 sm:px-6 md:px-0">
            <hr className="mt-10 mb-5" />
            <div className="mt-10">
              <div className="flex w-full bg-gray-50 px-4 py-4 sm:px-6">
                <div className="my-auto w-1/2">{t('LeaveTypeTemplate')}</div>
                <div className="w-1/2">
                  <Combobox as="div" value={selectedLeaveType} onChange={setSelectedLeaveType}>
                    <div className="relative mt-1">
                      <Combobox.Input
                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 shadow-sm focus:border-teams_brand_background_2 focus:outline-none focus:ring-1 focus:ring-teams_brand_foreground_bg sm:text-sm"
                        onChange={(event) => setQuery(event.target.value)}
                        displayValue={(person: any) => person?.name}
                      />
                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </Combobox.Button>

                      {filteredPeople && filteredPeople.length > 0 && (
                        <Combobox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {filteredPeople.map((person) => (
                            <Combobox.Option
                              key={person.id}
                              value={person}
                              className={({ active }) =>
                                classNames(
                                  'relative cursor-default select-none py-2 pl-3 pr-9',
                                  active ? 'bg-teams_brand_foreground_bg text-white' : 'text-gray-900'
                                )
                              }
                            >
                              {({ active, selected }) => (
                                <>
                                  <LeaveIcon leaveType={person} selected={selected} />

                                  {selected && (
                                    <span
                                      className={classNames(
                                        'absolute inset-y-0 right-0 flex items-center pr-4',
                                        active ? 'text-white' : 'text-teams_brand_border_1'
                                      )}
                                    >
                                      <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                  )}
                                </>
                              )}
                            </Combobox.Option>
                          ))}
                        </Combobox.Options>
                      )}
                    </div>
                  </Combobox>
                </div>
              </div>
              {selectedMailboxSetting?.allow_member_edit_out_of_office_message === false &&
                !current_member?.is_admin && (
                  <>
                    <hr className="mt-10 mb-5" />
                    <div className="rounded-md bg-yellow-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">{t('Attention_needed')}</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>{t('No_access')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              <hr
                className={
                  selectedMailboxSetting?.allow_member_edit_out_of_office_message ||
                  (selectedMailboxSetting && current_member?.is_admin)
                    ? 'mt-10 mb-5'
                    : 'block mb-10 h-0 w-0'
                }
              />
              {(selectedMailboxSetting?.allow_member_edit_out_of_office_message ||
                (selectedMailboxSetting && current_member?.is_admin)) && (
                <div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col space-y-2">
                        <h3 className="text-lg ">{t('outOfOfficeInsideHeader')}</h3>
                        <p className="text-sm">{t('outOfOfficeInsideHeaderDescription')}</p>
                      </div>
                    </div>
                    <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-x-5">
                      <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:py-0 lg:px-0 lg:pr-3">
                        <div className="space-y-2 ">
                          <div>{t('Variables')}</div>
                          {variables.map((item) => (
                            <button
                              key={item.name}
                              onClick={(e) => {
                                e.preventDefault();
                                if (!outOfOfficeInternalMessageRef?.current) return;
                                const quill = outOfOfficeInternalMessageRef.current as any;
                                if (!quill) return;
                                const selection = quill.editor.getSelection();

                                if (!selection) return;

                                quill.editor.insertText(selection.index, item.value);
                              }}
                              type="button"
                              className="mx-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </aside>

                      <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                        <div className=" w-full">
                          <div className="w-full bg-gray-50">
                            <ReactQuill
                              readOnly={
                                selectedMailboxSetting?.allow_member_edit_out_of_office_message === false &&
                                !current_member?.is_admin
                              }
                              theme="snow"
                              placeholder={placeholder}
                              modules={modules}
                              formats={formats}
                              ref={outOfOfficeInternalMessageRef}
                              value={outOfOfficeInternalMessage}
                              onChange={setOutOfOfficeInternalMessage}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex flex-col space-y-2"></div>

                      <div>
                        <input type="text" value={current_member?.email + ''} readOnly={true}></input>
                        <button
                          onClick={async () => {
                            if (!selectedLeaveType) return;
                            await save();
                            await sendTestMailMailboxSetting.mutateAsync(
                              { id: selectedMailboxSetting.id, internal: true },
                              {
                                async onSuccess() {
                                  notifySuccess(t('Testmail_sended_successfully'));
                                },
                                onError(error) {
                                  notifyError(error.message);
                                }
                              }
                            );
                          }}
                          disabled={sendTestMailMailboxSetting.isLoading}
                          type="button"
                          className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                        >
                          {sendTestMailMailboxSetting.isLoading && (
                            <div className="-ml-1 mr-3">
                              <Loader />
                            </div>
                          )}
                          {t('SendTestEmail')}
                        </button>
                      </div>
                    </div>
                  </div>
                  <hr className="mt-10 mb-5" />
                  <div>
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex flex-col space-y-2">
                        <h3 className="text-lg ">{t('outOfOfficeOutsideHeader')}</h3>
                        <p className="text-sm">{t('outOfOfficeOutsideHeaderDescription')}</p>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="mt-4 space-y-4">
                        <div className="relative flex items-start">
                          <div className="flex h-5 items-center">
                            <input
                              id="enableOutside"
                              name="enableOutside"
                              type="checkbox"
                              checked={checkedExternal}
                              onClick={() => {
                                setCheckedExternal(!checkedExternal);
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="enableOutside" className="font-medium text-gray-700">
                              {t('SendRepliesOutsideYourOrganisation')}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    {checkedExternal && (
                      <>
                        <div className="flex">
                          <div className="mt-4 space-y-4">
                            <div className="relative ml-5 flex items-start">
                              <div className="flex h-5 items-center">
                                <input
                                  id="allAllowed"
                                  name="allAllowed"
                                  type="checkbox"
                                  checked={checkedOnlyContacts}
                                  onClick={() => {
                                    setCheckedOnlyContacts(!checkedOnlyContacts);
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="allAllowed" className="font-medium text-gray-700">
                                  {t('SendRepliesOnlyToContacts')}
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}{' '}
                    {checkedExternal && (
                      <>
                        <div>
                          <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-x-5">
                            <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:py-0 lg:px-0 lg:pr-3">
                              <div className="space-y-2 ">
                                <div>{t('Variables')}</div>
                                {variables.map((item) => (
                                  <button
                                    key={item.name}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (!outOfOfficeExternalMessageRef?.current) return;
                                      const quill = outOfOfficeExternalMessageRef.current as any;
                                      if (!quill) return;
                                      const selection = quill.editor.getSelection();

                                      if (!selection) return;

                                      quill.editor.insertText(selection.index, item.value);
                                    }}
                                    type="button"
                                    className="mx-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                                  >
                                    {item.name}
                                  </button>
                                ))}
                              </div>
                            </aside>

                            <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                              <div className=" w-full">
                                <div className="w-full bg-gray-50">
                                  <ReactQuill
                                    readOnly={
                                      selectedMailboxSetting?.allow_member_edit_out_of_office_message === false &&
                                      !current_member?.is_admin
                                    }
                                    theme="snow"
                                    placeholder={placeholder}
                                    modules={modules}
                                    formats={formats}
                                    ref={outOfOfficeExternalMessageRef}
                                    value={outOfOfficeExternalMessage}
                                    onChange={setOutOfOfficeExternalMessage}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 mb-3 flex items-center justify-between">
                          <div className="flex flex-col space-y-2"></div>

                          <div>
                            <input type="text" value={current_member?.email + ''} readOnly={true}></input>
                            <button
                              onClick={async () => {
                                if (!selectedLeaveType) return;
                                await save();
                                await sendTestMailMailboxSetting.mutateAsync(
                                  { id: selectedMailboxSetting.id, internal: false },
                                  {
                                    async onSuccess() {
                                      notifySuccess(t('Testmail_sended_successfully'));
                                    },
                                    onError(error) {
                                      notifyError(error.message);
                                    }
                                  }
                                );
                              }}
                              disabled={sendTestMailMailboxSetting.isLoading}
                              type="button"
                              className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                            >
                              {sendTestMailMailboxSetting.isLoading && (
                                <div className="-ml-1 mr-3">
                                  <Loader />
                                </div>
                              )}
                              {t('SendTestEmail')}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <hr className="mt-10 mb-5" />
                  <div>
                    <div className="mb-3 flex justify-end">
                      <button
                        type="button"
                        disabled={
                          deleteMailboxSetting.isLoading ||
                          (selectedMailboxSetting?.allow_member_edit_out_of_office_message === false &&
                            !current_member?.is_admin)
                        }
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={() => {
                          setValueForDelete(true);
                        }}
                      >
                        {deleteMailboxSetting.isLoading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Delete')}
                      </button>
                      <button
                        disabled={
                          editMailboxSetting.isLoading ||
                          (selectedMailboxSetting?.allow_member_edit_out_of_office_message === false &&
                            !current_member?.is_admin)
                        }
                        onClick={async (e) => {
                          e.preventDefault();
                          save();
                        }}
                        type="submit"
                        className="ml-5 inline-flex justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2"
                      >
                        {editMailboxSetting.isLoading && (
                          <div className="-ml-1 mr-3">
                            <Loader />
                          </div>
                        )}
                        {t('Save')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!selectedMailboxSetting && (
                <div>
                  <div className="mb-96">
                    <div className="px-4 sm:px-6">
                      <ul role="list" className="mt-2 divide-y divide-gray-200">
                        <Switch.Group as="li" className="flex items-center justify-between py-4">
                          <div className="flex flex-col">
                            <Switch.Label as="p" className="text-sm font-medium text-gray-900" passive>
                              {t('EnableOutOfOfficeMessgageForLeaveType')}
                            </Switch.Label>
                            <Switch.Description className="text-sm text-gray-500"></Switch.Description>
                          </div>

                          <Switch
                            checked={selectedMailboxSetting ? true : false}
                            onChange={async () => {
                              if (!selectedLeaveType) return;
                              if (!current_member) return;
                              await addMailboxSetting.mutateAsync(
                                {
                                  leave_type_id: selectedLeaveType.id,
                                  workspace_id: current_member.workspace_id + '',
                                  member_id: current_member.id + '',
                                  externalReplyMessage: replaceNamePlaecholder(
                                    t('outOfOfficeExternalMessagePlaceholder'),
                                    current_member
                                  ),
                                  internalReplyMessage: replaceNamePlaecholder(
                                    t('outOfOfficeInternalMessagePlaceholder'),
                                    current_member
                                  ),

                                  externalAudience: MailboxAutomaticRepliesSettingExternalAudience.all
                                },
                                {
                                  async onSuccess() {
                                    await refetch_member_mailbox_settings();
                                  },
                                  onError(error) {
                                    notifyError(error.message);
                                  }
                                }
                              );
                            }}
                            className={classNames(
                              selectedMailboxSetting ? 'bg-teams_brand_500' : 'bg-gray-200',
                              'relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2'
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={classNames(
                                selectedMailboxSetting ? 'translate-x-5' : 'translate-x-0',
                                'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                              )}
                            />
                          </Switch>
                        </Switch.Group>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {valueForDelete && (
        <ConfirmModal
          text={t('confirm_delete_auto_reply')}
          handleCallback={handleDelete}
          onClose={() => {
            setValueForDelete(false);
          }}
        />
      )}
    </form>
  );
};

export const LeaveIcon = (props: { leaveType: LeaveType; selected: boolean }) => {
  return (
    <div className="flex items-center">
      {props.leaveType.icon != 'NoIcon' && (
        <Icon className="mr-2 -mt-0.5" width="4" color={props.leaveType.color} name={props.leaveType.icon} />
      )}
      {props.leaveType.icon == 'NoIcon' && (
        <div style={{ backgroundColor: props.leaveType.color }} className="mr-2 mt-0.5 h-4 w-4 rounded-sm"></div>
      )}

      <span className={classNames('ml-3 truncate', props.selected ? 'font-semibold' : '')}>{props.leaveType.name}</span>
    </div>
  );
};

export default AutomaticReplies;
