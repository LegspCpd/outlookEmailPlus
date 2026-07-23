// ==================== Worker 入口 ====================
// 所有模块使用动态导入、懒加载，避免模块加载期异常导致 1101

let routerPromise = null;

async function getRouter() {
	if (routerPromise) return routerPromise;
	routerPromise = (async () => {
		const [{ Router }, { initializeSchema }, health, auth, accounts,
			emails, settings, groups, tags, tempEmails, poolAdmin, externalPool,
			externalTempEmails, systemMod, audit, overview, plugins, scheduler, tokenTool, staticFiles] = await Promise.all([
			import('./router.js'),
			import('./db/schema.js'),
			import('./handlers/health.js'),
			import('./handlers/auth.js'),
			import('./handlers/accounts.js'),
			import('./handlers/emails.js'),
			import('./handlers/settings.js'),
			import('./handlers/groups.js'),
			import('./handlers/tags.js'),
			import('./handlers/temp_emails.js'),
			import('./handlers/pool_admin.js'),
			import('./handlers/external_pool.js'),
			import('./handlers/external_temp_emails.js'),
			import('./handlers/system.js'),
			import('./handlers/audit.js'),
			import('./handlers/overview.js'),
			import('./handlers/plugins.js'),
			import('./handlers/scheduler.js'),
			import('./handlers/token_tool.js'),
			import('./handlers/static.js'),
		]);

		const r = new Router();
		health.registerHealthRoutes(r);
		auth.registerAuthRoutes(r);
		staticFiles.registerStaticRoutes(r);
		accounts.registerAccountRoutes(r);
		emails.registerEmailRoutes(r);
		settings.registerSettingRoutes(r);
		groups.registerGroupRoutes(r);
		tags.registerTagRoutes(r);
		tempEmails.registerTempEmailRoutes(r);
		poolAdmin.registerPoolAdminRoutes(r);
		externalPool.registerExternalPoolRoutes(r);
		externalTempEmails.registerExternalTempEmailRoutes(r);
		systemMod.registerSystemRoutes(r);
		audit.registerAuditRoutes(r);
		overview.registerOverviewRoutes(r);
		plugins.registerPluginRoutes(r);
		scheduler.registerSchedulerRoutes(r);
		tokenTool.registerTokenToolRoutes(r);

		// 首次请求顺便初始化 D1 schema
		return { router: r, initializeSchema };
	})();
	return routerPromise;
}

export default {
	async fetch(request, env, ctx) {
		try {
			const { router, initializeSchema } = await getRouter();

			// 初始化 D1（失败不阻断）
			try { await initializeSchema(env.DB); } catch (_) { /* non-fatal */ }

			// CORS 预检
			if (request.method === 'OPTIONS') return handleCORS(request);

			const response = await router.handle(request, env, ctx);

			if (response === null) {
				const url = new URL(request.url);
				if (url.pathname.startsWith('/api/')) {
					return addCors(request, jsonResponse(
						{ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint not found', status: 404 } }, 404
					));
				}
				try {
					const obj = await env.R2_BUCKET?.get('templates/index.html');
					if (obj) {
						const html = await obj.text();
						return addCors(request, new Response(html, {
							headers: { 'content-type': 'text/html;charset=UTF-8', 'x-robots-tag': 'noindex' },
						}));
					}
				} catch (_) { /* ignore */ }
				return addCors(request, new Response('Not Found', { status: 404 }));
			}

			return addCors(request, response);
		} catch (err) {
			return new Response(
				JSON.stringify({ error: 'Worker error', message: err?.message || String(err), stack: err?.stack }),
				{ status: 500, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }
			);
		}
	},
};

// ==================== 辅助函数 ====================

function jsonResponse(data, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(data), {
		status, headers: { 'content-type': 'application/json;charset=UTF-8', ...extraHeaders },
	});
}

function addCors(request, response) {
	const headers = getCorsHeaders(request);
	for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
	return response;
}

function handleCORS(request) {
	const headers = getCorsHeaders(request);
	headers['access-control-max-age'] = '86400';
	return new Response(null, { status: 204, headers });
}

function getCorsHeaders(request) {
	const origin = request.headers.get('Origin') || '';
	const allowed = [/^chrome-extension:\/\/.*$/];
	const isAllowed = allowed.some((p) => p.test(origin));
	return {
		'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, X-API-Key, X-CSRF-Token',
		'access-control-allow-credentials': 'true',
		'access-control-allow-origin': isAllowed || origin ? origin : '*',
	};
}

/**
 * 给 Response 添加 CORS 头
 */
function addCors(request, response) {
	const headers = getCorsHeaders(request);
	for (const [key, value] of Object.entries(headers)) {
		response.headers.set(key, value);
	}
	return response;
}

/**
 * CORS 处理
 */
function handleCORS(request) {
	const headers = getCorsHeaders(request);
	headers['access-control-max-age'] = '86400';
	return new Response(null, { status: 204, headers });
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(request) {
	const origin = request.headers.get('Origin') || '';
	const allowedOrigins = [/^chrome-extension:\/\/.*$/];
	const isAllowed = allowedOrigins.some((p) => p.test(origin));
	const headers = {
		'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, X-API-Key, X-CSRF-Token',
		'access-control-allow-credentials': 'true',
	};
	if (isAllowed || origin) {
		headers['access-control-allow-origin'] = origin;
	} else {
		headers['access-control-allow-origin'] = '*';
	}
	return headers;
}


