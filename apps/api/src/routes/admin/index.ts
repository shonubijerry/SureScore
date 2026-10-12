import { Hono } from "hono";
import { fromHono } from "chanfana";
import { requireAdmin, requireAuth } from "../../lib/middleware.js";
import type { AppEnv } from "../../types.js";
import {
	AddPotNoteEndpoint,
	AdminListPotsEndpoint,
	AdminPotDetailEndpoint,
	OpenDisputeEndpoint,
	PotStateSummaryEndpoint,
	ResolveDisputeEndpoint,
	SettlementOverrideEndpoint,
} from "./pots.js";
import { PayoutQueueEndpoint, RefundQueueEndpoint, RetryTransferEndpoint } from "./transfers.js";
import { ProviderHealthEndpoint, SearchLedgerEndpoint } from "./operations.js";
import {
	ReconciliationFindingsEndpoint,
	ReconciliationStatusEndpoint,
	ResolveFindingEndpoint,
	RunReconciliationEndpoint,
} from "./reconciliation.js";

const hono = new Hono<AppEnv>();
hono.use("*", requireAuth, requireAdmin);

export const adminRoutes = fromHono(hono);

adminRoutes.get("/pots/summary", PotStateSummaryEndpoint);
adminRoutes.get("/pots", AdminListPotsEndpoint);
adminRoutes.get("/pots/:id", AdminPotDetailEndpoint);
adminRoutes.post("/pots/:id/notes", AddPotNoteEndpoint);
adminRoutes.post("/pots/:id/dispute", OpenDisputeEndpoint);
adminRoutes.post("/pots/:id/dispute/resolve", ResolveDisputeEndpoint);
adminRoutes.post("/pots/:id/settlement-override", SettlementOverrideEndpoint);
adminRoutes.get("/payouts", PayoutQueueEndpoint);
adminRoutes.get("/refunds", RefundQueueEndpoint);
adminRoutes.post("/transfers/retry", RetryTransferEndpoint);
adminRoutes.get("/health", ProviderHealthEndpoint);
adminRoutes.get("/ledger", SearchLedgerEndpoint);
adminRoutes.get("/reconciliation", ReconciliationStatusEndpoint);
adminRoutes.get("/reconciliation/findings", ReconciliationFindingsEndpoint);
adminRoutes.post("/reconciliation/run", RunReconciliationEndpoint);
adminRoutes.post("/reconciliation/findings/:id/resolve", ResolveFindingEndpoint);
