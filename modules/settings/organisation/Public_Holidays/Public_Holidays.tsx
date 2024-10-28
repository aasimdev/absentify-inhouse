import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import Add from './Add';

import useTranslation from 'next-translate/useTranslation';
import Edit from './Edit';
import { RouterOutputs, api } from "~/utils/api";
import { PublicHoliday } from '@prisma/client';

import { notifySuccess, notifyError } from '~/helper/notify';
import ConfirmModal from "@components/confirmModal";

const Departments: NextPage = () => {
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<PublicHoliday | null>(null);
  const [valueForDelete, setValueForDelete] = useState<PublicHoliday | null>(null);
    const { data: public_holidays, refetch: refetchPublicHolidayDays } = api.public_holiday.all.useQuery(undefined, {
        staleTime: 60000
    });
  const deletePublicHoliday = api.public_holiday.delete.useMutation();

  useEffect(() => {
    let x = public_holidays;
    //debugger;
  }, [public_holidays]);
  if (!public_holidays) return null;

  const handleDelete = async (holiday: PublicHoliday | null) => {
    if(!holiday) return;
    await deletePublicHoliday.mutateAsync(
      { id: holiday.id },
      {
        async onSuccess() {
          await refetchPublicHolidayDays();
          notifySuccess( t('Deleted_successfully') )
        },
        onError(error) {
          notifyError( error.message);
        }
      }
    );
  }

  return (
    <div className="divide-y divide-gray-200 lg:col-span-10">
      <div className="px-4 py-6 sm:p-6 lg:pb-8">
        <div>
          <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-200">{t('public_holidays_title')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-200">{t('public_holidays_description')}</p>
        </div>
        <div className="flex flex-col mt-6 ">
          <div className="overflow-x-auto -my-2 sm:-mx-6 lg:-mx-6 min-w-full">
            <div className="inline-block py-2 min-w-full align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden border-b dark:border-0 border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500">
                  <thead className="bg-gray-50 dark:bg-teams_brand_dark_100">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-200"
                      >
                        {t('Name')}
                      </th>

                      <th scope="col" className="relative px-6 py-3"></th>
                      <th scope="col" className="relative px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                    {public_holidays.map((holiday) => (
                      <tr key={holiday.id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap dark:text-gray-200">
                          {holiday.name}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap ">
                          <a
                            onClick={async (e) => {
                              e.preventDefault();
                              setValueForEdit(holiday);
                              setModalOpen(true);
                            }}
                            className="text-gray-300 cursor-pointer hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-5 h-5 dark:text-gray-200"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </a>
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                          <a
                            onClick={() => {
                              setValueForDelete(holiday);
                            }}
                            className="text-gray-300 cursor-pointer hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-5 h-5 dark:text-gray-200"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap cursor-pointer"
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
                            className="w-5 h-5 dark:text-gray-200"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                              clipRule="evenodd"
                            />
                          </svg>{' '}
                          <span className="ml-2 dark:text-gray-200">{t('Add_public_holiday')}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>{' '}
      </div>

      {modalOpen && !valueForEdit && (
        <Add
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
          }}
        ></Add>
      )}
      {modalOpen && valueForEdit && (
        <Edit
          open={modalOpen}
          value={valueForEdit}
          onClose={() => {
            setValueForEdit(null);
            setModalOpen(false);
          }}
        ></Edit>
      )}
      {valueForDelete && (<ConfirmModal 
      text={t('Delete')} 
      handleCallback={() => {handleDelete(valueForDelete)}}
      onClose={() => {
        setValueForDelete(null);
      }}
    />)}
    </div>
  );
};

export default Departments;
