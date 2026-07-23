/**
 * 静态资源处理
 *
 * 从 R2 存储桶读取前端文件（HTML/CSS/JS/图片等），
 * 保持前端内容原封不动。
 * 路由：Jinja2 模板已改为纯静态 HTML，通过 R2 提供。
 */

import { htmlResponse } from '../middleware/response.js';

// MIME 类型映射
const MIME_TYPES = {
	'.html': 'text/html;charset=UTF-8',
	'.css': 'text/css;charset=UTF-8',
	'.js': 'application/javascript;charset=UTF-8',
	'.json': 'application/json;charset=UTF-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain;charset=UTF-8',
	'.map': 'application/json',
};

// 需要注入 APP_VERSION 的动态路由
const DYNAMIC_PAGE_ROUTES = ['/', '/login'];

/**
 * 从 R2 获取文件
 * @param {R2Bucket} bucket
 * @param {string} path
 * @returns {Promise<Response|null>}
 */
async function serveFromR2(bucket, path, env) {
	try {
		// 规范化路径：去掉开头的 /
		const cleanPath = path.replace(/^\//, '');

		// 直接读取
		const object = await bucket.get(cleanPath);
		if (!object) return null;

		const ext = '.' + cleanPath.split('.').pop()?.toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		// 对 HTML 模板，进行简单的变量替换（如 APP_VERSION）
		if (ext === '.html') {
			let html = await object.text();

			// 替换 Jinja2 模板变量为静态值
			html = html
				.replace(/\{\{ APP_VERSION \}\}/g, env.APP_VERSION || '2.7.0')
				.replace(/\{\{ url_for\('static', filename='([^']+)'\) \}\}/g, '/static/$1')
				.replace(/\{\{ url_for\('static', filename='([^']+)'\?v=([^']+)'\) \}\}/g, '/static/$1?v=$2')
				.replace(/\{% if OAUTH_TOOL_ENABLED %\}/g, '')
				.replace(/\{% endif %\}/g, '')
				.replace(/\{% endfor %\}/g, '')
				.replace(/\{% for [^%]+%\}/g, '')
				.replace(/\{% if [^%]+%\}/g, '')
				.replace(/\{% else %\}/g, '');

			return htmlResponse(html);
		}

		// 二进制文件直接返回
		if (contentType.startsWith('image/') || contentType.startsWith('font/')) {
			return new Response(await object.arrayBuffer(), {
				headers: {
					'content-type': contentType,
					'cache-control': 'public, max-age=31536000, immutable',
				},
			});
		}

		// 文本文件
		return new Response(await object.text(), {
			headers: {
				'content-type': contentType,
				'cache-control': 'public, max-age=3600, must-revalidate',
			},
		});
	} catch (err) {
		console.error(`R2 serve error for ${path}:`, err);
		return null;
	}
}

/**
 * 注册静态资源路由
 * @param {import('../router.js').Router} router
 */
export function registerStaticRoutes(router) {
	// 主页（需要登录）
	router.get('/', async (request, env, ctx) => {
		// 检查是否已登录
		const { getSession } = await import('../middleware/auth.js');
		const session = await getSession(request, env);

		if (!session) {
			// 未登录，尝试返回 login.html
			const resp = await serveFromR2(env.R2_BUCKET, 'templates/login.html', env);
			if (resp) return resp;

			// 降级：返回简单登录页
			return htmlResponse(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>登录</title></head>
<body><script>window.location.href='/login';</script></body></html>`);
		}

		// 已登录，返回 index.html
		const resp = await serveFromR2(env.R2_BUCKET, 'templates/index.html', env);
		if (resp) return resp;

		return htmlResponse(`<!DOCTYPE html><html><body><h1>Outlook Email Plus</h1><p>Loading...</p></body></html>`);
	});

	// 登录页
	router.get('/login', async (request, env, ctx) => {
		const resp = await serveFromR2(env.R2_BUCKET, 'templates/login.html', env);
		if (resp) return resp;

		return htmlResponse(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>登录</title></head>
<body><h1>登录</h1></body></html>`);
	});

	// 静态文件：/static/*
	router.get('/static/:path+', async (request, env, ctx) => {
		const staticPath = 'static/' + request.params.path;
		const resp = await serveFromR2(env.R2_BUCKET, staticPath, env);
		if (resp) return resp;
		return new Response('Static file not found: ' + staticPath, { status: 404 });
	});

	// 图片资源：/img/*
	router.get('/img/:path+', async (request, env, ctx) => {
		const imgPath = 'img/' + request.params.path;
		const resp = await serveFromR2(env.R2_BUCKET, imgPath, env);
		if (resp) return resp;
		return new Response('Image not found', { status: 404 });
	});

	// favicon
	router.get('/favicon.ico', async (request, env, ctx) => {
		const resp = await serveFromR2(env.R2_BUCKET, 'favicon.ico', env);
		if (resp) return resp;
		return new Response('', { status: 204 });
	});

	// Token 工具页
	router.get('/token-tool', async (request, env, ctx) => {
		const resp = await serveFromR2(env.R2_BUCKET, 'templates/token_tool.html', env);
		if (resp) return resp;
		return new Response('Not found', { status: 404 });
	});

	// Popup result
	router.get('/popup-result', async (request, env, ctx) => {
		const resp = await serveFromR2(env.R2_BUCKET, 'templates/popup_result.html', env);
		if (resp) return resp;
		return new Response('Not found', { status: 404 });
	});
}
