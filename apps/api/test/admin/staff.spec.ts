import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { AdminStaffService } from "../../src/modules/admin/staff";
import { AUDIT_ACTIONS } from "../../src/modules/admin/audit";
import { applyMigrations } from "../helpers/db";

const db = createDbClient(env.DB);
beforeAll(applyMigrations);

describe("staff management and audit", () => {
	const staff = new AdminStaffService(env.DB);
	const user = (id: string, role = "user") => ({ id, email: `${id}@m.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG", role });

	it("guards roles and audits every change", async () => {
		await db.adminAuditLog.deleteMany();
		await db.user.createMany({ data: [user("adm1", "admin"), user("adm2", "admin"), user("plain")] });
		await expect(staff.changeRole("adm1", "adm1", "staff", "demote myself")).rejects.toThrow(/own role/);
		await staff.changeRole("adm1", "plain", "staff", "new support hire");
		await staff.changeRole("adm1", "adm2", "staff", "reduced scope");
		await expect(staff.changeRole("adm2", "adm1", "user", "remove last admin")).rejects.toThrow(/last admin/);
		await expect(staff.create("adm1", { email: "new@m.com", role: "staff", reason: "needs password" })).rejects.toThrow(/password/);
		const created = await staff.create("adm1", { email: "New@M.com", role: "staff", password: "password123", displayName: "New Hire", reason: "onboarding" });
		expect(created).toMatchObject({ email: "new@m.com", countryCode: "NG" });
		expect(created.role).toBe("staff");
		expect(created).not.toHaveProperty("passwordHash");

		const audit = await staff.audit({});
		expect(audit.items.map((a) => a.action).sort()).toEqual(["staff.create", "staff.role_change", "staff.role_change"]);
		expect(audit.items.every((a) => a.reason.length >= 5 && a.actorEmail)).toBe(true);
		expect(AUDIT_ACTIONS).toContain("staff.role_change");
		expect((await staff.list({ role: "staff" })).items.map((u) => u.id)).toContain("plain");
	});
});
