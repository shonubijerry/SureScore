import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { roles } from "@surescore/shared";
import { AdminUserService } from "../../modules/admin/users.js";
import { pageQuery } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { okResponse } from "./schema.js";

const service = (c: AppContext) => new AdminUserService(c.env.DB);

export class ListUsersEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "All user accounts, newest first",
		request: {
			query: z.object({
				q: z.string().optional().describe("Phone, email, name or exact user id"),
				role: z.enum(roles).optional(),
				countryCode: z.string().length(2).optional(),
				...pageQuery,
			}),
		},
		responses: okResponse("Users"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const { role, ...search } = query;
		return c.json(await service(c).list({ ...search, ...(role && { roles: [role] }) }));
	}
}

export class UserDetailEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "A user with masked payout accounts, activity counts and settled totals",
		request: { params: z.object({ id: z.string() }) },
		responses: okResponse("User"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).detail(params.id));
	}
}
