// 工具函数

const fs = require('fs')
const path = require('path')

/**
 * 日志函数
 */
const log = (...args) => {
    const now = new Date().toISOString()
    console.log(`[${now}]`, ...args)
}

/**
 * 确保目录存在
 */
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

/**
 * 读取文件内容
 */
const readFile = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf-8')
    } catch (e) {
        return null
    }
}

/**
 * 生成唯一 ID
 */
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

module.exports = {
    log,
    ensureDir,
    readFile,
    generateId
}
