// Applies every Prisma migration, in order, to the test D1 database. Each spec
// file gets isolated storage, so DB-backed specs call this in `beforeAll`.
import { env } from "cloudflare:test";

const migrations = (import.meta as unknown as { glob: (p: string, o: object) => unknown }).glob("../../../../packages/db/prisma/migrations/*/migration.sql", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

export async function applyMigrations() {
	for (const path of Object.keys(migrations).sort()) {
		const statements = migrations[path]
			.split("\n")
			.filter((line) => !line.trim().startsWith("--"))
			.join("\n")
			.split(/;\s*\n/)
			.map((s) => s.trim())
			.filter(Boolean);
		await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
	}
}
