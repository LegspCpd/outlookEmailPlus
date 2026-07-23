/**
 * 分组 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册分组路由
 * @param {import('../router.js').Router} router
 */
export function registerGroupRoutes(router) {
	// 获取分组列表
	router.get('/api/groups', loginRequired(async (request, env, ctx) => {
		try {
			const result = await env.DB.prepare(
				'SELECT g.*, (SELECT COUNT(*) FROM accounts WHERE group_id = g.id) as account_count FROM groups g ORDER BY g.id ASC'
			).all();
			return jsonResponse({ success: true, groups: result.results || [] });
		} catch (err) {
			return errorResponse('GROUP_LIST_FAILED', '获取分组列表失败', 500, err.message);
		}
	}));

	// 创建分组
	router.post('/api/groups', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { name, description, color, proxy_url } = body;

			if (!name) {
				return errorResponse('GROUP_NAME_REQUIRED', '分组名称不能为空', 400);
			}

			const result = await env.DB.prepare(
				'INSERT INTO groups (name, description, color, proxy_url) VALUES (?, ?, ?, ?)'
			).bind(name, description || '', color || '#1a1a1a', proxy_url || null).run();

			return jsonResponse({
				success: true,
				group_id: result.meta.last_row_id,
				message: '分组创建成功',
			});
		} catch (err) {
			if (err.message && err.message.includes('UNIQUE constraint')) {
				return errorResponse('GROUP_NAME_DUPLICATED', '分组名称已存在', 409);
			}
			return errorResponse('GROUP_CREATE_FAILED', '创建分组失败', 500, err.message);
		}
	}));

	// 更新分组
	router.put('/api/groups/:id', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const id = parseInt(request.params.id, 10);

			const fields = [];
			const binds = [];
			for (const key of ['name', 'description', 'color', 'proxy_url',
				'verification_code_length', 'verification_code_regex',
				'verification_ai_enabled', 'verification_ai_model']) {
				if (body[key] !== undefined) {
					fields.push(`${key} = ?`);
					binds.push(body[key]);
				}
			}

			if (fields.length === 0) {
				return errorResponse('NO_FIELDS', '没有要更新的字段', 400);
			}

			binds.push(id);
			await env.DB.prepare(
				`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`
			).bind(...binds).run();

			return jsonResponse({ success: true, message: '分组更新成功' });
		} catch (err) {
			return errorResponse('GROUP_UPDATE_FAILED', '更新分组失败', 500, err.message);
		}
	}));

	// 删除分组
	router.delete('/api/groups/:id', loginRequired(async (request, env, ctx) => {
		try {
			const id = parseInt(request.params.id, 10);

			// 检查是否为默认分组
			const group = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(id).first();
			if (!group) {
				return errorResponse('GROUP_NOT_FOUND', '分组不存在', 404);
			}

			await env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
			return jsonResponse({ success: true, message: '分组删除成功' });
		} catch (err) {
			return errorResponse('GROUP_DELETE_FAILED', '删除分组失败', 500, err.message);
		}
	}));
}
