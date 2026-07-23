/**
 * 健康检查路由
 */

import { jsonResponse } from '../middleware/response.js';

/**
 * 注册健康检查路由
 * @param {import('../router.js').Router} router
 */
export function registerHealthRoutes(router) {
	// 健康检查端点（无需认证）
	router.get('/healthz', async (request, env, ctx) => {
		return new Response('OK', {
			status: 200,
			headers: { 'content-type': 'text/plain' },
		});
	});

	// API 健康检查
	router.get('/api/system/health', async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: env.APP_VERSION || '2.7.0',
		});
	});

	// API 健康检查（外部）
	router.get('/api/external/health', async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			status: 'healthy',
			timestamp: new Date().toISOString(),
		});
	});
}
