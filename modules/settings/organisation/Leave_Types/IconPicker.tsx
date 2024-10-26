import Select from 'react-select';
import { Battery50Icon } from '@heroicons/react/24/outline';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { SunIcon } from '@heroicons/react/24/outline';
import { UsersIcon } from '@heroicons/react/24/outline';
import { PhotoIcon } from '@heroicons/react/24/outline';
import useTranslation from 'next-translate/useTranslation';
import { HomeIcon } from '@heroicons/react/24/outline';
import { BoltIcon } from '@heroicons/react/24/outline';
import { GiftIcon } from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import { FaceFrownIcon } from '@heroicons/react/24/outline';
import { AnchorIcon, AwardIcon, CastIcon, CoffeeIcon, CompassIcon, UmbrellaIcon } from '~/lib/leave_type-icons';
const IconPicker = (props: { value: string; color: string; onChange: Function; lastTwo: boolean }) => {
  const { t } = useTranslation('settings_organisation');
  const options = [
    { value: 'NoIcon', label: t('No_Icon') },
    {
      value: 'Umbrella',
      label: (
        <span style={{ color: props.color }}>
          <UmbrellaIcon />
        </span>
      )
    },
    {
      value: 'Anchor',
      label: (
        <span style={{ color: props.color }}>
          <AnchorIcon />
        </span>
      )
    },
    { value: 'Archive', label: <ArchiveBoxIcon color={props.color} className="w-6" /> },
    {
      value: 'Award',
      label: (
        <span style={{ color: props.color }}>
          <AwardIcon />
        </span>
      )
    },
    { value: 'Briefcase', label: <BriefcaseIcon color={props.color} className="w-6" /> },
    { value: 'Calendar', label: <CalendarIcon color={props.color} className="w-6" /> },
    {
      value: 'Cast',
      label: (
        <span style={{ color: props.color }}>
          <CastIcon />
        </span>
      )
    },
    { value: 'Clock', label: <ClockIcon color={props.color} className="w-6" /> },
    {
      value: 'Coffee',
      label: (
        <span style={{ color: props.color }}>
          <CoffeeIcon />
        </span>
      )
    },
    {
      value: 'Compass',
      label: (
        <span style={{ color: props.color }}>
          <CompassIcon />
        </span>
      )
    },
    { value: 'Battery', label: <Battery50Icon color={props.color} className="w-6" /> },
    { value: 'Emoji', label: <FaceSmileIcon color={props.color} className="w-6" /> },
    { value: 'Gift', label: <GiftIcon color={props.color} className=" w-6" /> },
    { value: 'Frown', label: <FaceFrownIcon color={props.color} className="w-6" /> },
    { value: 'Image', label: <PhotoIcon color={props.color} className="w-6" /> },
    { value: 'Sun', label: <SunIcon color={props.color} className="w-6" /> },
    { value: 'Home', label: <HomeIcon color={props.color} className="w-6" /> },
    { value: 'Zap', label: <BoltIcon color={props.color} className="w-6" /> },
    { value: 'Users', label: <UsersIcon color={props.color} className="w-6" /> }
  ];
  return (
    <Select
      menuPlacement={props.lastTwo ? 'top' : 'bottom'}
      value={options.find((x) => x.value == props.value)}
      onChange={(e) => {
        if (e) props.onChange(e.value);
      }}
      styles={{
        container: (baseStyles) => ({ ...baseStyles, width: '95px' }),
        control: (baseStyles) => ({
          ...baseStyles,
          '*': {
            boxShadow: 'none !important'
          },
          width: '95px'
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 }) ,
        menu: (baseStyles) => ({
          ...baseStyles,
          width: '95px',
        })
      }}
      // menuPortalTarget={document.body}
      options={options}
      className="w-full my-react-select-container"
      classNamePrefix="my-react-select"
    ></Select>
  );
};

export default IconPicker;
//   value={props.value}
