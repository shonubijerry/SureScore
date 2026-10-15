import { describe, expect, it } from "vitest";
import { countryOfPhone, toE164 } from "@surescore/shared";

describe("phone numbers", () => {
	it("normalises local and international Nigerian formats to E.164", () => {
		for (const input of ["08031234567", "8031234567", "0803 123 4567", "+234 803-123-4567", "2348031234567"]) {
			expect(toE164("NG", input)).toBe("+2348031234567");
		}
	});

	it("rejects wrong lengths, other dial codes and unknown countries", () => {
		for (const input of ["0803123456", "080312345678", "+14155550123", "abc", "0003123456"]) expect(toE164("NG", input)).toBeNull();
		expect(toE164("ZZ", "08031234567")).toBeNull();
	});

	it("finds the configured country of an E.164 number", () => {
		expect(countryOfPhone("+2348031234567")?.code).toBe("NG");
		expect(countryOfPhone("2348031234567")).toBeNull();
		expect(countryOfPhone("+14155550123")).toBeNull();
	});
});
