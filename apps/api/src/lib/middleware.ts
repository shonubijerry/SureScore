import { createMiddleware } from "hono/factory";
import { createDbClient } from "@surescore/db";
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

/** Requires an admin user. Mount after `requireAuth`. */
export const requireAdmin = createMiddleware<AppEnv>(async (context, next) => {
	const user = await createDbClient(context.env.DB).user.findUnique({
		where: { id: context.get("userId") },
		select: { role: true },
	});
	if (user?.role !== "admin") {
		return context.json({ error: "Admin access required." }, 403);
	}
	await next();
});
