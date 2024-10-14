import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";
type Languages = {
  data: {
    approvalProgress: number;
    eTag: string;
    fileId: number;
    phrases: {
      approved: number;
      total: number;
      translated: number;
    };
    translationProgress: number;
    words: {
      approved: number;
      total: number;
      translated: number;
    };
  };
};

export const crowdinRouter = createTRPCRouter({
  getProgress: publicProcedure
    .input(
      z.object({
        lang: z.string(),
      })
    )
    .query(async ({ input }) => {
      let valueResponse = await fetch(
        `https://api.crowdin.com/api/v2/projects/510056/languages/${
          input.lang == "es" ? "es-ES" : input.lang
        }/progress`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Authorization:
              "Bearer 40664adbed60ab5075c623801a3546571a41a4136e284f32651f37a17cad433467d63ac62a82b92d",
          },
        }
      );

      const data = await valueResponse.json();
      let result: number = 0;
      if (data.data) {
        data.data.forEach((language: Languages) => {
          result += language.data.approvalProgress;
        });

        return (result * 100) / (data.data.length * 100);
      }

      return 0;
    }),
});
