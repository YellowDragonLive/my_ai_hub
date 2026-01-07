// 会话模型

const db = require('../db')

class Conversation {
    constructor(row = {}) {
        this.id = row.id
        this.title = row.title || '新对话'
        this.createdAt = row.created_at
        this.updatedAt = row.updated_at
    }

    // 获取所有会话
    static all() {
        const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all()
        return rows.map(row => new Conversation(row))
    }

    // 根据 ID 获取
    static get(id) {
        const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id)
        return row ? new Conversation(row) : null
    }

    // 创建新会话
    static create(data = {}) {
        const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?)')
        const result = stmt.run(data.title || '新对话')
        return Conversation.get(result.lastInsertRowid)
    }

    // 更新会话标题
    static updateTitle(id, title) {
        db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(title, id)
        return Conversation.get(id)
    }

    // 更新时间戳
    static touch(id) {
        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
    }

    // 删除会话
    static delete(id) {
        db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
    }

    // 搜索会话
    static search(query) {
        const rows = db.prepare(`
            SELECT DISTINCT c.* FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.title LIKE ? OR m.content LIKE ?
            ORDER BY c.updated_at DESC
        `).all(`%${query}%`, `%${query}%`)
        return rows.map(row => new Conversation(row))
    }
}

module.exports = Conversation
