// The single writer of AdminAuditLog. Every admin action and every change to
// payout details goes through `recordAudit`, so completeness (T11.8) is
// checked against one list of actions and one code path.

import type { PrismaClient } from "@surescore/db";
import { log } from "../../platform/logger.js";

export const AUDIT_ACTIONS = [
	"note",
	"dispute.open",
	"dispute.resolve",
	"settlement.override",
	"transfer.retry",
	"reconciliation.run",
	"reconciliation.resolve",
	"sports.sync",
	"staff.create",
	"staff.role_change",
	"payout_account.create",
	"payout_account.update",
	"payout_account.delete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export async function recordAudit(
	db: Pick<PrismaClient, "adminAuditLog">,
	actorId: string,
	action: AuditAction,
	reason: string,
	target: { potId?: string; subject?: string } = {},
) {
	const row = await db.adminAuditLog.create({ data: { actorId, action, reason, ...target } });
	log.info("audit", action, { actorId, ...target });
	return row;
}
