import { getPrice } from 'lib/getPrice';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { api } from '~/utils/api';
import Price from './Price';
import { PricePreviewResponse } from '@paddle/paddle-js';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

const Plan: React.FC<{
  title: string;
  button: JSX.Element;
  price: number;
  onClick: Function;
  saving?: string;
  noCurrencyCode?: boolean;
  toggleEnabled: boolean;
  minUsers: number;
  enterprise: boolean;
  perUser: boolean;
}> = (props) => {
  const { current_member, paddleInstance } = useAbsentify();
  const { t } = useTranslation('upgrade');
  const { data: workspace } = api.workspace.current.useQuery(undefined, {
    staleTime: 60000
  });

  const { data: paddlePrices, isLoading }: UseQueryResult<PricePreviewResponse, Error> = useQuery(
    ['getPaddlePrices'],
    () => getPrice(paddleInstance),
    { staleTime: 300000, enabled: paddleInstance != null }
  );

  return (
    <div className="flex mr-2 mb-2 grow w-full sm:w-52 min-w-52">
      <div className="flex flex-col rounded-md border dark:border-gray-500 grow px-5 lg:px-8 py-10 border-element-10 ">
        {!current_member || !workspace || isLoading ? (
          <div className="w-full mx-auto">
            <div className="pt-2 animate-pulse flex space-x-4">
              <div className="flex-1 space-y-6 py-1">
                <div className="grid grid-cols-8 gap-4">
                  <div className="h-5 bg-gray-700 rounded col-span-5"></div>
                </div>
              </div>
            </div>
            <div className="pt-2 animate-pulse flex space-x-4">
              <div className="flex-1 space-y-6 py-1">
                <div className="grid grid-cols-10 gap-4">
                  <div className="h-6 bg-gray-700 rounded col-span-7"></div>
                </div>
              </div>
            </div>
            <div className="pt-2 animate-pulse flex space-x-4">
              <div className="flex-1 space-y-6 py-1">
                <div className="grid grid-cols-8 gap-4">
                  <div className="h-5 bg-gray-700 rounded col-span-4"></div>
                </div>
              </div>
            </div>
            <div className="pt-2 animate-pulse flex space-x-4 ">
              <div className="flex-1 space-y-6 py-1 ">
                <div className="grid grid-cols-8 gap-4">
                  <div className="  h-8 bg-gray-700 rounded col-span-8 "></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col space-y-3  grow">
              <div className="flex items-center flex-row space-x-3">
                <h3 className="text-base font-bold dark:text-gray-200">{props.title}</h3>
              </div>
              <div className="flex items-end flex-row space-x-1 ">
                {paddlePrices && (
                  <Price
                    enterprise={props.enterprise}
                    amount={props.enterprise ? props.price * workspace.min_enterprise_users : props.price}
                    fontSize={'text-3xl'}
                    dollar={true}
                    currency={(paddlePrices.data.currencyCode as 'EUR' | 'USD') ?? 'USD'}
                    from={props.enterprise ? true : false}
                    perUser={props.perUser}
                  ></Price>
                )}
              </div>
              {!props.enterprise && props.toggleEnabled && (
                <div className="inline-flex">
                  <p className="text-xs dark:text-gray-400"> {props.saving} </p>
                  <p className="text-xs dark:text-gray-400">
                    {!props.noCurrencyCode && (' ' + (paddlePrices?.data.currencyCode as 'EUR' | 'USD') ?? 'USD')},{' '}
                    {t('billedYe')}
                  </p>
                </div>
              )}
              {props.enterprise && (
                <div className="inline-flex">
                  <p className="text-xs ">
                    <Price
                      enterprise={props.enterprise}
                      amount={props.price}
                      fontSize={'text-3xl'}
                      dollar={true}
                      currency={(paddlePrices?.data.currencyCode as 'EUR' | 'USD') ?? 'USD'}
                      from={false}
                      minUsers={props.minUsers}
                    ></Price>
                  </p>
                </div>
              )}
            </div>
            <div className="pt-3" onClick={() => props.onClick()}>
              {props.button}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Plan;
