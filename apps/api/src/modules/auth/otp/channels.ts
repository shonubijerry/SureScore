// Where an OTP is delivered. A channel validates/normalises the destination
// and delivers the code; the challenge rules (otp-challenge.ts) are the same
// for every channel. Sign-in currently uses email; the SMS channel is kept so
// phone verification can be switched back on without new code.

import { HTTPException } from "hono/http-exception";
import { countryOfPhone, DEFAULT_COUNTRY_CODE, isEmailAddress, normalizeEmail, type EmailProvider, type SmsProvider } from "@surescore/shared";
import { createProviderRegistry } from "../../../providers/registry.js";
import { otpEmail, otpMessage } from "./code.js";

export interface OtpChannel {
	readonly kind: "email" | "sms";
	/** Canonical form of the destination; throws a 422 when it can't be served. */
	normalize(destination: string): string;
	/** `action` completes "Use this code to ..." */
	deliver(destination: string, code: string, action: string): Promise<void>;
}

const unprocessable = (message: string): never => {
	throw new HTTPException(422, { message });
};

export type EmailResolver = (countryCode: string) => EmailProvider;
export type SmsResolver = (countryCode: string) => SmsProvider;

/** Codes by email, through the launch market's configured email provider. */
export function emailChannel(env: Env, emailFor?: EmailResolver): OtpChannel {
	const provider = () => (emailFor ?? ((c: string) => createProviderRegistry(env).resolveEmailProviderForCountry(c)))(DEFAULT_COUNTRY_CODE);
	return {
		kind: "email",
		normalize: (email) => (isEmailAddress(email) ? normalizeEmail(email) : unprocessable("Enter a valid email address.")),
		async deliver(email, code, action) {
			await provider().send({ to: email, ...otpEmail(code, action) });
		},
	};
}

/** Codes by SMS, through the phone's country's SMS provider. */
export function smsChannel(env: Env, smsFor?: SmsResolver): OtpChannel {
	const provider = smsFor ?? ((c: string) => createProviderRegistry(env).resolveSmsProviderForCountry(c));
	return {
		kind: "sms",
		normalize(phone) {
			const country = countryOfPhone(phone);
			return country?.isLaunched ? phone : unprocessable("Enter a valid mobile number for a supported country.");
		},
		async deliver(phone, code) {
			const result = await provider(countryOfPhone(phone)!.code).send({ to: phone, body: otpMessage(code) });
			if (result.status === "failed") throw new Error("SMS provider rejected the message.");
		},
	};
}
