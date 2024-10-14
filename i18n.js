module.exports = {
  locales: ['en', 'de', 'it', 'fr', 'es', 'hu', 'pl', 'uk', 'tr', 'ru', 'pt'],
  defaultLocale: 'en',
  pages: {
    '*': ['common'],
    '/': ['start', 'calendar'],
    '/requests': ['requests'],
    'rgx:/calendar': ['calendar'],
    '/microsoft/ms-teams/bot/taskmodule': ['calendar'],
    '/insights': ['insights'],
    '/finishMsPay': ['finishMsPay'],
    '/microsoft/ms-teams/tab/config': ['microsoft_tab_config'],
    '/signup': ['signup'],
    '/login': ['login'],
    '/api/*': ['backend', 'mails'],
    'rgx:/settings/organisation': [
      'settings_organisation',
      'users',
      'schedules',
      'allowance',
      'upgrade',
      'billing',
      'deletion_reason'
    ],
    'rgx:/settings/profile': ['settings_profile']
  },
  // @ts-ignore
  loadLocaleFrom: (lang, ns) => import(`./locales/${lang}/${ns}.json`).then((m) => m.default)
};
