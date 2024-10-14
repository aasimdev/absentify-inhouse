import { PrismaClient } from "@prisma/client";



const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NEXT_PUBLIC_RUNMODE === "Development" ? [ "error", "warn"] : ["error"],
  });

if (process.env.NEXT_PUBLIC_RUNMODE == "Development") globalForPrisma.prisma = prisma;
