import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { roles, staffRoles } from "@surescore/shared";
import { emailSchema } from "../auth/schema.js";
import { AdminStaffService } from "../../modules/admin/staff.js";
import { currentAlerts } from "../../modules/admin/alerts.js";
import { pageQuery } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { okResponse, reasonSchema } from "./schema.js";

const service = (c: AppContext) => new AdminStaffService(c.env.DB);

export class ListStaffEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Staff and admin accounts",
		request: { query: z.object({ q: z.string().optional(), role: z.enum(roles).optional(), ...pageQuery }) },
		responses: okResponse("Staff"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).list(query));
	}
}

export class CreateStaffEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Create a staff/admin account, or promote an existing user",
		request: {
			body: contentJson(
				z.object({
					email: emailSchema.describe("Existing user to promote, or the new account's sign-in email"),
					role: z.enum(staffRoles),
					password: z.string().min(8).optional(),
					displayName: z.string().trim().min(1).optional().describe("Full name (required for new accounts)"),
					reason: reasonSchema,
				}),
			),
		},
		responses: okResponse("Account"),
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json({ user: await service(c).create(c.get("userId"), body) }, 201);
	}
}

export class ChangeRoleEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Change a user's role",
		request: {
			params: z.object({ id: z.string() }),
			body: contentJson(z.object({ role: z.enum(roles), reason: reasonSchema })),
		},
		responses: okResponse("Account"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		return c.json({ user: await service(c).changeRole(c.get("userId"), params.id, body.role, body.reason) });
	}
}

export class AuditLogEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Admin audit trail",
		request: {
			query: z.object({ action: z.string().optional(), actorId: z.string().optional(), potId: z.string().optional(), ...pageQuery }),
		},
		responses: okResponse("Audit entries"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).audit(query));
	}
}

export class AlertsEndpoint extends OpenAPIRoute {
	schema = { tags: ["Admin"], summary: "Active operational alerts", responses: okResponse("Alerts") };

	async handle(c: AppContext) {
		return c.json({ alerts: await currentAlerts(c.env.DB) });
	}
}
