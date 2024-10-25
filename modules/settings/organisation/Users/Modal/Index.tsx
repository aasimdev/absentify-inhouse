import { Fragment, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import {
  CalculatorIcon,
  CalendarIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import Profile from './Profile';
import Schedule from './Schedule/Index';
import { classNames } from 'lib/classNames';
import Allowance from './Allowance';
import Approver from './Approver';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { defaultMemberScheduleSelectOutput } from '~/server/api/routers/member_schedule';
import MailLogs from './MailLogs';
export interface ExtendedMemberScheduleSelectOutput extends defaultMemberScheduleSelectOutput {
  state: 'current' | 'future' | 'completed';
}
export default function Modal(props: {
  open: boolean;
  onClose: Function;
  currentMember: null | defaultMemberSelectOutput;
  onInvalidate: Function;
  schedules: ExtendedMemberScheduleSelectOutput[];
  isLoading: boolean;
}) {
  const { t } = useTranslation('users');

  const subNavigation = [
    { name: t('Profile'), id: 1, icon: UserCircleIcon, current: true },
    {
      name: t('approver'),
      id: 2,
      icon: ClipboardDocumentCheckIcon,
      current: false
    },
    { name: t('Schedule'), id: 3, icon: CalendarIcon, current: false },
    { name: t('Allowance'), id: 4, icon: CalculatorIcon, current: false },
    { name: t('EmailHistory'), id: 5, icon: EnvelopeIcon, current: false }
  ];

  const cancelButtonRef = useRef(null);
  const [currentNavigation, setCurrentNavigation] = useState<number>(1);

  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-30 overflow-y-auto" initialFocus={cancelButtonRef} onClose={() => {}}>
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
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
            <div className="inline-block transform overflow-visible rounded-lg bg-white pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:pt-6 sm:align-middle dark:bg-teams_brand_dark_600">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <Dialog.Title as="h3" className="ml-2 md:ml-4 mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">
                    <p className="inline-flex">
                      {props.currentMember && (
                        <span className="max-w-40 md:w-auto truncate">{props.currentMember.name} </span>
                      )}
                      &nbsp;{'|'}&nbsp;
                      {props.currentMember && (
                        <span>
                          {props.currentMember.departments.map((department) => department.department?.name).join(', ')}
                        </span>
                      )}
                    </p>
                  </Dialog.Title>
                  <main className="border-t">
                    <div className="overflow-visible bg-white dark:divide-gray-500">
                      <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                        <aside className="py-6 lg:col-span-3 dark:bg-teams_dark_mode_core">
                          <nav className="space-y-1">
                            {subNavigation.map((item) => (
                              <a
                                key={item.id}
                                onClick={() => {
                                  setCurrentNavigation(item.id);
                                }}
                                className={classNames(
                                  currentNavigation == item.id
                                    ? 'border-teams_brand_500 bg-teams_brand_50 text-teams_brand_700 hover:bg-teams_brand_50 hover:text-teams_brand_700 dark:bg-teams_brand_dark_100 hover:bg-teams_brand_50 hover:text-teams_brand_700 hover:dark:bg-teams_brand_dark_100'
                                    : 'border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900',
                                  'group flex cursor-pointer items-center border-l-4 px-3 py-2 text-sm font-medium dark:text-gray-200 hover:dark:bg-teams_brand_dark_100'
                                )}
                                aria-current={item.current ? 'page' : undefined}
                              >
                                <item.icon
                                  className={classNames(
                                    currentNavigation == item.id
                                      ? 'text-teams_brand_500 group-hover:text-teams_brand_500 dark:text-gray-200'
                                      : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-200',
                                    '-ml-1 mr-3 h-6 w-6 flex-shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{item.name}</span>
                              </a>
                            ))}
                          </nav>
                        </aside>
                        {currentNavigation == 1 && props.currentMember && (
                          <Profile onClose={props.onClose} currentMember={props.currentMember} />
                        )}
                        {currentNavigation == 2 && props.currentMember && (
                          <Approver onClose={props.onClose} currentMember={props.currentMember} />
                        )}
                        {currentNavigation == 3 && props.currentMember && (
                          <Schedule
                            onClose={props.onClose}
                            currentMember={props.currentMember}
                            schedules={props.schedules}
                            isLoading={props.isLoading}
                            onInvalidate={props.onInvalidate}
                          />
                        )}
                        {currentNavigation == 4 && props.currentMember && (
                          <Allowance onClose={props.onClose} currentMember={props.currentMember} />
                        )}
                        {currentNavigation == 5 && props.currentMember && (
                          <MailLogs onClose={props.onClose} currentMember={props.currentMember} />
                        )}
                      </div>
                    </div>
                  </main>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
