import { getPrice } from 'lib/getPrice';
import { ReactNode } from 'react';
import { api } from '~/utils/api';
import Price from './Price';
import { useAbsentify } from '@components/AbsentifyContext';
import { PricePreviewResponse } from '@paddle/paddle-js';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

const Addon: React.FC<{
  children: ReactNode;
  title: string;
  price: number;
  button: JSX.Element;
  priceEach?: string;
}> = (props) => {
  const { current_member, paddleInstance } = useAbsentify();
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });
  const { data: paddlePrices, isLoading }: UseQueryResult<PricePreviewResponse, Error> = useQuery(
    ['getPaddlePrices'],
    () => getPrice(paddleInstance),
    { staleTime: 300000, enabled: paddleInstance != null }
  ); // 5 min

  return (
    <>
      {!current_member || !workspace || isLoading || !paddlePrices ? (
        <div className="min-w-40 mr-2 mb-2 flex h-auto w-full grow sm:w-52">
          <div className="border-element-10 flex h-auto grow flex-col rounded-md border p-5 transition-colors duration-300 lg:p-6">
            <div className="mx-auto w-full">
              <div className="flex animate-pulse space-x-4 pt-2">
                <div className="flex-1 space-y-6 py-1">
                  <div className="grid grid-cols-8 gap-4">
                    <div className="col-span-7 ml-4 h-5 rounded bg-gray-700"></div>
                  </div>
                </div>
              </div>
              <div className="flex animate-pulse space-x-4 pt-2">
                <div className="flex-1 space-y-6 py-1">
                  <div className="grid grid-cols-10 gap-4">
                    <div className=" col-span-7 h-6 rounded bg-white"></div>
                  </div>
                </div>
              </div>
              <div className="flex animate-pulse space-x-4 pt-2">
                <div className="flex-1 space-y-6 py-1">
                  <div className="grid grid-cols-8 gap-4">
                    <div className="col-span-6 ml-8 h-5 rounded bg-gray-700"></div>
                  </div>
                </div>
              </div>
              <div className="flex animate-pulse space-x-4 pt-2 ">
                <div className="flex-1 space-y-6 py-1 ">
                  <div className="grid grid-cols-8 gap-4">
                    <div className="  col-span-8 h-8 rounded bg-gray-700 "></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-w-40 mr-2 mb-2 flex h-auto w-full grow sm:w-52 1xl:w-64">
          <div className="border-element-10 flex h-auto grow flex-col rounded-md border p-5 transition-colors duration-300 lg:p-6">
            <div className="flex flex-col space-y-3  ">
              <h3 className="min-h-10 text-center text-sm font-semibold">{props.title}</h3>
              <div className="mx-auto">
                {paddlePrices && (
                  <Price
                    amount={props.price}
                    fontSize={'text-2xl'}
                    dollar={true}
                    currency={(paddlePrices.data.currencyCode as 'USD' | 'EUR') ?? 'USD'}
                    each={props.priceEach}
                    enterprise={false}
                  ></Price>
                )}
              </div>
              {props.children}
            </div>
            <div className="flex pt-5 ">{props.button}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Addon;
