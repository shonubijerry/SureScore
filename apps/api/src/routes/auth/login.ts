import { OpenAPIRoute, UnauthorizedException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { normalizeEmail } from "@surescore/shared";
import { verifyPassword } from "../../modules/auth/password.js";
import { createSession } from "../../modules/auth/session.js";
import type { AppContext } from "../../types.js";
import { emailSchema, sessionResponseSchema, userView } from "./schema.js";

export class LoginEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Log in with email and password",
		request: {
			body: contentJson(z.object({ email: emailSchema, password: z.string() })),
		},
		responses: {
			"200": { description: "Logged in", ...contentJson(sessionResponseSchema) },
			...UnauthorizedException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();

		const db = createDbClient(c.env.DB);
		const user = await db.user.findUnique({ where: { email: normalizeEmail(body.email) } });

		// Verify against a dummy hash when the user is missing so response
		// timing doesn't reveal whether the email is registered.
		const passwordIsValid = user
			? await verifyPassword(body.password, user.passwordHash, user.passwordSalt)
			: await verifyPassword(body.password, "0".repeat(64), "0".repeat(32));

		if (!user || !passwordIsValid) {
			throw new UnauthorizedException("Invalid email or password.");
		}

		const { token, expiresAt } = await createSession(c.env.SESSIONS, c.env.AUTH_SECRET, user.id);
		return c.json({ token, expiresAt: expiresAt.toISOString(), user: userView(user) });
	}
}
