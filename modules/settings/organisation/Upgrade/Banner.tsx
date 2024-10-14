import useTranslation from "next-translate/useTranslation";

export default function Banner() {
  const { t } = useTranslation('upgrade');
  return (
    <div className="relative isolate flex items-center justify-center gap-x-6 overflow-hidden bg-teams_brand_foreground_bg px-6 py-2.5 sm:px-3.5">
      <p className="text-sm leading-6 text-white">
        <a href="https://absentify.com/pricing" target="_blank">
          <strong className="font-semibold">{t('new_prices_available')}</strong>
          <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
            <circle cx={1} cy={1} r={1} />
          </svg>
          {t('check_new_prices')} <span>&rarr;</span>
        </a>
        <div>
        <a href="mailto:support@absentify.com">{t('send_mail_to_supp')} <span>&rarr;</span></a>
        </div>
      </p>
    </div>
  )
}

