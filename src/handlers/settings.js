/**
 * 设置 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册设置路由
 * @param {import('../router.js').Router} router
 */
export function registerSettingRoutes(router) {
	// 获取所有设置
	router.get('/api/settings', loginRequired(async (request, env, ctx) => {
		try {
			const result = await env.DB.prepare('SELECT key, value FROM settings').all();
			const settings = {};
			for (const row of (result.results || [])) {
				settings[row.key] = row.value;
			}
			return jsonResponse({ success: true, settings });
		} catch (err) {
			return errorResponse('SETTINGS_GET_FAILED', '获取设置失败', 500, err.message);
		}
	}));

	// 更新设置
	router.put('/api/settings', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();

			for (const [key, value] of Object.entries(body)) {
				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					await env.DB.prepare(
						`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
					).bind(key, String(value)).run();
				}
			}

			return jsonResponse({ success: true, message: '设置更新成功' });
		} catch (err) {
			return errorResponse('SETTINGS_UPDATE_FAILED', '更新设置失败', 500, err.message);
		}
	}));
}
