import { WorkerEntrypoint } from "cloudflare:workers";
import app from "./router";
import { Context } from "hono";

export default class extends WorkerEntrypoint {
	async fetch(request: Request) {
		return app.fetch(request, this.env, this.ctx)
	}

	add(a: number, b: number) {
		return a + b;
	}
}
