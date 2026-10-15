import { OpenAPIRoute } from "chanfana";
import { PotService } from "../../modules/pots/pot-service.js";
import type { AppContext } from "../../types.js";
import { potIdParams, potResponse } from "./schema.js";

export class CancelPotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Cancel a pot until 20 minutes before kickoff; funded pots are refunded",
		request: { params: potIdParams },
		responses: potResponse("Cancelled pot"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json({ pot: await new PotService(c.env).cancelByPotter(c.get("userId"), params.id) });
	}
}
