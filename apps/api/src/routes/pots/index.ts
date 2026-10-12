import { Hono } from "hono";
import { fromHono } from "chanfana";
import { requireAuth } from "../../lib/middleware.js";
import { rateLimit, rateLimits } from "../../lib/rate-limit.js";
import type { AppEnv } from "../../types.js";
import { CreatePotEndpoint } from "./create.js";
import { ListPotsEndpoint } from "./list.js";
import { ListPredictedPotsEndpoint } from "./predicted.js";
import { GetPotEndpoint } from "./get.js";
import { VerifyPotFundingEndpoint } from "./verify-funding.js";
import { CancelPotEndpoint } from "./cancel.js";
import { GetPotSettlementEndpoint } from "./settlement.js";
import {
	EditPredictionEndpoint,
	GetLeaderboardEndpoint,
	GetMyPredictionEndpoint,
	SubmitPredictionEndpoint,
} from "./predictions.js";

const hono = new Hono<AppEnv>();
hono.use("*", requireAuth);
hono.post("/", rateLimit(rateLimits.createPot));
hono.on(["POST", "PUT"], "/:id/predictions", rateLimit(rateLimits.prediction));

export const potRoutes = fromHono(hono);

potRoutes.post("/", CreatePotEndpoint);
potRoutes.get("/", ListPotsEndpoint);
potRoutes.get("/predicted", ListPredictedPotsEndpoint);
potRoutes.get("/:id", GetPotEndpoint);
potRoutes.post("/:id/verify-funding", VerifyPotFundingEndpoint);
potRoutes.post("/:id/cancel", CancelPotEndpoint);
potRoutes.get("/:id/settlement", GetPotSettlementEndpoint);
potRoutes.post("/:id/predictions", SubmitPredictionEndpoint);
potRoutes.put("/:id/predictions", EditPredictionEndpoint);
potRoutes.get("/:id/predictions/me", GetMyPredictionEndpoint);
potRoutes.get("/:id/leaderboard", GetLeaderboardEndpoint);
