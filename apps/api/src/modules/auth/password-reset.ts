// Forgot password: a code emailed to the account's address proves ownership,
// then a short-lived single-use reset token lets the user set a new password.
// Resetting signs out every existing session, in case the account was taken over.

import { createDbClient } from "@surescore/db";
import { revokeAllSessions } from "./session.js";
import { hashPassword } from "./password.js";
import { emailChannel, type EmailResolver } from "./otp/channels.js";
import { OtpChallenges, otpFail, type OtpChallenge } from "./otp/challenge.js";

export const RESET_TOKEN_TTL_SECONDS = 10 * 60;

const resetKey = async (token: string) => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return `password-reset:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
};

export class PasswordResetService {
	private readonly db;
	private readonly challenges: OtpChallenges<{ userId: string }>;

	constructor(
		private readonly env: Env,
		emailFor?: EmailResolver,
		private readonly now: () => number = Date.now,
	) {
		this.db = createDbClient(env.DB);
		this.challenges = new OtpChallenges(env, "password-reset", emailChannel(env, emailFor), now);
	}

	async start(rawEmail: string): Promise<OtpChallenge> {
		const email = this.challenges.channel.normalize(rawEmail);
		const user = await this.db.user.findUnique({ where: { email }, select: { id: true } });
		if (!user) otpFail(404, "No account uses this email. Check it, or create an account.");
		return this.challenges.issue(email, { userId: user!.id });
	}

	resend(email: string): Promise<OtpChallenge> {
		return this.challenges.issue(email);
	}

	/** A valid code is exchanged (once) for a reset token. */
	async verify(email: string, code: string) {
		const { userId } = await this.challenges.verify(email, code);
		await this.challenges.consume(email);
		const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
		await this.env.SESSIONS.put(await resetKey(token), JSON.stringify({ userId }), { expirationTtl: RESET_TOKEN_TTL_SECONDS });
		return { resetToken: token, expiresAt: new Date(this.now() + RESET_TOKEN_TTL_SECONDS * 1000).toISOString() };
	}

	/** Sets the new password and signs out everywhere; returns the user to start a fresh session. */
	async reset(token: string, password: string) {
		const key = await resetKey(token);
		const record = await this.env.SESSIONS.get<{ userId: string }>(key, "json");
		if (!record) otpFail(410, "This reset link has expired. Start again.");
		await this.env.SESSIONS.delete(key);
		const { hash, salt } = await hashPassword(password);
		const user = await this.db.user.update({ where: { id: record!.userId }, data: { passwordHash: hash, passwordSalt: salt } });
		await revokeAllSessions(this.env.SESSIONS, user.id);
		return user;
	}
}
