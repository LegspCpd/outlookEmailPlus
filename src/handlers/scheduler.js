/**
 * 调度器 API 路由
 */

import { jsonResponse, errorResponse } from '../middleware/response.js';
import { loginRequired } from '../middleware/auth.js';

export function registerSchedulerRoutes(router) {
	router.get('/api/scheduler/status', loginRequired(async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			status: 'running',
			type: 'cloudflare-workers-cron',
			next_run: null,
		});
	}));
}
