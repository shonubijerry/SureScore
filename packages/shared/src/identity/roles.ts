// Role-based access for the back office. Roles map to permissions in one
// place so the API (enforcement) and UI (navigation) can never disagree.

export const roles = ["user", "staff", "admin"] as const;
export type Role = (typeof roles)[number];

export const staffRoles = ["staff", "admin"] as const satisfies readonly Role[];

export const permissions = [
  "dashboard.view",
  "alerts.view",
  "pots.view",
  "pots.annotate",
  "pots.dispute",
  "pots.override",
  "transfers.view",
  "transfers.retry",
  "ledger.view",
  "users.view",
  "reconciliation.view",
  "reconciliation.manage",
  "staff.view",
  "staff.manage",
  "audit.view",
  "sports.sync",
] as const;
export type Permission = (typeof permissions)[number];

/** Staff can look at everything operational and annotate pots; money and role changes are admin-only. */
const STAFF_PERMISSIONS: readonly Permission[] = [
  "dashboard.view",
  "alerts.view",
  "pots.view",
  "pots.annotate",
  "transfers.view",
  "ledger.view",
  "users.view",
  "reconciliation.view",
];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: [],
  staff: STAFF_PERMISSIONS,
  admin: permissions,
};

export const isRole = (value: string): value is Role => (roles as readonly string[]).includes(value);

export const isStaffRole = (role: string | null | undefined): boolean =>
  (staffRoles as readonly string[]).includes(role ?? "");

export const permissionsFor = (role: string | null | undefined): readonly Permission[] =>
  ROLE_PERMISSIONS[role as Role] ?? [];

export const hasPermission = (role: string | null | undefined, permission: Permission): boolean =>
  permissionsFor(role).includes(permission);
