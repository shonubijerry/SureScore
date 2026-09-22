import { Hono } from "hono";
import { fromHono } from "chanfana";
import { requireAuth } from "../../lib/middleware.js";
import type { AppEnv } from "../../types.js";
import { ListPayoutAccountsEndpoint } from "./list.js";
import { CreatePayoutAccountEndpoint } from "./create.js";
import { UpdatePayoutAccountEndpoint } from "./update.js";
import { DeletePayoutAccountEndpoint } from "./delete.js";

const hono = new Hono<AppEnv>();
hono.use("*", requireAuth);

export const payoutAccountRoutes = fromHono(hono);

payoutAccountRoutes.get("/", ListPayoutAccountsEndpoint);
payoutAccountRoutes.post("/", CreatePayoutAccountEndpoint);
payoutAccountRoutes.patch("/:id", UpdatePayoutAccountEndpoint);
payoutAccountRoutes.delete("/:id", DeletePayoutAccountEndpoint);
