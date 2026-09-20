import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, "..");
const tempDir = mkdtempSync(join(tmpdir(), "surescore-api-"));
const tempConfigPath = join(tempDir, "wrangler.jsonc");

const toPosixPath = (value) => value.replaceAll("\\", "/");
const config = readFileSync(resolve(packageDir, "wrangler.jsonc"), "utf8")
	.replaceAll("__CLOUDFLARE_D1_DATABASE_NAME__", "surescore-db")
	.replaceAll("__CLOUDFLARE_D1_DATABASE_ID__", "00000000-0000-0000-0000-000000000000")
	.replaceAll(
		"__CLOUDFLARE_D1_PREVIEW_DATABASE_ID__",
		"11111111-1111-1111-1111-111111111111",
	)
	.replace(
		"\"main\": \"src/index.ts\"",
		`"main": "${toPosixPath(resolve(packageDir, "src/index.ts"))}"`,
	)
	.replace(
		"../../packages/db/prisma/migrations",
		toPosixPath(resolve(packageDir, "../../packages/db/prisma/migrations")),
	);

writeFileSync(tempConfigPath, config);

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
	command,
	["exec", "--", "wrangler", "deploy", "--dry-run", "--outdir", "dist", "--config", tempConfigPath],
	{
		cwd: packageDir,
		stdio: "inherit",
	},
);

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}
