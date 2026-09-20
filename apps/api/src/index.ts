import { d1BindingName, databaseProvider } from "@surescore/db";
import { appName, type HealthResponse } from "@surescore/shared";

type WorkerEnv = {
	DB?: D1Database;
};

function json(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...init?.headers,
		},
	});
}

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname === "/" || pathname === "/api/health") {
			const body: HealthResponse & { binding: string } = {
				app: appName,
				service: "api",
				status: "ok",
				database: env.DB
					? databaseProvider
					: `Bind ${d1BindingName} to Cloudflare D1`,
				timestamp: new Date().toISOString(),
				binding: d1BindingName,
			};

			return json(body);
		}

		return json(
			{
				app: appName,
				status: "not_found",
			},
			{ status: 404 },
		);
	},
} satisfies ExportedHandler<WorkerEnv>;
