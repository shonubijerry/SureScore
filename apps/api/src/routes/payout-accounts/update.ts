import { OpenAPIRoute, NotFoundException, contentJson } from "chanfana";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { createDbClient } from "@surescore/db";
import { isNameMatching } from "@surescore/shared";
import { recordAudit } from "../../modules/admin/audit.js";
import { sealAccountNumber, toPublicAccount, decrypt } from "../../platform/secure-data.js";
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
		if (!account || account.userId !== userId || account.deletedAt !== null) {
			throw new NotFoundException("Payout account not found.");
		}

		if (body.accountName !== undefined) {
			const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
			if (user.displayName && !isNameMatching(body.accountName, user.displayName)) {
				throw new HTTPException(400, {
					message: `Account name ("${body.accountName}") must match your registered name ("${user.displayName}").`,
				});
			}
			if (!user.displayName) {
				await db.user.update({ where: { id: userId }, data: { displayName: body.accountName } });
			}
		}

		if (body.isDefault === true) {
			await db.payoutAccount.updateMany({
				where: { userId, isDefault: true, deletedAt: null },
				data: { isDefault: false },
			});
		}

		// The duplicate-detection hash covers number + bank, so it is re-derived when either changes.
		const reseal = body.accountNumber !== undefined || body.bankCode !== undefined;
		const secret = c.env.PAYOUT_ENCRYPTION_KEY;
		const number = body.accountNumber ?? (reseal ? await decrypt(secret, account.accountNumber) : "");
		const updated = await db.payoutAccount.update({
			where: { id: params.id },
			data: {
				accountName: body.accountName,
				bankCode: body.bankCode,
				...(reseal && (await sealAccountNumber(secret, number, body.bankCode ?? account.bankCode))),
				isDefault: body.isDefault,
				...(reseal && { providerRecipientCode: null, recipientProvider: null }),
			},
		});

		await recordAudit(db, userId, "payout_account.update", "user-initiated", { subject: updated.id });
		return c.json({ payoutAccount: toPublicAccount(updated) });
	}
}
