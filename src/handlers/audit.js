/**
 * 审计日志 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册审计日志路由
 * @param {import('../router.js').Router} router
 */
export function registerAuditRoutes(router) {
	router.get('/api/audit-logs', loginRequired(async (request, env, ctx) => {
		try {
			const { resource_type, limit = '200' } = request.query;
			let sql = 'SELECT * FROM audit_logs WHERE 1=1';
			const binds = [];

			if (resource_type) {
				sql += ' AND resource_type = ?';
				binds.push(resource_type);
			}

			sql += ' ORDER BY id DESC LIMIT ?';
			binds.push(parseInt(limit, 10));

			const result = await env.DB.prepare(sql).bind(...binds).all();
			return jsonResponse({ success: true, logs: result.results || [] });
		} catch (err) {
			return errorResponse('AUDIT_LOG_FAILED', '获取审计日志失败', 500, err.message);
		}
	}));
}
