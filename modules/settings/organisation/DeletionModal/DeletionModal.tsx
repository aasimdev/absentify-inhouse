
import { Dialog, Transition } from '@headlessui/react';
import useTranslation from "next-translate/useTranslation";
import { Fragment, useState, useRef } from 'react';
import { ModalOption } from "./ModalOption";
import { ModalTitle } from "./ModalTitle";
import { Steps } from "./Steps";
import { ModalTextArea } from "./ModalTextArea";
import { notifyError } from "~/helper/notify";
export const DeletionModal = (props: {
  onClose: () => void,
  onConfirm: (text: string, options: Array<string>) => void,
}) => {
  const { t } = useTranslation('deletion_reason');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [options, setOptions] = useState<Array<string>>([]);
  const [showTextArea, setShowTextArea] = useState(false);
  const [page, setPage] = useState(0);
  const [reasonText, setReasonText] = useState('');
  const handleProceed = (pageNumber: number, newOption: string | null) => {
    if(!newOption && !showTextArea) {
      notifyError(t('Must_choose'));
    } else if(showTextArea) {
      if(reasonText.trim().length === 0) {
        notifyError(t('Other_cannot'))
        return;
      }
      setOptions((prevOption) => [...prevOption, reasonText]);
      setPage(pageNumber);
      setShowTextArea(false);
    } else if(newOption) {
      setOptions((prevOption) => [...prevOption, newOption]);
      setPage(pageNumber);
      setShowTextArea(false);
    }
  }

  const handleBackOption = () => {
   if (page === 0) {
    return;
   }
   setOptions((prevOp) => [...prevOp.slice(0, prevOp.length - 1)])
   setSelectedOption(null);
   setReasonText('');
   setPage((prevPage) => prevPage - 1)
  }

  const handleAddOption = (option: string) => {
    setSelectedOption(option);
    setShowTextArea(false);
  };
  const handleReasonText = (text: string) => {
    setReasonText(text);
  }

  const handleOpenTextArea = () => {
    setShowTextArea(true);
    setSelectedOption(null);
    if(reasonText.trim().length > 0) {
      setSelectedOption(reasonText);
      setReasonText('');
    }
  }
  const firstOptions = ["Not_useful_right_now", "Didn't_see_the_value", "Poor_support", "Missing_features", "Hard_to_use"];
  const secondOptions = ["Many_things_I_will_be_back", "Good_value", "Helpful_support", "Easy_to_use"];

  function checkedPage(value: number) {
    switch (value) {
      case 0:
        return <>
        <ModalTitle firstTitle={t('We_are_sorry_first')} secondTitle={t('We_are_sorry_second')} />
        <div className="m-8">
        {firstOptions.map((option, index) => (
        <ModalOption handleOnClick={handleAddOption} text={option} active={option === selectedOption} key={index}/>
        ))}
        <ModalOption handleOnClick={handleOpenTextArea} text={t("Other")} active={showTextArea}/>
        {showTextArea && (
          <>
          <ModalTextArea handleReasonText={handleReasonText} text={t('Enter_here')} row={3}/>
          </> 
        )}
        <div className="flex justify-end mt-4">
          <button
            type="button" onClick={() => handleProceed(1, selectedOption)}
            className="rounded-md bg-teams_brand_foreground_bg px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 "
          >
            {t('Next')}
          </button>
          </div>
        </div>
        </>;
      case 1:
        return <>
        <ModalTitle firstTitle={t('It_wasnt_bad')} secondTitle={t('Did_we_do_anything_well')} />
        <div className="m-8">
        {secondOptions.map((option, index) => (
        <ModalOption handleOnClick={handleAddOption} text={option} active={option === selectedOption} key={index}/>
        ))}
        <ModalOption handleOnClick={handleOpenTextArea} text={t("Other")} active={showTextArea}/>
        {showTextArea && (
          <>
          <ModalTextArea handleReasonText={handleReasonText} text={t('What_you_liked')} row={3}/>
          </>
        )}
        <div className="flex justify-between mt-4">
        <button
            type="button" onClick={handleBackOption}
            className="rounded-md bg-teams_brand_foreground_bg px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
          >
            {t('Back')}
          </button>
          <button
            type="button" onClick={() => handleProceed(2, selectedOption)}
            className="rounded-md bg-teams_brand_foreground_bg px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-teams_brand_background_2"
          >
            {t('Next')}
          </button>
          </div>
        </div>
        </>;
      case 2:
        return <>
        <ModalTitle firstTitle={t('Well_miss')} />
        <div className="m-8 mb-4">
        <ModalTextArea handleReasonText={handleReasonText} text={t('If_theres_anything')} row={8}/> 
        <div className="flex justify-between align-middle mt-4">
        <button
            type="button" onClick={handleBackOption}
            className="rounded-md bg-teams_brand_foreground_bg px-2.5 py-1.5 font-semibold text-white shadow-sm hover:bg-teams_brand_background_2 dark:bg-teams_brand_dark_100 dark:border dark:border-gray-200 dark:text-white"
          >
            {t('Back')}
        </button>
        <button
          type="button"
          className=" flex justify-center rounded-md border border-transparent bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          onClick={() => props.onConfirm(reasonText, options)}
        >
          {t('Confirm_Cancel')}
        </button>
          </div>
          <span className=" text-xs text-gray-400">{t('Deleteion_alert')}</span>
        </div>
      </>;
      default:
        return null;
    }
  }
  

  return(
      <Transition appear show={!!props.onClose} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 z-30 overflow-y-auto" onClose={() => {}}>
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
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all dark:bg-teams_brand_dark_100">
                  {checkedPage(page)}
                  <div className="border border-b-gray-300 py-8 dark:border-0">
                  <div className="mb-6">
                    <Steps page={page}/>
                  </div>
                  <button type="button" onClick={props.onClose} className="block w-full text-xs text-gray-400 text-center font-semibold">
                    {t('Nevermind')}
                  </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  )
}