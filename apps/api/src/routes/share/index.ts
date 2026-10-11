import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { GetSharedPotEndpoint } from "./get.js";

export const shareRoutes = fromHono(new Hono<AppEnv>());

shareRoutes.get("/:code", GetSharedPotEndpoint);
