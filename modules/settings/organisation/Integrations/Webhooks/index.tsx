import { Dialog, Transition } from '@headlessui/react';
import { useRef, useState, Fragment, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import useTranslation from 'next-translate/useTranslation';
import { api, type RouterInputs } from '~/utils/api';
import Link from 'next/link';
import type { NextPage } from 'next';
import { type WebhookSetting } from '@prisma/client';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useAbsentify } from '@components/AbsentifyContext';

import { notifySuccess, notifyError } from '~/helper/notify';
import Loader from '@components/calendar/Loader';

const Webhooks: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalOpen1, setModalOpen1] = useState<boolean>(false);
  const { register, handleSubmit } = useForm<RouterInputs['webhook_setting']['add']>();
  const { subscription } = useAbsentify();
  const { current_member } = useAbsentify();
  const utils = api.useContext();
  const { data: allWebhookSettings, refetch: refetchAllWebhookSettings } = api.webhook_setting.all.useQuery(undefined, {
    staleTime: 60000
  });
  const addWebhookSetting = api.webhook_setting.add.useMutation();
  const editWebhookSetting = api.webhook_setting.edit.useMutation();
  const deleteWebhookSetting = api.webhook_setting.delete.useMutation();
  const [valueForEdit, setValueForEdit] = useState<WebhookSetting | null>(null);
  const [valueForDelete, setValueForDelete] = useState<WebhookSetting | null>(null);

  const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(false);
  useEffect(() => {
    if (!allWebhookSettings) return;

    if (subscription.enterprise > 0) {
      setHasValidSubscription(true);
      return;
    } else if (subscription.business || subscription.business_by_user > 0) {
      const count = subscription.addons.webhooks;

      if (allWebhookSettings.length < count) {
        setHasValidSubscription(true);
        return;
      }
    }
    setHasValidSubscription(false);
  }, [allWebhookSettings, subscription]);

  const onSubmit: SubmitHandler<RouterInputs['webhook_setting']['add']> = async (data: any) => {
    if (!current_member) return;
    const eventValue: ('request_created' | 'request_status_changed')[] =
      data.event === 'request_created;request_status_changed'
        ? ['request_created', 'request_status_changed']
        : data.event == 'request_created'
        ? ['request_created']
        : ['request_status_changed'];
    await addWebhookSetting.mutateAsync(
      {
        url: data.url,
        workspace_id: current_member?.workspace_id + '',
        source: 'Website',
        event: eventValue
      },
      {
        async onSuccess() {
          await refetchAllWebhookSettings();

          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  const Modal = (props: { open: boolean; onClose: Function; value: null | WebhookSetting }) => {
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-teams_dark_mode">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="py-4 text-lg font-medium leading-6 text-gray-900  dark:text-gray-200">
                        {t('WebhookRemove')}
                      </Dialog.Title>
                      <div className="mt-2 py-2">
                        <p
                          className="text-sm text-gray-500  dark:text-gray-200"
                          dangerouslySetInnerHTML={{
                            __html: t('WebhookRemoveSubTitle', {
                              interpolation: { escapeValue: false },

                              value:
                                props.value?.event === 'request_created'
                                  ? t('created')
                                  : props.value?.event === 'request_status_changed'
                                  ? t('statusChanged')
                                  : t('all')
                            })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={
                        //deleteHandler
                        async (e) => {
                          e.preventDefault();
                          await deleteWebhookSetting.mutateAsync(
                            { id: props.value?.id as string },
                            {
                              async onSuccess() {
                                utils.webhook_setting.all.invalidate();
                                notifySuccess(t('Deleted_successfully'));

                                props.onClose(false);
                              },
                              onError(error) {
                                notifyError(error.message);
                                props.onClose(false);
                              }
                            }
                          );
                        }
                      }
                    >
                      {deleteWebhookSetting.isLoading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}

                      {t('yes_remove_webhook')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-teams_dark_mode dark:border dark:border-teams_brand_border dark:text-white"
                      onClick={() => {
                        props.onClose(false);
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

  const Modal1 = (props: { open: boolean; onClose: Function; value: null | WebhookSetting }) => {
    const cancelButtonRef = useRef(null);
    const { current_member } = useAbsentify();

    const {
      register,
      handleSubmit,
      formState: { errors },
      control,

      setValue
    } = useForm<RouterInputs['webhook_setting']['add']>();

    const onSubmit: SubmitHandler<RouterInputs['webhook_setting']['add']> = async (data: any) => {
      if (!current_member) return;
      const eventValue: ('request_created' | 'request_status_changed')[] =
        data.event === 'request_created;request_status_changed'
          ? ['request_created', 'request_status_changed']
          : data.event == 'request_created'
          ? ['request_created']
          : ['request_status_changed'];
      await editWebhookSetting.mutateAsync(
        {
          data: { url: data.url, event: eventValue },
          id: props.value?.id as string
        },
        {
          onSuccess: async () => {
            await utils.webhook_setting.all.invalidate();

            notifySuccess(t('Saved_successfully'));
          },
          onError: (error) => {
            notifyError(error.message);
          }
        }
      );
      props.onClose(false);
    };

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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6  dark:bg-teams_dark_mode  dark:text-gray-200">
                  <form action="" onSubmit={handleSubmit(onSubmit)}>
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <Dialog.Title as="h3" className="py-4 text-lg font-medium leading-6 text-gray-900  dark:text-gray-200">
                          {t('editW')}
                        </Dialog.Title>
                        <div className="mt-5 md:flex md:items-center">
                          <div className='flex items-center gap-1'>
                            {' '}
                            <label htmlFor="location" className="sr-only  dark:text-gray-200">
                              {t('select_event')}
                            </label>
                            <select
                              {...register('event')}
                              id="event"
                              className=" block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm  dark:text-gray-200  dark:bg-teams_dark_mode  dark:text-gray-200 dark:border-teams_brand_border"
                              defaultValue={props.value?.event as string}
                              onChange={(e: any) => setValue('event', e.target.value)}
                            >
                              <option value="request_created;request_status_changed"> {t('all')} </option>
                              <option value="request_created"> {t('created')}</option>
                              <option value="request_status_changed"> {t('statusChanged')}</option>
                            </select>
                          </div>

                          <div className="w-full pl-0  pr-0 pt-4 sm:max-w-xs lg:pl-4 lg:pr-1 lg:pt-0">
                            <label htmlFor="webhook" className="sr-only  dark:text-gray-200">
                              {t('Webhook')}
                            </label>

                            <input
                              {...register('url')}
                              onChange={(e: any) => {
                                setValue('url', e.target.value);
                              }}
                              defaultValue={props.value?.url}
                              type="url"
                              name="url"
                              autoComplete="url"
                              pattern="https://.*"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm  dark:text-gray-200 dark:border-teams_brand_border dark:bg-teams_dark_mode  dark:text-gray-200"
                              placeholder="https://"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-teams_brand_foreground_bg px-4 py-2 font-medium text-white shadow-sm  hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={() => {}}
                      >
                        {t('save')}
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:bg-teams_dark_mode dark:border dark:border-gray-200 dark:text-white"
                        onClick={() => {
                          props.onClose(false);
                        }}
                        ref={cancelButtonRef}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  };
  if (!current_member) return <></>;

  return (
    <>
      <form className="divide-y divide-gray-200 dark:divide-teams_brand_border lg:col-span-10" onSubmit={handleSubmit(onSubmit)}>
        {/* Profile section */}
        <div className="px-4 py-6 sm:p-6 lg:pb-8">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900  dark:text-gray-200">{t('Webhooks')}</h2>
            <p className="mt-1 text-sm text-gray-500  dark:text-gray-200">{t('Webhooks_description')}</p>
            <a
              href="https://absentify.com/docs/api-reference/webhooks"
              target="_blank"
              className="mt-1 text-sm text-gray-500 underline  dark:text-gray-200"
            >
              {t('Webhooks_description_2')}
            </a>
            {!hasValidSubscription && (
              <div className="relative z-0 mt-5 flex w-full items-center rounded-md bg-teams_brand_50 py-5 px-6 text-left dark:bg-teams_dark_mode">
                <div className="w-full text-sm  dark:text-gray-200">
                  {t('Webhooks_description_available_in_plan') + ' '}
                  <Link href="/settings/organisation/upgrade" className="transition-color underline duration-200  dark:text-gray-200">
                    {t('Webhooks_description_available_in_plan_2')}
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="mt-10 h-5 w-full divide-y divide-gray-200 dark:divide-teams_brand_border"></div>

          <div className="flex flex-col space-y-3 ">
            <h3 className="text-base font-medium  dark:text-gray-200">{t('URLs_for_receiving_webhooks')}</h3>
            <p className="text-sm  dark:text-gray-200">{t('URLs_for_receiving_webhooks_description')}</p>
          </div>

          <div className="mt-5 flex sm:items-center sm:space-x-3 space-x-6">
            <div className=" ">
              {' '}
              <label htmlFor="location" className="sr-only  dark:text-gray-200">
                {t('select_event')}
              </label>
              <select
                id="event"
                {...register('event', { required: true })}
                className=" block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-teams_brand_500 focus:outline-none focus:ring-teams_brand_500 sm:text-sm  dark:bg-teams_dark_mode dark:border-teams_brand_border  dark:text-gray-200"
              >
                <option value="request_created;request_status_changed"> {t('all')} </option>
                <option value="request_created">{t('created')} </option>
                <option value="request_status_changed"> {t('statusChanged')}</option>
              </select>
            </div>
            <div className="w-full pl-0 pr-0  sm:max-w-xs sm:pt-0 lg:pl-4 lg:pr-1 lg:pt-0">
              <label htmlFor="webhook" className="sr-only  dark:text-gray-200">
                {t('Webhook')}
              </label>
              <input
                {...register('url', { required: true })}
                type="url"
                name="url"
                pattern="https://.*"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm  dark:bg-teams_dark_mode  dark:text-gray-200 dark:border-teams_brand_border"
                placeholder="https://"
              />
            </div>
            <button
              disabled={!hasValidSubscription}
              type="submit"
              className={` ${
                !hasValidSubscription
                  ? 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-teams_brand_foreground_bg dark:text-gray-200'
                  : ' border-transparent  bg-teams_brand_foreground_bg  text-white  hover:bg-teams_brand_background_2 '
              } bordershadow-sm inline-flex w-3/5 items-center justify-center rounded-md px-4 py-2 font-medium  focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0  sm:w-auto sm:text-sm `}
            >
              {addWebhookSetting.isLoading && (
                <div className="-ml-1 mr-3">
                  <Loader />
                </div>
              )}
              {!hasValidSubscription ? t('WebhookLimitReached') : t('Add')}
            </button>
          </div>

          {
            //allWebhookSettings ?.filter((x) => x.source == 'Website')
            allWebhookSettings?.map((webhookSetting) => (
              <div key={webhookSetting.id} className="mt-5 sm:flex sm:items-center">
                <div className="inline-flex w-auto ">
                  <label htmlFor="webhook" className="sr-only  dark:text-gray-200">
                    {t('Webhook')}
                  </label>

                  <div className="w-44 py-2 text-sm  dark:text-gray-200">
                    {webhookSetting.event === 'request_created;request_status_changed' && t('all')}
                    {webhookSetting.event === 'request_created' && t('created')}
                    {webhookSetting.event === 'request_status_changed' && t('statusChanged')}
                  </div>
                  <div className=" px-2.5 ">
                    <p
                      className="w-20 cursor-pointer truncate py-2 text-sm font-semibold lg:w-72  dark:text-gray-200"
                      data-tooltip-id="url-tooltip"
                      data-tooltip-variant="light"
                      data-tooltip-content={webhookSetting.url}
                    >
                      {webhookSetting.url}
                    </p>
                    <ReactTooltip
                      id="url-tooltip"
                      className="z-50 shadow-sm  dark:text-gray-200 dark:bg-teams_brand_thead"
                      classNameArrow="shadow-sm"
                      place="bottom"
                      style={{ boxShadow: '0 0 10px rgba(0,0,0,.1)' }}
                    />
                    <span className="stooltip rounded bg-white p-2 text-xs shadow-custom  dark:bg-teams_brand_tbody  dark:text-gray-200">{}</span>
                  </div>
                  <div className="inline-flex cursor-pointer space-x-2 py-2">
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        setModalOpen1(true);
                        setValueForEdit(webhookSetting);
                      }}
                    >
                      <label htmlFor="EditIcon" className="sr-only  dark:text-gray-200">
                        {t('Edit')}
                      </label>
                      <svg
                        className="h-5 w-5 text-gray-300 hover:text-gray-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                      </svg>
                    </div>
                    <div
                      onClick={async (e) => {
                        e.preventDefault();
                        setModalOpen(true);
                        setValueForDelete(webhookSetting);
                      }}
                    >
                      <label htmlFor="TrashIcon" className="sr-only">
                        {t('Trash')}
                      </label>
                      <svg
                        className="h-5 w-5 text-gray-300 hover:text-gray-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </div>
                  </div>
                </div>
                {/*  <button
                type="button"
                className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-black border-gray-500   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {t('Test')}
              </button> */}
              </div>
            ))
          }
          <hr className="mt-4 dark:border dark:border-teams_brand_border" />
          <div className="mt-4 flex justify-between ">
            <div className="block">
              <h2 className="text-base font-semibold  dark:text-gray-200"> {t('history')} </h2>
              <h3 className="text-sm  dark:text-gray-200">{t('allLog')}</h3>
            </div>
            <div>
              <Link href={'/settings/organisation/integrations/webhooks/history'} legacyBehavior>
                <p className="mt-2 inline-flex cursor-pointer rounded-lg  border-2  border-teams_brand_foreground_bg p-2 text-sm  text-teams_brand_foreground_bg hover:border-teams_brand_foreground_bg hover:text-teams_brand_background_2  dark:text-gray-200">
                  {t('notif')}
                  <span>
                    <svg
                      className="h-4 w-4 pt-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                      <path
                        fillRule="evenodd"
                        d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </span>
                </p>
              </Link>
            </div>
          </div>
        </div>

        {modalOpen && (
          <Modal
            open={modalOpen}
            value={valueForDelete}
            onClose={() => {
              setModalOpen(false);
            }}
          ></Modal>
        )}

        {modalOpen1 && (
          <Modal1
            open={modalOpen1}
            value={valueForEdit}
            onClose={() => {
              setModalOpen1(false);
            }}
          ></Modal1>
        )}
      </form>
    </>
  );
};

export default Webhooks;
