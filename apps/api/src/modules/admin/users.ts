// Read-only user directory for support: every account (not just staff), with
// payout accounts (masked), activity counts and settled money totals. A user's
// payouts are the payout queue filtered by `userId` (AdminTransferService).

import { createDbClient } from "@surescore/db";
import type { Role } from "@surescore/shared";
import { newestFirst, paginate, type PageParams } from "../../http/pagination.js";
import { toPublicAccount } from "../../platform/secure-data.js";
import { fail } from "../pots/pot-service.js";

export const publicUser = { id: true, phone: true, email: true, displayName: true, role: true, countryCode: true, createdAt: true } as const;

export interface UserSearch extends PageParams {
	q?: string;
	roles?: readonly Role[];
	countryCode?: string;
}

export class AdminUserService {
	private readonly db;

	constructor(database: D1Database) {
		this.db = createDbClient(database);
	}

	/** Newest first; `q` matches phone, email or name, or an exact user id. */
	list({ q, roles, countryCode, ...page }: UserSearch) {
		const term = q?.trim();
		const where = {
			...(roles && { role: { in: [...roles] } }),
			...(countryCode && { countryCode: countryCode.toUpperCase() }),
			...(term && {
				OR: [{ id: term }, { phone: { contains: term } }, { email: { contains: term.toLowerCase() } }, { displayName: { contains: term } }],
			}),
		};
		return paginate(newestFirst, page, where, (args) => this.db.user.findMany({ ...args, select: publicUser }));
	}

	async detail(userId: string) {
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: { ...publicUser, emailVerifiedAt: true, updatedAt: true },
		});
		if (!user) return fail(404, "User not found.");

		const [accounts, potsCreated, predictions, totals] = await Promise.all([
			this.db.payoutAccount.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
			this.db.pot.count({ where: { potterId: userId } }),
			this.db.prediction.count({ where: { userId } }),
			this.db.ledgerEntry.groupBy({
				by: ["type", "currency"],
				where: { userId, status: "successful" },
				_sum: { amountMinorUnits: true },
			}),
		]);
		return {
			user,
			// Deleted accounts stay listed (flagged by deletedAt) since past payouts may have gone to them.
			payoutAccounts: accounts.map(toPublicAccount),
			stats: { potsCreated, predictions },
			totals: totals.map((t) => ({ type: t.type, currency: t.currency, amountMinorUnits: t._sum.amountMinorUnits ?? 0 })),
		};
	}
}
