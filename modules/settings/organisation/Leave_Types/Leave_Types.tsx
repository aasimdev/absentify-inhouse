import type { NextPage } from 'next';
import {  useEffect, useState } from 'react';
import Modal from './Modal';
import { TwitterPicker } from 'react-color';
import OutsideAlerter from '../../../../components/OutsideAlerter';
import IconPicker from './IconPicker';
import useTranslation from 'next-translate/useTranslation';
import { type LeaveType } from '@prisma/client';
import { api, type RouterOutputs } from '~/utils/api';
import { closestCenter, DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { notifyError, notifySuccess } from '~/helper/notify';
import { useAbsentify } from '@components/AbsentifyContext';
import ConfirmModal from '@components/confirmModal';
import { tr } from 'date-fns/locale';

const Leave_Types: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['leave_type']['all'][0] | null>(null);

  const [items, setItems] = useState<UniqueIdentifier[]>([]);

  const { data: leave_types, refetch: refetchLeaveTypes } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const changeOrder = api.leave_type.changeOrder.useMutation();
  //create a function that will return a boolean if the leave type at the last two position
  const isLastTwo = (leave_type_id: string) => {
    const index = leave_types && leave_types.findIndex((x) => x.id === leave_type_id);
    if (index) return index >= leave_types.length - 2;
  };
  useEffect(() => {
    if (!leave_types) return;
    setItems(leave_types?.filter((x) => !x.deleted).map((leave_type) => leave_type.id));
  }, [leave_types]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        changeOrder.mutateAsync(
          {
            ids: newOrder.map((x) => x + '')
          },
          {
            async onSuccess() {
              await refetchLeaveTypes();
              notifySuccess(t('Saved_successfully'));
            },
            onError(error) {
              notifyError(error.message);
            }
          }
        );

        return newOrder;
      });
    }
  };

  return (
    <form className="divide-y divide-gray-200 lg:col-span-10" action="#" method="POST">
      {/* Profile section */}
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('Leave_types_title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('Leave_types_description')}</p>
        </div>
        <div className="mt-6 flex flex-col ">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-6">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 dark:bg-teams_brand_dark_500">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-200"
                        >
                          {t('Name')}
                        </th>
                        <th
                          scope="col"
                          className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                        >
                          {t('Leave_types_Color')}
                        </th>
                        <th
                          scope="col"
                          className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell dark:text-gray-200"
                        >
                          {t('Leave_types_Icon')}
                        </th>

                        <th scope="col" className="relative px-6 py-3"></th>
                        <th scope="col" className="relative px-6 py-3"></th>
                        <th scope="col" className="relative px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                      <SortableContext items={items} strategy={verticalListSortingStrategy}>
                        {items.map((id) => (
                          <SortableItem
                            key={id}
                            leave_type_id={id + ''}
                            setValueForEdit={(e: RouterOutputs['leave_type']['all'][0]) => {
                              setValueForEdit(e);
                            }}
                            setModalOpen={(e: boolean) => {
                              setModalOpen(e);
                            }}
                            lastTwo={isLastTwo(id + '') as boolean}
                          />
                        ))}
                      </SortableContext>

                      <tr>
                        <td
                          className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200"
                          colSpan={8}
                          onClick={(e) => {
                            e.preventDefault();
                            setValueForEdit(null);
                            setModalOpen(true);
                          }}
                        >
                          <div className="flex">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="ml-2"> {t('Leave_types_new')} </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </DndContext>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <Modal
          open={modalOpen}
          value={valueForEdit}
          onClose={() => {
            setModalOpen(false);
          }}
        ></Modal>
      )}
    </form>
  );
};

export default Leave_Types;

const SortableItem = (props: {
  leave_type_id: string;
  setValueForEdit: Function;
  setModalOpen: Function;
  lastTwo: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.leave_type_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const { t } = useTranslation('settings_organisation');
  const { data: leave_types, refetch: refetchLeaveTypes } = api.leave_type.all.useQuery(undefined, {
    staleTime: 60000
  });
  const { current_member } = useAbsentify();
  const editLeaveType = api.leave_type.edit.useMutation();
  const [openColorPicker, setOpenColorPicker] = useState<string | null>();
  const [valueForDelete, setValueForDelete] = useState<LeaveType | null>(null);

  const [leave_type, setLeaveType] = useState<LeaveType>();
  useEffect(() => {
    if (!leave_types) return;
    setLeaveType(leave_types.find((x) => x.id === props.leave_type_id));
  }, [leave_types]);

  const saveLeaveType = async (leave_type: LeaveType) => {
    await editLeaveType.mutateAsync(
      {
        id: leave_type.id,
        data: { ...leave_type, name: leave_type.name.trim() }
      },
      {
        async onSuccess() {
          await refetchLeaveTypes();
          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  const handleDelete = async (leave_type: LeaveType | null) => {
    if (!leave_type) return;
    if (!current_member) return;

    leave_type.deleted = true;
    leave_type.deleted_at = new Date();
    leave_type.deleted_by_member_id = current_member.id + '';

    await editLeaveType.mutateAsync(
      {
        id: leave_type.id,
        data: leave_type
      },
      {
        async onSuccess() {
          await refetchLeaveTypes();
          notifySuccess(t('Deleted_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };

  if (!leave_type) return <></>;
  return (
    <>
      <tr key={leave_type.id} ref={setNodeRef} style={style} {...attributes} className="cursor-default">
        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200">
          <span className="w-24 truncate">{leave_type.name}</span>
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 md:table-cell dark:text-gray-200 dark:bg-teams_brand_dark-100">
          <div
            onClick={(e) => {
              e.preventDefault();
              setOpenColorPicker(leave_type.id);
            }}
            className={'h-4 w-4 cursor-pointer'}
            style={{ backgroundColor: leave_type.color }}
          ></div>
          {openColorPicker == leave_type.id && (
            <div className="absolute z-10 dark:bg-teams_brand_dark_100">
              <OutsideAlerter
                onClick={() => {
                  setOpenColorPicker(null);
                }}
              >
                <TwitterPicker
                  onChange={async (e) => {
                    leave_type.color = e.hex;
                    await saveLeaveType(leave_type);
                    setOpenColorPicker(null);
                  }}
                  className="fixed mt-2 -ml-3 dark:bg-teams_brand_dark_100"
                  styles={{
                    default: {
                      card: {
                        width: '272px',
                        // background: "#191919"
                      },
                      body: {
                        padding: '10px',
                        // background: "#191919"
                      },
                      input: {
                        height: '14px',
                        width: '90px'
                      },
                    }
                  }}
                ></TwitterPicker>
              </OutsideAlerter>
            </div>
          )}
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 md:table-cell">
          <IconPicker
            color={leave_type.color}
            onChange={async (e: string) => {
              leave_type.icon = e;
              await saveLeaveType(leave_type);
              setOpenColorPicker(null);
            }}
            value={leave_type.icon + ''}
            lastTwo={props.lastTwo}
          />
        </td>

        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
          <a
            onClick={async (e) => {
              e.preventDefault();
              props.setValueForEdit(leave_type);
              props.setModalOpen(true);
            }}
            className="cursor-pointer text-gray-300 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </a>
        </td>

        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
          <a
            onClick={() => {
              setValueForDelete(leave_type);
            }}
            className="cursor-pointer text-gray-300 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
          <a {...listeners} className="cursor-move text-gray-300 hover:text-gray-900 dark:hover:text-gray-200">
            <Squares2X2Icon height={20} />
          </a>
        </td>
      </tr>
      {valueForDelete && (
        <ConfirmModal
          text={t('Delete')}
          handleCallback={() => {
            handleDelete(valueForDelete);
          }}
          onClose={() => {
            setValueForDelete(null);
          }}
        />
      )}
    </>
  );
};
