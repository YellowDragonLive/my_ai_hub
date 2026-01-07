// SQLite 数据库初始化

const Database = require('better-sqlite3')
const path = require('path')
const { ensureDir } = require('../utils')
const config = require('../config')

// 确保 db 目录存在
ensureDir(path.dirname(config.dbPath))

// 创建数据库连接
const db = new Database(config.dbPath)

// 启用 WAL 模式提高性能
db.pragma('journal_mode = WAL')

// 初始化数据库表
const initDatabase = () => {
    // API 配置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS api_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vendor TEXT NOT NULL,
            model TEXT NOT NULL,
            api_key TEXT NOT NULL,
            base_url TEXT,
            is_active INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)

    // 会话表
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)

    // 消息表
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    `)

    // Pattern 使用统计表
    db.exec(`
        CREATE TABLE IF NOT EXISTS pattern_stats (
            pattern_name TEXT PRIMARY KEY,
            use_count INTEGER DEFAULT 0,
            last_used_at DATETIME
        )
    `)

    // 全文搜索虚拟表
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content=messages,
            content_rowid=id
        )
    `)

    // 插入默认 API 配置
    const count = db.prepare('SELECT COUNT(*) as cnt FROM api_configs').get()
    if (count.cnt === 0) {
        db.prepare(`
            INSERT INTO api_configs (name, vendor, model, api_key, base_url, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('默认配置', 'openai', config.defaultAI.model, 'pwd', config.defaultAI.baseUrl, 1)
    }

    console.log('[DB] 数据库初始化完成')
}

// 执行初始化
initDatabase()

module.exports = db
