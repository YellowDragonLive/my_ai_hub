// 极客 AI 助手 - 主入口

const express = require('express')
const bodyParser = require('body-parser')
const session = require('cookie-session')
const path = require('path')

const { log } = require('./utils')
const config = require('./config')

// 初始化数据库
require('./db')

// 引入路由
const configRoutes = require('./routes/config')
const patternsRoutes = require('./routes/patterns')
const chatRoutes = require('./routes/chat')

// 创建 Express 应用
const app = express()

// 解析 JSON 请求体
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Session 配置
app.use(session({
    secret: config.secretKey,
}))

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, 'static')))

// API 路由
app.use('/api/config', configRoutes)
app.use('/api/patterns', patternsRoutes)
app.use('/api', chatRoutes)

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'))
})

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('[Error]', err)
    res.status(500).json({ success: false, error: err.message })
})

// 启动服务器
const run = (port = config.server.port, host = config.server.host) => {
    const server = app.listen(port, host, () => {
        log(`🚀 极客 AI 助手已启动`)
        log(`📍 访问地址: http://${host}:${port}`)
        log(`📚 已加载 Patterns: ${require('./services/patternLoader').loadAllPatterns().length} 个`)
    })
}

if (require.main === module) {
    run()
}

module.exports = app
