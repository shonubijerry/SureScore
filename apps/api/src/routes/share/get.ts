import { OpenAPIRoute, NotFoundException } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { predictionLockTime } from "@surescore/shared";
import type { AppContext } from "../../types.js";

export class GetSharedPotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Public pot view for a share link (only exists once funding succeeded)",
		request: { params: z.object({ code: z.string() }) },
		responses: { "200": { description: "Public pot" }, ...NotFoundException.schema() },
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const pot = await createDbClient(c.env.DB).pot.findUnique({
			where: { shareCode: params.code },
			include: { event: true },
		});
		if (!pot) throw new NotFoundException("Pot not found.");

		return c.json({
			pot: {
				id: pot.id,
				status: pot.status,
				currency: pot.currency,
				countryCode: pot.countryCode,
				prizeAmountMinorUnits: pot.prizeAmountMinorUnits,
				winnerCount: pot.winnerCount,
				predictionLocksAt: predictionLockTime(pot.event.kickoffTimeUtc).toISOString(),
				match: {
					id: pot.event.id,
					league: pot.event.league,
					homeTeam: pot.event.homeTeam,
					awayTeam: pot.event.awayTeam,
					kickoffTimeUtc: pot.event.kickoffTimeUtc,
					status: pot.event.status,
				},
			},
		});
	}
}
