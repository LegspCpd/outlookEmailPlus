/**
 * Cloudflare Worker 入口 — Outlook Email Plus
 *
 * 将原有 Flask 应用适配为 Cloudflare Workers (ES Module 格式)。
 * - 静态资源通过 R2 存储桶提供（前端文件原封不动）
 * - 数据库使用 D1 (替代 SQLite)
 * - 配置/缓存使用 Workers KV
 * - 文件/附件使用 R2 对象存储
 *
 * 部署前请配置 wrangler.toml 中的 D1/KV/R2 绑定。
 */

import { Router } from './router.js';
import { errorResponse, jsonResponse } from './middleware/response.js';
import { initializeSchema } from './db/schema.js';

// 路由实例
const router = new Router();

// ==================== 导入各路由处理器 ====================

import { registerHealthRoutes } from './handlers/health.js';
import { registerAuthRoutes } from './handlers/auth.js';
import { registerAccountRoutes } from './handlers/accounts.js';
import { registerEmailRoutes } from './handlers/emails.js';
import { registerSettingRoutes } from './handlers/settings.js';
import { registerGroupRoutes } from './handlers/groups.js';
import { registerTagRoutes } from './handlers/tags.js';
import { registerTempEmailRoutes } from './handlers/temp_emails.js';
import { registerPoolAdminRoutes } from './handlers/pool_admin.js';
import { registerExternalPoolRoutes } from './handlers/external_pool.js';
import { registerExternalTempEmailRoutes } from './handlers/external_temp_emails.js';
import { registerSystemRoutes } from './handlers/system.js';
import { registerAuditRoutes } from './handlers/audit.js';
import { registerOverviewRoutes } from './handlers/overview.js';
import { registerPluginRoutes } from './handlers/plugins.js';
import { registerSchedulerRoutes } from './handlers/scheduler.js';
import { registerTokenToolRoutes } from './handlers/token_tool.js';
import { registerStaticRoutes } from './handlers/static.js';

// ==================== 注册路由 ====================

// 健康检查（无需认证）
registerHealthRoutes(router);

// 认证相关（登录/登出）
registerAuthRoutes(router);

// 静态资源（从 R2 提供，不做任何页面修改）
registerStaticRoutes(router);

// API 路由（需要登录认证）
registerAccountRoutes(router);
registerEmailRoutes(router);
registerSettingRoutes(router);
registerGroupRoutes(router);
registerTagRoutes(router);
registerTempEmailRoutes(router);
registerPoolAdminRoutes(router);
registerExternalPoolRoutes(router);
registerExternalTempEmailRoutes(router);
registerSystemRoutes(router);
registerAuditRoutes(router);
registerOverviewRoutes(router);
registerPluginRoutes(router);
registerSchedulerRoutes(router);
registerTokenToolRoutes(router);

// ==================== Worker 入口 ====================

// 标记 schema 是否已初始化（避免每次冷启动重复执行）
let schemaInitialized = false;

export default {
	async fetch(request, env, ctx) {
		try {
			// 首次请求时初始化 D1 schema
			if (!schemaInitialized) {
				schemaInitialized = true;
				try {
					await initializeSchema(env.DB);
					console.log('D1 schema initialized on first request');
				} catch (schemaErr) {
					console.error('D1 schema init error (non-fatal):', schemaErr);
				}
			}

			// CORS 预检处理
			if (request.method === 'OPTIONS') {
				return handleCORS(request);
			}

			// 交给路由处理
			const response = await router.handle(request, env, ctx);

			// 路由返回 null 表示无匹配 → 执行兜底逻辑
			if (response === null) {
				const url = new URL(request.url);

				// API 路径 → JSON 404
				if (url.pathname.startsWith('/api/')) {
					return addCors(request, jsonResponse(
						{ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint not found', status: 404 } },
						404
					));
				}

				// 其他路径 → 尝试从 R2 返回 index.html（SPA 降级）
				try {
					const indexHtml = await env.R2_BUCKET.get('templates/index.html');
					if (indexHtml) {
						const html = await indexHtml.text();
						return addCors(request, new Response(html, {
							headers: { 'content-type': 'text/html;charset=UTF-8', 'x-robots-tag': 'noindex' },
						}));
					}
				} catch (_) { /* ignore */ }

				return addCors(request, new Response('Not Found', { status: 404 }));
			}

			// 添加 CORS 头
			return addCors(request, response);
		} catch (err) {
			console.error('Unhandled error:', err);
			return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
		}
	},
};

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

/**
 * CORS 处理
 */
function handleCORS(request) {
	const headers = getCorsHeaders(request);
	headers['access-control-max-age'] = '86400';
	return new Response(null, {
		status: 204,
		headers,
	});
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(request) {
	const origin = request.headers.get('Origin') || '';
	const allowedOrigins = [
		/^chrome-extension:\/\/.*$/,
	];

	// 检查是否匹配允许的来源
	const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));

	const headers = {
		'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, X-API-Key, X-CSRF-Token',
		'access-control-allow-credentials': 'true',
	};

	if (isAllowed) {
		headers['access-control-allow-origin'] = origin;
	} else if (origin) {
		// 对已知来源放宽
		headers['access-control-allow-origin'] = origin;
	} else {
		headers['access-control-allow-origin'] = '*';
	}

	return headers;
}
