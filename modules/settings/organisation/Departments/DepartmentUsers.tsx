import ProfileImage from "@components/layout/components/ProfileImage";
import useTranslation from "next-translate/useTranslation";
import { Tooltip as ReactTooltip } from 'react-tooltip';

import { useDarkSide } from '@components/ThemeContext';

type Props = {
  members: {
    id: string;
    member: {
        name: string | null;
        email: string | null;
        microsoft_user_id: string | null;
        has_cdn_image: boolean;
    };
}[];
max_members: number;
}

export default function DepartmentUsers({members, max_members}: Props) {
  const { t } = useTranslation('settings_organisation');
  const [theme] = useDarkSide();
  const memberOverflow = members.length > max_members;
  const useMembers = memberOverflow ? members.slice(0, max_members) : members;
  return (
    <div className="isolate flex -space-x-2 text-gray-400">
    {useMembers.map(member => (
      <div key={member.id} className=" min-w-[6px]">
      <span
      className="ml-1 flex items-center self-center cursor-pointer"
      data-tooltip-id={member.id}
      data-tooltip-content={member.member.name ?? ''}
      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
    >
      <ProfileImage tailwindSize="6" member={{
        has_cdn_image: member.member.has_cdn_image,
        microsoft_user_id: member.member.microsoft_user_id,
      }}/>
    </span>
    <ReactTooltip
      id={member.id}
      className="shadow z-50 dark:bg-teams_brand_dark_200 dark:text-gray-200"
      classNameArrow="shadow-sm"
      place="top"
      style={{ width: '160px' }}
    />
      </div>
    ))}
    {memberOverflow 
    ? (
      <div className=" pl-1">
      <span
      className="ml-1 flex items-center self-center cursor-pointer"
      data-tooltip-id={'more_users'}
      data-tooltip-content={t("more_users", {users: members.length - 16})}
      data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
    >
    ...
    </span>
    <ReactTooltip
      id={'more_users'}
      className="shadow z-50 dark:bg-teams_brand_dark_200 dark:text-gray-200"
      classNameArrow="shadow-sm"
      place="top"
      style={{ width: '160px' }}
    />
    </div>
    )
    : ''}
    </div>
  )
}