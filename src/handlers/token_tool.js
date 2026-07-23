/**
 * OAuth Token 工具 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

export function registerTokenToolRoutes(router) {
	router.get('/api/token-tool/config', loginRequired(async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			config: {
				enabled: true,
				default_scope: 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
				default_tenant: 'consumers',
			},
		});
	}));
}
