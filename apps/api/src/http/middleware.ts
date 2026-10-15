import { createMiddleware } from "hono/factory";
import { createDbClient } from "@surescore/db";
import { verifySession, AuthError } from "../modules/auth/session.js";
import { hasPermission, isStaffRole, type Permission } from "@surescore/shared";
import type { AppContext, AppEnv } from "../types.js";

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

/** Sets `userId` when a valid session token is sent; otherwise continues anonymously. */
export const optionalAuth = createMiddleware<AppEnv>(async (context, next) => {
	const token = context.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
	if (token) {
		try {
			context.set("userId", (await verifySession(context.env.SESSIONS, context.env.AUTH_SECRET, token)).userId);
		} catch (error) {
			if (!(error instanceof AuthError)) throw error;
		}
	}
	await next();
});

/** The caller's current role, read from the database once per request so demotions apply immediately. */
async function roleOf(context: AppContext): Promise<string | undefined> {
	const cached = context.get("role");
	if (cached) return cached;
	const user = await createDbClient(context.env.DB).user.findUnique({
		where: { id: context.get("userId") },
		select: { role: true },
	});
	if (user) context.set("role", user.role);
	return user?.role;
}

/** Requires a back-office user (staff or admin). Mount after `requireAuth`. */
export const requireStaff = createMiddleware<AppEnv>(async (context, next) => {
	if (!isStaffRole(await roleOf(context))) return context.json({ error: "Staff access required." }, 403);
	await next();
});

/** Requires the role of the caller to grant `permission`. Mount after `requireAuth`. */
export const requirePermission = (permission: Permission) =>
	createMiddleware<AppEnv>(async (context, next) => {
		if (!hasPermission(await roleOf(context), permission)) {
			return context.json({ error: `Missing permission: ${permission}.` }, 403);
		}
		await next();
	});
