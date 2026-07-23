/**
 * 临时邮箱 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册临时邮箱路由
 * @param {import('../router.js').Router} router
 */
export function registerTempEmailRoutes(router) {
	// 获取临时邮箱列表
	router.get('/api/temp-emails', loginRequired(async (request, env, ctx) => {
		try {
			const { status, page = '1', per_page = '50' } = request.query;
			const offset = (parseInt(page, 10) - 1) * parseInt(per_page, 10);
			const limit = parseInt(per_page, 10);

			let sql = 'SELECT * FROM temp_emails WHERE 1=1';
			const binds = [];

			if (status) {
				sql += ' AND status = ?';
				binds.push(status);
			}

			sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
			binds.push(limit, offset);

			const result = await env.DB.prepare(sql).bind(...binds).all();
			const countResult = await env.DB.prepare(
				'SELECT COUNT(*) as total FROM temp_emails'
			).first();

			return jsonResponse({
				success: true,
				emails: result.results || [],
				total: countResult ? countResult.total : 0,
			});
		} catch (err) {
			return errorResponse('TEMP_EMAIL_LIST_FAILED', '获取临时邮箱列表失败', 500, err.message);
		}
	}));

	// 获取临时邮箱选项
	router.get('/api/temp-emails/options', loginRequired(async (request, env, ctx) => {
		try {
			const domains = await env.DB.prepare(
				"SELECT value FROM settings WHERE key = 'temp_mail_domains'"
			).first();

			const domainList = domains ? JSON.parse(domains.value) : [];

			return jsonResponse({
				success: true,
				options: {
					domains: domainList,
					default_domain: domainList[0] || '',
				},
			});
		} catch (err) {
			return jsonResponse({
				success: true,
				options: { domains: [], default_domain: '' },
			});
		}
	}));

	// 生成临时邮箱
	router.post('/api/temp-emails/generate', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { domain } = body;
			const prefix = 'user_' + Math.random().toString(36).substring(2, 10);
			const email = `${prefix}@${domain || 'tempmail.dev'}`;

			const result = await env.DB.prepare(
				`INSERT INTO temp_emails (email, status, mailbox_type, visible_in_ui, source, prefix, domain)
				 VALUES (?, 'active', 'user', 1, 'cloudflare_worker', ?, ?)`
			).bind(email, prefix, domain || 'tempmail.dev').run();

			return jsonResponse({
				success: true,
				email,
				id: result.meta.last_row_id,
				message: '临时邮箱生成成功',
			});
		} catch (err) {
			return errorResponse('TEMP_EMAIL_GENERATE_FAILED', '生成临时邮箱失败', 500, err.message);
		}
	}));

	// 获取临时邮箱消息
	router.get('/api/temp-emails/:email_addr/messages', loginRequired(async (request, env, ctx) => {
		try {
			const { email_addr } = request.params;
			const messages = await env.DB.prepare(
				'SELECT id, message_id, from_address, subject, content, has_html, timestamp, created_at FROM temp_email_messages WHERE email_address = ? ORDER BY timestamp DESC LIMIT 50'
			).bind(email_addr).all();

			return jsonResponse({ success: true, messages: messages.results || [] });
		} catch (err) {
			return errorResponse('MESSAGES_FETCH_FAILED', '获取消息失败', 500, err.message);
		}
	}));

	// 删除临时邮箱
	router.delete('/api/temp-emails/:email_addr', loginRequired(async (request, env, ctx) => {
		try {
			await env.DB.prepare('DELETE FROM temp_email_messages WHERE email_address = ?')
				.bind(request.params.email_addr).run();
			await env.DB.prepare('DELETE FROM temp_emails WHERE email = ?')
				.bind(request.params.email_addr).run();
			return jsonResponse({ success: true, message: '临时邮箱删除成功' });
		} catch (err) {
			return errorResponse('TEMP_EMAIL_DELETE_FAILED', '删除临时邮箱失败', 500, err.message);
		}
	}));
}
