/**
 * 插件 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

export function registerPluginRoutes(router) {
	router.get('/api/plugins', loginRequired(async (request, env, ctx) => {
		return jsonResponse({ success: true, plugins: [] });
	}));
}
