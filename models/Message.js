// 消息模型

const db = require('../db')

class Message {
    constructor(row = {}) {
        this.id = row.id
        this.conversationId = row.conversation_id
        this.role = row.role || 'user'
        this.content = row.content || ''
        this.createdAt = row.created_at
    }

    // 获取会话的所有消息
    static getByConversation(conversationId) {
        const rows = db.prepare(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
        ).all(conversationId)
        return rows.map(row => new Message(row))
    }

    // 创建消息
    static create(data) {
        const stmt = db.prepare(`
            INSERT INTO messages (conversation_id, role, content)
            VALUES (@conversationId, @role, @content)
        `)
        const result = stmt.run({
            conversationId: data.conversationId,
            role: data.role,
            content: data.content
        })

        // 更新全文搜索索引
        db.prepare('INSERT INTO messages_fts(rowid, content) VALUES (?, ?)')
            .run(result.lastInsertRowid, data.content)

        return Message.get(result.lastInsertRowid)
    }

    // 根据 ID 获取
    static get(id) {
        const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
        return row ? new Message(row) : null
    }

    // 全文搜索
    static search(query) {
        const rows = db.prepare(`
            SELECT m.* FROM messages m
            JOIN messages_fts ON m.id = messages_fts.rowid
            WHERE messages_fts MATCH ?
            ORDER BY m.created_at DESC
        `).all(query)
        return rows.map(row => new Message(row))
    }

    // 删除会话的所有消息
    static deleteByConversation(conversationId) {
        // 先删除 FTS 索引
        const ids = db.prepare('SELECT id FROM messages WHERE conversation_id = ?').all(conversationId)
        ids.forEach(({ id }) => {
            db.prepare('DELETE FROM messages_fts WHERE rowid = ?').run(id)
        })
        // 删除消息
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
    }
}

module.exports = Message
