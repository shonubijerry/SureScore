// Staff and admin management. Roles are read from the database on every
// request (see middleware), so a change here takes effect immediately.

import { createDbClient } from "@surescore/db";
import { isRole, normalizeEmail, resolveSignupCountry, type Role } from "@surescore/shared";
import { recordAudit } from "./audit.js";
import { inChunks } from "../../platform/chunk.js";
import { hashPassword } from "../auth/password.js";
import { pageArgs, toPage } from "../../http/pagination.js";
import { fail } from "../pots/pot-service.js";

const publicUser = { id: true, phone: true, email: true, displayName: true, role: true, countryCode: true, createdAt: true } as const;

export class AdminStaffService {
	private readonly db;

	constructor(database: D1Database) {
		this.db = createDbClient(database);
	}

	async list({ q, role, limit, cursor }: { q?: string; role?: Role; limit?: number; cursor?: string }) {
		const term = q?.trim();
		const rows = await this.db.user.findMany({
			where: {
				role: role ?? { in: ["staff", "admin"] },
				...(term
					? { OR: [{ phone: { contains: term } }, { email: { contains: term.toLowerCase() } }, { displayName: { contains: term } }] }
					: {}),
			},
			select: publicUser,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs({ limit, cursor }),
		});
		return toPage(rows, limit);
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
	async audit({ action, actorId, potId, limit, cursor }: { action?: string; actorId?: string; potId?: string; limit?: number; cursor?: string }) {
		const rows = await this.db.adminAuditLog.findMany({
			where: { ...(action && { action }), ...(actorId && { actorId }), ...(potId && { potId }) },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs({ limit, cursor }),
		});
		const page = toPage(rows, limit);
		const actors = await inChunks([...new Set(page.items.map((r) => r.actorId))], (ids) =>
			this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, phone: true } }),
		);
		const email = new Map(actors.map((a) => [a.id, a.email ?? a.phone]));
		return { ...page, items: page.items.map((r) => ({ ...r, actorEmail: email.get(r.actorId) ?? null })) };
	}
}
