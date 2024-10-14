export function ensureTimeZoneAvailability(timezone: string) {
  if (timezone === 'FLE Standard Time') return 'Europe/Kyiv';
  if (timezone === 'Sao Tome Standard Time') return 'Africa/Sao_Tome';
  if (timezone === 'Europe/Zaporizhzhia') return 'Europe/Kyiv';
  return timezone;
}
