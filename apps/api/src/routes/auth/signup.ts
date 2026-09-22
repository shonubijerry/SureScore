import { OpenAPIRoute, ConflictException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { getCountryConfig } from "@surescore/shared";
import { hashPassword } from "../../lib/password.js";
import { createSession } from "../../lib/auth.js";
import { errorResponse } from "../../lib/openapi.js";
import type { AppContext } from "../../types.js";

const userResponseSchema = z.object({
	id: z.string(),
	email: z.string(),
	countryCode: z.string(),
	displayName: z.string().nullable(),
	role: z.string(),
});

export class SignupEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Create an account",
		request: {
			body: contentJson(
				z.object({
					email: z.email(),
					password: z.string().min(8),
					countryCode: z.string().length(2).describe("ISO 3166-1 alpha-2 country code"),
					displayName: z.string().trim().min(1).optional(),
				}),
			),
		},
		responses: {
			"201": {
				description: "Account created",
				...contentJson(
					z.object({ token: z.string(), expiresAt: z.iso.datetime(), user: userResponseSchema }),
				),
			},
			"400": errorResponse("Unsupported country"),
			...ConflictException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const email = body.email.trim().toLowerCase();
		const countryCode = body.countryCode.trim().toUpperCase();

		const country = getCountryConfig(countryCode);
		if (!country || !country.isLaunched) {
			return c.json({ error: `Country "${countryCode}" is not currently supported.` }, 400);
		}

		const db = createDbClient(c.env.DB);

		const existing = await db.user.findUnique({ where: { email } });
		if (existing) {
			throw new ConflictException("An account with this email already exists.");
		}

		const { hash, salt } = await hashPassword(body.password);
		const user = await db.user.create({
			data: {
				email,
				passwordHash: hash,
				passwordSalt: salt,
				countryCode: country.code,
				displayName: body.displayName,
			},
		});

		const { token, expiresAt } = await createSession(c.env.SESSIONS, c.env.AUTH_SECRET, user.id);

		return c.json(
			{
				token,
				expiresAt: expiresAt.toISOString(),
				user: {
					id: user.id,
					email: user.email,
					countryCode: user.countryCode,
					displayName: user.displayName,
					role: user.role,
				},
			},
			201,
		);
	}
}
