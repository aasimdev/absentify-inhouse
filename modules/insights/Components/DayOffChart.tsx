import useTranslation from 'next-translate/useTranslation';
import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, ArcElement, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { AllowanceUnit } from '@prisma/client';
import { formatDuration } from '~/helper/formatDuration';

const DayOffChart: React.FC<{
  data: {
    booked: number;
    remaining: number;
    totalAllowance: number;
  };
  nbrEmployees: number;
  allowanceUnit: AllowanceUnit;
}> = (props) => {
  const { t, lang } = useTranslation('insights');
  ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip);
  const options: any = {
    plugins: {
      legend: {
        display: false
      }
    },
    responsive: true,
    layout: {
      paddingLeft: 0
    }
  };

  const labels = ['Booked', 'Remaining'];
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    setData({
      labels,
      datasets: [
        {
          label: labels,
          data: [props.data.booked, props.data.remaining],
          backgroundColor: ['rgb(91,95,199)', 'rgb(189,189,229)']
        }
      ]
    });
  }, [props.data]);

  if (!data || !data.labels) return <></>;

  return (
    <div className="lg:inline-flex md:flex-row flex-col flex w-full flex-wrap md:flex-wrap lg:pr-4 px-6 md:space-x-10 sm:space-x-0 justify-center  dark:bg-teams_brand_dark_100">
      <div className="w-auto mx-auto">
        <Doughnut data={data} options={options} style={{ maxWidth: '111px' }} />
      </div>

      <div
        className=" py-4 px-0 ml-0 lg:px-0 font-normal text-sm md:px-4 flex space-x-0 flex-wrap md:flex-wrap sm:space-x-0 lg:space-x-5 space-y-2 lg:space-y-2 md:space-y-0 md:space-x-4 my-auto justify-center
 "
      >
        <div className="flex flex-col lg:flex-row  md:flex-row space-x-3 lg:mt-2 w-full md:w-auto lg:w-auto justify-center lg:pt-0 sm:pt-2">
          <div className=" lg:inline-block block h-4 w-10 bg-[#5b5fc7] p-2 mt-3 mx-auto "> </div>
          <div className="lg:inline-block block py-3 md:py-0 lg:py-0">
            <p className="text-center dark:text-gray-200">{t('booked')}</p>
            {props.data ? (
              <>
                <span className=" flex items-center justify-center text-base dark:text-gray-200">
                  {formatDuration(props.data.booked, lang, props.allowanceUnit, true, t)}
                </span>
              </>
            ) : (
              0
            )}
          </div>
        </div>
        <div className="lg:flex block"> </div>
        <div className="flex space-x-3  w-full md:w-auto lg:w-auto justify-center lg:pt-0 sm:pt-2 flex-col lg:flex-row md:flex-row">
          <div className="  inline-block h-4 w-10 bg-[#bdbde5] p-2 mt-3 mx-auto"> </div>
          <div className="inline-block py-3 md:py-0 lg:py-0">
            <p className="text-center dark:text-gray-200">{t('remaining')}</p>
            {props.data ? (
              <>
                <span className=" flex items-center justify-center text-base dark:text-gray-200">
                  {formatDuration(props.data.remaining, lang, props.allowanceUnit, true, t)}
                </span>
              </>
            ) : (
              0
            )}
          </div>
        </div>
        <div className="flex mt-2  w-full lg:w-auto md:w-auto justify-center lg:pt-0 sm:pt-2 dark:text-gray-200"> =</div>
        <div className="block mx-auto  w-full md:w-auto lg:w-auto justify-center lg:pt-0 sm:pt-2">
          <p className="text-center dark:text-gray-200">{t('totalAllowance')}</p>
          {props.data ? (
            <>
              <span className=" flex items-center justify-center text-base dark:text-gray-200">
                {formatDuration(props.data.totalAllowance, lang, props.allowanceUnit, true, t)}
              </span>
            </>
          ) : (
            0
          )}
        </div>
        <div className="block lg:pt-0 sm:pt-2  ">
          <p className='dark:text-gray-200'>{t('nbrOfEmployees')}</p>
          <span className=" flex items-center justify-center text-base dark:text-gray-200">{props.nbrEmployees}</span>
        </div>
      </div>
    </div>
  );
};

export default DayOffChart;
