/**
 * 认证路由 — 登录/登出
 */

import { jsonResponse, errorResponse, generateTraceId } from '../middleware/response.js';
import { createSession, destroySession, getSession } from '../middleware/auth.js';
import { verifyPassword } from '../db/schema.js';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 300; // 5 分钟
const LOGIN_WINDOW_SECONDS = 900; // 15 分钟

/**
 * 注册认证路由
 * @param {import('../router.js').Router} router
 */
export function registerAuthRoutes(router) {
	// 登录
	router.post('/login', async (request, env, ctx) => {
		try {
			const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
			const body = await request.json();
			const password = body.password || '';

			// 检查速率限制
			const now = Math.floor(Date.now() / 1000);
			let attempt = null;

			try {
				attempt = await env.DB.prepare(
					'SELECT count, last_attempt_at, locked_until_at FROM login_attempts WHERE ip = ?'
				).bind(clientIp).first();
			} catch (_) { /* ignore */ }

			if (attempt && attempt.locked_until_at && now < attempt.locked_until_at) {
				const remaining = Math.ceil(attempt.locked_until_at - now);
				return jsonResponse({
					success: false,
					error: {
						code: 'LOGIN_RATE_LIMITED',
						message: `登录失败次数过多，请在 ${remaining} 秒后重试`,
						status: 429,
					},
				}, 429);
			}

			// 获取存储的密码
			let storedPassword = null;
			try {
				const row = await env.DB.prepare(
					"SELECT value FROM settings WHERE key = 'login_password'"
				).first();
				storedPassword = row ? row.value : null;
			} catch (_) { /* ignore */ }

			// 默认密码
			if (!storedPassword) {
				storedPassword = 'sha256:665c1f3a3ebce2e1b20f948458f5e6e1a1c1c0e1e3e0b8a0b0c0d0e0f0a0b0c0';
			}

			// 验证密码
			const valid = await verifyPassword(password, storedPassword);

			if (valid) {
				// 登录成功，重置失败记录
				try {
					await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(clientIp).run();
				} catch (_) { /* ignore */ }

				const sessionId = await createSession(env);

				return jsonResponse({
					success: true,
					message: '登录成功',
				}, 200, {
					'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
				});
			} else {
				// 登录失败
				try {
					if (attempt) {
						const newCount = (attempt.count || 0) + 1;
						let lockedUntil = null;
						if (newCount >= LOGIN_MAX_ATTEMPTS) {
							lockedUntil = now + LOGIN_LOCKOUT_SECONDS;
						}
						await env.DB.prepare(
							'UPDATE login_attempts SET count = ?, last_attempt_at = ?, locked_until_at = ? WHERE ip = ?'
						).bind(newCount, now, lockedUntil, clientIp).run();
					} else {
						await env.DB.prepare(
							'INSERT INTO login_attempts (ip, count, last_attempt_at, locked_until_at) VALUES (?, 1, ?, NULL)'
						).bind(clientIp, now).run();
					}
				} catch (_) { /* ignore */ }

				return jsonResponse({
					success: false,
					error: {
						code: 'LOGIN_INVALID_PASSWORD',
						message: '密码错误',
						status: 401,
					},
				}, 401);
			}
		} catch (err) {
			return errorResponse('LOGIN_FAILED', '登录处理失败', 500, err.message);
		}
	});

	// 登出
	router.get('/logout', async (request, env, ctx) => {
		const session = await getSession(request, env);
		if (session) {
			const cookie = request.headers.get('Cookie') || '';
			const match = cookie.match(/session_id=([^;]+)/);
			if (match) {
				await destroySession(env, match[1]);
			}
		}

		return new Response(null, {
			status: 302,
			headers: {
				'Location': '/login',
				'Set-Cookie': 'session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
			},
		});
	});

	// CSRF Token
	router.get('/api/csrf-token', async (request, env, ctx) => {
		// Workers 环境中 CSRF 主要通过 SameSite Cookie + Origin 头验证
		const token = generateTraceId();
		return jsonResponse({
			success: true,
			csrf_token: token,
		});
	});

	// Bootstrap
	router.get('/api/bootstrap', async (request, env, ctx) => {
		return jsonResponse({
			success: true,
			version: env.APP_VERSION || '2.7.0',
			oauth_tool_enabled: true,
			features: {
				oauth_tool: true,
				pool: true,
				temp_mail: true,
			},
		});
	});
}
