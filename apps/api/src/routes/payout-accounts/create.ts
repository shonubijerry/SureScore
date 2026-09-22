import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { resolvePaymentProviderForCountry } from "@surescore/shared";
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

		// The payout provider is always derived from the user's country, never
		// accepted from the client, to keep provider selection config-driven.
		const provider = resolvePaymentProviderForCountry(user.countryCode);
		const existingCount = await db.payoutAccount.count({ where: { userId } });

		const account = await db.payoutAccount.create({
			data: {
				userId,
				countryCode: user.countryCode,
				provider: provider.id,
				accountName: body.accountName,
				accountNumber: body.accountNumber,
				bankCode: body.bankCode,
				isDefault: existingCount === 0,
			},
		});

		return c.json({ payoutAccount: account }, 201);
	}
}
