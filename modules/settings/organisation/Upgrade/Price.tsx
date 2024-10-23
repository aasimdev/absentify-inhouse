import { currencies } from 'helper/common-currency';
import useTranslation from 'next-translate/useTranslation';

const Price: React.FC<{
  amount: number;
  fontSize: string;
  dollar: boolean;
  currency: 'EUR' | 'USD';
  each?: string;
  perUser?: boolean;
  from?: boolean;
  title?: string;
  enterprise: boolean;
  minUsers?: number;
}> = (props) => {
  const { t } = useTranslation('upgrade');
  if (props.dollar && !props.minUsers) {
    return (
      <div className={`py-1 dark:text-gray-300 ${props.fontSize} text-gray-800 inline`}>
        {props.from && <span className="text-sm">{t('from')}</span>}{' '}
        {currencies[props.currency]?.symbol + props.amount?.toFixed(2).toLocaleString()}
        <p className="text-sm inline">
        {props.perUser && t('per_user')}
          {props.amount != 0 && '/' + t('Mo') + '.'}
          {' '} {props.each}
        </p>
      </div>
    );
  }
  if (props.enterprise && props.minUsers) {
    return (
      <>
        {t('MinUsers', {
          price: currencies[props.currency].symbol + props.amount?.toFixed(2).toString(),
          month: t('Mo'),
          users: props.minUsers
        })}
      </>
    );
  }
  return (
    <div className={`py-1 ${props.fontSize}  h-11`}>
      <p className="hidden">{currencies[props.currency]?.symbol + props.amount?.toFixed(2).toLocaleString()} </p>
    </div>
  );
};

export default Price;
