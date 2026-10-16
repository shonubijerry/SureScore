// Staff and admin management. Roles are read from the database on every
// request (see middleware), so a change here takes effect immediately.

import { createDbClient } from "@surescore/db";
import { isRole, normalizeEmail, resolveSignupCountry, staffRoles, type Role } from "@surescore/shared";
import { recordAudit } from "./audit.js";
import { inChunks } from "../../platform/chunk.js";
import { hashPassword } from "../auth/password.js";
import { newestFirst, paginate, type PageParams } from "../../http/pagination.js";
import { AdminUserService, publicUser } from "./users.js";
import { fail } from "../pots/pot-service.js";

export class AdminStaffService {
	private readonly db;

	constructor(private readonly database: D1Database) {
		this.db = createDbClient(database);
	}

	/** Back-office accounts only; the full user directory is AdminUserService.list. */
	list({ role, ...search }: { q?: string; role?: Role } & PageParams) {
		return new AdminUserService(this.database).list({ ...search, roles: role ? [role] : [...staffRoles] });
	}

	/** Creates a back-office account, or promotes an existing user, with a mandatory reason. */
	async create(
		actorId: string,
		input: { email: string; role: Exclude<Role, "user">; password?: string; displayName?: string; reason: string },
	) {
		const email = normalizeEmail(input.email);
		const existing = await this.db.user.findUnique({ where: { email }, select: publicUser });
		let user;
		if (existing) {
			if (existing.role === input.role) fail(409, "User already has this role.");
			user = await this.db.user.update({ where: { id: existing.id }, data: { role: input.role }, select: publicUser });
		} else {
			if (!input.password) fail(422, "A password is required to create a new account.");
			if (!input.displayName) fail(422, "A full name is required to create a new account.");
			const { hash, salt } = await hashPassword(input.password);
			user = await this.db.user.create({
				data: {
					email,
					passwordHash: hash,
					passwordSalt: salt,
					countryCode: resolveSignupCountry(undefined).code,
					displayName: input.displayName,
					role: input.role,
				},
				select: publicUser,
			});
		}
		await recordAudit(this.db, actorId, "staff.create", input.reason, { subject: `${user.id}:${input.role}` });
		return user;
	}

	async changeRole(actorId: string, userId: string, role: Role, reason: string) {
		if (!isRole(role)) fail(400, "Unknown role.");
		if (userId === actorId) fail(403, "You cannot change your own role.");
		const target = await this.db.user.findUnique({ where: { id: userId }, select: publicUser });
		if (!target) fail(404, "User not found.");
		if (target.role === role) fail(409, "User already has this role.");
		if (target.role === "admin" && (await this.db.user.count({ where: { role: "admin" } })) <= 1) {
			fail(409, "Cannot demote the last admin.");
		}
		const user = await this.db.user.update({ where: { id: userId }, data: { role }, select: publicUser });
		await recordAudit(this.db, actorId, "staff.role_change", reason, { subject: `${userId}:${target.role}->${role}` });
		return user;
	}

	/** Audit trail, newest first, with the actor's email (or phone) attached. */
	async audit({ action, actorId, potId, ...params }: { action?: string; actorId?: string; potId?: string } & PageParams) {
		const where = { ...(action && { action }), ...(actorId && { actorId }), ...(potId && { potId }) };
		const page = await paginate(newestFirst, params, where, (args) => this.db.adminAuditLog.findMany(args));
		const actors = await inChunks([...new Set(page.items.map((r) => r.actorId))], (ids) =>
			this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, phone: true } }),
		);
		const email = new Map(actors.map((a) => [a.id, a.email ?? a.phone]));
		return { ...page, items: page.items.map((r) => ({ ...r, actorEmail: email.get(r.actorId) ?? null })) };
	}
}
