import { Hono } from "hono";
import { optionalAuth } from "../../http/middleware.js";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { GetPublicPotEndpoint, ListPublicPotsEndpoint } from "./pots.js";
import { ListPopularMatchesEndpoint } from "./popular.js";

// Public (unauthenticated) discovery of matches and pots.
const hono = new Hono<AppEnv>();
// Signed-in potters/players keep access to their private pots without the link.
hono.use("/pots/:id", optionalAuth);

export const discoverRoutes = fromHono(hono);

discoverRoutes.get("/matches/popular", ListPopularMatchesEndpoint);
discoverRoutes.get("/pots", ListPublicPotsEndpoint);
discoverRoutes.get("/pots/:id", GetPublicPotEndpoint);
