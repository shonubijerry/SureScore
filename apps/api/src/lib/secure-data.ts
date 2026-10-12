// Protection of sensitive payout data at rest (T11.4). Account numbers are
// stored AES-256-GCM encrypted; a keyed hash (HMAC-SHA-256) supports duplicate
// detection without decrypting, and only the last four digits are ever shown.
// Both keys derive from the PAYOUT_ENCRYPTION_KEY secret, which must be set
// per environment (`wrangler secret put PAYOUT_ENCRYPTION_KEY`).

const PREFIX = "enc:v1:";
const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(secret: string | undefined, purpose: string) {
	if (!secret) throw new Error("PAYOUT_ENCRYPTION_KEY is not configured.");
	return crypto.subtle.digest("SHA-256", encoder.encode(`${purpose}:${secret}`));
}

export async function encrypt(secret: string | undefined, plain: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", await derive(secret, "enc"), "AES-GCM", false, ["encrypt"]);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain)));
	return `${PREFIX}${toBase64(iv)}:${toBase64(cipher)}`;
}

export async function decrypt(secret: string | undefined, stored: string): Promise<string> {
	if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext row
	const [iv, cipher] = stored.slice(PREFIX.length).split(":");
	const key = await crypto.subtle.importKey("raw", await derive(secret, "enc"), "AES-GCM", false, ["decrypt"]);
	const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(cipher));
	return new TextDecoder().decode(plain);
}

async function fingerprint(secret: string | undefined, bankCode: string | null | undefined, accountNumber: string) {
	const key = await crypto.subtle.importKey("raw", await derive(secret, "hmac"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${bankCode ?? ""}/${accountNumber}`)));
	return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Columns to persist for a payout account number; the raw number never reaches the database. */
export async function sealAccountNumber(secret: string | undefined, accountNumber: string, bankCode?: string | null) {
	const digits = accountNumber.trim();
	return {
		accountNumber: await encrypt(secret, digits),
		accountNumberHash: await fingerprint(secret, bankCode, digits),
		accountLast4: digits.slice(-4),
	};
}

/** API representation of a payout account: no ciphertext, no hash, masked number. */
export function toPublicAccount<T extends { accountNumber: string; accountNumberHash?: string | null; accountLast4?: string | null }>(
	account: T,
) {
	const { accountNumberHash: _hash, accountLast4, ...rest } = account;
	return { ...rest, accountNumber: `••••${accountLast4 ?? ""}` };
}
