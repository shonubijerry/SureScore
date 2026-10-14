import { OpenAPIRoute, NotFoundException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { recordAudit } from "../../lib/audit.js";
import type { AppContext } from "../../types.js";

export class DeletePayoutAccountEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Payout Accounts"],
		summary: "Remove a payout account for the current user",
		request: {
			params: z.object({ id: z.string() }),
		},
		responses: {
			"200": { description: "Payout account removed", ...contentJson(z.object({ ok: z.literal(true) })) },
			...NotFoundException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const userId = c.get("userId");

		const db = createDbClient(c.env.DB);
		const account = await db.payoutAccount.findUnique({ where: { id: params.id } });
		if (!account || account.userId !== userId || account.deletedAt !== null) {
			throw new NotFoundException("Payout account not found.");
		}

		await db.payoutAccount.update({
			where: { id: params.id },
			data: { deletedAt: new Date(), isDefault: false },
		});

		if (account.isDefault) {
			const nextAccount = await db.payoutAccount.findFirst({
				where: { userId, deletedAt: null, id: { not: params.id } },
				orderBy: { createdAt: "desc" },
			});
			if (nextAccount) {
				await db.payoutAccount.update({
					where: { id: nextAccount.id },
					data: { isDefault: true },
				});
			}
		}

		await recordAudit(db, userId, "payout_account.delete", "user-initiated", { subject: params.id });
		return c.json({ ok: true });
	}
}
