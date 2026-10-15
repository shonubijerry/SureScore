import { Hono } from "hono";
import { fromHono } from "chanfana";
import { requireAuth } from "../../http/middleware.js";
import { rateLimit, rateLimits } from "../../http/rate-limit.js";
import type { AppEnv } from "../../types.js";
import { ResendSignupCodeEndpoint, SignupEndpoint, VerifySignupEndpoint } from "./signup.js";
import { LoginEndpoint } from "./login.js";
import { LogoutEndpoint } from "./logout.js";
import { MeEndpoint, UpdateMeEndpoint } from "./me.js";
import { ForgotPasswordEndpoint, ResendResetCodeEndpoint, ResetPasswordEndpoint, VerifyResetCodeEndpoint } from "./password.js";

const hono = new Hono<AppEnv>();
hono.post("/signup", rateLimit(rateLimits.signup));
hono.post("/signup/resend", rateLimit(rateLimits.otpResend));
hono.post("/signup/verify", rateLimit(rateLimits.otpVerify));
hono.post("/login", rateLimit(rateLimits.login));
hono.post("/password/forgot", rateLimit(rateLimits.passwordForgot));
hono.post("/password/forgot/resend", rateLimit(rateLimits.otpResend));
hono.post("/password/verify", rateLimit(rateLimits.otpVerify));
hono.post("/password/reset", rateLimit(rateLimits.passwordReset));
hono.use("/me", requireAuth);

export const authRoutes = fromHono(hono);

authRoutes.post("/signup", SignupEndpoint);
authRoutes.post("/signup/resend", ResendSignupCodeEndpoint);
authRoutes.post("/signup/verify", VerifySignupEndpoint);
authRoutes.post("/login", LoginEndpoint);
authRoutes.post("/password/forgot", ForgotPasswordEndpoint);
authRoutes.post("/password/forgot/resend", ResendResetCodeEndpoint);
authRoutes.post("/password/verify", VerifyResetCodeEndpoint);
authRoutes.post("/password/reset", ResetPasswordEndpoint);
authRoutes.post("/logout", LogoutEndpoint);
authRoutes.get("/me", MeEndpoint);
authRoutes.patch("/me", UpdateMeEndpoint);
