import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
type CustomHeaderProps = {
  date: Date;
  changeYear: (year: number) => void;
  decreaseMonth: () => void;
  increaseMonth: () => void;
  prevMonthButtonDisabled: boolean;
  nextMonthButtonDisabled: boolean;
};

export const CustomHeader = ({ date, changeYear, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: CustomHeaderProps) => {
  const [yearEditMode, setYearEditMode] = useState(false);
  const [editedYear, setEditedYear] = useState(date.getFullYear().toString());

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newYear = e.target.value;
    if (/^\d*$/.test(newYear)) {
      setEditedYear(newYear);
    }
  };

  const handleYearBlur = () => {
    let numYear = editedYear ? parseInt(editedYear, 10) : NaN;
    if (!isNaN(numYear) && numYear >= 1900 && numYear <= new Date().getFullYear()) {
      changeYear(numYear);
      setYearEditMode(false);
    } else {
      const validYear = numYear < 1900 ? 1900 : date.getFullYear();
      setEditedYear(validYear.toString());
      setYearEditMode(false);
      changeYear(validYear);
    }
  };

  return (
    <div className="flex items-center justify-between p-2">
      <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} type="button" className="disabled:opacity-50">
       <ArrowLeftIcon className="h-4 w-4 text-gray-400"/>
      </button>
      <div className="flex items-center">
        <span className="text-base font-semibold mr-2">{date.toLocaleString('default', { month: 'long' })}</span>
        {yearEditMode ? (
          <input
            autoFocus
            value={editedYear}
            onChange={handleYearChange}
            onBlur={handleYearBlur}
            type="text"
            inputMode="numeric"
            className="text-base font-semibold w-16 border-gray-400 rounded-md h-8 mt-0.5"
            pattern="\d*"
            maxLength={4}
          />
        ) : (
          <span className=" text-base font-semibold cursor-pointer" onClick={() => setYearEditMode(true)}>
            {date.getFullYear()}
          </span>
        )}
      </div>
      <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} type="button" className="disabled:opacity-50">
       <ArrowRightIcon className="h-4 w-4 text-gray-400"/>
      </button>
    </div>
  );
};

