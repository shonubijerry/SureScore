import { describe, expect, it } from "vitest";
import { assertHasCompletedPayoutDetails, EligibilityError } from "@surescore/shared";

describe("first prediction payout eligibility", () => {
	it("blocks a user with no payout account from their first prediction", () => {
		expect(() =>
			assertHasCompletedPayoutDetails("NG", [], {
				requireCountryMatch: true,
			}),
		).toThrow(EligibilityError);
	});

	it("allows a user to make a first prediction once a payout account exists for their country", () => {
		expect(() =>
			assertHasCompletedPayoutDetails(
				"NG",
				[
					{ countryCode: "NG", accountName: "Ada Doe", accountNumber: "1234567890" },
				],
				{ requireCountryMatch: true },
			),
		).not.toThrow();
	});

	it("rejects payout accounts from a different country even if they exist", () => {
		expect(() =>
			assertHasCompletedPayoutDetails(
				"NG",
				[
					{ countryCode: "US", accountName: "Ada Doe", accountNumber: "1234567890" },
				],
				{ requireCountryMatch: true },
			),
		).toThrow(EligibilityError);
	});
});
