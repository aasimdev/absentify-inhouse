import { AllowanceUnit } from '@prisma/client';
import useTranslation from 'next-translate/useTranslation';
import { useState, useEffect } from 'react';

export const InputPicker = (props: {
  unit: AllowanceUnit;
  value: number;
  className?: string;
  onChange: (newValue: number) => void;
}) => {
  const calculateMinutes = (value: number) => {
    let minutes = value % 60;
    if (minutes < 0) {
      minutes += 60;
    }
    return minutes;
  };

  const handleMinutesChange = (value: string) => {
    const parsedValue = parseInt(value, 10);
    if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
      setMinutes(parsedValue);
    } else if (value === '') {
      setMinutes('');
    }
  };

  const { t } = useTranslation('common');

  const preventInvalidKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'e' || event.key === '+') {
      event.preventDefault();
    }
  };

  const [hours, setHours] = useState<number | string>(Math.floor(props.value / 60));
  const [minutes, setMinutes] = useState<number | string>(calculateMinutes(props.value));
  const [days, setDays] = useState<number>(props.value);

  useEffect(() => {
    if(typeof minutes === 'string') return;
    if(typeof hours === 'string') return;
    if (props.unit == 'days') {
      props.onChange(days);
      return;
    }
    if (props.value == hours * 60 + minutes) return;
    props.onChange(hours * 60 + minutes);
    // eslint-disable-next-line
  }, [hours, minutes, days]);

  useEffect(() => {
    setHours(Math.floor(props.value / 60));
    setMinutes(calculateMinutes(props.value));
    setDays(props.value);
  }, [props.value]);
  const numberInputOnWheelPreventChange = (e:any) => {
    // Prevent the input value change
    e.target.blur()

    // Prevent the page/container scrolling
    e.stopPropagation()

    // Refocus immediately, on the next tick (after the current   function is done)
      setTimeout(() => {
        e.target.focus()
    }, 0)
}

  if (props.unit == 'days') {
    return (
      <input
        type="number"
        onChange={(x) => {
          if(!isNaN(parseFloat(x.target.value))){
            setDays(parseFloat(x.target.value));
          } else {
            setDays(0)
          }
        }}
        onWheel={numberInputOnWheelPreventChange} // Disable scrolling to change value
        className={
          props.className ??
          'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-gray-200 focus:outline-none focus:ring-transparent sm:text-sm'
        }
        value={props.value}
        step={0.5}
      ></input>
    );
  }

  return (
    <div className="flex">
      <div className="relative mt-2 rounded-md shadow-sm">
        <input
          type="number"
          max={999}
          onWheel={numberInputOnWheelPreventChange} // Disable scrolling to change value
          onChange={(x) => {
            const newHours = parseInt(x.target.value, 10);
            if (!isNaN(newHours) && newHours <= 999 && newHours >= -999) {
              setHours(newHours);
            } else if (x.target.value === '') {
              setHours('');
            }
          }}
          onKeyDown={preventInvalidKeys}
          
          onBlur={(x) => {
            if (x.target.value === '') {
              x.target.value = '0';
              setHours(0);
            }
            if (!minutes) {
              setMinutes(0);
            }
          }}
          className={
            props.className ??
            'block w-full rounded-md border-0 py-1.5 pl-4 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teams_brand_600 sm:text-sm sm:leading-6'
          }
          value={hours}
          step={1}
        ></input>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <span className="text-gray-500 sm:text-sm">{t('hours_unit')}</span>
        </div>
      </div>
      <div className="relative mt-2 rounded-md shadow-sm">
        <input
          type="number"
          max={59}
          onChange={(x) => handleMinutesChange(x.target.value)}
          onKeyDown={preventInvalidKeys}
          onBlur={(x) => {
            if (x.target.value === '') {
              x.target.value = '0';
              setMinutes(0);
            }
            if (!hours) {
              setHours(0);
            }
          }}
          onWheel={numberInputOnWheelPreventChange} // Disable scrolling to change value
          className={
            props.className ??
            'block w-full rounded-md border-0 py-1.5 pl-4 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teams_brand_600 sm:text-sm sm:leading-6'
          }
          value={minutes}
          step={1}
        ></input>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <span className="text-gray-500 sm:text-sm">{t('minutes_unit')}</span>
        </div>
      </div>
    </div>
  );
};
