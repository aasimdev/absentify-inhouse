import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Switch, Transition } from '@headlessui/react';
import useTranslation from 'next-translate/useTranslation';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { api } from '~/utils/api';

import { classNames } from 'lib/classNames';

import { notifyError, notifySuccess } from '~/helper/notify';
import Loader from '@components/calendar/Loader';

export default function SetEmailModal(props: {
  open: boolean;
  onClose: Function;
  member_id: string;
  email: string | null;
}) {
  const utils = api.useContext();
  const cancelButtonRef = useRef(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { t, lang } = useTranslation('users');
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    getValues
  } = useForm<{ email: string; send_invitation_email: boolean }>();

  const updateMemberEmail = api.member.updateMemberEmail.useMutation();
  const { refetch: checkHasAccount } = api.member.byEmail.useQuery(
    { email: getValues('email') ?? '' },
    {
      enabled: false
    }
  );
  useEffect(() => {
    if (!props.email) return;
    setValue('email', props.email);
  }, [props.email]);
  const onSubmit: SubmitHandler<{ email: string; send_invitation_email: boolean }> = async (data: {
    email: string;
    send_invitation_email: boolean;
  }) => {
    if (!data.email) return;
    setLoading(true);
    let hasAccountRes = await checkHasAccount();

    if (hasAccountRes.data) {
      notifyError(t('AccountAlreadyExists'));
      setLoading(false);
      return;
    }

    await updateMemberEmail.mutateAsync(
      {
        email: data.email.toLowerCase(),
        member_id: props.member_id,
      },
      {
        onSuccess: async () => {
          await utils.member.all.invalidate();
          notifySuccess(data.send_invitation_email ? t('User_invited_successfully') : t('User_created_successfully'));
          if (typeof umami !== 'undefined') umami.track('InviteAUser');
          setLoading(false);
          props.onClose();
        },
        onError: (error) => {
          notifyError(error.message);

          setLoading(false);
          return;
        }
      }
    );
  };
  return (
    <Transition.Root show={props.open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-30"
        initialFocus={cancelButtonRef}
        onClose={() => {
          props.onClose();
        }}
      >
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <form>
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        {t('Set_an_E_Mail_for_the_user')}
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">{t('Set_an_E_Mail_for_the_user_description')}</p>
                        <p className="text-sm text-gray-500 mt-2">{t('Set_an_E_Mail_for_the_user_description2')} </p>
                      </div>
                      <div className="mt-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('Email')}
                        </label>
                        <div className="flex mt-1 rounded-md shadow-sm">
                          <input
                            {...register('email', { required: true })}
                            type="email"
                            name="email"
                            id="email"
                            autoComplete="email"
                            className={`block flex-grow w-full min-w-0 rounded-md ${
                              errors.email ? 'border-red-400 ' : 'border-gray-300'
                            }  focus:ring-teams_brand_500 focus:border-teams_brand_500 sm:text-sm`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={() => {
                        handleSubmit(onSubmit)();
                      }}
                      className="inline-flex justify-center px-4 py-2 ml-5 text-sm font-medium text-white bg-teams_brand_foreground_bg rounded-md border border-transparent shadow-sm hover:bg-teams_brand_background_2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teams_brand_500"
                    >
                      {loading && (
                        <div className="-ml-1 mr-3">
                          <Loader />
                        </div>
                      )}
                      {t('Save')}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={() => {
                        props.onClose();
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
}
