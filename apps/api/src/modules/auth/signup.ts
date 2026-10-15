// Email signup with OTP verification. Nothing is written to D1 until the
// emailed code is confirmed: the pending signup (password already hashed)
// rides on the OTP challenge in KV, so no session exists before verification
// and an abandoned attempt never blocks the address's real owner.
// The phone number is collected but not verified (see otp-channels.ts to
// switch SMS verification back on).

import { createDbClient } from "@surescore/db";
import { countryOfPhone } from "@surescore/shared";
import { hashPassword } from "./password.js";
import { emailChannel, type EmailResolver } from "./otp/channels.js";
import { OtpChallenges, otpFail, type OtpChallenge } from "./otp/challenge.js";

export type { OtpChallenge } from "./otp/challenge.js";

interface PendingSignup {
	phone: string;
	countryCode: string;
	displayName: string;
	passwordHash: string;
	passwordSalt: string;
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

export class SignupService {
	private readonly db;
	private readonly challenges: OtpChallenges<PendingSignup>;

	constructor(
		env: Env,
		emailFor?: EmailResolver,
		private readonly now: () => number = Date.now,
	) {
		this.db = createDbClient(env.DB);
		this.challenges = new OtpChallenges(env, "signup", emailChannel(env, emailFor), now);
	}

	/** Validates the details, holds them pending and emails a code. `countryCode` is the account's signup country. */
	async start(input: { email: string; phone: string; displayName: string; password: string; countryCode: string }): Promise<OtpChallenge> {
		const email = this.challenges.channel.normalize(input.email);
		if (!countryOfPhone(input.phone)?.isLaunched) otpFail(422, "Enter a valid mobile number for a supported country.");
		if (await this.db.user.findUnique({ where: { email }, select: { id: true } })) {
			otpFail(409, "An account with this email already exists. Sign in instead.");
		}
		const { hash, salt } = await hashPassword(input.password);
		// A restarted signup replaces the pending details but keeps the send counters.
		return this.challenges.issue(email, {
			phone: input.phone,
			countryCode: input.countryCode,
			displayName: input.displayName,
			passwordHash: hash,
			passwordSalt: salt,
		});
	}

	resend(email: string): Promise<OtpChallenge> {
		return this.challenges.issue(email);
	}

	/** Confirms the code and creates the (email-verified) account. */
	async verify(rawEmail: string, code: string) {
		const email = this.challenges.channel.normalize(rawEmail);
		const pending = await this.challenges.verify(email, code);
		try {
			const user = await this.db.user.create({
				data: { email, emailVerifiedAt: new Date(this.now()), ...pending },
			});
			await this.challenges.consume(email);
			return user;
		} catch (error) {
			if (isUniqueViolation(error)) otpFail(409, "An account with this email already exists. Sign in instead.");
			throw error;
		}
	}
}
