// 对话路由

const express = require('express')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const adapter = require('../services/adapter')
const patternLoader = require('../services/patternLoader')

const router = express.Router()

// 获取所有会话
router.get('/conversations', (req, res) => {
    try {
        const conversations = Conversation.all()
        res.json({ success: true, data: conversations })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 创建新会话
router.post('/conversations', (req, res) => {
    try {
        const conversation = Conversation.create(req.body)
        res.json({ success: true, data: conversation })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 获取会话消息
router.get('/conversations/:id/messages', (req, res) => {
    try {
        const messages = Message.getByConversation(req.params.id)
        res.json({ success: true, data: messages })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 更新会话标题
router.put('/conversations/:id', (req, res) => {
    try {
        const conversation = Conversation.updateTitle(req.params.id, req.body.title)
        res.json({ success: true, data: conversation })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 删除会话
router.delete('/conversations/:id', (req, res) => {
    try {
        Message.deleteByConversation(req.params.id)
        Conversation.delete(req.params.id)
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 搜索会话和消息
router.get('/search', (req, res) => {
    try {
        const query = req.query.q || ''
        const conversations = Conversation.search(query)
        res.json({ success: true, data: conversations })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 发送消息（流式响应）
router.post('/chat', async (req, res) => {
    try {
        const { conversationId, content, patternName } = req.body

        // 获取或创建会话
        let convId = conversationId
        if (!convId) {
            const conv = Conversation.create({ title: content.slice(0, 50) })
            convId = conv.id
        }

        // 构建消息列表
        const messages = []

        // 加载全局 System Prompt
        const fs = require('fs')
        const path = require('path')
        const globalPromptPath = path.join(__dirname, '..', 'global_system_prompt.md')
        let globalSystemPrompt = ''
        try {
            if (fs.existsSync(globalPromptPath)) {
                globalSystemPrompt = fs.readFileSync(globalPromptPath, 'utf-8').trim()
            }
        } catch (e) {
            console.log('[Chat] 无法加载全局 system prompt:', e.message)
        }

        // 如果指定了 pattern，添加系统消息（全局 prompt + pattern 内容）
        if (patternName) {
            const pattern = patternLoader.getPattern(patternName)
            if (pattern) {
                const combinedPrompt = globalSystemPrompt
                    ? `${globalSystemPrompt}\n\n---\n\n${pattern.content}`
                    : pattern.content
                messages.push({ role: 'system', content: combinedPrompt })
            }
        } else if (globalSystemPrompt) {
            // 没有 pattern 时，单独使用全局 prompt
            messages.push({ role: 'system', content: globalSystemPrompt })
        }

        // 获取历史消息
        const history = Message.getByConversation(convId)
        history.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content })
        })

        // 添加当前用户消息
        messages.push({ role: 'user', content })

        // 保存用户消息
        Message.create({ conversationId: convId, role: 'user', content })

        // 更新会话时间
        Conversation.touch(convId)

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        // 发送会话 ID
        res.write(`data: ${JSON.stringify({ type: 'conversation', id: convId })}\n\n`)

        // 发送流式请求
        const stream = await adapter.sendStreamRequest(messages)
        const reader = stream.getReader()
        const decoder = new TextDecoder()

        let fullResponse = ''
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() // 保留不完整的行

            for (const line of lines) {
                const parsed = adapter.parseSSELine(line)
                if (parsed) {
                    if (parsed.done) {
                        break
                    }
                    if (parsed.content) {
                        fullResponse += parsed.content
                        res.write(`data: ${JSON.stringify({ type: 'content', content: parsed.content })}\n\n`)
                    }
                }
            }
        }

        // 保存 AI 响应
        if (fullResponse) {
            Message.create({ conversationId: convId, role: 'assistant', content: fullResponse })
        }

        // 发送完成信号
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        res.end()

    } catch (e) {
        console.error('[Chat Error]', e)
        res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`)
        res.end()
    }
})

// Prompt 增强（魔法棒功能）
router.post('/enhance', async (req, res) => {
    try {
        const { content } = req.body

        const messages = [
            {
                role: 'system',
                content: `你是一个 Prompt 优化专家。用户会给你一个简短的描述或问题，你需要将其优化为一个更详细、更有效的 Prompt。
要求：
1. 保持用户的原始意图
2. 添加必要的上下文和约束
3. 使输出更加结构化
4. 直接输出优化后的 Prompt，不要解释`
            },
            { role: 'user', content }
        ]

        const enhanced = await adapter.sendRequest(messages)
        res.json({ success: true, data: enhanced })

    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

module.exports = router
