/**
 * D1 数据库 Schema 定义
 *
 * 与原始 SQLite 数据库 schema 保持一致（v24）。
 * 在 Worker 启动时自动执行初始化。
 */

const DB_SCHEMA_VERSION = 24;

const SCHEMA_SQL = `
-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Schema 迁移记录表
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_version INTEGER NOT NULL,
    to_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    started_at REAL NOT NULL,
    finished_at REAL,
    error TEXT,
    trace_id TEXT
);

-- 分组表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#1a1a1a',
    proxy_url TEXT,
    is_system INTEGER DEFAULT 0,
    verification_code_length TEXT DEFAULT '6-6',
    verification_code_regex TEXT DEFAULT '',
    verification_ai_enabled INTEGER DEFAULT 0,
    verification_ai_model TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 邮箱账号表
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    client_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    account_type TEXT DEFAULT 'outlook',
    provider TEXT DEFAULT 'outlook',
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_password TEXT,
    group_id INTEGER,
    remark TEXT,
    status TEXT DEFAULT 'active',
    last_refresh_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    telegram_push_enabled INTEGER DEFAULT 0,
    telegram_last_checked_at TEXT,
    latest_email_subject TEXT DEFAULT '',
    latest_email_from TEXT DEFAULT '',
    latest_email_folder TEXT DEFAULT '',
    latest_email_received_at TEXT DEFAULT '',
    latest_verification_code TEXT DEFAULT '',
    latest_verification_folder TEXT DEFAULT '',
    latest_verification_received_at TEXT DEFAULT '',
    email_domain TEXT,
    temp_mail_meta TEXT,
    preferred_verification_channel TEXT,
    claimed_project_key TEXT,
    FOREIGN KEY (group_id) REFERENCES groups (id)
);

-- 临时邮箱表
CREATE TABLE IF NOT EXISTS temp_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    mailbox_type TEXT NOT NULL DEFAULT 'user',
    visible_in_ui INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'custom_domain_temp_mail',
    prefix TEXT,
    domain TEXT,
    task_token TEXT UNIQUE,
    consumer_key TEXT,
    caller_id TEXT,
    task_id TEXT,
    finished_at TEXT,
    meta_json TEXT,
    pool_status TEXT,
    claimed_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 临时邮件表
CREATE TABLE IF NOT EXISTS temp_email_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    email_address TEXT NOT NULL,
    from_address TEXT,
    subject TEXT,
    content TEXT,
    html_content TEXT,
    has_html INTEGER DEFAULT 0,
    timestamp INTEGER,
    raw_content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (email_address) REFERENCES temp_emails (email),
    UNIQUE(email_address, message_id)
);

-- 刷新记录表
CREATE TABLE IF NOT EXISTS account_refresh_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    account_email TEXT NOT NULL,
    refresh_type TEXT DEFAULT 'manual',
    status TEXT NOT NULL,
    error_message TEXT,
    run_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    user_ip TEXT,
    operator TEXT,
    status TEXT DEFAULT '',
    details TEXT,
    trace_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 账号标签关联表
CREATE TABLE IF NOT EXISTS account_tags (
    account_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (account_id, tag_id),
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

-- 分布式锁表
CREATE TABLE IF NOT EXISTS distributed_locks (
    name TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    acquired_at REAL NOT NULL,
    expires_at REAL NOT NULL
);

-- 导出验证 Token 表
CREATE TABLE IF NOT EXISTS export_verify_tokens (
    token TEXT PRIMARY KEY,
    ip TEXT,
    user_agent TEXT,
    expires_at REAL NOT NULL,
    created_at REAL NOT NULL
);

-- 登录尝试表
CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    last_attempt_at REAL NOT NULL,
    locked_until_at REAL
);

-- 刷新运行表
CREATE TABLE IF NOT EXISTS refresh_runs (
    id TEXT PRIMARY KEY,
    trigger_source TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_by_ip TEXT,
    requested_by_user_agent TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    total INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    message TEXT,
    trace_id TEXT
);

-- 对外 API 限流表
CREATE TABLE IF NOT EXISTS external_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Wait-message 探测缓存表
CREATE TABLE IF NOT EXISTS external_probe_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    probe_id TEXT UNIQUE NOT NULL,
    email_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    result_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

-- 上游探测结果缓存表
CREATE TABLE IF NOT EXISTS external_verification_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_address TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    UNIQUE(email_address, cache_key)
);

-- 多 API Key 表
CREATE TABLE IF NOT EXISTS external_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT UNIQUE NOT NULL,
    label TEXT,
    enabled INTEGER DEFAULT 1,
    ip_whitelist TEXT,
    allowed_emails TEXT,
    pool_access INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 调用方日级使用统计
CREATE TABLE IF NOT EXISTS external_daily_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(api_key_id, date)
);

-- 邮箱池设置
CREATE TABLE IF NOT EXISTS pool_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 账号申领日志
CREATE TABLE IF NOT EXISTS account_claim_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    claim_type TEXT NOT NULL,
    claimed_by TEXT,
    project_key TEXT,
    caller_id TEXT,
    task_id TEXT,
    result TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);

-- 账号项目使用表
CREATE TABLE IF NOT EXISTS account_project_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    project_key TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    last_success_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(account_id, project_key),
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);

-- 验证码提取日志
CREATE TABLE IF NOT EXISTS verification_extract_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT,
    email_address TEXT,
    confidence REAL,
    extractor TEXT,
    raw_result TEXT,
    ai_fallback_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 通知投递日志
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    recipient TEXT,
    subject TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_account_refresh_logs_run_id ON account_refresh_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id ON audit_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_runs_started_at ON refresh_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_refresh_runs_trigger_source ON refresh_runs(trigger_source);
CREATE INDEX IF NOT EXISTS idx_temp_emails_task_token_unique ON temp_emails(task_token);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_started_at ON schema_migrations(started_at);
`;

/**
 * 初始化 D1 数据库 schema
 * @param {D1Database} db
 */
export async function initializeSchema(db) {
	try {
		// 执行 schema SQL
		const statements = SCHEMA_SQL.split(';').filter(s => s.trim().length > 0);

		for (const stmt of statements) {
			if (stmt.trim().toUpperCase().startsWith('CREATE') ||
				stmt.trim().toUpperCase().startsWith('CREATE INDEX')) {
				await db.prepare(stmt.trim()).run();
			}
		}

		// 检查当前 schema 版本
		const row = await db.prepare(
			"SELECT value FROM settings WHERE key = 'db_schema_version'"
		).first();

		const currentVersion = row ? parseInt(row.value, 10) : 0;

		if (currentVersion < DB_SCHEMA_VERSION) {
			// 记录迁移
			await db.prepare(
				`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
			).bind('db_schema_version', String(DB_SCHEMA_VERSION)).run();

			// 插入默认设置（如果不存在）
			await db.prepare(
				`INSERT OR IGNORE INTO settings (key, value) VALUES ('login_password', ?)`
			).bind(await hashDefaultPassword()).run();

			console.log(`D1 schema initialized to v${DB_SCHEMA_VERSION}`);
		}

		return true;
	} catch (err) {
		console.error('D1 schema initialization failed:', err);
		throw err;
	}
}

/**
 * 生成默认密码哈希（简单 bcrypt 模拟 — 实际应用需使用 proper hash）
 * 默认密码: admin123
 */
async function hashDefaultPassword() {
	// 使用简单的 SHA-256 哈希作为初始密码（生产环境应使用 bcrypt）
	const encoder = new TextEncoder();
	const data = encoder.encode('admin123');
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 验证密码
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
	if (!storedHash) return false;

	if (storedHash.startsWith('sha256:')) {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const computed = 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return computed === storedHash;
	}

	// 兼容 bcrypt 或其他哈希格式
	return false;
}
