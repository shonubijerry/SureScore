// Records every scheduled-job execution so admins can see failures (T10.7).
// Recording is best-effort: it must never fail or mask the job itself.

import { createDbClient } from "@surescore/db";
import { log } from "./logger.js";

export type JobKind = "sports" | "payments" | "finance";
type JobOutcome = { failures?: { error: string }[] } | void;

export async function trackJob(database: D1Database, job: string, kind: JobKind, run: () => Promise<JobOutcome>) {
	const startedAt = Date.now();
	let error: string | undefined;
	try {
		const outcome = await run();
		if (outcome?.failures?.length) error = outcome.failures.map((f) => f.error).join("; ");
	} catch (thrown) {
		error = String(thrown);
	}

	try {
		await createDbClient(database).jobRun.create({
			data: {
				job,
				kind,
				status: error ? "failed" : "ok",
				error: error?.slice(0, 1000),
				durationMs: Date.now() - startedAt,
			},
		});
	} catch (recordError) {
		log.error("job", "record_failed", { job, error: recordError });
	}
	if (error) log.error("job", "failed", { job, kind, error });
	else log.info("job", "ok", { job, kind, durationMs: Date.now() - startedAt });
}

const JOB_RETENTION_DAYS = 14;

export const pruneJobRuns = (database: D1Database) =>
	createDbClient(database).jobRun.deleteMany({
		where: { startedAt: { lt: new Date(Date.now() - JOB_RETENTION_DAYS * 86_400_000) } },
	});
