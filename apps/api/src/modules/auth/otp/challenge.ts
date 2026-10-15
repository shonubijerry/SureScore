// OTP challenges shared by every flow that sends a code (signup, password
// reset), over any channel (email today; SMS is kept, see otp-channels.ts). A
// challenge lives in KV keyed by purpose + destination and expires with its
// code, which also resets the send cap. Each challenge can carry flow data
// (e.g. the pending signup), stored with it.
// Rules (see otp.ts): 60s resend cooldown, max sends per challenge, code burnt
// after max wrong guesses, codes bound to purpose + destination.

import { HTTPException } from "hono/http-exception";
import { log } from "../../../platform/logger.js";
import type { OtpChannel } from "./channels.js";
import {
	constantTimeEqual,
	generateOtp,
	hashOtp,
	OTP_MAX_ATTEMPTS,
	OTP_MAX_SENDS,
	OTP_RESEND_COOLDOWN_SECONDS,
	OTP_TTL_SECONDS,
} from "./code.js";

const KV_MIN_TTL_SECONDS = 60;

export type OtpPurpose = "signup" | "password-reset";

export interface OtpChallenge {
	/** Where the code went (normalised). */
	sentTo: string;
	expiresAt: string;
	resendAvailableAt: string;
}

interface ChallengeRecord<T> {
	destination: string;
	data: T;
	/** Null once the code is burnt by too many wrong guesses. */
	codeHash: string | null;
	attempts: number;
	sends: number;
	codeExpiresAt: number;
	lastSentAt: number;
}

export const otpFail = (status: 400 | 404 | 409 | 410 | 422 | 429, message: string): never => {
	throw new HTTPException(status, { message });
};

export class OtpChallenges<T> {
	constructor(
		private readonly env: Env,
		private readonly purpose: OtpPurpose,
		readonly channel: OtpChannel,
		private readonly now: () => number = Date.now,
	) {}

	/** What the code lets the user do, for the message ("Use this code to ..."). */
	private get action() {
		return this.purpose === "signup" ? "finish creating your SureScore account" : "reset your SureScore password";
	}

	/**
	 * Texts a fresh code (earlier codes stop working). Pass `data` to start or
	 * restart a challenge; without it, an existing challenge is resent. Send
	 * counters always carry over, so restarting never bypasses the limits.
	 */
	async issue(rawDestination: string, data?: T): Promise<OtpChallenge> {
		const destination = this.channel.normalize(rawDestination);
		const existing = await this.load(destination);
		if (!existing && data === undefined) otpFail(404, "This verification has expired. Please start again.");
		if (existing) this.assertCanSend(existing);

		const code = generateOtp();
		const now = this.now();
		const next: ChallengeRecord<T> = {
			destination,
			data: data ?? existing!.data,
			codeHash: await this.hash(destination, code),
			attempts: 0,
			sends: (existing?.sends ?? 0) + 1,
			codeExpiresAt: now + OTP_TTL_SECONDS * 1000,
			lastSentAt: now,
		};
		try {
			await this.channel.deliver(destination, code, this.action);
		} catch (error) {
			log.error("auth", "otp_send_failed", { purpose: this.purpose, channel: this.channel.kind, error });
			throw new HTTPException(502, { message: "We couldn't send your verification code. Please try again shortly.", cause: error });
		}
		await this.save(next);
		return {
			sentTo: destination,
			expiresAt: new Date(next.codeExpiresAt).toISOString(),
			resendAvailableAt: new Date(now + OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
		};
	}

	/** Checks the code and returns the challenge data; a wrong guess counts towards the limit. The challenge stays until `consume`. */
	async verify(rawDestination: string, code: string): Promise<T> {
		const destination = this.channel.normalize(rawDestination);
		const record = await this.load(destination);
		if (!record || this.now() >= record.codeExpiresAt) otpFail(410, "This code has expired. Request a new one.");
		if (!record!.codeHash) otpFail(429, "Too many incorrect attempts. Request a new code.");

		if (!constantTimeEqual(await this.hash(destination, code.trim()), record!.codeHash!)) {
			const attempts = record!.attempts + 1;
			const burnt = attempts >= OTP_MAX_ATTEMPTS;
			await this.save({ ...record!, attempts, codeHash: burnt ? null : record!.codeHash });
			const left = OTP_MAX_ATTEMPTS - attempts;
			otpFail(400, burnt ? "Too many incorrect attempts. Request a new code." : `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`);
		}
		return record!.data;
	}

	/** Ends the challenge so its code cannot be used again. */
	consume(rawDestination: string) {
		return this.env.SESSIONS.delete(this.key(this.channel.normalize(rawDestination)));
	}

	private key(destination: string) {
		return `otp:${this.purpose}:${this.channel.kind}:${destination}`;
	}

	/** Bound to purpose + destination, so a signup code can never reset a password. */
	private hash(destination: string, code: string) {
		return hashOtp(this.env.AUTH_SECRET, `${this.purpose}:${destination}`, code);
	}

	private assertCanSend(record: ChallengeRecord<T>) {
		const waitSeconds = Math.ceil((record.lastSentAt + OTP_RESEND_COOLDOWN_SECONDS * 1000 - this.now()) / 1000);
		if (waitSeconds > 0) otpFail(429, `Please wait ${waitSeconds}s before requesting another code.`);
		if (record.sends >= OTP_MAX_SENDS) otpFail(429, `Too many codes requested. Try again in ${Math.ceil(OTP_TTL_SECONDS / 60)} minutes.`);
	}

	private load(destination: string) {
		return this.env.SESSIONS.get<ChallengeRecord<T>>(this.key(destination), "json");
	}

	/** The record lives exactly as long as its current code. */
	private save(record: ChallengeRecord<T>) {
		const ttl = Math.ceil((record.codeExpiresAt - this.now()) / 1000);
		return this.env.SESSIONS.put(this.key(record.destination), JSON.stringify(record), { expirationTtl: Math.max(ttl, KV_MIN_TTL_SECONDS) });
	}
}
