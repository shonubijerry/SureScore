import { OpenAPIRoute, UnauthorizedException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { verifySession, AuthError } from "../../lib/auth.js";
import type { AppContext } from "../../types.js";

export class MeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Get the current authenticated user",
		responses: {
			"200": {
				description: "Current user",
				...contentJson(
					z.object({
						id: z.string(),
						email: z.string(),
						countryCode: z.string(),
						displayName: z.string().nullable(),
						role: z.string(),
					}),
				),
			},
			...UnauthorizedException.schema(),
		},
	};

	async handle(c: AppContext) {
		const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
		if (!token) {
			throw new UnauthorizedException("Missing bearer token.");
		}

		const db = createDbClient(c.env.DB);
		try {
			const { userId } = await verifySession(c.env.SESSIONS, c.env.AUTH_SECRET, token);
			const user = await db.user.findUnique({ where: { id: userId } });
			if (!user) {
				throw new UnauthorizedException("User no longer exists.");
			}
			return c.json({
				id: user.id,
				email: user.email,
				countryCode: user.countryCode,
				displayName: user.displayName,
				role: user.role,
			});
		} catch (error) {
			if (error instanceof AuthError) {
				throw new UnauthorizedException(error.message);
			}
			throw error;
		}
	}
}
