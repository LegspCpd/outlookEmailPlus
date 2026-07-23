/**
 * 数据概览 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册概览路由
 * @param {import('../router.js').Router} router
 */
export function registerOverviewRoutes(router) {
	router.get('/api/overview/:type', loginRequired(async (request, env, ctx) => {
		try {
			const { type } = request.params;
			const data = {};

			switch (type) {
				case 'dashboard':
					const accountCount = await env.DB.prepare('SELECT COUNT(*) as c FROM accounts').first();
					const groupCount = await env.DB.prepare('SELECT COUNT(*) as c FROM groups').first();
					const tempEmailCount = await env.DB.prepare('SELECT COUNT(*) as c FROM temp_emails').first();
					data.account_count = accountCount ? accountCount.c : 0;
					data.group_count = groupCount ? groupCount.c : 0;
					data.temp_email_count = tempEmailCount ? tempEmailCount.c : 0;
					break;
				case 'pool':
					const poolStats = await env.DB.prepare(
						"SELECT status, COUNT(*) as c FROM accounts GROUP BY status"
					).all();
					data.pool_stats = poolStats.results || [];
					break;
				default:
					return errorResponse('INVALID_TYPE', '无效的概览类型', 400);
			}

			return jsonResponse({ success: true, data });
		} catch (err) {
			return errorResponse('OVERVIEW_FAILED', '获取概览数据失败', 500, err.message);
		}
	}));
}
