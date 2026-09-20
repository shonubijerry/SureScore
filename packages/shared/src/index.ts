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
    runtime: "Prisma ORM (no engine)",
    deployment: "Cloudflare D1",
  },
] as const;

export interface HealthResponse {
  app: string;
  service: "api";
  status: "ok";
  database: string;
  timestamp: string;
}
