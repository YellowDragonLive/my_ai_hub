// 极客 AI 助手配置文件

const path = require('path')

module.exports = {
    // 会话密钥
    secretKey: 'geek-ai-hub-secret-key',

    // 服务器配置
    server: {
        port: 4000,
        host: '127.0.0.1'
    },

    // 数据库路径
    dbPath: path.join(__dirname, 'db', 'geek-hub.db'),

    // Patterns 目录
    patternsDir: path.join(__dirname, 'patterns'),

    // 默认 AI 配置
    defaultAI: {
        baseUrl: 'http://127.0.0.1:7861/antigravity',
        model: 'gemini-3-flash'
    }
}
