/**
 * 外部邮箱池 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { apiKeyRequired } from '../middleware/auth.js';

/**
 * 注册外部邮箱池路由
 * @param {import('../router.js').Router} router
 */
export function registerExternalPoolRoutes(router) {
	// 申领账号
	router.get('/api/external/pool/claim', apiKeyRequired(async (request, env, ctx) => {
		try {
			const { project_key } = request.query;

			let account;
			if (project_key) {
				// 按项目分配
				account = await env.DB.prepare(
					`SELECT * FROM accounts WHERE status = 'active' AND
					 (claimed_project_key IS NULL OR claimed_project_key = ?)
					 ORDER BY RANDOM() LIMIT 1`
				).bind(project_key).first();
			} else {
				account = await env.DB.prepare(
					"SELECT * FROM accounts WHERE status = 'active' ORDER BY RANDOM() LIMIT 1"
				).first();
			}

			if (!account) {
				return jsonResponse({ success: true, account: null, message: 'No available accounts' });
			}

			// 标记为已申领
			await env.DB.prepare(
				"UPDATE accounts SET status = 'claimed', updated_at = datetime('now') WHERE id = ?"
			).bind(account.id).run();

			return jsonResponse({
				success: true,
				account: {
					id: account.id,
					email: account.email,
					status: 'claimed',
				},
			});
		} catch (err) {
			return errorResponse('CLAIM_FAILED', '申领账号失败', 500, err.message);
		}
	}));

	// 释放账号
	router.post('/api/external/pool/release', apiKeyRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { email } = body;

			if (!email) {
				return errorResponse('EMAIL_REQUIRED', 'email 必填', 400);
			}

			await env.DB.prepare(
				"UPDATE accounts SET status = 'active', updated_at = datetime('now') WHERE email = ?"
			).bind(email).run();

			return jsonResponse({ success: true, message: '账号已释放' });
		} catch (err) {
			return errorResponse('RELEASE_FAILED', '释放账号失败', 500, err.message);
		}
	}));

	// 完成操作
	router.post('/api/external/pool/complete', apiKeyRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { email, result } = body;

			if (!email) {
				return errorResponse('EMAIL_REQUIRED', 'email 必填', 400);
			}

			if (result === 'success') {
				await env.DB.prepare(
					"UPDATE accounts SET status = 'active', updated_at = datetime('now') WHERE email = ?"
				).bind(email).run();
			} else {
				await env.DB.prepare(
					"UPDATE accounts SET status = 'used', updated_at = datetime('now') WHERE email = ?"
				).bind(email).run();
			}

			return jsonResponse({ success: true, message: '操作完成' });
		} catch (err) {
			return errorResponse('COMPLETE_FAILED', '完成操作失败', 500, err.message);
		}
	}));
}
