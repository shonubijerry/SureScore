import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { MAX_FIRST_GOAL_MINUTE, MAX_PREDICTED_GOALS } from "@surescore/shared";
import { PredictionService } from "../../lib/prediction-service.js";
import type { AppContext } from "../../types.js";
import { potIdParams } from "./schema.js";

const predictionBody = z.object({
	homeGoals: z.number().int().min(0).max(MAX_PREDICTED_GOALS),
	awayGoals: z.number().int().min(0).max(MAX_PREDICTED_GOALS),
	firstGoalMinute: z.number().int().min(1).max(MAX_FIRST_GOAL_MINUTE).nullish(),
});

const breakdownSchema = z.object({
	outcome: z.number(),
	exactScoreline: z.number(),
	goalDifference: z.number(),
	homeGoals: z.number(),
	awayGoals: z.number(),
	total: z.number(),
});

const predictionView = z.object({
	prediction: z.object({ id: z.string(), potId: z.string(), userId: z.string() }).passthrough().nullable(),
	final: z.boolean(),
	breakdown: breakdownSchema.nullable(),
	edits: z.array(z.object({ homeGoals: z.number(), awayGoals: z.number() }).passthrough()),
});

const viewResponse = (description: string, status: "200" | "201" = "200") => ({
	[status]: { description, ...contentJson(predictionView) },
});

const service = (c: AppContext) => new PredictionService(c.env);

export class SubmitPredictionEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Predictions"],
		summary: "Submit your one prediction for a pot (until 15 minutes before kickoff)",
		request: { params: potIdParams, body: contentJson(predictionBody) },
		responses: viewResponse("Prediction created", "201"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).submit(c.get("userId"), params.id, body), 201);
	}
}

export class EditPredictionEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Predictions"],
		summary: "Edit your prediction before lock; previous values are kept in the edit history",
		request: { params: potIdParams, body: contentJson(predictionBody) },
		responses: viewResponse("Prediction updated"),
	};

	async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).edit(c.get("userId"), params.id, body));
	}
}

export class GetMyPredictionEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Predictions"],
		summary: "Your prediction with its score breakdown and edit history",
		request: { params: potIdParams },
		responses: viewResponse("Prediction"),
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).getMine(c.get("userId"), params.id));
	}
}

export class GetLeaderboardEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Predictions"],
		summary: "Ranked leaderboard with per-prediction score breakdown (available after lock)",
		request: { params: potIdParams },
		responses: {
			"200": {
				description: "Leaderboard; tied entries share a rank",
				...contentJson(
					z.object({
						potId: z.string(),
						final: z.boolean(),
						entries: z.array(
							z.object({
								rank: z.number().int(),
								userId: z.string(),
								displayName: z.string().nullable(),
								homeGoals: z.number(),
								awayGoals: z.number(),
								firstGoalMinute: z.number().nullable(),
								breakdown: breakdownSchema.nullable(),
							}),
						),
					}),
				),
			},
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json(await service(c).leaderboard(params.id));
	}
}
