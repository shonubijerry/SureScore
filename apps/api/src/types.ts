import type { Context } from "hono";

export type AppEnv = {
	Bindings: Env;
	Variables: {
		userId: string;
	};
};

export type AppContext = Context<AppEnv>;
