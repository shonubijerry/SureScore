import { describe, expect, it, vi } from "vitest";
import { CloudflareEmailProvider } from "../../src/providers/email/cloudflare-email-provider";

describe("CloudflareEmailProvider", () => {
	it("sends through the send_email binding with a named sender", async () => {
		const send = vi.fn().mockResolvedValue({ messageId: "cf-1" });
		const provider = new CloudflareEmailProvider({ binding: { send } as never, fromAddress: "no-reply@x.com", fromName: "SureScore" });
		expect(await provider.send({ to: "a@b.com", subject: "S", text: "T", html: "<p>H</p>" })).toEqual({ provider: "cloudflare-email", messageId: "cf-1" });
		expect(send).toHaveBeenCalledWith({ to: "a@b.com", from: { email: "no-reply@x.com", name: "SureScore" }, subject: "S", text: "T", html: "<p>H</p>" });
	});

	it("surfaces Email Service error codes and missing configuration", async () => {
		const send = vi.fn().mockRejectedValue(Object.assign(new Error("domain not onboarded"), { code: "E_SENDER_NOT_VERIFIED" }));
		await expect(new CloudflareEmailProvider({ binding: { send } as never, fromAddress: "f@x.com" }).send({ to: "a@b.com", subject: "S", text: "T" })).rejects.toThrow(/E_SENDER_NOT_VERIFIED.*domain not onboarded/);
		await expect(new CloudflareEmailProvider({ binding: undefined, fromAddress: "f@x.com" }).send({ to: "a@b.com", subject: "S", text: "T" })).rejects.toThrow(/binding is not configured/);
	});
});
