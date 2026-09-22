import { Hono } from "hono";
import { fromHono } from "chanfana";
import type { AppEnv } from "../../types.js";
import { ListCountriesEndpoint } from "./countries.js";
import { ListPaymentProvidersEndpoint } from "./payment-providers.js";
import { ListSportsProvidersEndpoint } from "./sports-providers.js";

export const configRoutes = fromHono(new Hono<AppEnv>());

configRoutes.get("/countries", ListCountriesEndpoint);
configRoutes.get("/payment-providers", ListPaymentProvidersEndpoint);
configRoutes.get("/sports-providers", ListSportsProvidersEndpoint);
