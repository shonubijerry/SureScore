import { describe, expect, it, vi } from "vitest";
import { KudiSmsProvider } from "../../src/providers/sms/kudisms-provider";

describe("KudiSmsProvider", () => {
	const ok = () => new Response(JSON.stringify({ status: "success", error_code: "000", data: "2348031234567|m-1", msg: "Message received Successfully" }));

	it("sends through the corporate (DND-capable) route in KudiSMS's format", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(ok());
		const provider = new KudiSmsProvider({ apiKey: "tok", senderId: "SureScore", fetchImpl });
		expect(await provider.send({ to: "+2348031234567", body: "hi" })).toEqual({ provider: "kudisms", messageId: "m-1", status: "queued" });
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe("https://my.kudisms.net/api/corporate");
		const form = init.body as FormData;
		const field = (name: string) => form.get(name);
		expect(["token", "senderID", "recipients", "message"].map(field)).toEqual(["tok", "SureScore", "2348031234567", "hi"]);
	});

	it("treats a non-000 code as a failure even on HTTP 200, and a bad token", async () => {
		const missing = new Response(JSON.stringify({ status: "error", error_code: "300", msg: "Missing parameter: recipients." }));
		await expect(new KudiSmsProvider({ apiKey: "t", senderId: "S", fetchImpl: vi.fn().mockResolvedValue(missing) }).send({ to: "+2348031234567", body: "x" })).rejects.toThrow(/code 300.*Missing parameter/);
		const invalid = new Response(JSON.stringify({ status: "error", error_code: "100", msg: "Token provided is invalid." }), { status: 401 });
		await expect(new KudiSmsProvider({ apiKey: "t", senderId: "S", fetchImpl: vi.fn().mockResolvedValue(invalid) }).send({ to: "+2348031234567", body: "x" })).rejects.toThrow(/HTTP 401.*invalid/);
		await expect(new KudiSmsProvider({ apiKey: "", senderId: "S", fetchImpl: vi.fn() }).send({ to: "+1", body: "x" })).rejects.toThrow(/not configured/);
	});

	it("gives up on a hung request instead of hanging signup", async () => {
		const hung = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason))));
		const error = await new KudiSmsProvider({ apiKey: "t", senderId: "S", fetchImpl: hung as never, timeoutMs: 20 }).send({ to: "+2348031234567", body: "x" }).catch((e: Error) => e);
		expect((error as Error).message).toMatch(/did not respond within 20ms/);
		expect((error as Error).cause).toBeDefined();
	});
});
