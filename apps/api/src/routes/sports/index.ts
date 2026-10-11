import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { ListUpcomingMatchesEndpoint } from "./upcoming.js";
import { ListLiveMatchesEndpoint } from "./live.js";
import { GetMatchDetailEndpoint } from "./detail.js";

export const sportsRoutes = fromHono(new Hono<AppEnv>());

sportsRoutes.get("/matches/upcoming", ListUpcomingMatchesEndpoint);
sportsRoutes.get("/matches/live", ListLiveMatchesEndpoint);
sportsRoutes.get("/matches/:id", GetMatchDetailEndpoint);
