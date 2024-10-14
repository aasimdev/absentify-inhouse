import getT from 'next-translate/getT';

import i18n from '../i18n';

export const ensureAvailabilityOfGetT = () => {
  // @ts-ignore
  global.i18nConfig = i18n;
  return getT;
};
