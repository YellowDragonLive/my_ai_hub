// AI 厂商适配器服务

const APIConfig = require('../models/APIConfig')

/**
 * 构建 OpenAI 兼容格式的请求
 */
const buildRequest = (messages, options = {}) => {
    const config = APIConfig.getActive()
    if (!config) {
        throw new Error('未找到激活的 API 配置')
    }

    const endpoint = `${config.baseUrl}/v1/chat/completions`

    const payload = {
        model: config.model,
        messages: messages,
        stream: options.stream || false,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
    }

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
    }

    return { endpoint, requestOptions, payload }
}

/**
 * 发送非流式请求
 */
const sendRequest = async (messages, options = {}) => {
    const { endpoint, requestOptions } = buildRequest(messages, { ...options, stream: false })

    const response = await fetch(endpoint, requestOptions)

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`API 请求失败: ${response.status} - ${errorBody}`)
    }

    const data = await response.json()

    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content
    }

    throw new Error('无效的 API 响应格式')
}

/**
 * 发送流式请求
 */
const sendStreamRequest = async (messages, options = {}) => {
    const { endpoint, requestOptions, payload } = buildRequest(messages, { ...options, stream: true })

    // 更新 payload 为流式
    requestOptions.body = JSON.stringify({ ...payload, stream: true })

    const response = await fetch(endpoint, requestOptions)

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`API 请求失败: ${response.status} - ${errorBody}`)
    }

    return response.body
}

/**
 * 解析 SSE 数据
 */
const parseSSELine = (line) => {
    if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
            return { done: true }
        }
        try {
            const json = JSON.parse(data)
            if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                return { content: json.choices[0].delta.content }
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    return null
}

module.exports = {
    buildRequest,
    sendRequest,
    sendStreamRequest,
    parseSSELine
}
