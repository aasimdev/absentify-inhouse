import useTranslation from "next-translate/useTranslation";
import { classNames } from "~/lib/classNames";

export const ModalOption = ( props: {
  handleOnClick: ( option: string) => void;
  text: string;
  active: boolean;
}) => {
  const { t } = useTranslation('deletion_reason');
  return(
    <div className="mb-4">
    <button type="button" className=" block w-full" onClick={() => props.handleOnClick(props.text)}>
      <div className={classNames(props.active ? "bg-[#deebff] dark:bg-teams_brand_dark_200 dark:text-gray-900" : "bg-white dark:bg-teams_brand_dark_100 dark:text-gray-200",
      " border border-gray-300 rounded-md active:bg-[#deebff] hover:border-teams_brand_500" )}>
        <div className=" pl-4 p-2 font-semibold text-md text-left dark:text-gray-200">{t(props.text)}</div>
      </div>
    </button>
    </div>
  );
}