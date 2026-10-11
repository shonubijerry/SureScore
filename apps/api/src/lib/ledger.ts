// Append-only ledger access. Entries are only ever inserted; every state
// change of a financial action becomes a new row (see LedgerEntry in the
// schema). Writes are idempotent through the unique `entryKey`.

import { createDbClient } from "@surescore/db";

export type LedgerType = "fund" | "refund" | "payout";
export type LedgerStatus = "pending" | "successful" | "failed";

export interface LedgerEntryInput {
	type: LedgerType;
	status: LedgerStatus;
	userId: string;
	potId: string;
	countryCode: string;
	currency: string;
	amountMinorUnits: number;
	provider: string;
	idempotencyKey: string;
	attempt: number;
	reference?: string;
	detail?: string;
}

export interface LedgerStore {
	append(entry: LedgerEntryInput): Promise<void>;
	/** True once the action has a pending or successful row (do not resend). */
	isInFlightOrDone(idempotencyKey: string): Promise<boolean>;
}

export class PrismaLedgerStore implements LedgerStore {
	private readonly db;

	constructor(database: D1Database) {
		this.db = createDbClient(database);
	}

	async append({ attempt, ...entry }: LedgerEntryInput) {
		const entryKey = `${entry.idempotencyKey}:${attempt}`;
		await this.db.ledgerEntry.upsert({
			where: { entryKey },
			update: {},
			create: { ...entry, entryKey },
		});
	}

	async isInFlightOrDone(idempotencyKey: string) {
		const count = await this.db.ledgerEntry.count({
			where: { idempotencyKey, status: { in: ["pending", "successful"] } },
		});
		return count > 0;
	}
}
