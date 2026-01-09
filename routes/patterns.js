// Patterns 路由

const express = require('express')
const patternLoader = require('../services/patternLoader')
const db = require('../db')

const router = express.Router()

// 获取所有 patterns
router.get('/', (req, res) => {
    try {
        const patterns = patternLoader.loadAllPatterns()
        // 只返回基本信息，不包含完整内容
        const list = patterns.map(p => ({
            name: p.name,
            description: p.description,
            description_zh: p.description_zh,
            category: p.category
        }))
        res.json({ success: true, data: list })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 获取分类统计
router.get('/categories', (req, res) => {
    try {
        const categories = patternLoader.getCategories()
        res.json({ success: true, data: categories })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 搜索 patterns
router.get('/search', (req, res) => {
    try {
        const query = req.query.q || ''
        const patterns = patternLoader.searchPatterns(query)
        const list = patterns.map(p => ({
            name: p.name,
            description: p.description,
            description_zh: p.description_zh,
            category: p.category
        }))
        res.json({ success: true, data: list })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 获取单个 pattern 详情
router.get('/:name', (req, res) => {
    try {
        const pattern = patternLoader.getPattern(req.params.name)
        if (!pattern) {
            return res.status(404).json({ success: false, error: 'Pattern 不存在' })
        }

        // 更新使用统计
        db.prepare(`
            INSERT INTO pattern_stats (pattern_name, use_count, last_used_at)
            VALUES (?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(pattern_name) DO UPDATE SET
                use_count = use_count + 1,
                last_used_at = CURRENT_TIMESTAMP
        `).run(pattern.name)

        res.json({ success: true, data: pattern })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 获取热门 patterns
router.get('/stats/popular', (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT pattern_name, use_count, last_used_at
            FROM pattern_stats
            ORDER BY use_count DESC
            LIMIT 10
        `).all()
        res.json({ success: true, data: stats })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// AI 推荐技能
router.post('/suggest', async (req, res) => {
    try {
        const { query } = req.body
        if (!query || query.trim().length === 0) {
            return res.status(400).json({ success: false, error: '请提供描述' })
        }

        const adapter = require('../services/adapter')
        const patterns = patternLoader.loadAllPatterns()

        // 构建技能列表摘要给 AI
        const skillsSummary = patterns.map(p =>
            `- ${p.name}: ${p.description_zh || p.description}`
        ).join('\n')

        const messages = [
            {
                role: 'system',
                content: `你是一个技能推荐助手。用户会描述他们想要完成的任务，你需要从以下技能列表中推荐最匹配的 3-5 个技能。

可用技能列表：
${skillsSummary}

要求：
1. 只推荐与用户需求最相关的技能
2. 以 JSON 数组格式返回推荐结果，每项包含 name（技能名）和 reason（推荐理由，简短中文）
3. 按匹配度从高到低排序
4. 只输出 JSON，不要其他解释

示例输出：
[{"name": "extract_wisdom", "reason": "适合提取文章核心观点和智慧"}, {"name": "summarize", "reason": "快速总结长文内容"}]`
            },
            { role: 'user', content: query }
        ]

        const response = await adapter.sendRequest(messages)

        // 尝试解析 JSON 响应
        let suggestions = []
        try {
            // 处理可能的 markdown 代码块包裹
            let jsonStr = response.trim()
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
            }
            suggestions = JSON.parse(jsonStr)
        } catch (e) {
            console.error('[AI Suggest Parse Error]', e.message)
            return res.status(500).json({ success: false, error: '无法解析 AI 响应' })
        }

        res.json({ success: true, data: suggestions })

    } catch (e) {
        console.error('[AI Suggest Error]', e)
        res.status(500).json({ success: false, error: e.message })
    }
})

// 智能建议相似技能 (用于搜索无结果时)
router.get('/recommend', (req, res) => {
    try {
        const query = req.query.q || ''
        const suggestions = patternLoader.suggestPatterns(query)
        res.json({ success: true, data: suggestions })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// AI 生成新 Skill 内容
router.post('/generate', async (req, res) => {
    try {
        const { description, referencePattern } = req.body
        if (!description) {
            return res.status(400).json({ success: false, error: '请提供需求描述' })
        }

        const adapter = require('../services/adapter')
        let refContent = ''

        if (referencePattern) {
            const ref = patternLoader.getPattern(referencePattern)
            if (ref) {
                refContent = `参考模式 (${referencePattern}) 的结构：\n${ref.content}\n\n`
            }
        }

        const messages = [
            {
                role: 'system',
                content: `你是一个专业的 Pattern 架构师，专注于编写高质量的 Fabric 风格 Pattern (system.md)。
你的任务是根据用户的需求描述，生成一个功能强大、结构严谨的 Pattern。

生成的 Pattern 必须遵循以下 [标准结构]：
1. # IDENTITY and PURPOSE: 极其详尽地描述 AI 的角色、专家身份和核心职责。
2. Take a step back and think step-by-step... (此行必须原样保留)
3. # GOALS: 罗列 1-3 个核心交付目标。
4. # STEPS: 细化的算法或处理逻辑方案。
5. # OUTPUT INSTRUCTIONS: 格式要求、语调、负面限制。
6. # INPUT: 固定为 "INPUT:"。

要求：
- 使用英文编写 Pattern 正文（因为 AI 对英文指令理解更精准）。
- 语气专业、权威。
- 只输出 Markdown 内容，不要任何解释或开场白。`
            },
            {
                role: 'user',
                content: `${refContent}用户需求描述：${description}\n\n请生成对应的 system.md 内容：`
            }
        ]

        const content = await adapter.sendRequest(messages)
        res.json({ success: true, data: content })

    } catch (e) {
        console.error('[Generate Pattern Error]', e)
        res.status(500).json({ success: false, error: e.message })
    }
})

// 保存生成的 Skill
router.post('/save', (req, res) => {
    try {
        const { name, content, description_zh } = req.body
        if (!name || !content) {
            return res.status(400).json({ success: false, error: '缺少名称或内容' })
        }

        // 格式化名称：小写，空格换下划线，去除非法文件名字符
        // 允许中文和其他 Unicode 字符
        const safeName = name.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 过滤 Windows/Unix 非法文件名字符

        const pattern = patternLoader.savePattern(safeName, content, description_zh)
        res.json({ success: true, data: pattern })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

module.exports = router
