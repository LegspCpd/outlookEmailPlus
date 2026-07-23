/**
 * 标签 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

/**
 * 注册标签路由
 * @param {import('../router.js').Router} router
 */
export function registerTagRoutes(router) {
	// 获取标签列表
	router.get('/api/tags', loginRequired(async (request, env, ctx) => {
		try {
			const result = await env.DB.prepare(
				'SELECT t.*, (SELECT COUNT(*) FROM account_tags WHERE tag_id = t.id) as account_count FROM tags t ORDER BY t.name ASC'
			).all();
			return jsonResponse({ success: true, tags: result.results || [] });
		} catch (err) {
			return errorResponse('TAG_LIST_FAILED', '获取标签列表失败', 500, err.message);
		}
	}));

	// 创建标签
	router.post('/api/tags', loginRequired(async (request, env, ctx) => {
		try {
			const body = await request.json();
			const { name, color } = body;
			if (!name) {
				return errorResponse('TAG_NAME_REQUIRED', '标签名称不能为空', 400);
			}
			const result = await env.DB.prepare(
				'INSERT INTO tags (name, color) VALUES (?, ?)'
			).bind(name, color || '#666').run();
			return jsonResponse({ success: true, tag_id: result.meta.last_row_id, message: '标签创建成功' });
		} catch (err) {
			if (err.message && err.message.includes('UNIQUE constraint')) {
				return errorResponse('TAG_NAME_DUPLICATED', '标签名称已存在', 409);
			}
			return errorResponse('TAG_CREATE_FAILED', '创建标签失败', 500, err.message);
		}
	}));

	// 删除标签
	router.delete('/api/tags/:id', loginRequired(async (request, env, ctx) => {
		try {
			await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(parseInt(request.params.id, 10)).run();
			return jsonResponse({ success: true, message: '标签删除成功' });
		} catch (err) {
			return errorResponse('TAG_DELETE_FAILED', '删除标签失败', 500, err.message);
		}
	}));
}
