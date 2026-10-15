export const appName = "SureScore";

export const services = [
  {
    name: "UI",
    runtime: "React + Vite",
    deployment: "Cloudflare Pages",
  },
  {
    name: "API",
    runtime: "Cloudflare Worker",
    deployment: "Cloudflare Workers",
  },
  {
    name: "Database",
    runtime: "Prisma ORM (wasm engine)",
    deployment: "Cloudflare D1",
  },
] as const;

export interface HealthResponse {
  app: string;
  binding: string;
  service: "api";
  status: "ok";
  database: string;
  timestamp: string;
}

// Configuration: countries, currencies, provider and league mapping, banks.
export * from "./config/country-config.js";
export * from "./config/banks.js";

// Identity: phone/email formats, account-name matching, roles and permissions.
export * from "./identity/phone.js";
export * from "./identity/email.js";
export * from "./identity/name-match.js";
export * from "./identity/roles.js";

// Product rules (pure, no I/O): pot lifecycle, scoring, settlement,
// eligibility, reconciliation and sports-data freshness.
export * from "./rules/pot-rules.js";
export * from "./rules/scoring.js";
export * from "./rules/settlement.js";
export * from "./rules/eligibility.js";
export * from "./rules/reconciliation.js";
export * from "./rules/cache-freshness.js";

// Provider contracts and registry.
export * from "./providers/index.js";
