import { api, type RouterOutputs } from '~/utils/api';
import { useState } from 'react';
import Add from './Add';
import useTranslation from 'next-translate/useTranslation';
import { type PublicHoliday } from '@prisma/client';
import { format } from 'date-fns';
import { useAbsentify } from '@components/AbsentifyContext';
import { dateToIsoDate } from 'lib/DateHelper';
import { notifySuccess, notifyError } from '~/helper/notify';
import ConfirmModal from '@components/confirmModal';
import EditDayModal from './EditDayModal';
const Table = (props: { public_holiday: PublicHoliday; year: number }) => {
  const { t } = useTranslation('settings_organisation');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [valueForEdit, setValueForEdit] = useState<RouterOutputs['public_holiday_day']['byId'] | null>(null);

  const deletePublicHolidayDay = api.public_holiday_day.delete.useMutation();
  const editPublicHolidayDay = api.public_holiday_day.editHolidayDay.useMutation();
  const { current_member } = useAbsentify();
  const { data: publicHolidayDays, refetch: refetchPublicHolidayDays } = api.public_holiday_day.all.useQuery(
    {
      public_holiday_id: props.public_holiday.id,
      start: new Date(Date.UTC(props.year, 0, 1)),
      end: new Date(Date.UTC(props.year, 11, 31))
    },
    { staleTime: 60000 }
  );
  const [valueForDelete, setValueForDelete] = useState<RouterOutputs['public_holiday_day']['byId'] | null>(null);
  const [valueForEditDay, setValueForEditDay] = useState<RouterOutputs['public_holiday_day']['byId'] | null>(null);
  const handleClose = () => {
    setValueForEditDay(null);
  };
  const handleEditDay = async (
    holiday: RouterOutputs['public_holiday_day']['byId'] | null,
    customName: string,
    language: string
  ) => {
    if (!holiday?.id) return;
    if (customName.trim() === '') {
      notifyError(t('name_cannot_be_empty'));
      return;
    }
    await editPublicHolidayDay.mutateAsync(
      {
        name: customName,
        language: language,
        public_holiday_day_id: holiday.id
      },
      {
        async onSuccess() {
          await refetchPublicHolidayDays();
          notifySuccess(t('Saved_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };
  const handleDelete = async (holiday: RouterOutputs['public_holiday_day']['byId'] | null) => {
    if (!holiday) return;

    await deletePublicHolidayDay.mutateAsync(
      { id: holiday.id },
      {
        async onSuccess() {
          await refetchPublicHolidayDays();
          notifySuccess(t('Deleted_successfully'));
        },
        onError(error) {
          notifyError(error.message);
        }
      }
    );
  };
  if (!current_member) return <></>;
  return (
    <>
      <table className="min-w-full divide-y divide-gray-200 border z-0">
        <thead className="bg-gray-50 dark:bg-teams_brand_dark_100">
          <tr>
            <th
              scope="col"
              colSpan={2}
              className="px-6 py-3 text-center text-xs font-medium  uppercase tracking-wider text-gray-500 dark:text-gray-200"
            >
              {t('Name')}
            </th>

            <th scope="col" className="relative px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100">
          {publicHolidayDays
            ?.filter((x) => x.year == props.year)
            .map((holiday) => (
              <tr key={holiday.id}>
                <td colSpan={2} className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200 dark:bg-teams_brand_dark_100 ">
                  <div className="w-32 truncate dark:text-gray-200">{holiday.name} </div>
                  <div className="dark:text-gray-200">{format(dateToIsoDate(holiday.date), current_member?.date_format)}</div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap dark:text-gray-200 dark:bg-teams_brand_dark_100">
                  {holiday.custom_value && (
                    <a
                      onClick={() => {
                        if (!holiday.custom_value) return;
                        setValueForEditDay(holiday);
                      }}
                      className="text-gray-300 cursor-pointer hover:text-gray-900 dark:text-gray-200"
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
                  )}
                </td>

                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <a
                    onClick={() => {
                      setValueForDelete(holiday);
                    }}
                    className="cursor-pointer text-gray-300 hover:text-gray-900 dark:text-gray-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 dark:text-gray-200" viewBox="0 0 20 20" fill="currentColor">
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
              className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-200"
              colSpan={8}
              onClick={(e) => {
                e.preventDefault();
                setValueForEdit(null);
                setModalOpen(true);
              }}
            >
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 dark:text-gray-200" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>{' '}
                <span className="ml-2 dark:text-gray-200"> {t('Add_public_holiday_day')}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {modalOpen && !valueForEdit && (
        <Add
          public_holiday_id={props.public_holiday.id}
          year={props.year}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
          }}
        ></Add>
      )}
      {valueForDelete && (
        <ConfirmModal
          text={t('delete')}
          handleCallback={() => {
            handleDelete(valueForDelete);
          }}
          onClose={() => {
            setValueForDelete(null);
          }}
        />
      )}
      {valueForEditDay && (
        <EditDayModal handleEditDay={handleEditDay} holiday={valueForEditDay} onClose={handleClose} />
      )}
    </>
  );
};

export default Table;
