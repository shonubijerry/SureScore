// Centralised structured logging (T11.1). Every line is one JSON object with
// a `scope` (sync, payout, refund, settlement, job, http, alert, audit, auth), so
// Workers Logs / Logpush can filter and alert on it. Secrets and payout
// details are redacted before anything is written.

export type LogScope = "sync" | "payout" | "refund" | "fund" | "settlement" | "job" | "http" | "alert" | "audit" | "auth";
type Level = "info" | "warn" | "error";

const SENSITIVE_KEY = /pass|secret|token|authorization|account|iban|cvv|api[_-]?key/i;

export function redact(value: unknown, depth = 0): unknown {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
			...(value.cause !== undefined && { cause: redact(value.cause, depth + 1) }),
		};
	}
	if (typeof value !== "object" || value === null || depth > 4) return value;
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redact(item, depth + 1)]),
	);
}

function emit(level: Level, scope: LogScope, event: string, data: Record<string, unknown> = {}) {
	const line = JSON.stringify({ level, scope, event, ts: new Date().toISOString(), ...(redact(data) as object) });
	if (level === "error") {
		console.error(line);
		// Also print raw errors so the console shows a readable stack trace (and cause chain).
		for (const value of Object.values(data)) if (value instanceof Error) console.error(value);
	}
	else if (level === "warn") console.warn(line);
	else console.log(line);
}

export const log = {
	info: (scope: LogScope, event: string, data?: Record<string, unknown>) => emit("info", scope, event, data),
	warn: (scope: LogScope, event: string, data?: Record<string, unknown>) => emit("warn", scope, event, data),
	error: (scope: LogScope, event: string, data?: Record<string, unknown>) => emit("error", scope, event, data),
};
