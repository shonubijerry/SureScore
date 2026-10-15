import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createSession } from "../../modules/auth/session.js";
import { errorResponse } from "../../http/openapi.js";
import { PasswordResetService } from "../../modules/auth/password-reset.js";
import type { AppContext } from "../../types.js";
import { emailSchema, otpChallengeSchema, otpCodeSchema, sessionResponseSchema, userView } from "./schema.js";

const challengeResponses = {
	"202": { description: "Verification code sent by email", ...contentJson(otpChallengeSchema) },
	"429": errorResponse("Asked for a code too soon or too often"),
	"502": errorResponse("The email could not be sent"),
};

export class ForgotPasswordEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Forgot password: emails a one-time code to the account's address",
		request: { body: contentJson(z.object({ email: emailSchema })) },
		responses: { ...challengeResponses, "404": errorResponse("No account with this email") },
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new PasswordResetService(c.env).start(body.email), 202);
	}
}

export class ResendResetCodeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Send a fresh password-reset code (the previous one stops working)",
		request: { body: contentJson(z.object({ email: emailSchema })) },
		responses: { ...challengeResponses, "404": errorResponse("No reset in progress for this email") },
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new PasswordResetService(c.env).resend(body.email), 202);
	}
}

export class VerifyResetCodeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Confirm the reset code; returns a single-use token for setting the new password",
		request: { body: contentJson(z.object({ email: emailSchema, code: otpCodeSchema })) },
		responses: {
			"200": { description: "Code accepted", ...contentJson(z.object({ resetToken: z.string(), expiresAt: z.iso.datetime() })) },
			"400": errorResponse("Incorrect code"),
			"410": errorResponse("Code expired"),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new PasswordResetService(c.env).verify(body.email, body.code));
	}
}

export class ResetPasswordEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Set a new password with a reset token; signs out all other sessions and signs in",
		request: { body: contentJson(z.object({ resetToken: z.string().min(1), password: z.string().min(8) })) },
		responses: {
			"200": { description: "Password changed", ...contentJson(sessionResponseSchema) },
			"410": errorResponse("Reset token expired or already used"),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const user = await new PasswordResetService(c.env).reset(body.resetToken, body.password);
		const { token, expiresAt } = await createSession(c.env.SESSIONS, c.env.AUTH_SECRET, user.id);
		return c.json({ token, expiresAt: expiresAt.toISOString(), user: userView(user) });
	}
}
