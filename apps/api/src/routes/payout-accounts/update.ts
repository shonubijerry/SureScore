import { OpenAPIRoute, NotFoundException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";
import { payoutAccountSchema } from "./schema.js";

export class UpdatePayoutAccountEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Payout Accounts"],
		summary: "Update a payout account for the current user",
		request: {
			params: z.object({ id: z.string() }),
			body: contentJson(
				z.object({
					accountName: z.string().trim().min(1).optional(),
					accountNumber: z.string().trim().min(1).optional(),
					bankCode: z.string().trim().min(1).optional(),
					isDefault: z.boolean().optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Payout account updated",
				...contentJson(z.object({ payoutAccount: payoutAccountSchema })),
			},
			...NotFoundException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		const userId = c.get("userId");

		const db = createDbClient(c.env.DB);
		const account = await db.payoutAccount.findUnique({ where: { id: params.id } });
		if (!account || account.userId !== userId) {
			throw new NotFoundException("Payout account not found.");
		}

		if (body.isDefault === true) {
			await db.payoutAccount.updateMany({
				where: { userId, isDefault: true },
				data: { isDefault: false },
			});
		}

		const updated = await db.payoutAccount.update({
			where: { id: params.id },
			data: {
				accountName: body.accountName,
				accountNumber: body.accountNumber,
				bankCode: body.bankCode,
				isDefault: body.isDefault,
			},
		});

		return c.json({ payoutAccount: updated });
	}
}
