import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { GetPublicPotEndpoint, ListPublicPotsEndpoint } from "./pots.js";
import { ListPopularMatchesEndpoint } from "./popular.js";

// Public (unauthenticated) discovery of matches and pots.
export const discoverRoutes = fromHono(new Hono<AppEnv>());

discoverRoutes.get("/matches/popular", ListPopularMatchesEndpoint);
discoverRoutes.get("/pots", ListPublicPotsEndpoint);
discoverRoutes.get("/pots/:id", GetPublicPotEndpoint);
