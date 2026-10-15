import { Hono } from "hono";
import { fromHono } from "chanfana";
import { requireAuth } from "../../http/middleware.js";
import type { AppEnv } from "../../types.js";
import { GetWalletEndpoint } from "./get.js";

const hono = new Hono<AppEnv>();
hono.use("*", requireAuth);

export const walletRoutes = fromHono(hono);

walletRoutes.get("/", GetWalletEndpoint);
