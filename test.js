// main.js

// --- ⚠️ 请在这里填写你的配置 ---
let PROXY_URL = ""; // 替换为你的反向代理地址 (例如 SillyTavern-Extras 的地址)
let PROXY_PASSWORD = ""; // 替换为你的反向代理密码 (在 config.yaml 中设置的)
let modelToUse = "";

// --- 配置结束 ---
let base_url = "http://127.0.0.1:7861/antigravity"
let api_key = "pwd"
let modelName = "gemini-3-flash"
let userInput = "你好,请求在 1 次尝试后失败。 最后一次错误详情: { error: { code: 404, message: Requested entity was not found., status: NOT_FOUND } } ";


PROXY_URL = base_url
PROXY_PASSWORD = api_key
modelToUse = modelName
userInput = "最近有中国有啥ai创作大赛"


// 关键: SillyTavern 客户端 (以及我们的脚本) 会向代理发送一个 *OpenAI 格式* 的请求。
// 代理服务器 (SillyTavern-Extras) 负责将其翻译成 Google API 格式。
// 这就是为什么我们访问的是 /v1/chat/completions
const apiEndpoint = `${PROXY_URL}/v1/chat/completions`;
console.log(apiEndpoint, "log 1");


// 构造一个 OpenAI 格式的 payload
const payload = {
    model: modelToUse, // 代理会根据这个模型名称路由到正确的 API (Gemini)
    messages: [
        {
            role: "user",
            content: userInput
        }
    ],
    stream: false, // 为了简单演示，我们不使用流式传输
    temperature: 0.7,
    max_tokens: 2048
};

// 设置请求选项
const options = {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        // 这是反向代理的身份验证，不是 Google API 密钥
        "Authorization": `Bearer ${PROXY_PASSWORD}`
    },
    body: JSON.stringify(payload)
};

// 异步执行请求
async function fetchFromProxy() {
    console.log(`[请求] 正在向 ${apiEndpoint} 发送...`);
    console.log(`[请求] 模型: ${modelToUse}`);

    try {
        const response = await fetch(apiEndpoint, options);

        // 检查 HTTP 响应是否成功
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[错误] HTTP 状态码: ${response.status} ${response.statusText}`);
            console.error("[错误] 响应详情:", errorBody);

            if (response.status === 401) {
                console.error(">>> 提醒: 收到 401 (Unauthorized) 错误。请检查你的 PROXY_PASSWORD 是否正确。");
            } else if (response.status === 404) {
                console.error(">>> 提醒: 收到 404 (Not Found) 错误。请检查你的 PROXY_URL 和路径 /v1/chat/completions 是否正确。");
            }
            return;
        }

        // 解析 JSON 响应 (代理会将其转换回 OpenAI 格式)
        const data = await response.json();

        // 提取并打印 AI 的回复
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content;
            console.log("\n--- 🤖 AI 响应 ---");
            console.log(aiResponse);
        } else {
            console.error("[错误] 响应中未找到有效的 'choices' 数组。");
            console.log("[调试] 完整响应:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("[严重错误] 请求执行失败:", error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error(`>>> 提醒: 连接被拒绝。请确保你的反向代理正在 ${PROXY_URL} 上运行。`);
        }
    }
}

// 运行函数
fetchFromProxy();