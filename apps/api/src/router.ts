import { fromHono } from 'chanfana';
import { Hono, type Context } from 'hono';
import { d1BindingName, databaseProvider } from '@surescore/db';
import { appName, type HealthResponse } from '@surescore/shared';

export type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();
const openapi = fromHono(app, {
	docs_url: '/api/docs',
	openapi_url: '/api/openapi.json',
	schema: {
		info: {
			title: 'SureScore API',
			version: '0.1.0',
			description: 'API for SureScore football prediction pots.',
		},
	},
});

function healthResponse(database: D1Database | undefined) {
	const body: HealthResponse & { binding: string } = {
		app: appName,
		service: 'api',
		status: 'ok',
		database: database ? databaseProvider : `Bind ${d1BindingName} to Cloudflare D1`,
		timestamp: new Date().toISOString(),
		binding: d1BindingName,
	};

	return body;
}

openapi.get('/', (context) => context.json(healthResponse(context.env.DB)));
openapi.get('/api/health', (context) => context.json(healthResponse(context.env.DB)));

app.notFound((context) =>
	context.json(
		{
			app: appName,
			status: 'not_found',
		},
		404,
	),
);

export default app;
