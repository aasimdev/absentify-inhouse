import timezones from 'timezones-list';

const filteredTimezones = timezones.filter(x => x.tzCode != "America/AnguillaSandy Hill" && x.tzCode != "Pacific/GuamVillage");
const mappedTimezones = filteredTimezones.map((timezone) => {
  if(timezone.tzCode === "Europe/Kyiv") {
   return { ...timezone, tzCode: "FLE Standard Time" };
  } 
  if (timezone.tzCode === "Africa/Sao_Tome") {
    return { ...timezone, tzCode: "Sao Tome Standard Time" };
  }
   if (timezone.tzCode === "Antarctica/Troll") {
    return { ...timezone, tzCode: "Atlantic/Canary" };
  }

  return timezone;
})

export default mappedTimezones;