import type { Context } from "hono";

export type AppEnv = {
	Bindings: Env;
	Variables: {
		userId: string;
		role?: string;
	};
};

export type AppContext = Context<AppEnv>;
