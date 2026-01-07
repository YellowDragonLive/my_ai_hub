// API 配置路由

const express = require('express')
const APIConfig = require('../models/APIConfig')

const router = express.Router()

// 获取所有配置
router.get('/', (req, res) => {
    try {
        const configs = APIConfig.all()
        res.json({ success: true, data: configs })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 获取当前激活配置
router.get('/active', (req, res) => {
    try {
        const config = APIConfig.getActive()
        res.json({ success: true, data: config })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 创建新配置
router.post('/', (req, res) => {
    try {
        const config = APIConfig.create(req.body)
        res.json({ success: true, data: config })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 更新配置
router.put('/:id', (req, res) => {
    try {
        const config = APIConfig.update(req.params.id, req.body)
        res.json({ success: true, data: config })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 设置激活配置
router.post('/:id/activate', (req, res) => {
    try {
        const config = APIConfig.setActive(req.params.id)
        res.json({ success: true, data: config })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// 删除配置
router.delete('/:id', (req, res) => {
    try {
        APIConfig.delete(req.params.id)
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ success: false, error: e.message })
    }
})

module.exports = router
