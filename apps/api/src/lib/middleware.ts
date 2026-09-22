import { createMiddleware } from "hono/factory";
import { verifySession, AuthError } from "./auth.js";
import type { AppEnv } from "../types.js";

/** Requires a valid bearer session token, and sets `userId` in context. */
export const requireAuth = createMiddleware<AppEnv>(async (context, next) => {
	const token = context.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
	if (!token) {
		return context.json({ error: "Missing bearer token." }, 401);
	}

	try {
		const { userId } = await verifySession(context.env.SESSIONS, context.env.AUTH_SECRET, token);
		context.set("userId", userId);
	} catch (error) {
		if (error instanceof AuthError) {
			return context.json({ error: error.message }, 401);
		}
		throw error;
	}

	await next();
});
