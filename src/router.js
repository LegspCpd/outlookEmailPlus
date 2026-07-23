/**
 * 轻量级 URL 路由器
 *
 * 支持路径参数（如 /api/accounts/:id）和方法匹配。
 */

export class Router {
	constructor() {
		/** @type {Array<{method: string, pattern: RegExp, paramNames: string[], handler: Function}>} */
		this.routes = [];
	}

	/**
	 * 注册 GET 路由
	 * @param {string} path
	 * @param {Function} handler
	 */
	get(path, handler) {
		this._addRoute('GET', path, handler);
	}

	/**
	 * 注册 POST 路由
	 * @param {string} path
	 * @param {Function} handler
	 */
	post(path, handler) {
		this._addRoute('POST', path, handler);
	}

	/**
	 * 注册 PUT 路由
	 * @param {string} path
	 * @param {Function} handler
	 */
	put(path, handler) {
		this._addRoute('PUT', path, handler);
	}

	/**
	 * 注册 PATCH 路由
	 * @param {string} path
	 * @param {Function} handler
	 */
	patch(path, handler) {
		this._addRoute('PATCH', path, handler);
	}

	/**
	 * 注册 DELETE 路由
	 * @param {string} path
	 * @param {Function} handler
	 */
	delete(path, handler) {
		this._addRoute('DELETE', path, handler);
	}

	/**
	 * 注册所有方法
	 * @param {string} path
	 * @param {Function} handler
	 */
	all(path, handler) {
		this._addRoute('ALL', path, handler);
	}

	/**
	 * 添加路由
	 * @param {string} method
	 * @param {string} path
	 * @param {Function} handler
	 */
	_addRoute(method, path) {
		const handler = arguments[2];
		const paramNames = [];

		// 1. 先处理 <path:xxx> 通配符参数（匹配含斜杠路径）
		let regexStr = path.replace(/<path:([^>]+)>/g, (_, name) => {
			paramNames.push(name);
			return '(.+)';
		});

		// 2. 再处理 :param 命名参数（不匹配斜杠）
		regexStr = regexStr.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
			paramNames.push(name);
			return '([^/]+)';
		});

		// 3. 转义剩余的所有正则特殊字符
		regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// 把刚才插入的捕获组 `\(` 恢复为 `(`
		regexStr = regexStr.replace(/\\\(/g, '(').replace(/\\\)/g, ')');

		const pattern = new RegExp(`^${regexStr}$`);
		this.routes.push({ method, pattern, paramNames, handler });
	}

	/**
	 * 处理请求
	 * @param {Request} request
	 * @param {Object} env
	 * @param {ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async handle(request, env, ctx) {
		const url = new URL(request.url);
		const method = request.method;

		for (const route of this.routes) {
			if (route.method !== 'ALL' && route.method !== method) continue;

			const match = url.pathname.match(route.pattern);
			if (!match) continue;

			// 提取路径参数
			const params = {};
			route.paramNames.forEach((name, index) => {
				params[name] = decodeURIComponent(match[index + 1]);
			});

			// 附加到 request
			request.params = params;
			request.query = Object.fromEntries(url.searchParams.entries());

			return await route.handler(request, env, ctx);
		}

		// 没有匹配的路由，交给 404 处理
		return new Response('Not Found', { status: 404 });
	}
}
