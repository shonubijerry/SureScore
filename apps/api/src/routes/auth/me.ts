import { OpenAPIRoute, contentJson } from "chanfana";
import { countryOfPhone } from "@surescore/shared";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { errorResponse } from "../../http/openapi.js";
import type { AppContext } from "../../types.js";
import { fullNameSchema, phoneSchema, userResponseSchema, userView } from "./schema.js";

export class MeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Get the current authenticated user",
		responses: {
			"200": { description: "Current user", ...contentJson(userResponseSchema) },
			"401": errorResponse("Not signed in"),
		},
	};

	async handle(c: AppContext) {
		const user = await createDbClient(c.env.DB).user.findUnique({ where: { id: c.get("userId") } });
		if (!user) return c.json({ error: "User no longer exists." }, 401);
		return c.json(userView(user));
	}
}

export class UpdateMeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Update profile details: full name and/or phone. Omitted fields are unchanged. (Email is the verified sign-in id and can't be changed here.)",
		request: {
			body: contentJson(
				z
					.object({ fullName: fullNameSchema.optional(), phone: phoneSchema.optional() })
					.refine((b) => b.fullName !== undefined || b.phone !== undefined, "Nothing to update."),
			),
		},
		responses: {
			"200": { description: "Updated user", ...contentJson(userResponseSchema) },
			"422": errorResponse("Phone number not valid for a supported country"),
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		if (body.phone !== undefined && !countryOfPhone(body.phone)?.isLaunched) {
			return c.json({ error: "Enter a valid mobile number for a supported country." }, 422);
		}
		const user = await createDbClient(c.env.DB).user.update({
			where: { id: c.get("userId") },
			data: {
				...(body.fullName !== undefined && { displayName: body.fullName }),
				// Not verified; changing it clears any old SMS verification.
				...(body.phone !== undefined && { phone: body.phone, phoneVerifiedAt: null }),
			},
		});
		return c.json(userView(user));
	}
}
