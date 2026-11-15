import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Matches .env.example. The client doesn't open the file until the first
// query, so the build step works without a database present.
const DEFAULT_DATABASE_URL = "file:./data/dev.db";

function createClient() {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
