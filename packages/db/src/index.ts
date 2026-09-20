import { PrismaD1 } from "@prisma/adapter-d1";
import type { D1Database } from "@cloudflare/workers-types";
import { PrismaClient } from "../generated/client";

export const d1BindingName = "DB";
export const databaseProvider = "Cloudflare D1 + Prisma (no engine)";

export function createDbClient(database: D1Database) {
  const adapter = new PrismaD1(database);

  return new PrismaClient({ adapter });
}
