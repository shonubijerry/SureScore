import { OpenAPIRoute } from "chanfana";
import { PotService } from "../../lib/pot-service.js";
import type { AppContext } from "../../types.js";
import { potIdParams, potResponse } from "./schema.js";

export class VerifyPotFundingEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Verify funding with the payment provider; opens the pot and issues the share link on success",
		request: { params: potIdParams },
		responses: potResponse("Pot after verification"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json({ pot: await new PotService(c.env).verifyFunding(c.get("userId"), params.id) });
	}
}
