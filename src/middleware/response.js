/**
 * HTTP 响应工具函数
 */

/**
 * 返回 JSON 响应
 * @param {any} data
 * @param {number} status
 * @param {Object} [extraHeaders] - 额外的响应头
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json;charset=UTF-8',
			...extraHeaders,
		},
	});
}

/**
 * 返回错误响应
 * @param {string} code - 错误码
 * @param {string} message - 错误消息
 * @param {number} status - HTTP 状态码
 * @param {string} [details] - 错误详情
 * @returns {Response}
 */
export function errorResponse(code, message, status = 500, details = null) {
	const body = {
		success: false,
		error: {
			code,
			message,
			status,
		},
	};
	if (details) {
		body.error.details = details;
	}
	return jsonResponse(body, status);
}

/**
 * 返回 HTML 响应
 * @param {string} html
 * @param {number} status
 * @returns {Response}
 */
export function htmlResponse(html, status = 200) {
	return new Response(html, {
		status,
		headers: {
			'content-type': 'text/html;charset=UTF-8',
		},
	});
}

/**
 * 生成 trace ID
 * @returns {string}
 */
export function generateTraceId() {
	const chars = '0123456789abcdef';
	let id = '';
	for (let i = 0; i < 32; i++) {
		id += chars[Math.floor(Math.random() * 16)];
	}
	return id;
}
