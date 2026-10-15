// One-time passcodes for phone verification, following common OTP practice:
// 6 random digits from a CSPRNG, valid for 10 minutes and single use; only an
// HMAC of the code is stored; checks are constant-time and the code is burnt
// after 5 wrong guesses; resends are throttled per number and capped so the
// SMS endpoint cannot be used to flood a phone or run up provider costs.

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Codes sent per verification before the number must wait for it to expire. */
export const OTP_MAX_SENDS = 5;

const OTP_SPACE = 10 ** OTP_LENGTH;
// Largest multiple of OTP_SPACE below 2^32, so `value % OTP_SPACE` is unbiased.
const UNBIASED_LIMIT = Math.floor(0x1_0000_0000 / OTP_SPACE) * OTP_SPACE;

/** A uniformly random zero-padded numeric code. */
export function generateOtp(): string {
	const buffer = new Uint32Array(1);
	do crypto.getRandomValues(buffer);
	while (buffer[0] >= UNBIASED_LIMIT);
	return String(buffer[0] % OTP_SPACE).padStart(OTP_LENGTH, "0");
}

const MINUTES = OTP_TTL_SECONDS / 60;

/** SMS body for a code. */
export const otpMessage = (code: string) =>
	`Your SureScore verification code is ${code}. It expires in ${MINUTES} minutes. Never share this code with anyone.`;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Email for a code; `action` says what it is for, e.g. "finish creating your account". */
export function otpEmail(code: string, action: string) {
	const intro = `Use this code to ${action}:`;
	const warning = `It expires in ${MINUTES} minutes. If you didn't request it, you can ignore this email. Never share this code with anyone.`;
	return {
		subject: `${code} is your SureScore verification code`,
		text: `${intro}\n\n${code}\n\n${warning}\n\n- SureScore`,
		html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:20px;margin:0 0 16px">SureScore</h1>
<p style="margin:0 0 16px">${escapeHtml(intro)}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;font-variant-numeric:tabular-nums">${code}</p>
<p style="margin:0;color:#555;font-size:14px">${escapeHtml(warning)}</p>
</div>`,
	};
}

/** HMAC of the code bound to its subject (e.g. the phone), so a stored hash is useless for any other number. */
export async function hashOtp(secret: string, subject: string, code: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`otp:${subject}:${code}`));
	return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}
