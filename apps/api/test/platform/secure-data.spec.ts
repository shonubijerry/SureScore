import { describe, expect, it } from "vitest";
import { decrypt, encrypt, sealAccountNumber, toPublicAccount } from "../../src/platform/secure-data";

describe("payout data protection", () => {
	it("encrypts at rest, masks in responses and fingerprints deterministically", async () => {
		const sealed = await sealAccountNumber("k", "0123456789", "044");
		expect(sealed.accountNumber).not.toContain("0123456789");
		expect(await decrypt("k", sealed.accountNumber)).toBe("0123456789");
		expect((await sealAccountNumber("k", "0123456789", "044")).accountNumberHash).toBe(sealed.accountNumberHash);
		expect((await sealAccountNumber("k", "0123456789", "058")).accountNumberHash).not.toBe(sealed.accountNumberHash);
		const view = toPublicAccount({ ...sealed, id: "a" });
		expect(view).toMatchObject({ accountNumber: "••••6789" });
		expect(view).not.toHaveProperty("accountNumberHash");
		expect(await decrypt("k", "legacy-plain")).toBe("legacy-plain");
		await expect(decrypt("wrong", await encrypt("k", "x"))).rejects.toThrow();
		await expect(encrypt(undefined, "x")).rejects.toThrow();
	});
});
