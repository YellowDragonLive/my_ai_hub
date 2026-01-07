// API 配置模型

const db = require('../db')

class APIConfig {
    constructor(row = {}) {
        this.id = row.id
        this.name = row.name || ''
        this.vendor = row.vendor || 'openai'
        this.model = row.model || ''
        this.apiKey = row.api_key || ''
        this.baseUrl = row.base_url || ''
        this.isActive = row.is_active || 0
        this.createdAt = row.created_at
    }

    // 获取所有配置
    static all() {
        const rows = db.prepare('SELECT * FROM api_configs ORDER BY created_at DESC').all()
        return rows.map(row => new APIConfig(row))
    }

    // 获取当前激活配置
    static getActive() {
        const row = db.prepare('SELECT * FROM api_configs WHERE is_active = 1').get()
        return row ? new APIConfig(row) : null
    }

    // 根据 ID 获取
    static get(id) {
        const row = db.prepare('SELECT * FROM api_configs WHERE id = ?').get(id)
        return row ? new APIConfig(row) : null
    }

    // 创建新配置
    static create(data) {
        const stmt = db.prepare(`
            INSERT INTO api_configs (name, vendor, model, api_key, base_url, is_active)
            VALUES (@name, @vendor, @model, @apiKey, @baseUrl, @isActive)
        `)
        const result = stmt.run({
            name: data.name,
            vendor: data.vendor || 'openai',
            model: data.model,
            apiKey: data.apiKey,
            baseUrl: data.baseUrl || '',
            isActive: data.isActive || 0
        })
        return APIConfig.get(result.lastInsertRowid)
    }

    // 更新配置
    static update(id, data) {
        const stmt = db.prepare(`
            UPDATE api_configs 
            SET name = @name, vendor = @vendor, model = @model, 
                api_key = @apiKey, base_url = @baseUrl
            WHERE id = @id
        `)
        stmt.run({ id, ...data })
        return APIConfig.get(id)
    }

    // 设置激活配置
    static setActive(id) {
        db.prepare('UPDATE api_configs SET is_active = 0').run()
        db.prepare('UPDATE api_configs SET is_active = 1 WHERE id = ?').run(id)
        return APIConfig.get(id)
    }

    // 删除配置
    static delete(id) {
        db.prepare('DELETE FROM api_configs WHERE id = ?').run(id)
    }

    // 转换为 API 请求格式
    toRequestConfig() {
        return {
            baseUrl: this.baseUrl,
            apiKey: this.apiKey,
            model: this.model
        }
    }
}

module.exports = APIConfig
