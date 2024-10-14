import { NextApiRequest, NextApiResponse } from 'next';
import cors from 'nextjs-cors';
import { createOpenApiNextHandler } from 'trpc-openapi';
import { createTRPCContext } from '~/server/api/trpc';
import { apiV1Router } from '~/server/v1/root';




const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Setup CORS
  await cors(req, res);

  // Handle incoming OpenAPI requests
  return createOpenApiNextHandler({
    router: apiV1Router ,
    createContext: createTRPCContext,
  })(req, res);
};

export default handler;