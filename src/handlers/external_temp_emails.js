/**
 * 外部临时邮箱 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { apiKeyRequired } from '../middleware/auth.js';

/**
 * 注册外部临时邮箱路由
 * @param {import('../router.js').Router} router
 */
export function registerExternalTempEmailRoutes(router) {
	// 获取临时邮箱消息（外部）
	router.get('/api/external/temp-emails/:email_addr/messages', apiKeyRequired(async (request, env, ctx) => {
		try {
			const { email_addr } = request.params;
			const messages = await env.DB.prepare(
				'SELECT message_id, from_address, subject, content, timestamp FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT 20'
			).bind(email_addr).all();
			return jsonResponse({ success: true, messages: messages.results || [] });
		} catch (err) {
			return errorResponse('FETCH_FAILED', '获取消息失败', 500, err.message);
		}
	}));
}
