import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __db: PrismaClient };

export const prisma =
  g.__db || new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] });

if (process.env.NODE_ENV !== "production") g.__db = prisma;

export default prisma;
