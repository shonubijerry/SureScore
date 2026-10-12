import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { AdminPotService } from "../../lib/admin-pots.js";
import { AdminTransferService } from "../../lib/admin-transfers.js";
import { pageQuery } from "../../lib/pagination.js";
import type { AppContext } from "../../types.js";
import { okResponse, reasonSchema } from "./schema.js";

const service = (c: AppContext) => new AdminTransferService(c.env, new AdminPotService(c.env));

const queueQuery = (defaultStatus: "failed" | "pending" | "successful") =>
	z.object({ status: z.enum(["failed", "pending", "successful"]).default(defaultStatus), ...pageQuery });

export class PayoutQueueEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Payout queue (default: failed payouts awaiting retry)",
		request: { query: queueQuery("failed") },
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
		summary: "Refund queue with processing status (default: pending)",
		request: { query: queueQuery("pending") },
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
