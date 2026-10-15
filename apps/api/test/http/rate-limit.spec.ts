import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimit } from "../../src/http/rate-limit";
import type { AppEnv } from "../../src/types";

describe("rate limiting", () => {
	it("returns 429 with Retry-After past the limit", async () => {
		const app = new Hono<AppEnv>();
		app.use("*", rateLimit({ name: "t", limit: 2, windowSeconds: 60, by: "ip" }));
		app.get("/", (c) => c.text("ok"));
		const hit = () => app.request("/", { headers: { "CF-Connecting-IP": "9.9.9.9" } }, env);
		expect([(await hit()).status, (await hit()).status]).toEqual([200, 200]);
		const limited = await hit();
		expect(limited.status).toBe(429);
		expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
		expect((await app.request("/", { headers: { "CF-Connecting-IP": "8.8.8.8" } }, env)).status).toBe(200);
	});
});
