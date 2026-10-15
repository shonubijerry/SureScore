// Who may see a pot. Public pots are open to everyone. A private pot is
// reachable only by its potter, by anyone who has predicted on it, or by
// someone holding its share link; to everyone else it does not exist (404),
// so private pots are never revealed.

import { HTTPException } from "hono/http-exception";
import type { createDbClient, Pot } from "@surescore/db";

type Db = ReturnType<typeof createDbClient>;

export interface PotViewer {
	userId?: string;
	/** Share code from the pot's link. */
	shareCode?: string;
}

export async function canAccessPot(db: Db, pot: Pick<Pot, "id" | "isPrivate" | "potterId" | "shareCode">, viewer: PotViewer) {
	if (!pot.isPrivate) return true;
	if (viewer.shareCode && pot.shareCode && viewer.shareCode === pot.shareCode) return true;
	if (!viewer.userId) return false;
	if (viewer.userId === pot.potterId) return true;
	// Once someone has predicted, they keep access without the link.
	const prediction = await db.prediction.findUnique({
		where: { potId_userId: { potId: pot.id, userId: viewer.userId } },
		select: { id: true },
	});
	return prediction !== null;
}

export async function assertPotAccess(db: Db, pot: Pick<Pot, "id" | "isPrivate" | "potterId" | "shareCode">, viewer: PotViewer) {
	if (!(await canAccessPot(db, pot, viewer))) throw new HTTPException(404, { message: "Pot not found." });
}
