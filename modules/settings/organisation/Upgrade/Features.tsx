import { CheckIcon, MinusIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';

export const FeaturesV1 = () => {
  const { t } = useTranslation('upgrade');
  return [
    {
      name: 'feature1',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited_per_user')}</p>,
      tooltip: t('feature1_desc')
    },
    {
      name: 'feature2',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200"> 2 </p>,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">4 ({t('add_on_available')})</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature2_desc')
    },
    {
      name: 'feature3',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature3_desc')
    },
    {
      name: 'feature4',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature4_desc')
    },
    {
      name: 'feature5',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature5_desc')
    },
    {
      name: 'feature6',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature6_desc')
    },
    {
      name: 'feature7',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature7_desc')
    },

    {
      name: 'feature8',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Extended')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Extended')}</p>,
      tooltip: t('feature8_desc')
    },
    {
      name: 'feature9',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature9_desc')
    },
    {
      name: 'feature10',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature10_desc')
    },
    {
      name: 'feature11',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature11_desc')
    },
    {
      name: 'feature30',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">1</p>,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">4</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature30_desc')
    },
    {
      name: 'feature31',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays')}</p>,

      startup: <p className=" text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays_hours_minutes')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays_hours_minutes')}</p>,
      tooltip: t('feature31_desc')
    },
    {
      name: 'feature12',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature12_desc')
    },
    {
      name: 'feature13',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature13_desc')
    },
    {
      name: 'feature14',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature14_desc')
    },
    {
      name: 'feature15',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature15_desc')
    },
    {
      name: 'feature16',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature16_desc')
    },

    {
      name: 'feature17',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature17_desc')
    },
    {
      name: 'feature18',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,

      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature18_desc')
    },
    {
      name: 'feature19',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 3</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature19_desc')
    },
    {
      name: 'feature21',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 3</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature21_desc')
    },

    {
      name: 'feature22',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 1 ({t('add_on_available')})</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature22_desc')
    },
    {
      name: 'feature32',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('add_on')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('included')}</p>,
      tooltip: t('feature32_desc')
    },
    {
      name: 'feature23',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('add_on')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('included')}</p>,
      tooltip: t('feature23_desc')
    },
    // {
    //   name: 'feature24',
    //   free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

    //   startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('add_on')}</p>,
    //   enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('included')}</p>,
    //   tooltip: t('feature24_desc')
    // },

    {
      name: 'feature25',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature25_desc')
    },
    {
      name: 'feature20',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature20_desc')
    },
    {
      name: 'feature28',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature28_desc')
    },
    ,
    {
      name: 'feature29',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature29_desc')
    },
    {
      name: 'feature27',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,

      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('individual')} </p>,
      tooltip: t('feature27_desc')
    },
    {
      name: 'feature26',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200"> E-Mail</p>,

      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('Pemail')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Pemail')} </p>,
      tooltip: t('feature26_desc')
    }
  ];
};

export const Features = () => {
  const { t } = useTranslation('upgrade');
  return [
    {
      name: 'feature1',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited_per_user')}</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited_per_user')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited_per_user')}</p>,
      tooltip: t('feature1_desc')
    },
    {
      name: 'feature2',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200"> 2 </p>,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200">4</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">8</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature2_desc')
    },
    {
      name: 'feature3',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature3_desc')
    },
    {
      name: 'feature4',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature4_desc')
    },
    {
      name: 'feature5',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature5_desc')
    },
    {
      name: 'feature6',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature6_desc')
    },
    {
      name: 'feature7',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature7_desc')
    },

    {
      name: 'feature8',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Extended')}</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Extended')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('Extended')}</p>,
      tooltip: t('feature8_desc')
    },
    {
      name: 'feature9',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature9_desc')
    },
    {
      name: 'feature10',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature10_desc')
    },
    {
      name: 'feature11',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature11_desc')
    },
    {
      name: 'feature30',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">1</p>,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200">2</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">4</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature30_desc')
    },
    {
      name: 'feature31',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays')}</p>,
      smallteam: <p className=" text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays_hours_minutes')}</p>,
      startup: <p className=" text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays_hours_minutes')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('days_halfdays_hours_minutes')}</p>,
      tooltip: t('feature31_desc')
    },
    {
      name: 'feature12',
      free: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200">{t('unlimited')}</p>,
      tooltip: t('feature12_desc')
    },
    {
      name: 'feature13',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature13_desc')
    },
    {
      name: 'feature14',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature14_desc')
    },
    {
      name: 'feature15',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature15_desc')
    },
    {
      name: 'feature16',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature16_desc')
    },

    {
      name: 'feature17',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature17_desc')
    },
    {
      name: 'feature18',
      free: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      smallteam: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature18_desc')
    },
    {
      name: 'feature22',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <p className="  text-xs text-gray-600 dark:text-gray-200"> 1</p>,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 5</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature22_desc')
    },
    {
      name: 'feature19',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 3</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature19_desc')
    },

    {
      name: 'feature21',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <p className="  text-xs text-gray-600 dark:text-gray-200"> 3</p>,
      enterprise: <p className="  text-xs text-gray-600 dark:text-gray-200"> {t('unlimited')}</p>,
      tooltip: t('feature21_desc')
    },
    {
      name: 'feature32',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature32_desc')
    },
    {
      name: 'feature23',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature23_desc')
    },

    {
      name: 'feature25',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature25_desc')
    },
    {
      name: 'feature20',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature20_desc')
    },
    {
      name: 'feature28',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature28_desc')
    },
    ,
    {
      name: 'feature29',
      free: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      smallteam: <MinusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />,
      startup: <p className=" text-xs text-gray-600 dark:text-gray-200 break-words w-24">{t('yearly_paymnet')}</p>,
      enterprise: <CheckIcon className="ml-0 h-5 w-5 text-xs dark:text-gray-200" aria-hidden="true" />,
      tooltip: t('feature29_desc')
    },
    {
      name: 'feature26',
      free: <p className=" text-xs text-gray-600 dark:text-gray-200"> E-Mail</p>,
      smallteam: <p className=" text-xs text-gray-600 dark:text-gray-200"> E-Mail</p>,
      startup: <p className=" text-xs text-gray-600 dark:text-gray-200"> {t('Pemail')}</p>,
      enterprise: <p className=" text-xs text-gray-600 dark:text-gray-200">{t('Pemail')} </p>,
      tooltip: t('feature26_desc')
    }
  ];
};
