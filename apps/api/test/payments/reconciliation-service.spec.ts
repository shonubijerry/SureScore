import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { ReconciliationService } from "../../src/modules/payments/reconciliation-service";
import { sealAccountNumber } from "../../src/platform/secure-data";
import { applyMigrations } from "../helpers/db";

const db = createDbClient(env.DB);
beforeAll(applyMigrations);

describe("reconciliation service", () => {
	it("detects payout accounts shared by different winners without exposing numbers", async () => {
		const user = (id: string) => ({ id, email: `${id}@s.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG" });
		await db.user.createMany({ data: [user("s1"), user("s2")] });
		for (const userId of ["s1", "s2"]) {
			await db.payoutAccount.create({
				data: { userId, countryCode: "NG", provider: "paystack", accountName: "N", ...(await sealAccountNumber("k", "0123456789", "044")) },
			});
		}
		const shared = await (new ReconciliationService(env.DB) as any).sharedAccounts(["s1"]);
		expect([...shared.values()]).toEqual([["s1", "s2"]].map((ids) => expect.arrayContaining(ids)));
		expect([...shared.keys()].join()).not.toContain("0123456789");
	});
});
