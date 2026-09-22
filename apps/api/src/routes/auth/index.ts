import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { SignupEndpoint } from "./signup.js";
import { LoginEndpoint } from "./login.js";
import { LogoutEndpoint } from "./logout.js";
import { MeEndpoint } from "./me.js";

export const authRoutes = fromHono(new Hono<AppEnv>());

authRoutes.post("/signup", SignupEndpoint);
authRoutes.post("/login", LoginEndpoint);
authRoutes.post("/logout", LogoutEndpoint);
authRoutes.get("/me", MeEndpoint);
