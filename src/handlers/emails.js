/**
 * 邮件 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired, apiKeyRequired } from '../middleware/auth.js';

/**
 * 注册邮件路由
 * @param {import('../router.js').Router} router
 */
export function registerEmailRoutes(router) {
	// 获取邮箱的邮件列表
	router.get('/api/emails/:email_addr', loginRequired(async (request, env, ctx) => {
		try {
			const { email_addr } = request.params;
			const { limit = '20' } = request.query;

			// 检查账号是否存在
			const account = await env.DB.prepare(
				'SELECT id, email, client_id, refresh_token, account_type FROM accounts WHERE email = ?'
			).bind(email_addr).first();

			if (!account) {
				return errorResponse('ACCOUNT_NOT_FOUND', '账号不存在', 404);
			}

			// 尝试从 temp_email_messages 获取缓存消息
			const messages = await env.DB.prepare(
				'SELECT * FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT ?'
			).bind(email_addr, parseInt(limit, 10)).all();

			return jsonResponse({
				success: true,
				account: {
					id: account.id,
					email: account.email,
					account_type: account.account_type,
				},
				emails: messages.results || [],
			});
		} catch (err) {
			return errorResponse('EMAIL_FETCH_FAILED', '获取邮件失败', 500, err.message);
		}
	}));

	// 提取验证码
	router.get('/api/emails/:email_addr/extract-verification', loginRequired(async (request, env, ctx) => {
		try {
			const { email_addr } = request.params;

			// 从缓存中查找最近的邮件
			const message = await env.DB.prepare(
				'SELECT * FROM temp_email_messages WHERE email_address = ? AND content IS NOT NULL ORDER BY timestamp DESC LIMIT 1'
			).bind(email_addr).first();

			if (!message) {
				return jsonResponse({
					success: true,
					code: '',
					message: '未找到邮件内容，无法提取验证码',
				});
			}

			// 简单正则提取验证码（6位数字）
			const content = message.content || '';
			const codeMatch = content.match(/\b(\d{4,8})\b/);
			const code = codeMatch ? codeMatch[1] : '';

			return jsonResponse({
				success: true,
				code,
				message: code ? '验证码提取成功' : '未找到验证码',
			});
		} catch (err) {
			return errorResponse('EXTRACT_FAILED', '提取验证码失败', 500, err.message);
		}
	}));

	// 批量获取邮件
	router.post('/api/emails/batch', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { emails: emailList } = body;

			if (!Array.isArray(emailList) || emailList.length === 0) {
				return jsonResponse({ success: true, results: [] });
			}

			const results = {};
			for (const email of emailList) {
				const messages = await env.DB.prepare(
					'SELECT * FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT 5'
				).bind(email).all();
				results[email] = messages.results || [];
			}

			return jsonResponse({ success: true, results });
		} catch (err) {
			return errorResponse('BATCH_FETCH_FAILED', '批量获取邮件失败', 500, err.message);
		}
	}));

	// 外部 API：获取消息
	router.get('/api/external/messages', apiKeyRequired(async (request, env, ctx) => {
		try {
			const { email, limit = '10' } = request.query;
			if (!email) {
				return errorResponse('EMAIL_REQUIRED', 'email 参数必填', 400);
			}

			const messages = await env.DB.prepare(
				'SELECT message_id, from_address, subject, content, timestamp FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT ?'
			).bind(email, parseInt(limit, 10)).all();

			return jsonResponse({ success: true, messages: messages.results || [] });
		} catch (err) {
			return errorResponse('EXTERNAL_FETCH_FAILED', '获取消息失败', 500, err.message);
		}
	}));

	// 外部 API：获取最新消息
	router.get('/api/external/messages/latest', apiKeyRequired(async (request, env, ctx) => {
		try {
			const { email } = request.query;
			if (!email) {
				return errorResponse('EMAIL_REQUIRED', 'email 参数必填', 400);
			}

			const message = await env.DB.prepare(
				'SELECT * FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT 1'
			).bind(email).first();

			return jsonResponse({ success: true, message: message || null });
		} catch (err) {
			return errorResponse('EXTERNAL_FETCH_FAILED', '获取最新消息失败', 500, err.message);
		}
	}));

	// 外部 API：获取验证码
	router.get('/api/external/verification-code', apiKeyRequired(async (request, env, ctx) => {
		try {
			const { email } = request.query;
			if (!email) {
				return errorResponse('EMAIL_REQUIRED', 'email 参数必填', 400);
			}

			const message = await env.DB.prepare(
				'SELECT content FROM temp_email_messages WHERE email_address = ? AND content IS NOT NULL ORDER BY timestamp DESC LIMIT 1'
			).bind(email).first();

			if (!message || !message.content) {
				return jsonResponse({ success: true, code: '', message: 'No messages found' });
			}

			const codeMatch = message.content.match(/\b(\d{4,8})\b/);
			const code = codeMatch ? codeMatch[1] : '';

			return jsonResponse({ success: true, code });
		} catch (err) {
			return errorResponse('EXTERNAL_VERIFICATION_FAILED', '获取验证码失败', 500, err.message);
		}
	}));
}
