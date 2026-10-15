import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { resolveSignupCountry } from "@surescore/shared";
import { createSession } from "../../modules/auth/session.js";
import { errorResponse } from "../../http/openapi.js";
import { SignupService } from "../../modules/auth/signup.js";
import type { AppContext } from "../../types.js";
import { emailSchema, fullNameSchema, otpChallengeSchema, otpCodeSchema, phoneSchema, sessionResponseSchema, userView } from "./schema.js";

const challengeResponses = {
	"202": { description: "Verification code sent by email", ...contentJson(otpChallengeSchema) },
	"429": errorResponse("Asked for a code too soon or too often"),
	"502": errorResponse("The email could not be sent"),
};

export class SignupEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Start signup: holds the details and emails a one-time code to verify the address",
		request: {
			body: contentJson(
				z.object({
					fullName: fullNameSchema,
					email: emailSchema,
					phone: phoneSchema.describe("Contact number; not verified"),
					password: z.string().min(8),
				}),
			),
		},
		responses: { ...challengeResponses, "409": errorResponse("Email already registered") },
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		// Country is never user-supplied: it comes from Cloudflare's edge geolocation.
		const country = resolveSignupCountry(c.req.raw.cf?.country as string | undefined);
		const challenge = await new SignupService(c.env).start({
			email: body.email,
			phone: body.phone,
			displayName: body.fullName,
			password: body.password,
			countryCode: country.code,
		});
		return c.json(challenge, 202);
	}
}

export class ResendSignupCodeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Send a fresh signup code (the previous one stops working)",
		request: { body: contentJson(z.object({ email: emailSchema })) },
		responses: { ...challengeResponses, "404": errorResponse("No signup in progress for this email") },
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new SignupService(c.env).resend(body.email), 202);
	}
}

export class VerifySignupEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Confirm the signup code; creates the account and signs in",
		request: {
			body: contentJson(z.object({ email: emailSchema, code: otpCodeSchema })),
		},
		responses: {
			"201": { description: "Account created", ...contentJson(sessionResponseSchema) },
			"400": errorResponse("Incorrect code"),
			"410": errorResponse("Code expired"),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const user = await new SignupService(c.env).verify(body.email, body.code);
		const { token, expiresAt } = await createSession(c.env.SESSIONS, c.env.AUTH_SECRET, user.id);
		return c.json({ token, expiresAt: expiresAt.toISOString(), user: userView(user) }, 201);
	}
}
