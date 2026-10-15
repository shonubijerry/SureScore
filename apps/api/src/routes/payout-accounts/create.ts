import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { createDbClient } from "@surescore/db";
import { isNameMatching, resolvePaymentProviderForCountry } from "@surescore/shared";
import { recordAudit } from "../../modules/admin/audit.js";
import { sealAccountNumber, toPublicAccount } from "../../platform/secure-data.js";
import type { AppContext } from "../../types.js";
import { payoutAccountSchema } from "./schema.js";

export class CreatePayoutAccountEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Payout Accounts"],
		summary: "Add a payout account for the current user",
		request: {
			body: contentJson(
				z.object({
					accountName: z.string().trim().min(1),
					accountNumber: z.string().trim().min(1),
					bankCode: z.string().trim().min(1).optional(),
				}),
			),
		},
		responses: {
			"201": {
				description: "Payout account created",
				...contentJson(z.object({ payoutAccount: payoutAccountSchema })),
			},
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const userId = c.get("userId");

		const db = createDbClient(c.env.DB);
		const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

		if (user.displayName && !isNameMatching(body.accountName, user.displayName)) {
			throw new HTTPException(400, {
				message: `Account name ("${body.accountName}") must match your registered name ("${user.displayName}").`,
			});
		}
		if (!user.displayName) {
			await db.user.update({ where: { id: userId }, data: { displayName: body.accountName } });
		}

		// The payout provider is always derived from the user's country, never
		// accepted from the client, to keep provider selection config-driven.
		const provider = resolvePaymentProviderForCountry(user.countryCode);
		const existingCount = await db.payoutAccount.count({ where: { userId, deletedAt: null } });

		const account = await db.payoutAccount.create({
			data: {
				userId,
				countryCode: user.countryCode,
				provider: provider.id,
				accountName: body.accountName,
				...(await sealAccountNumber(c.env.PAYOUT_ENCRYPTION_KEY, body.accountNumber, body.bankCode)),
				bankCode: body.bankCode,
				isDefault: existingCount === 0,
			},
		});

		await recordAudit(db, userId, "payout_account.create", "user-initiated", { subject: account.id });
		return c.json({ payoutAccount: toPublicAccount(account) }, 201);
	}
}
