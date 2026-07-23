/**
 * 邮箱池管理 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册邮箱池路由
 * @param {import('../router.js').Router} router
 */
export function registerPoolAdminRoutes(router) {
	// 获取邮箱池账号
	router.get('/api/pool-admin/accounts', loginRequired(async (request, env, ctx) => {
		try {
			const { status, page = '1', per_page = '50' } = request.query;
			const offset = (parseInt(page, 10) - 1) * parseInt(per_page, 10);
			const limit = parseInt(per_page, 10);

			let sql = `SELECT a.*, g.name as group_name FROM accounts a
					   LEFT JOIN groups g ON a.group_id = g.id WHERE 1=1`;
			const binds = [];

			if (status) {
				sql += ' AND a.status = ?';
				binds.push(status);
			}

			sql += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
			binds.push(limit, offset);

			const result = await env.DB.prepare(sql).bind(...binds).all();
			const countResult = await env.DB.prepare(
				'SELECT COUNT(*) as total FROM accounts'
			).first();

			return jsonResponse({
				success: true,
				accounts: result.results || [],
				total: countResult ? countResult.total : 0,
			});
		} catch (err) {
			return errorResponse('POOL_LIST_FAILED', '获取邮箱池列表失败', 500, err.message);
		}
	}));

	// 账号操作（claim/release/complete）
	router.post('/api/pool-admin/accounts/:id/action', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { action } = body;
			const id = parseInt(request.params.id, 10);

			switch (action) {
				case 'reset':
					await env.DB.prepare(
						"UPDATE accounts SET status = 'active', updated_at = datetime('now') WHERE id = ?"
					).bind(id).run();
					break;
				case 'disable':
					await env.DB.prepare(
						"UPDATE accounts SET status = 'disabled', updated_at = datetime('now') WHERE id = ?"
					).bind(id).run();
					break;
				default:
					return errorResponse('INVALID_ACTION', '无效的操作', 400);
			}

			return jsonResponse({ success: true, message: `账号 ${action} 成功` });
		} catch (err) {
			return errorResponse('POOL_ACTION_FAILED', '操作失败', 500, err.message);
		}
	}));
}
