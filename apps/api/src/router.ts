import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { d1BindingName, databaseProvider } from '@surescore/db'
import { appName, type HealthResponse } from '@surescore/shared'
import { authRoutes } from './routes/auth/index.js'
import { configRoutes } from './routes/config/index.js'
import { payoutAccountRoutes } from './routes/payout-accounts/index.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>()
const openapi = fromHono(app, {
	docs_url: '/api/v1/docs',
	openapi_url: '/api/v1/openapi.json',
	schema: {
		info: {
			title: 'SureScore API',
			version: '0.1.0',
			description: 'API for SureScore football prediction pots.',
		},
	},
})

function healthResponse(database: D1Database | undefined) {
	const body: HealthResponse & { binding: string } = {
		app: appName,
		service: 'api',
		status: 'ok',
		database: database ? databaseProvider : `Bind ${d1BindingName} to Cloudflare D1`,
		timestamp: new Date().toISOString(),
		binding: d1BindingName,
	}

	return body
}

app.onError((err, c) => {
	console.error('Global error handler caught:', err)

	if (err instanceof HTTPException) {
		return err.getResponse()
	}

	return c.json(
		{
			success: false,
			errors: [
				{
					app: appName,
					message: 'Internal Server Error',
				},
			],
		},
		500,
	)
})

openapi.get('/api/health', (context) => context.json(healthResponse(context.env.DB)))

openapi.route('/api/auth', authRoutes)
openapi.route('/api/config', configRoutes)
openapi.route('/api/payout-accounts', payoutAccountRoutes)

app.notFound((context) =>
	context.json(
		{
			app: appName,
			status: 'not_found',
		},
		404,
	),
)

export default app
