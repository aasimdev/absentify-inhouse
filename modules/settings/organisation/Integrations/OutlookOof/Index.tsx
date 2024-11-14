import type { NextPage } from 'next';
import { Dialog, Transition } from '@headlessui/react';
import { classNames } from 'lib/classNames';
import useTranslation from 'next-translate/useTranslation';
import { Fragment, useEffect, useState, useRef, useMemo } from 'react';
import 'quill/dist/quill.snow.css';
import { api, type RouterOutputs } from '~/utils/api';
import { notifyError, notifySuccess } from '~/helper/notify';
import DropDownUsers from './DropDownUsers';
import { Department, LeaveType, MailboxAutomaticRepliesSettingExternalAudience, TimeFormat } from '@prisma/client';
import DropDownSelectMember from './DropDownSelectMember';
import OofTabs from './OofTabs';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ensureTimeZoneAvailability } from '~/helper/ensureTimeZoneAvailability';
import Loader from '@components/calendar/Loader';
import { useAbsentify } from '@components/AbsentifyContext';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import Select from 'react-select';
import { getApproverValue } from '~/lib/getApproverHelper';
function areAllTextsSame(texts: string[]): boolean {
  if (texts.length === 0) {
    return false;
  }

  const firstText = texts[0];

  for (let i = 1; i < texts.length; i++) {
    if (texts[i] !== firstText) {
      return false;
    }
  }

  return true;
}

const OutlookOof: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const [countStep, setCountStep] = useState<number>(0);
  const { current_member } = useAbsentify();
  const [steps, setSteps] = useState<{ id: string; name: string; status: 'current' | 'upcoming' | 'complete' }[]>([
    { id: t('Step', { number: 1 }), name: t('Choose_members'), status: 'current' },
    { id: t('Step', { number: 2 }), name: t('Select_leave_type'), status: 'upcoming' },
    { id: t('Step', { number: 3 }), name: t('Inside_organization_template'), status: 'upcoming' },
    { id: t('Step', { number: 4 }), name: t('Outside_organization_template'), status: 'upcoming' },
    { id: t('Step', { number: 5 }), name: t('allow_useres_to_edit_oof'), status: 'upcoming' }
  ]);
  const ReactQuill = typeof window === 'object' ? require('react-quill') : () => false;
  const { data: leave_types } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: membersData } = api.member.all.useQuery(
    { filter: { status: ['ACTIVE', 'INACTIVE'] }, page: 1, limit: 1000 },
    {
      staleTime: 60000
    }
  );
  const members = useMemo(() => {
    return membersData?.members || [];
  }, [membersData?.members]);
  const { data: departaments } = api.department.all.useQuery(undefined);
  const [filteredMembers, setFilteredMembers] = useState<defaultMemberSelectOutput[]>([]);
  const [chosedMembers, setChosedMembers] = useState<defaultMemberSelectOutput[]>([]);
  const [testingMember, setTestingMember] = useState<defaultMemberSelectOutput | null>();
  const ids: string[] = filteredMembers?.map((member) => member.id);
  const chosedIds: string[] = chosedMembers?.map((member) => member.id);
  const { data: member_mailbox_settings, refetch: refetch_member_mailbox_settings } =
    api.member_mailbox_settings.allMembersSettings.useQuery(
      { ids },
      { staleTime: 60000, enabled: !!ids && ids.length > 0 }
    );
  const editMailboxSetting = api.member_mailbox_settings.editAllMailSettings.useMutation();
  const addMailboxSetting = api.member_mailbox_settings.addAllMembersSettings.useMutation();
  const sendTestMailMailboxSetting = api.member_mailbox_settings.sendtestmailWithoutSaving.useMutation();
  const [outOfOfficeExternalMessage, setOutOfOfficeExternalMessage] = useState<string>('');
  const [outOfOfficeInternalMessage, setOutOfOfficeInternalMessage] = useState<string>('');
  const [previewExternalMessage, setPreviewExternalMessage] = useState<string>('');
  const [previewInternalMessage, setPreviewInternalMessage] = useState<string>('');
  const [selectedIndexDeps, setSelectedIndexDeps] = useState<Department[]>([]);
  const selectedMembers = (member: defaultMemberSelectOutput) => chosedMembers.find((mem) => mem.id === member.id);
  const handleSelect = (curr: defaultMemberSelectOutput) => {
    const selectedOne = selectedMembers(curr);
    if (selectedOne) {
      setChosedMembers((prev) => [...prev.filter((mem) => mem.id !== selectedOne.id)]);
      return;
    }
    setChosedMembers((prev) => [...prev, curr]);
  };
  const membersSelected = chosedMembers.length > 0;
  const handleTestingMember = (value: defaultMemberSelectOutput) => {
    setTestingMember(value);
  };

  const handleSelectOrClearAll = () => {
    if (chosedMembers.length > 0) {
      setChosedMembers([]);
    } else if (chosedMembers.length === 0) {
      if (selectedIndexDeps.length > 0) {
        const selectedIds = selectedIndexDeps.map((sel) => sel.id);
        const initialMembers: defaultMemberSelectOutput[] = filteredMembers?.filter((member) =>
          member.departments.find((dep) => selectedIds.includes(dep.department_id))
        );
        setChosedMembers(initialMembers);
      } else {
        setChosedMembers(filteredMembers);
      }
    }
  };

  const resetToFirstStep = () => {
    const step1 = steps[countStep];
    if (step1) {
      step1.status = 'upcoming';
    }
    const step2 = steps[countStep - 1];
    if (step2) {
      step2.status = 'upcoming';
    }

    const step3 = steps[countStep - 2];
    if (step3) {
      step3.status = 'upcoming';
    }

    const step4 = steps[countStep - 3];
    if (step4) {
      step4.status = 'upcoming';
    }

    const step5 = steps[countStep - 4];
    if (step5) {
      step5.status = 'current';
    }

    setSteps(steps);
    setCountStep(countStep - 4);
    setChosedMembers([]);
    setTestingMember(null);
    setSelectedTab(1);
  };
  useEffect(() => {
    if (steps[0]?.status === 'current') {
      setTestingMember(null);
      setSelectedLeaveTypes([]);
    } else if (steps[1]?.status === 'current') {
      window.scrollTo(0, 0);
    }
  }, [steps, countStep]);

  const [deletemodalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const deleteAllMailBoxSettings = api.member_mailbox_settings.deleteAllMailSettings.useMutation();
  const variables = [
    { value: '{{startDate}}', name: t('Startdate') },
    { value: '{{startTime}}', name: t('Starttime') },
    { value: '{{dateOfReturn}}', name: t('DateOfReturn') },
    { value: '{{timeOfReturn}}', name: t('TimeOfReturn') },
    { value: '{{approverName}}', name: t('ApproverName') },
    { value: '{{approverMail}}', name: t('ApproverEmail') },
    { value: '{{firstName}}', name: t('firstName') },
    { value: '{{lastName}}', name: t('lastName') },
    { value: '{{name}}', name: t('FullName') }
  ];
  const [checkedExternal, setCheckedExternal] = useState(false);
  const [checkedAllowToEdit, setCheckedAllowToEdit] = useState(true);
  const [checkedOnlyContacts, setCheckedOnlyContacts] = useState(false);
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<LeaveType[] | RouterOutputs['leave_type']['all']>([]);
  const outOfOfficeExternalMessageRef = useRef(null);
  const outOfOfficeInternalMessageRef = useRef(null);
  const previewExternalMessageRef = useRef(null);
  const previewInternalMessageRef = useRef(null);

  const modules = {
    toolbar: [['bold', 'italic', 'underline', 'strike']]
  };

  const editMailbox = async (
    members: { id: string; name: string }[],
    leavetypeIds: string[],
    internalReplyMessage: string,
    externalReplyMessage: string,
    externalAudience: MailboxAutomaticRepliesSettingExternalAudience,
    allow_member_edit_out_of_office_message: boolean
  ) => {
    await editMailboxSetting.mutateAsync(
      {
        members,
        leavetypeIds,
        internalReplyMessage,
        externalReplyMessage,
        externalAudience,
        allow_member_edit_out_of_office_message
      },
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

  const addMailbox = async (
    members: { id: string; name: string }[],
    workspace_id: string,
    leave_type_ids: string[],
    internalReplyMessage: string,
    externalReplyMessage: string,
    externalAudience: MailboxAutomaticRepliesSettingExternalAudience,
    allow_member_edit_out_of_office_message: boolean
  ) => {
    await addMailboxSetting.mutateAsync(
      {
        leave_type_ids,
        workspace_id,
        members,
        externalReplyMessage,
        internalReplyMessage,
        externalAudience,
        allow_member_edit_out_of_office_message
      },
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

  const save = async () => {
    if (!member_mailbox_settings) return;
    if (selectedLeaveTypes.length === 0) return;
    if (!current_member) return;
    try {
      let checked: MailboxAutomaticRepliesSettingExternalAudience = checkedExternal ? 'all' : 'none';
      if (checkedOnlyContacts) {
        checked = 'contactsOnly';
      }

      if (chosedMembers && chosedMembers.length > 0) {
        const leaveTypeIds = selectedLeaveTypes.map((type) => type.id);
        const mailMemberIds = member_mailbox_settings
          ?.filter((mail) => leaveTypeIds.includes(mail.leave_type_id))
          .map((mail) => mail.member_id);
        const usersToEditIds = chosedMembers.filter((member) => member.id && mailMemberIds.includes(member.id));
        const usersToCreateIds = chosedMembers.filter((member) => member.id && !mailMemberIds.includes(member.id));
        if (usersToEditIds && usersToEditIds.length > 0) {
          await editMailbox(
            usersToEditIds as { id: string; name: string }[],
            leaveTypeIds,
            outOfOfficeInternalMessage,
            outOfOfficeExternalMessage,
            checked,
            checkedAllowToEdit
          );
        }
        if (usersToCreateIds && usersToCreateIds.length > 0) {
          await addMailbox(
            usersToCreateIds as { id: string; name: string }[],
            current_member.workspace_id + '',
            leaveTypeIds,
            outOfOfficeInternalMessage,
            outOfOfficeExternalMessage,
            checked,
            checkedAllowToEdit
          );
        }
        return;
      }
    } catch (error) {
      console.log(error);
    }
  };
  const placeholder = '';

  const formats = ['bold', 'italic', 'underline', 'strike'];

  const tabs = [
    { id: 1, name: t('Edit') },
    { id: 2, name: t('Preview') }
  ];

  const [selectedTab, setSelectedTab] = useState(1);

  const handleTab = (value: number) => {
    setSelectedTab(value);
  };

  const handlePreview = () => {
    const testingUser = testingMember || chosedMembers[0];
    if (!testingUser) return;
    const today = new Date();
    today.setUTCHours(8, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(18, 0, 0, 0);

    const replace = (text: string) => {
      text = text.replace(/{{firstName}}/g, testingUser.firstName || '');
      text = text.replace(/{{lastName}}/g, testingUser.lastName || '');
      text = text.replace(/{{name}}/g, testingUser.name || '');
      text = text.replace(/{{startDate}}/g, format(today, testingUser.date_format ?? 'MM/dd/yyyy'));
      text = text.replace(
        /{{startTime}}/g,
        formatInTimeZone(
          today,
          ensureTimeZoneAvailability(testingUser.timezone ?? (workspace?.global_timezone || 'HH:mm')),
          testingUser.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
        )
      );
      text = text.replace(/{{dateOfReturn}}/g, format(tomorrow, testingUser.date_format ?? 'MM/dd/yyyy'));
      text = text.replace(
        /{{timeOfReturn}}/g,
        formatInTimeZone(
          tomorrow,
          ensureTimeZoneAvailability(testingUser.timezone ?? (workspace?.global_timezone || 'HH:mm')),
          testingUser.time_format == TimeFormat.H24 ? 'HH:mm' : 'hh:mm a'
        )
      );

      // Replacing the placeholders (with and without square brackets)
      text = text.replace(/{{approverName(?:\[(\d+)\])?}}/g, (_, index) => {
        // User enters a 1-based index, so we need to subtract 1
        const userIndex = index ? parseInt(index, 10) - 1 : 0;
        return getApproverValue(
          testingUser.has_approvers.map((y) => ({
            approver_member_id: y.approver_member_id,
            predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
            approver_member: y.approver_member
          })),
          userIndex,
          'name'
        );
      });

      text = text.replace(/{{approverMail(?:\[(\d+)\])?}}/g, (_, index) => {
        // User enters a 1-based index, so we need to subtract 1
        const userIndex = index ? parseInt(index, 10) - 1 : 0;
        return getApproverValue(
          testingUser.has_approvers.map((y) => ({
            approver_member_id: y.approver_member_id,
            predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
            approver_member: y.approver_member
          })),
          userIndex,
          'email'
        );
      });
      text = text.replace(/{{managerName(?:\[(\d+)\])?}}/g, (_, index) => {
        // User enters a 1-based index, so we need to subtract 1
        const userIndex = index ? parseInt(index, 10) - 1 : 0;
        return getApproverValue(
          testingUser.has_approvers.map((y) => ({
            approver_member_id: y.approver_member_id,
            predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
            approver_member: y.approver_member
          })),
          userIndex,
          'name'
        );
      });

      text = text.replace(/{{managerMail(?:\[(\d+)\])?}}/g, (_, index) => {
        // User enters a 1-based index, so we need to subtract 1
        const userIndex = index ? parseInt(index, 10) - 1 : 0;
        return getApproverValue(
          testingUser.has_approvers.map((y) => ({
            approver_member_id: y.approver_member_id,
            predecessor_request_member_approver_id: y.predecessor_approver_member_approver_id,
            approver_member: y.approver_member
          })),
          userIndex,
          'email'
        );
      });
      return text;
    };

    setPreviewInternalMessage(replace(outOfOfficeInternalMessage));
    setPreviewExternalMessage(replace(outOfOfficeExternalMessage));
  };

  useEffect(() => {
    setPreviewInternalMessage(outOfOfficeInternalMessage);
    setPreviewExternalMessage(outOfOfficeExternalMessage);
  }, [outOfOfficeInternalMessage, outOfOfficeExternalMessage]);
  useEffect(() => {
    if (selectedTab === 2) {
      handlePreview();
    }
  }, [selectedTab, testingMember]);

  useEffect(() => {
    if (!members) {
      return;
    }
    setFilteredMembers(members.filter((member) => !!member));
  }, [members]);
  const handleSelectedIndexDeps = (selectedDeps: Department[]) => {
    setSelectedIndexDeps(selectedDeps);
  };
  useEffect(() => {
    const leaveTypeIds = selectedLeaveTypes.map((type) => type.id);
    if (chosedMembers?.length === 1) {
      const setting = member_mailbox_settings?.find(
        (mail) => leaveTypeIds.includes(mail.leave_type_id) && mail.member_id === chosedMembers[0]?.id
      );
      setCheckedAllowToEdit(setting?.allow_member_edit_out_of_office_message ? true : false);
    } else if (chosedMembers?.length > 0 && current_member) {
      const setting = member_mailbox_settings?.find(
        (mail) => leaveTypeIds.includes(mail.leave_type_id) && mail.member_id === current_member?.id
      );
      setCheckedAllowToEdit(setting?.allow_member_edit_out_of_office_message ? true : false);
    }
  }, [chosedMembers, selectedLeaveTypes, current_member]);
  useEffect(() => {
    if (!member_mailbox_settings) return;
    if (selectedLeaveTypes.length === 0) return;
    if (!current_member) return;
    const leaveTypeIds = selectedLeaveTypes.map((type) => type.id);
    const selected = member_mailbox_settings.find((mail) => {
      if (chosedMembers.length === 1) {
        return leaveTypeIds.includes(mail.leave_type_id) && mail.member_id === chosedMembers[0]?.id;
      }
      return leaveTypeIds.includes(mail.leave_type_id) && mail.member_id === current_member.id;
    });
    let internalText = null;
    let externalText = null;
    if (chosedMembers.length > 1 && members) {
      const mail_settings = member_mailbox_settings.filter(
        (mail) => leaveTypeIds.includes(mail.leave_type_id) && chosedIds.includes(mail.member_id)
      );
      const cleanedInternalTexts = mail_settings.map((setting) => setting.internalReplyMessage);
      const cleanedExternalTexts = mail_settings.map((setting) => setting.externalReplyMessage);
      internalText = areAllTextsSame(cleanedInternalTexts) ? cleanedInternalTexts[0] : null;
      externalText = areAllTextsSame(cleanedExternalTexts) ? cleanedExternalTexts[0] : null;
    }

    if (selected) {
      setCheckedExternal(selected.externalAudience != 'none');
      setCheckedOnlyContacts(selected.externalAudience == 'contactsOnly');
      if (externalText) {
        setOutOfOfficeExternalMessage(externalText);
      } else {
        if (chosedMembers.length === 1) {
          setOutOfOfficeExternalMessage(selected.externalReplyMessage);
        } else {
          setOutOfOfficeExternalMessage(t('outOfOfficeExternalMessagePlaceholder'));
        }
      }
      if (internalText) {
        setOutOfOfficeInternalMessage(internalText);
      } else {
        if (chosedMembers.length === 1) {
          setOutOfOfficeInternalMessage(selected.internalReplyMessage);
        } else {
          setOutOfOfficeInternalMessage(t('outOfOfficeInternalMessagePlaceholder'));
        }
      }
    } else {
      setOutOfOfficeExternalMessage(t('outOfOfficeExternalMessagePlaceholder'));
      setOutOfOfficeInternalMessage(t('outOfOfficeInternalMessagePlaceholder'));
    }
  }, [selectedLeaveTypes, chosedMembers]);

  const Modal = (props: { open: boolean; onClose: Function }) => {
    const cancelButtonRef = useRef(null);
    return (
      <Transition.Root show={props.open} as={Fragment}>
        <Dialog as="div" className="relative z-30" initialFocus={cancelButtonRef} onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 dark:bg-teams_brand_tbody bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="py-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                        {t('Remove_oof_title')}
                      </Dialog.Title>
                      <div className="mt-2 py-2">
                        <div className="w-full mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-200">{t('select_type')}</span>
                          <Select
                            styles={{
                              control: (base) => ({
                                ...base,
                                '*': {
                                  boxShadow: 'none !important'
                                }
                              })
                            }}
                            isMulti
                            value={selectedLeaveTypes}
                            className="w-full my-react-select-container"
                              classNamePrefix="my-react-select"
                            name="leavetype_ids"
                            onChange={(val) => {
                              if (val) {
                                setSelectedLeaveTypes([...val]);
                              }
                            }}
                            getOptionLabel={(option) => `${option.name}`}
                            getOptionValue={(option) => option.id}
                            options={leave_types}
                          />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-200">{t('Remove_oof', { number: chosedIds.length })}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={async (e) => {
                        if (selectedLeaveTypes.length === 0) {
                          notifyError(t('no_leave_type'));
                          return;
                        }
                        e.preventDefault();
                        await deleteAllMailBoxSettings.mutateAsync(
                          {
                            ids: chosedIds,
                            leavetypeIds: selectedLeaveTypes.map((type) => type.id)
                          },
                          {
                            async onSuccess() {
                              await refetch_member_mailbox_settings();

                              notifySuccess(t('Saved_successfully'));
                              props.onClose(false);
                            },
                            onError(error) {
                              notifyError(error.message);
                              props.onClose(false);
                            }
                          }
                        );
                        setSelectedLeaveTypes([]);
                      }}
                    >
                      {deleteAllMailBoxSettings.isLoading && (
                        <svg
                          className="-ml-1 mr-3 h-5 w-5 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth={4}
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      )}

                      {t('yes_remove')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-teams_brand_tbody dark:border dark:border-gray-200 dark:text-white"
                      onClick={() => {
                        props.onClose(false);
                        setSelectedLeaveTypes([]);
                      }}
                      ref={cancelButtonRef}
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  };
  return (
    <div className="divide-y divide-gray-200 lg:col-span-10">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <span className="hidden sm:inline-block sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block px-4 pt-5 pb-4 text-left sm:w-full sm:p-6">
          <h3 className="py-6 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Add_new_oof')}</h3>
          <nav aria-label="Progress ">
            <ol role="list" className="mt-4 space-y-4 md:flex md:space-y-0 md:space-x-8">
              {steps.map((step) => (
                <li key={step.name} className="md:flex-1">
                  {step.status === 'complete' ? (
                    <span className="group flex flex-col border-l-4 border-teams_brand_foreground_bg py-2 pl-4  md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                      <span className="text-xs font-semibold uppercase tracking-wide text-teams_brand_foreground_bg ">
                        {step.id}
                      </span>
                      <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                    </span>
                  ) : step.status === 'current' ? (
                    <span
                      className="flex flex-col border-l-4 border-teams_brand_foreground_bg py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0"
                      aria-current="step"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-teams_brand_foreground_bg">
                        {step.id}
                      </span>
                      <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                    </span>
                  ) : (
                    <span className="group flex flex-col border-l-4 border-gray-200 py-2 pl-4  md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{step.id}</span>
                      <span className="text-sm font-medium dark:text-gray-200">{step.name}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="mt-5 border-t border-gray-200 dark:border-teams_brand_border"></div>
          {steps[0] && steps[0].status === 'current' && (
            <div>
              <div className="mt-4">
                <span className="text-lg dark:text-gray-200">{t('ChooseUsers')}</span>
                <p className="text-sm mb-4 dark:text-gray-200">{t('ChooseUsersDesc')}</p>
                {!filteredMembers || !departaments ? (
                  <div className="w-full flex items-center align-middle justify-center p-10">
                    <Loader height="10" width="10" />
                  </div>
                ) : (
                  <div className="w-full">
                    <DropDownUsers
                      members={filteredMembers}
                      handleSelect={handleSelect}
                      selectedMembers={selectedMembers}
                      departaments={departaments}
                      handleSelectOrClearAll={handleSelectOrClearAll}
                      membersSelected={membersSelected}
                      handleSelectedIndexDeps={handleSelectedIndexDeps}
                    />
                  </div>
                )}
              </div>
              {member_mailbox_settings && member_mailbox_settings?.length > 0 && (
                <div className="mt-4 w-full text-gray-400 mr-2 text-sm">{t('delete_message')}</div>
              )}
            </div>
          )}
          {steps[1] && steps[1].status === 'current' && (
            <div className="mt-4">
              <div className="flex w-full flex-col mb-64">
                <div className="my-auto w-full mr-2 mb-2 text-lg dark:text-gray-200">{t('LeaveTypeTemplate')}</div>
                <div className="my-auto w-full mr-2 mb-2 text-sm dark:text-gray-200">{t('LeaveTypeDesc')}</div>
                <div className="w-full">
                  <Select
                    styles={{
                      control: (base) => ({
                        ...base,
                        '*': {
                          boxShadow: 'none !important'
                        }
                      })
                    }}
                    isMulti
                    value={selectedLeaveTypes}
                    className="w-full my-react-select-container"
                    classNamePrefix="my-react-select"
                    name="leavetype_ids"
                    onChange={(val) => {
                      if (val) {
                        setSelectedLeaveTypes([...val]);
                      }
                    }}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={leave_types}
                  />
                </div>
              </div>
            </div>
          )}
          {steps[2] && steps[2].status === 'current' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-lg dark:text-gray-200">{t('outOfOfficeInsideHeader')}</h3>
                  <p className="text-sm dark:text-gray-200">{t('outOfOfficeInsideHeaderDescription')}</p>
                </div>
              </div>
              <OofTabs tabs={tabs} handler={handleTab} selectedTab={selectedTab} />
              {selectedTab === 1 ? (
                <>
                  <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-x-5">
                    <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:py-0 lg:px-0 lg:pr-3">
                      <div className="space-y-2 ">
                        <div className='dark:text-gray-200'>{t('Variables')}</div>
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
                            className="mx-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 dark:bg-teams_brand_tbody  dark:text-gray-200"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </aside>

                    <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                      <div className=" w-full">
                        <div className="w-full bg-gray-50 dark:bg-teams_brand_tbody  dark:text-gray-200">
                          <ReactQuill
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
                </>
              ) : (
                <>
                  {chosedMembers.length !== 1 && (
                    <div className="mt-2 flex sm:flex-row flex-col items-center">
                      <p className="text-sm sm:mr-4 dark:text-gray-200">{t('assign_member')}</p>
                      <DropDownSelectMember members={chosedMembers} handleTestingMember={handleTestingMember} />
                    </div>
                  )}
                  <div className="mt-2 lg:grid lg:grid-cols-12 lg:gap-x-5">
                    <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                      <div className=" w-full">
                        <div className="w-full bg-gray-50 dark:bg-teams_brand_tbody  dark:text-gray-200">
                          <ReactQuill
                            theme="snow"
                            placeholder={placeholder}
                            modules={modules}
                            formats={formats}
                            ref={previewInternalMessageRef}
                            value={previewInternalMessage}
                            onChange={setOutOfOfficeInternalMessage}
                            readOnly={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div
                      className={classNames(
                        chosedMembers.length !== 1 ? 'flex sm:flex-row flex-col items-end w-full px-6' : 'px-6',
                        'justify-end'
                      )}
                    >
                      <div className="">
                        <input
                          type="text"
                          value={current_member?.email + ''}
                          readOnly={true}
                          className="sm:mb-0 mb-4 rounded dark:text-gray-200 dark:bg-teams_brand_tbody"
                        ></input>
                        <button
                          onClick={async () => {
                            if (selectedLeaveTypes.length === 0) return;
                            const testMemberId = testingMember?.id || chosedMembers[0]?.id;
                            if (!testMemberId) return;
                            await sendTestMailMailboxSetting.mutateAsync(
                              {
                                testMember: { id: testMemberId },
                                internalReplyMessage: outOfOfficeInternalMessage,
                                externalReplyMessage: outOfOfficeExternalMessage,
                                internal: true
                              },
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
                            <svg
                              className="-ml-1 mr-3 h-5 w-5 animate-spin"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth={4}
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          )}
                          {t('SendTestEmail')}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {steps[3] && steps[3].status === 'current' && (
            <div>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-lg  dark:text-gray-200">{t('outOfOfficeOutsideHeader')}</h3>
                  <p className="text-sm  dark:text-gray-200">{t('outOfOfficeOutsideHeaderDescription')}</p>
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
                        onChange={() => {
                          setCheckedExternal(!checkedExternal);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450 dark:bg-teams_brand_tbody  dark:text-gray-200  dark:border-gray-200  dark:focus:ring-teams_brand_tbody dark:focus:bg-teams_brand_tbody"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="enableOutside" className="font-medium text-gray-700  dark:text-gray-200">
                        {t('SendRepliesOutsideYourOrganisation')}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              {checkedExternal && (
                <>
                  <div className="flex mb-2">
                    <div className="mt-4 space-y-4">
                      <div className="relative ml-5 flex items-start">
                        <div className="flex h-5 items-center">
                          <input
                            id="allAllowed"
                            name="allAllowed"
                            type="checkbox"
                            checked={checkedOnlyContacts}
                            onChange={() => {
                              setCheckedOnlyContacts(!checkedOnlyContacts);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450  dark:text-gray-200 dark:bg-teams_brand_tbody  dark:border-gray-200  dark:focus:ring-teams_brand_tbody dark:focus:bg-teams_brand_tbody"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="allAllowed" className="font-medium text-gray-700  dark:text-gray-200">
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
                  <OofTabs tabs={tabs} handler={handleTab} selectedTab={selectedTab} />
                  {selectedTab === 1 ? (
                    <>
                      <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-x-5">
                        <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:py-0 lg:px-0 lg:pr-3">
                          <div className="space-y-2 ">
                            <div className=" dark:text-gray-200">{t('Variables')}</div>
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
                                className="mx-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2  dark:bg-teams_brand_tbody  dark:text-gray-200"
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </aside>

                        <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                          <div className=" w-full">
                            <div className="w-full bg-gray-50 dark:bg-teams_brand_tbody  dark:text-gray-200">
                              <ReactQuill
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
                    </>
                  ) : (
                    <>
                      {chosedMembers.length !== 1 && (
                        <div className="mt-2 flex sm:flex-row flex-col items-center">
                          <p className="text-sm sm:mr-4">{t('assign_member')}</p>
                          <DropDownSelectMember members={chosedMembers} handleTestingMember={handleTestingMember} />
                        </div>
                      )}
                      <div className="mt-2 lg:grid lg:grid-cols-12 lg:gap-x-5">
                        <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                          <div className=" w-full">
                            <div className="w-full bg-gray-50 dark:bg-teams_brand_tbody  dark:text-gray-200">
                              <ReactQuill
                                theme="snow"
                                placeholder={placeholder}
                                modules={modules}
                                formats={formats}
                                ref={previewExternalMessageRef}
                                value={previewExternalMessage}
                                onChange={setOutOfOfficeExternalMessage}
                                readOnly={true}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div
                          className={classNames(
                            chosedMembers.length !== 1 ? 'flex sm:flex-row flex-col items-end w-full px-6' : 'px-6',
                            'justify-end'
                          )}
                        >
                          <div className="">
                            <input
                              type="text"
                              value={current_member?.email + ''}
                              readOnly={true}
                              className="sm:mb-0 mb-4 dark:bg-teams_brand_tbody  dark:text-gray-200"
                            ></input>
                            <button
                              onClick={async () => {
                                if (selectedLeaveTypes.length === 0) return;
                                const testMemberId = testingMember?.id || chosedMembers[0]?.id;
                                if (!testMemberId) return;
                                await sendTestMailMailboxSetting.mutateAsync(
                                  {
                                    testMember: { id: testMemberId },
                                    internalReplyMessage: outOfOfficeInternalMessage,
                                    externalReplyMessage: outOfOfficeExternalMessage,
                                    internal: true
                                  },
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
                                <svg
                                  className="-ml-1 mr-3 h-5 w-5 animate-spin"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth={4}
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                              )}
                              {t('SendTestEmail')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {steps[4] && steps[4].status === 'current' && (
            <>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-lg  dark:text-gray-200">{t('allow_member_h3')}</h3>
                  <p className="text-sm  dark:text-gray-200">{t('Can_user_edit')}</p>
                </div>
              </div>
              <div className="flex">
                <div className="mt-4 space-y-4">
                  <div className="relative flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="outOffOfficEdit"
                        name="outOffOfficEdit"
                        type="checkbox"
                        checked={checkedAllowToEdit}
                        onChange={() => {
                          setCheckedAllowToEdit(!checkedAllowToEdit);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450  dark:text-gray-200 dark:bg-teams_brand_tbody  dark:border-gray-200  dark:focus:ring-teams_brand_tbody dark:focus:bg-teams_brand_tbody"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="outOffOfficEdit" className="font-medium text-gray-700  dark:text-gray-200">
                        {t('allow_member_checkbox')}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="mt-4 flex justify-end border-t p-4 sm:px-6 dark:border-teams_brand_border">
            {countStep >= 1 && countStep !== steps.length - 1 && (
              <button
                onClick={() => {
                  const step1 = steps[countStep];
                  if (steps[1]?.status === 'current') {
                    setTestingMember(null);
                    setChosedMembers([]);
                    setSelectedTab(1);
                  }
                  if (step1) {
                    step1.status = 'upcoming';
                  }
                  const step2 = steps[countStep - 1];
                  if (step2) {
                    step2.status = 'current';
                  }

                  setSteps(steps);
                  setCountStep(countStep - 1);
                  if (countStep - 1 === 0) {
                    setChosedMembers([]);
                  }
                }}
                type="button"
                className="mx-2 inline-flex items-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 font-medium text-white shadow-sm hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm "
              >
                {t('previous')}
              </button>
            )}
            {member_mailbox_settings && member_mailbox_settings?.length > 0 && countStep === 0 && (
              <button
                type="button"
                disabled={deleteAllMailBoxSettings.isLoading}
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm mx-2"
                onClick={() => {
                  if (steps[0] && chosedMembers.length === 0) {
                    notifyError(t('choose_members_error'));
                    return;
                  }
                  setDeleteModalOpen(true);
                }}
              >
                {deleteAllMailBoxSettings.isLoading && (
                  <svg
                    className="-ml-1 mr-3 h-5 w-5 animate-spin "
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth={4}
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                {t('Delete')}
              </button>
            )}
            {countStep < steps.length - 1 && (
              <button
                onClick={() => {
                  if (steps[0]?.status === 'current' && chosedMembers.length === 0) {
                    notifyError(t('choose_members_error'));
                    return;
                  } else if (steps[1]?.status === 'current' && selectedLeaveTypes.length === 0) {
                    notifyError(t('no_leave_type'));
                    return;
                  }
                  const step = steps[countStep];
                  if (step) step.status = 'complete';
                  const nextStep = steps[countStep + 1];
                  if (nextStep) nextStep.status = 'current';
                  setSteps(steps);
                  setCountStep(countStep + 1);
                }}
                type="button"
                className=" bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium   shadow-sm focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm"
              >
                {t('next_for_users', { number: chosedMembers.length })}
              </button>
            )}
            {deletemodalOpen && (
              <Modal
                open={deletemodalOpen}
                onClose={async (refresh: boolean) => {
                  setDeleteModalOpen(false);
                  if (refresh) {
                    await refetch_member_mailbox_settings();
                  }
                }}
              ></Modal>
            )}
            {countStep === steps.length - 1 && (
              <>
                <button
                  onClick={() => {
                    const step1 = steps[countStep];
                    if (step1) {
                      step1.status = 'upcoming';
                    }
                    const step2 = steps[countStep - 1];
                    if (step2) {
                      step2.status = 'current';
                    }

                    setSteps(steps);
                    setCountStep(countStep - 1);
                  }}
                  type="button"
                  className="mx-2 inline-flex items-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 font-medium text-white shadow-sm hover:bg-teams_brand_foreground_1 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm "
                >
                  {t('previous')}
                </button>
                <button
                  onClick={async () => {
                    await save();
                    resetToFirstStep();
                  }}
                  type="submit"
                  className=" bg-teams_brand_foreground_bg text-white hover:bg-teams_brand_foreground_1 mx-2 inline-flex items-center rounded-md border border-transparent px-4 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:text-sm"
                >
                  {(editMailboxSetting.isLoading || addMailboxSetting.isLoading) && (
                    <svg
                      className="-ml-1 mr-3 h-5 w-5 animate-spin "
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth={4}
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {chosedMembers && chosedMembers.length === 1
                    ? t('save')
                    : t('save_for', { number: chosedMembers.length })}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default OutlookOof;
