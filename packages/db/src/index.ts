import { PrismaD1 } from "@prisma/adapter-d1";
import type { D1Database } from "@cloudflare/workers-types";
// Import from the package root (not a direct index.js path) so bundlers
// resolve the generated client's "workerd" export condition to the wasm
// engine build instead of the Node "library" engine build, which references
// __dirname and breaks under workerd.
import { PrismaClient } from "../generated/client/wasm.js";

export * from "../generated/client/wasm.js";

export const d1BindingName = "DB";
export const databaseProvider = "Cloudflare D1 + Prisma (wasm engine)";

export function createDbClient(database: D1Database) {
  const adapter = new PrismaD1(database);

  return new PrismaClient({ adapter });
}
