import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import useTranslation from "next-translate/useTranslation";
import React from "react";
import { api } from "~/utils/api";

const LangProgressBar: React.FC<{ lang: string }> = (props) => {
  const { t } = useTranslation("common");
  const { data: percentage } = api.crowdin.getProgress.useQuery(
    { lang: props.lang },
    {
      enabled: props.lang != "en" || !props.lang,
      staleTime: 60000,
    }
  );

  return (
    <div className="mx-auto w-1/2 p-2 py-4">
      <div className=" h-2 rounded-full bg-gray-200 dark:bg-gray-700 dark:text-gray-200 ">
        <div
          className="h-2 rounded-full bg-teams_brand_background_2"
          style={{ width: `${percentage ? percentage : 0}%` }}
        ></div>
        <p className="p-1 text-center text-xs font-medium text-teams_brand_background_2 dark:text-gray-200">
          {percentage
            ? Math.round(percentage) + "% " + t("validated")
            : "0% " + t("validated")}
        </p>
      </div>
    </div>
  );
};

const CrowdinTrans: React.FC<{ lang: string }> = (props) => {
  const { t } = useTranslation("common");
  return (
    <div className="block dark:text-gray-200">
      <div className="p-2 dark:text-gray-200">
        {t("Community_Description")}

        {!(props.lang == "en" || props.lang == "de") && props.lang && (
          <LangProgressBar lang={props.lang} />
        )}
      </div>
      {t("Community_Description2")}
      <a
        className="inline-flex p-2 text-teams_brand_background_2 underline hover:text-teams_brand_foreground_1 dark:text-gray-200"
        href="https://crowdin.com/project/absentify"
        target="_blank"
      >
        absentify - crowdin.com <ArrowTopRightOnSquareIcon height={16} />
      </a>
    </div>
  );
};
export default CrowdinTrans;
