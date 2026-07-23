/**
 * 认证中间件
 *
 * 基于会话（Cookie）的登录认证。
 * 使用 KV 存储会话数据。
 */

import { errorResponse, jsonResponse, generateTraceId } from './response.js';

const SESSION_COOKIE = 'session_id';
const SESSION_EXPIRY_SECONDS = 7 * 24 * 3600; // 7 天

/**
 * 创建会话
 * @param {Object} env
 * @param {string} userId
 * @returns {Promise<string>} session ID
 */
export async function createSession(env, userId = 'admin') {
	const sessionId = generateTraceId();
	const sessionData = {
		userId,
		loggedIn: true,
		createdAt: Date.now(),
	};

	await env.SESSION_KV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
		expirationTtl: SESSION_EXPIRY_SECONDS,
	});

	return sessionId;
}

/**
 * 销毁会话
 * @param {Object} env
 * @param {string} sessionId
 */
export async function destroySession(env, sessionId) {
	await env.SESSION_KV.delete(`session:${sessionId}`);
}

/**
 * 获取当前会话
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object|null>}
 */
export async function getSession(request, env) {
	const cookie = request.headers.get('Cookie') || '';
	const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
	if (!match) return null;

	const sessionId = match[1];
	const data = await env.SESSION_KV.get(`session:${sessionId}`);
	if (!data) return null;

	return JSON.parse(data);
}

/**
 * 认证中间件 — 需要登录
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<boolean>} 是否已认证
 */
export async function requireAuth(request, env) {
	const session = await getSession(request, env);
	return session && session.loggedIn === true;
}

/**
 * 需要登录的路由包装器
 * @param {Function} handler
 * @returns {Function}
 */
export function loginRequired(handler) {
	return async (request, env, ctx) => {
		const isAuthed = await requireAuth(request, env);
		if (!isAuthed) {
			return jsonResponse(
				{
					success: false,
					need_login: true,
					error: {
						code: 'AUTH_REQUIRED',
						message: 'Authentication required',
						status: 401,
					},
				},
				401
			);
		}
		return handler(request, env, ctx);
	};
}

/**
 * 外部 API Key 认证
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<boolean>}
 */
export async function verifyApiKey(request, env) {
	const apiKey = request.headers.get('X-API-Key');
	if (!apiKey) return false;

	try {
		const result = await env.DB.prepare(
			'SELECT id, pool_access FROM external_api_keys WHERE api_key = ? AND enabled = 1 LIMIT 1'
		).bind(apiKey).first();

		return !!result;
	} catch (e) {
		return false;
	}
}

/**
 * 可选的 API Key 认证（无需登录但需要有效 API Key）
 */
export function apiKeyRequired(handler) {
	return async (request, env, ctx) => {
		const valid = await verifyApiKey(request, env);
		if (!valid) {
			return jsonResponse(
				{
					success: false,
					error: {
						code: 'API_KEY_INVALID',
						message: 'Invalid or missing API Key',
						status: 401,
					},
				},
				401
			);
		}
		return handler(request, env, ctx);
	};
}
