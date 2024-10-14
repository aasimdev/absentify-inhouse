export function capitalizeFirstMonthLetter(string: string, lang: string) {
  const langArrayWithSmallCapital = ['es','it','pt','tr'];
  if(langArrayWithSmallCapital.includes(lang)) {
    return string;
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}