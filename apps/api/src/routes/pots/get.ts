import { OpenAPIRoute } from "chanfana";
import { PotService } from "../../lib/pot-service.js";
import type { AppContext } from "../../types.js";
import { potIdParams, potResponse } from "./schema.js";

export class GetPotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Get one of the current user's pots",
		request: { params: potIdParams },
		responses: potResponse("Pot"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json({ pot: await new PotService(c.env).getOwned(c.get("userId"), params.id) });
	}
}
