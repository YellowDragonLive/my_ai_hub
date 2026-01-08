// Pattern 加载器服务

const fs = require('fs')
const path = require('path')
const config = require('../config')

// 缓存 patterns 数据
let patternsCache = null
let patternDescriptions = {}
let patternTranslationsZh = {}

/**
 * 加载 pattern_explanations.md 中的描述
 */
const loadDescriptions = () => {
    const filePath = path.join(config.patternsDir, 'pattern_explanations.md')
    const transPath = path.join(config.patternsDir, 'pattern_translations_zh.json')

    // 加载英文描述
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const lines = content.split('\n')
            lines.forEach(line => {
                const match = line.match(/^\d+\.\s+\*\*(\w+)\*\*:\s*(.+)$/)
                if (match) {
                    patternDescriptions[match[1]] = match[2].trim()
                }
            })
        }
    } catch (e) {
        console.log('[PatternLoader] 无法加载英文描述:', e.message)
    }

    // 加载中文翻译
    try {
        if (fs.existsSync(transPath)) {
            const content = fs.readFileSync(transPath, 'utf-8')
            patternTranslationsZh = JSON.parse(content)
        }
    } catch (e) {
        console.log('[PatternLoader] 无法加载中文翻译:', e.message)
    }
}

/**
 * 加载单个 pattern
 */
const loadPattern = (patternName) => {
    const patternDir = path.join(config.patternsDir, patternName)
    const systemPath = path.join(patternDir, 'system.md')

    if (!fs.existsSync(systemPath)) {
        return null
    }

    try {
        const content = fs.readFileSync(systemPath, 'utf-8')
        return {
            name: patternName,
            description: patternDescriptions[patternName] || '',
            description_zh: patternTranslationsZh[patternName] || '',
            content: content,
            category: categorizePattern(patternName)
        }
    } catch (e) {
        return null
    }
}

/**
 * 根据名称前缀分类 pattern
 */
const categorizePattern = (name) => {
    if (name.startsWith('analyze_')) return '分析'
    if (name.startsWith('create_')) return '创建'
    if (name.startsWith('extract_')) return '提取'
    if (name.startsWith('summarize_')) return '总结'
    if (name.startsWith('write_')) return '写作'
    if (name.startsWith('improve_')) return '优化'
    if (name.startsWith('explain_')) return '解释'
    if (name.startsWith('t_')) return '个人'
    return '其他'
}

/**
 * 加载所有 patterns
 */
const loadAllPatterns = () => {
    if (patternsCache) {
        return patternsCache
    }

    loadDescriptions()

    const patterns = []
    const dirs = fs.readdirSync(config.patternsDir)

    dirs.forEach(name => {
        const fullPath = path.join(config.patternsDir, name)
        if (fs.statSync(fullPath).isDirectory()) {
            const pattern = loadPattern(name)
            if (pattern) {
                patterns.push(pattern)
            }
        }
    })

    // 按名称排序
    patterns.sort((a, b) => a.name.localeCompare(b.name))

    patternsCache = patterns
    console.log(`[PatternLoader] 已加载 ${patterns.length} 个 patterns`)

    return patterns
}

/**
 * 搜索 patterns (硬匹配)
 */
const searchPatterns = (query) => {
    const patterns = loadAllPatterns()
    const q = query.toLowerCase()

    return patterns.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.description_zh && p.description_zh.includes(q))
    )
}

/**
 * 智能建议 patterns (基于权重评分)
 */
const suggestPatterns = (query, limit = 3) => {
    const patterns = loadAllPatterns()
    const q = query.toLowerCase()
    const keywords = q.split(/\s+/).filter(k => k.length > 0)

    if (keywords.length === 0) return []

    const scored = patterns.map(p => {
        let score = 0
        keywords.forEach(k => {
            if (p.name.toLowerCase().includes(k)) score += 10
            if (p.description.toLowerCase().includes(k)) score += 5
            if (p.description_zh && p.description_zh.includes(k)) score += 5
            if (p.category.toLowerCase().includes(k)) score += 2
        })
        return { ...p, score }
    })

    return scored
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
}

/**
 * 获取单个 pattern
 */
const getPattern = (name) => {
    const patterns = loadAllPatterns()
    return patterns.find(p => p.name === name)
}

/**
 * 获取分类列表
 */
const getCategories = () => {
    const patterns = loadAllPatterns()
    const categories = {}

    patterns.forEach(p => {
        if (!categories[p.category]) {
            categories[p.category] = 0
        }
        categories[p.category]++
    })

    return categories
}

/**
 * 清除缓存并重新加载
 */
const clearCache = () => {
    patternsCache = null
    patternDescriptions = {}
    patternTranslationsZh = {}
    loadAllPatterns()
}

/**
 * 保存新的 Pattern
 */
const savePattern = (name, content, description_zh = '') => {
    const patternDir = path.join(config.patternsDir, name)

    // 创建目录
    if (!fs.existsSync(patternDir)) {
        fs.mkdirSync(patternDir, { recursive: true })
    }

    // 写入 system.md
    fs.writeFileSync(path.join(patternDir, 'system.md'), content, 'utf-8')

    // 同步更新中文翻译文件
    if (description_zh) {
        const transPath = path.join(config.patternsDir, 'pattern_translations_zh.json')
        try {
            let translations = {}
            if (fs.existsSync(transPath)) {
                translations = JSON.parse(fs.readFileSync(transPath, 'utf-8'))
            }
            translations[name] = description_zh
            fs.writeFileSync(transPath, JSON.stringify(translations, null, 2), 'utf-8')
        } catch (e) {
            console.error('[PatternLoader] 无法更新中文翻译:', e.message)
        }
    }

    // 清除缓存以触发热加载
    clearCache()

    return loadPattern(name)
}

module.exports = {
    loadAllPatterns,
    searchPatterns,
    suggestPatterns,
    getPattern,
    getCategories,
    clearCache,
    savePattern
}
