import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { potStatuses, MAX_PREDICTED_GOALS, MAX_FIRST_GOAL_MINUTE } from "@surescore/shared";
import { AdminPotService } from "../../lib/admin-pots.js";
import type { AppContext } from "../../types.js";
import { okResponse, pageQuery, potIdParams, reasonSchema } from "./schema.js";

const reasonBody = contentJson(z.object({ reason: reasonSchema }));

export class PotStateSummaryEndpoint extends OpenAPIRoute {
	schema = { tags: ["Admin"], summary: "Pot counts and prize totals by state", responses: okResponse("Summary") };

	async handle(c: AppContext) {
		return c.json({ states: await new AdminPotService(c.env).summary() });
	}
}

export class AdminListPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Pots, optionally filtered by state",
		request: { query: z.object({ status: z.enum(potStatuses).optional(), ...pageQuery }) },
		responses: okResponse("Pots"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new AdminPotService(c.env).list(query));
	}
}

export class AdminPotDetailEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Pot with transitions, ledger, audit notes and any settlement override",
		request: { params: potIdParams },
		responses: okResponse("Pot detail"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new AdminPotService(c.env).detail(params.id));
	}
}

export class AddPotNoteEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Add an audit note to a pot",
		request: { params: potIdParams, body: contentJson(z.object({ note: reasonSchema })) },
		responses: okResponse("Note recorded"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		await new AdminPotService(c.env).addNote(c.get("userId"), params.id, body.note);
		return c.json({ ok: true });
	}
}

export class OpenDisputeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Freeze a settling or paid pot as Disputed",
		request: { params: potIdParams, body: reasonBody },
		responses: okResponse("Dispute opened"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		await new AdminPotService(c.env).openDispute(c.get("userId"), params.id, body.reason);
		return c.json({ ok: true });
	}
}

export class ResolveDisputeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Resolve a dispute, returning the pot to the state it was frozen from",
		request: { params: potIdParams, body: reasonBody },
		responses: okResponse("Dispute resolved"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		await new AdminPotService(c.env).resolveDispute(c.get("userId"), params.id, body.reason);
		return c.json({ ok: true });
	}
}

export class SettlementOverrideEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Settle a pot on a manually entered regulation-time score (reason required)",
		request: {
			params: potIdParams,
			body: contentJson(
				z.object({
					homeGoals: z.number().int().min(0).max(MAX_PREDICTED_GOALS),
					awayGoals: z.number().int().min(0).max(MAX_PREDICTED_GOALS),
					firstGoalMinute: z.number().int().min(1).max(MAX_FIRST_GOAL_MINUTE).optional(),
					reason: reasonSchema,
				}),
			),
		},
		responses: okResponse("Override applied"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new AdminPotService(c.env).overrideSettlement(c.get("userId"), params.id, body));
	}
}
