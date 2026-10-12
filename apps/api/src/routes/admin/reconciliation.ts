import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { AdminPotService } from "../../lib/admin-pots.js";
import { ReconciliationService } from "../../lib/reconciliation-service.js";
import { trackJob } from "../../lib/job-runs.js";
import type { AppContext } from "../../types.js";
import { okResponse, pageQuery, reasonSchema } from "./schema.js";

const service = (c: AppContext) => new ReconciliationService(c.env.DB, new AdminPotService(c.env));

export class ReconciliationStatusEndpoint extends OpenAPIRoute {
	schema = { tags: ["Admin"], summary: "Latest reconciliation run and open finding counts", responses: okResponse("Status") };

	async handle(c: AppContext) {
		return c.json(await service(c).latest());
	}
}

export class ReconciliationFindingsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Reconciliation findings",
		request: { query: z.object({ status: z.enum(["open", "resolved"]).default("open"), ...pageQuery }) },
		responses: okResponse("Findings"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).findings(query));
	}
}

export class RunReconciliationEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Run reconciliation now",
		request: { body: contentJson(z.object({ days: z.number().int().min(1).max(365).optional() })) },
		responses: okResponse("Run result"),
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		let result: Awaited<ReturnType<ReconciliationService["run"]>> | undefined;
		await trackJob(c.env.DB, "reconciliation", "finance", async () => {
			result = await service(c).run(body);
		});
		return c.json(result ?? { error: "Reconciliation failed; see job failures." }, result ? 200 : 500);
	}
}

export class ResolveFindingEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Mark a finding as reviewed",
		request: { params: z.object({ id: z.string() }), body: contentJson(z.object({ note: reasonSchema })) },
		responses: okResponse("Finding resolved"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		await service(c).resolve(c.get("userId"), params.id, body.note);
		return c.json({ ok: true });
	}
}
