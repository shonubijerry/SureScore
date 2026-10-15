// Fixed-window rate limiting on KV (T11.5) for abuse-prone endpoints. KV is
// not atomic, so under a concurrent burst a few extra requests can slip
// through; that is acceptable abuse protection and keeps the limiter on
// Cloudflare-native storage. A KV outage never blocks users (fail open).

import { createMiddleware } from "hono/factory";
import { log } from "../platform/logger.js";
import type { AppEnv } from "../types.js";

const KV_MIN_TTL_SECONDS = 60;

export interface RateLimitRule {
	/** Bucket name, e.g. "login". */
	name: string;
	limit: number;
	windowSeconds: number;
	/** `user` limits per authenticated user (falls back to IP); `ip` always per client IP. */
	by: "ip" | "user";
}

export const rateLimit = ({ name, limit, windowSeconds, by }: RateLimitRule) =>
	createMiddleware<AppEnv>(async (context, next) => {
		const ip = context.req.header("CF-Connecting-IP") ?? "unknown";
		const id = (by === "user" && context.get("userId")) || ip;
		const window = Math.floor(Date.now() / (windowSeconds * 1000));
		const key = `rl:${name}:${id}:${window}`;

		try {
			const count = Number((await context.env.SESSIONS.get(key)) ?? 0);
			if (count >= limit) {
				log.warn("http", "rate_limited", { rule: name, by, id });
				const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
				return context.json({ error: "Too many requests. Please slow down." }, 429, { "Retry-After": String(retryAfter) });
			}
			await context.env.SESSIONS.put(key, String(count + 1), {
				expirationTtl: Math.max(windowSeconds, KV_MIN_TTL_SECONDS),
			});
		} catch (error) {
			log.error("http", "rate_limit_unavailable", { rule: name, error });
		}
		await next();
	});

export const rateLimits = {
	login: { name: "login", limit: 10, windowSeconds: 15 * 60, by: "ip" },
	signup: { name: "signup", limit: 5, windowSeconds: 60 * 60, by: "ip" },
	passwordForgot: { name: "password-forgot", limit: 5, windowSeconds: 60 * 60, by: "ip" },
	passwordReset: { name: "password-reset", limit: 10, windowSeconds: 60 * 60, by: "ip" },
	otpResend: { name: "otp-resend", limit: 10, windowSeconds: 60 * 60, by: "ip" },
	otpVerify: { name: "otp-verify", limit: 20, windowSeconds: 15 * 60, by: "ip" },
	createPot: { name: "create-pot", limit: 10, windowSeconds: 60 * 60, by: "user" },
	prediction: { name: "prediction", limit: 30, windowSeconds: 60, by: "user" },
} as const satisfies Record<string, RateLimitRule>;
