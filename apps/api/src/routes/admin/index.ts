import { Hono } from "hono";
import type { Permission } from "@surescore/shared";
import { fromHono, type OpenAPIRoute } from "chanfana";
import { requirePermission, requireAuth, requireStaff } from "../../http/middleware.js";
import { AlertsEndpoint, AuditLogEndpoint, ChangeRoleEndpoint, CreateStaffEndpoint, ListStaffEndpoint } from "./staff.js";
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
import { ProviderHealthEndpoint, SearchLedgerEndpoint, SyncScoreboardEndpoint } from "./operations.js";
import {
	ReconciliationFindingsEndpoint,
	ReconciliationStatusEndpoint,
	ResolveFindingEndpoint,
	RunReconciliationEndpoint,
} from "./reconciliation.js";

const hono = new Hono<AppEnv>();
hono.use("*", requireAuth, requireStaff);

export const adminRoutes = fromHono(hono);

type Method = "get" | "post" | "patch";
// chanfana endpoints take no inline middleware, so each route's permission guard is registered on the Hono app first.
const route = (method: Method, path: string, permission: Permission, endpoint: new (options: never) => OpenAPIRoute) => {
	hono.on(method.toUpperCase(), path, requirePermission(permission));
	adminRoutes[method](path, endpoint as never);
};

// Permissions come from @surescore/shared roles: staff are read-only (plus notes), admins can act.
route("get", "/alerts", "alerts.view", AlertsEndpoint);
route("get", "/pots/summary", "dashboard.view", PotStateSummaryEndpoint);
route("get", "/pots", "pots.view", AdminListPotsEndpoint);
route("get", "/pots/:id", "pots.view", AdminPotDetailEndpoint);
route("post", "/pots/:id/notes", "pots.annotate", AddPotNoteEndpoint);
route("post", "/pots/:id/dispute", "pots.dispute", OpenDisputeEndpoint);
route("post", "/pots/:id/dispute/resolve", "pots.dispute", ResolveDisputeEndpoint);
route("post", "/pots/:id/settlement-override", "pots.override", SettlementOverrideEndpoint);
route("get", "/payouts", "transfers.view", PayoutQueueEndpoint);
route("get", "/refunds", "transfers.view", RefundQueueEndpoint);
route("post", "/transfers/retry", "transfers.retry", RetryTransferEndpoint);
route("get", "/health", "dashboard.view", ProviderHealthEndpoint);
route("get", "/ledger", "ledger.view", SearchLedgerEndpoint);
route("get", "/reconciliation", "reconciliation.view", ReconciliationStatusEndpoint);
route("get", "/reconciliation/findings", "reconciliation.view", ReconciliationFindingsEndpoint);
route("post", "/reconciliation/run", "reconciliation.manage", RunReconciliationEndpoint);
route("post", "/reconciliation/findings/:id/resolve", "reconciliation.manage", ResolveFindingEndpoint);
route("get", "/staff", "staff.view", ListStaffEndpoint);
route("post", "/staff", "staff.manage", CreateStaffEndpoint);
route("patch", "/staff/:id", "staff.manage", ChangeRoleEndpoint);
route("post", "/sports/sync", "sports.sync", SyncScoreboardEndpoint);
route("get", "/audit", "audit.view", AuditLogEndpoint);
