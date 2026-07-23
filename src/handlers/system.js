/**
 * 系统 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册系统路由
 * @param {import('../router.js').Router} router
 */
export function registerSystemRoutes(router) {
	// 系统诊断
	router.get('/api/system/diagnostics', loginRequired(async (request, env, ctx) => {
		try {
			const dbResult = await env.DB.prepare('SELECT COUNT(*) as account_count FROM accounts').first();
			return jsonResponse({
				success: true,
				diagnostics: {
					version: env.APP_VERSION || '2.7.0',
					account_count: dbResult ? dbResult.account_count : 0,
					d1_connected: true,
					kv_connected: true,
					r2_connected: !!env.R2_BUCKET,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (err) {
			return errorResponse('DIAGNOSTICS_FAILED', '系统诊断失败', 500, err.message);
		}
	}));

	// 版本检查
	router.get('/api/system/version-check', loginRequired(async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			current_version: env.APP_VERSION || '2.7.0',
			latest_version: env.APP_VERSION || '2.7.0',
			update_available: false,
			deployment_type: 'cloudflare-workers',
		});
	}));

	// 外部能力
	router.get('/api/external/capabilities', async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			capabilities: {
				temp_email: true,
				pool: true,
				verification_code_extraction: true,
			},
		});
	});
}
