import { Battery50Icon, BookmarkSquareIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { SunIcon } from '@heroicons/react/24/outline';
import { UsersIcon } from '@heroicons/react/24/outline';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { HomeIcon } from '@heroicons/react/24/outline';
import { BoltIcon } from '@heroicons/react/24/outline';
import { GiftIcon } from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import { FaceFrownIcon } from '@heroicons/react/24/outline';
import { AnchorIcon, AwardIcon, CastIcon, CoffeeIcon, CompassIcon, UmbrellaIcon } from '~/lib/leave_type-icons';
export const Icon = (props: { name?: string; color: string; width: string; className: string; date?: number }) => {
  if (props.name == 'Umbrella')
    return (
      <UmbrellaIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'Anchor')
    return (
      <AnchorIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'Archive')
    return <ArchiveBoxIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Award')
    return (
      <AwardIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'BookmarkSquareIcon')
    return (
      <BookmarkSquareIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'Briefcase')
    return <BriefcaseIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Calendar')
    return <CalendarIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Cast')
    return (
      <CastIcon style={{ color: props.color }} className={`${props.className} w-${props.width ? props.width : '6'} `} />
    );
  if (props.name == 'Clock')
    return <ClockIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Coffee')
    return (
      <CoffeeIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'Compass')
    return (
      <CompassIcon
        style={{ color: props.color }}
        className={`${props.className} w-${props.width ? props.width : '6'} `}
      />
    );
  if (props.name == 'NoIcon' && props.date) return <>{props.date}</>;
  if (props.name == 'Battery')
    return <Battery50Icon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Emoji')
    return <FaceSmileIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Gift')
    return <GiftIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Frown')
    return <FaceFrownIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Image')
    return <PhotoIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Sun')
    return <SunIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Zap')
    return <BoltIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Home')
    return <HomeIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  if (props.name == 'Users')
    return <UsersIcon color={props.color} className={`${props.className} w-${props.width ? props.width : '6'}`} />;
  return <></>;
};
