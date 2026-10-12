import { Hono } from "hono";
import { fromHono } from "chanfana";
import { rateLimit, rateLimits } from "../../lib/rate-limit.js";
import type { AppEnv } from "../../types.js";
import { SignupEndpoint } from "./signup.js";
import { LoginEndpoint } from "./login.js";
import { LogoutEndpoint } from "./logout.js";
import { MeEndpoint } from "./me.js";

const hono = new Hono<AppEnv>();
hono.post("/signup", rateLimit(rateLimits.signup));
hono.post("/login", rateLimit(rateLimits.login));

export const authRoutes = fromHono(hono);

authRoutes.post("/signup", SignupEndpoint);
authRoutes.post("/login", LoginEndpoint);
authRoutes.post("/logout", LogoutEndpoint);
authRoutes.get("/me", MeEndpoint);
