import { format } from "date-fns";

const settingsDate = new Date(new Date().getFullYear(), 11, 31);
export const dateFormats = [
  { label: format(settingsDate, 'MM/dd/yyyy'), value: 'MM/dd/yyyy' },
  { label: format(settingsDate, 'MM-dd-yyyy'), value: 'MM-dd-yyyy' },
  { label: format(settingsDate, 'MM dd yyyy'), value: 'MM dd yyyy' },
  { label: format(settingsDate, 'MM.dd.yyyy'), value: 'MM.dd.yyyy' },
  { label: format(settingsDate, 'dd/MM/yyyy'), value: 'dd/MM/yyyy' },
  { label: format(settingsDate, 'dd-MM-yyyy'), value: 'dd-MM-yyyy' },
  { label: format(settingsDate, 'dd MM yyyy'), value: 'dd MM yyyy' },
  { label: format(settingsDate, 'dd.MM.yyyy'), value: 'dd.MM.yyyy' },
  { label: format(settingsDate, 'yyyy-MM-dd'), value: 'yyyy-MM-dd' },
  { label: format(settingsDate, 'yyyy/MM/dd'), value: 'yyyy/MM/dd' },
  { label: format(settingsDate, 'yyyy MM dd'), value: 'yyyy MM dd' },
  { label: format(settingsDate, 'yyyy.MM.dd'), value: 'yyyy.MM.dd' },
  { label: format(settingsDate, 'yyyy-dd-MM'), value: 'yyyy-dd-MM' },
  { label: format(settingsDate, 'yyyy/dd/MM'), value: 'yyyy/dd/MM' },
  { label: format(settingsDate, 'yyyy dd MM'), value: 'yyyy dd MM' },
  { label: format(settingsDate, 'yyyy.dd.MM'), value: 'yyyy.dd.MM' }
];