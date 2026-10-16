import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { AdminPotService } from "../../modules/admin/pots.js";
import { AdminTransferService } from "../../modules/admin/transfers.js";
import { pageQuery } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { okResponse, reasonSchema } from "./schema.js";

const service = (c: AppContext) => new AdminTransferService(c.env, new AdminPotService(c.env));

const queueQuery = z.object({
	status: z.enum(["failed", "pending", "successful"]).optional().describe("Current state to filter by; omit for every payout/refund"),
	...pageQuery,
});

export class PayoutQueueEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Payouts, newest first (default: all statuses)",
		request: { query: queueQuery },
		responses: okResponse("Payouts"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).queue({ type: "payout", ...query }));
	}
}

export class RefundQueueEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Refunds with processing status, newest first (default: all statuses)",
		request: { query: queueQuery },
		responses: okResponse("Refunds"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).queue({ type: "refund", ...query }));
	}
}

export class RetryTransferEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Retry a failed payout (to the user's current account) or refund",
		request: { body: contentJson(z.object({ idempotencyKey: z.string().min(1), reason: reasonSchema })) },
		responses: okResponse("Retry queued"),
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).retry(c.get("userId"), body.idempotencyKey, body.reason));
	}
}
