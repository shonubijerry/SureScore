import { describe, expect, it } from "vitest";
import { redact } from "../../src/platform/logger";

describe("logger", () => {
	it("keeps the stack and cause of logged errors", () => {
		const logged = redact({ error: new Error("outer", { cause: new Error("inner") }) }) as { error: { stack: string; cause: { message: string } } };
		expect(logged.error.stack).toContain("outer");
		expect(logged.error.cause.message).toBe("inner");
	});

	it("redacts secrets and account data from logs", () => {
		expect(redact({ idempotencyKey: "k", accountNumber: "1", nested: { token: "t", apiKey: "a" } })).toEqual({
			idempotencyKey: "k",
			accountNumber: "[redacted]",
			nested: { token: "[redacted]", apiKey: "[redacted]" },
		});
	});
});
