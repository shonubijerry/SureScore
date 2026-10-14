import { log } from './lib/logger.js'
import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { d1BindingName, databaseProvider } from '@surescore/db'
import { appName, type HealthResponse } from '@surescore/shared'
import { adminRoutes } from './routes/admin/index.js'
import { authRoutes } from './routes/auth/index.js'
import { configRoutes } from './routes/config/index.js'
import { discoverRoutes } from './routes/discover/index.js'
import { payoutAccountRoutes } from './routes/payout-accounts/index.js'
import { potRoutes } from './routes/pots/index.js'
import { shareRoutes } from './routes/share/index.js'
import { sportsRoutes } from './routes/sports/index.js'
import { walletRoutes } from './routes/wallet/index.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>()
// Security headers (HSTS etc.) everywhere; API responses may hold payout or account data, so never cache them.
app.use('*', secureHeaders())
app.use('/api/*', async (c, next) => {
	await next()
	c.header('Cache-Control', 'no-store')
})

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

app.onError(async (err, c) => {
	log.error("http", "unhandled", { path: c.req.path, error: err })

	if (err instanceof HTTPException) {
		const res = err.getResponse()
		const contentType = res.headers.get("content-type")
		if (contentType?.includes("application/json")) {
			return res
		}
		const text = await res.text()
		return c.json({ message: text || err.message, error: text || err.message }, err.status)
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

openapi.route('/api/admin', adminRoutes)
openapi.route('/api/auth', authRoutes)
openapi.route('/api/config', configRoutes)
openapi.route('/api/discover', discoverRoutes)
openapi.route('/api/payout-accounts', payoutAccountRoutes)
openapi.route('/api/pots', potRoutes)
openapi.route('/api/share', shareRoutes)
openapi.route('/api/sports', sportsRoutes)
openapi.route('/api/wallet', walletRoutes)

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
