import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { d1BindingName, databaseProvider } from '@surescore/db'
import { appName, type HealthResponse } from '@surescore/shared'
import { authRoutes } from './routes/auth/index.js'
import { configRoutes } from './routes/config/index.js'
import { payoutAccountRoutes } from './routes/payout-accounts/index.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>()
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

openapi.get('/', (context) => context.json(healthResponse(context.env.DB)))
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
