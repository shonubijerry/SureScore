import { describe, expect, it, vi } from "vitest";
import { constantTimeEqual, generateOtp, hashOtp, OTP_LENGTH } from "../../src/modules/auth/otp/code";
import { emailChannel } from "../../src/modules/auth/otp/channels";

describe("OTP", () => {
	it("generates zero-padded numeric codes of the standard length", () => {
		const codes = Array.from({ length: 500 }, generateOtp);
		expect(codes.every((c) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(c))).toBe(true);
		expect(new Set(codes).size).toBeGreaterThan(490);
	});

	it("binds the hash to the secret and the phone", async () => {
		const hash = await hashOtp("s", "+2348031234567", "123456");
		expect(constantTimeEqual(hash, await hashOtp("s", "+2348031234567", "123456"))).toBe(true);
		expect(constantTimeEqual(hash, await hashOtp("s", "+2348031234568", "123456"))).toBe(false);
		expect(constantTimeEqual(hash, await hashOtp("t", "+2348031234567", "123456"))).toBe(false);
		expect(hash).not.toContain("123456");
	});
});

describe("email OTP channel", () => {
	it("normalises addresses and emails the code with what it is for", async () => {
		const send = vi.fn().mockResolvedValue({ provider: "fake", messageId: null });
		const channel = emailChannel({} as Env, () => ({ id: "fake", send }));
		expect(channel.normalize("  Ada@Example.COM ")).toBe("ada@example.com");
		expect(() => channel.normalize("nope")).toThrow(/valid email/);
		await channel.deliver("ada@example.com", "123456", "reset your SureScore password");
		const message = send.mock.calls[0][0];
		expect(message).toMatchObject({ to: "ada@example.com", subject: "123456 is your SureScore verification code" });
		expect(message.text).toContain("Use this code to reset your SureScore password:");
		expect(message.html).toContain("123456");
	});
});
