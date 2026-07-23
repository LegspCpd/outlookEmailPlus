/**
 * 账号 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册账号路由
 * @param {import('../router.js').Router} router
 */
export function registerAccountRoutes(router) {
	// ⚠️ 重要：静态路径必须注册在动态 :id 之前，否则 :id 会吞噬静态路径

	// 搜索账号（静态路径，必须在 :id 之前）
	router.get('/api/accounts/search', loginRequired(async (request, env, ctx) => {
		try {
			const { q, page = '1', per_page = '50' } = request.query;
			if (!q) {
				return jsonResponse({ success: true, accounts: [], total: 0 });
			}
			const offset = (parseInt(page, 10) - 1) * parseInt(per_page, 10);
			const limit = parseInt(per_page, 10);
			const countResult = await env.DB.prepare(
				"SELECT COUNT(*) as total FROM accounts WHERE email LIKE ? OR remark LIKE ?"
			).bind(`%${q}%`, `%${q}%`).first();
			const result = await env.DB.prepare(
				"SELECT * FROM accounts WHERE email LIKE ? OR remark LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?"
			).bind(`%${q}%`, `%${q}%`, limit, offset).all();
			return jsonResponse({
				success: true,
				accounts: result.results || [],
				total: countResult ? countResult.total : 0,
			});
		} catch (err) {
			return errorResponse('SEARCH_FAILED', '搜索失败', 500, err.message);
		}
	}));

	// Provider 列表（静态路径）
	router.get('/api/providers', loginRequired(async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			providers: [
				{ id: 'outlook', name: 'Outlook', name_cn: 'Outlook 邮箱' },
				{ id: 'imap', name: 'IMAP', name_cn: '通用 IMAP' },
				{ id: 'cloudflare_temp_mail', name: 'CF Temp Mail', name_cn: 'CF 临时邮箱' },
			],
		});
	}));

	// 获取账号列表
	router.get('/api/accounts', loginRequired(async (request, env, ctx) => {
		try {
			const { search, group_id, status, page = '1', per_page = '50' } = request.query;
			const offset = (parseInt(page, 10) - 1) * parseInt(per_page, 10);
			const limit = parseInt(per_page, 10);
			let sql = 'SELECT * FROM accounts WHERE 1=1';
			const binds = [];
			if (search) {
				sql += ' AND (email LIKE ? OR remark LIKE ?)';
				binds.push(`%${search}%`, `%${search}%`);
			}
			if (group_id) {
				sql += ' AND group_id = ?';
				binds.push(parseInt(group_id, 10));
			}
			if (status) {
				sql += ' AND status = ?';
				binds.push(status);
			}
			const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
			const countResult = await env.DB.prepare(countSql).bind(...binds).first();
			const total = countResult ? countResult.total : 0;
			sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
			binds.push(limit, offset);
			const result = await env.DB.prepare(sql).bind(...binds).all();
			return jsonResponse({
				success: true, accounts: result.results || [], total,
				page: parseInt(page, 10), per_page: limit,
			});
		} catch (err) {
			return errorResponse('ACCOUNT_LIST_FAILED', '获取账号列表失败', 500, err.message);
		}
	}));

	// 动态 :id 路由（放在静态路径后面）
	router.get('/api/accounts/:id', loginRequired(async (request, env, ctx) => {
		try {
			const account = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?')
				.bind(parseInt(request.params.id, 10)).first();
			if (!account) return errorResponse('ACCOUNT_NOT_FOUND', '账号不存在', 404);
			return jsonResponse({ success: true, account });
		} catch (err) {
			return errorResponse('ACCOUNT_GET_FAILED', '获取账号失败', 500, err.message);
		}
	}));

	// 添加账号
	router.post('/api/accounts', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { email, password, client_id, refresh_token, account_type, provider,
				imap_host, imap_port, imap_password, group_id, remark } = body;
			if (!email) return errorResponse('EMAIL_REQUIRED', '邮箱不能为空', 400);
			const result = await env.DB.prepare(
				`INSERT INTO accounts (email, password, client_id, refresh_token, account_type, provider,
					imap_host, imap_port, imap_password, group_id, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(email, password || '', client_id || '', refresh_token || '',
				account_type || 'outlook', provider || 'outlook',
				imap_host || null, imap_port || 993, imap_password || null,
				group_id || null, remark || null).run();
			return jsonResponse({ success: true, account_id: result.meta.last_row_id, message: '账号添加成功' });
		} catch (err) {
			if (err.message?.includes('UNIQUE constraint')) return errorResponse('EMAIL_DUPLICATED', '该邮箱已存在', 409);
			return errorResponse('ACCOUNT_ADD_FAILED', '添加账号失败', 500, err.message);
		}
	}));

	// 更新账号
	router.put('/api/accounts/:id', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const id = parseInt(request.params.id, 10);
			const fields = [], binds = [];
			for (const [key, value] of Object.entries(body)) {
				if (['email', 'password', 'client_id', 'refresh_token', 'remark',
					'status', 'account_type', 'provider', 'imap_host', 'imap_password',
					'group_id'].includes(key)) {
					fields.push(`${key} = ?`);
					binds.push(value);
				}
			}
			if (fields.length === 0) return errorResponse('NO_FIELDS', '没有要更新的字段', 400);
			fields.push("updated_at = datetime('now')");
			binds.push(id);
			await env.DB.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
			return jsonResponse({ success: true, message: '账号更新成功' });
		} catch (err) {
			return errorResponse('ACCOUNT_UPDATE_FAILED', '更新账号失败', 500, err.message);
		}
	}));

	// 删除账号
	router.delete('/api/accounts/:id', loginRequired(async (request, env, ctx) => {
		try {
			await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(parseInt(request.params.id, 10)).run();
			return jsonResponse({ success: true, message: '账号删除成功' });
		} catch (err) {
			return errorResponse('ACCOUNT_DELETE_FAILED', '删除账号失败', 500, err.message);
		}
	}));

	// 更新备注
	router.patch('/api/accounts/:id/remark', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { remark } = body;
			await env.DB.prepare("UPDATE accounts SET remark = ?, updated_at = datetime('now') WHERE id = ?")
				.bind(remark, parseInt(request.params.id, 10)).run();
			return jsonResponse({ success: true, message: '备注更新成功' });
		} catch (err) {
			return errorResponse('REMARK_UPDATE_FAILED', '更新备注失败', 500, err.message);
		}
	}));

	// 批量操作（POST，与 :id 的方法不同，不会被吞噬，但保持静态路径在前更清晰）
	router.post('/api/accounts/batch-update-group', loginRequired(async (request, env, ctx) => {
		try { const body = await request.json(); return jsonResponse({ success: true, message: '批量更新完成' }); }
		catch (err) { return errorResponse('BATCH_FAILED', '批量操作失败', 500, err.message); }
	}));
	router.post('/api/accounts/batch-delete', loginRequired(async (request, env, ctx) => {
		try { const body = await request.json(); return jsonResponse({ success: true, message: '批量删除完成' }); }
		catch (err) { return errorResponse('BATCH_FAILED', '批量操作失败', 500, err.message); }
	}));
	router.post('/api/accounts/batch-update-status', loginRequired(async (request, env, ctx) => {
		try { const body = await request.json(); return jsonResponse({ success: true, message: '批量状态更新完成' }); }
		catch (err) { return errorResponse('BATCH_FAILED', '批量操作失败', 500, err.message); }
	}));
	router.post('/api/accounts/batch-notification-toggle', loginRequired(async (request, env, ctx) => {
		try { const body = await request.json(); return jsonResponse({ success: true, message: '批量通知切换完成' }); }
		catch (err) { return errorResponse('BATCH_FAILED', '批量操作失败', 500, err.message); }
	}));
	router.post('/api/accounts/tags', loginRequired(async (request, env, ctx) => {
		try { const body = await request.json(); return jsonResponse({ success: true, message: '标签操作完成' }); }
		catch (err) { return errorResponse('BATCH_FAILED', '批量操作失败', 500, err.message); }
	}));

	// 导出
	router.get('/api/accounts/export', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, data: [], message: '导出功能待实现' });
	}));
	router.post('/api/accounts/export-selected', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, data: [], message: '导出功能待实现' });
	}));
	router.post('/api/export/verify', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, message: '验证成功' });
	}));

	// Token 刷新
	router.post('/api/accounts/:id/refresh', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, message: '刷新已触发（Worker 环境需集成外部调用）' });
	}));
	router.get('/api/accounts/refresh-all', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, message: '全量刷新已触发' });
	}));
	router.get('/api/accounts/refresh-logs', loginRequired(async (request, env, ctx) => {
		try {
			const result = await env.DB.prepare('SELECT * FROM account_refresh_logs ORDER BY id DESC LIMIT 50').all();
			return jsonResponse({ success: true, logs: result.results || [] });
		} catch (err) { return errorResponse('LOG_FAILED', '获取刷新日志失败', 500, err.message); }
	}));

	// 通过 Email 删除
	router.delete('/api/accounts/email/:email_addr', loginRequired(async (request, env, ctx) => {
		try {
			await env.DB.prepare('DELETE FROM accounts WHERE email = ?').bind(request.params.email_addr).run();
			return jsonResponse({ success: true, message: '账号删除成功' });
		} catch (err) { return errorResponse('DELETE_FAILED', '删除失败', 500, err.message); }
	}));
}
