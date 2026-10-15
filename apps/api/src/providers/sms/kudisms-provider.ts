// KudiSMS adapter. All KudiSMS-specific request/response shapes are isolated
// here; only the internal `SmsProvider` contract is exposed.
// Uses "Send Corporate SMS" (POST /api/corporate, multipart form): the route
// for OTPs/alerts, which delivers to DND numbers, unlike the promotional
// /api/sms route. Needs a Corporate Sender ID approved on the KudiSMS account.
// Docs: https://documenter.getpostman.com/view/44181644/2sB2cd3HUd

import type { SendSmsRequest, SmsProvider, SmsResult } from "@surescore/shared";

export interface KudiSmsProviderConfig {
	apiKey: string;
	/** Approved Corporate Sender ID shown to the recipient. */
	senderId: string;
	baseUrl?: string;
	fetchImpl?: typeof fetch;
	/** Give up on a hung request after this long, so signup fails fast instead of hanging. */
	timeoutMs?: number;
}

interface KudiSmsResponse {
	status?: string;
	/** "000" means accepted. */
	error_code?: string;
	msg?: string;
	/** "234XXXXXXXXXX|message-id" for a single recipient. */
	data?: string | string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
const SUCCESS_CODE = "000";

export class KudiSmsProvider implements SmsProvider {
	readonly id = "kudisms";

	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;

	constructor(private readonly config: KudiSmsProviderConfig) {
		this.baseUrl = config.baseUrl ?? "https://my.kudisms.net";
		// workerd's fetch must keep its original `this` (see PaystackProvider).
		this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
	}

	async send({ to, body }: SendSmsRequest): Promise<SmsResult> {
		if (!this.config.apiKey) throw new Error("KudiSMS API key is not configured.");
		const form = new FormData();
		form.set("token", this.config.apiKey);
		form.set("senderID", this.config.senderId);
		// KudiSMS expects international format without the "+".
		form.set("recipients", to.replace(/^\+/, ""));
		form.set("message", body);

		const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const response = await this.fetchImpl(`${this.baseUrl}/api/corporate`, {
			method: "POST",
			body: form,
			signal: AbortSignal.timeout(timeoutMs),
		}).catch((error: unknown) => {
			const timedOut = error instanceof DOMException && error.name === "TimeoutError";
			throw new Error(timedOut ? `KudiSMS did not respond within ${timeoutMs}ms.` : "KudiSMS request failed.", { cause: error });
		});

		const result = (await response.json().catch(() => ({}))) as KudiSmsResponse;
		// Errors come back as HTTP 401 (bad token) or as HTTP 200 with a non-"000" code.
		if (!response.ok || result.status !== "success" || result.error_code !== SUCCESS_CODE) {
			throw new Error(`KudiSMS send failed (HTTP ${response.status}, code ${result.error_code ?? "?"}): ${result.msg ?? response.statusText}`);
		}
		const first = Array.isArray(result.data) ? result.data[0] : result.data;
		return { provider: this.id, messageId: first?.split("|")[1] ?? null, status: "queued" };
	}
}
