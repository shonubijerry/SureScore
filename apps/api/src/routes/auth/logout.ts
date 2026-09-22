import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { revokeSession } from "../../lib/auth.js";
import type { AppContext } from "../../types.js";

export class LogoutEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Revoke the current session",
		responses: {
			"200": { description: "Logged out", ...contentJson(z.object({ ok: z.literal(true) })) },
		},
	};

	async handle(c: AppContext) {
		const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
		if (token) {
			await revokeSession(c.env.SESSIONS, token);
		}
		return c.json({ ok: true });
	}
}
