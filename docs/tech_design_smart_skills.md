# 技术实现方案：智能 Skill 生成 (Smart Skill Generation)

## 0. 设计目标
当用户在技能库中找不到合适技能时，利用 AI 生成新的 Pattern 并持久化到本地，实现技能库的自我扩充与复用。

## 1. 后端实现方案 (Node.js)

### 1.1 语义匹配增强 (`services/patternLoader.js`)
*   **算法选择**: 鉴于本地环境不引入复杂的 Embedding，使用基于关键字权重和拼音匹配的模糊搜索。
*   **逻辑**: 
    - 提取搜索词的关键词。
    - 对 Pattern 的 `name` (权重 3), `description_zh` (权重 2), `category` (权重 1) 进行匹配评分。
    - 返回评分最高的 3 个 Pattern 作为推荐参考。

### 1.2 模式持久化与热加载
*   **方法**: `patternLoader.refreshCache()`。
*   **触发**: 在保存新的 Pattern 文件夹至 `patterns/` 目录后，调用该方法重新执行文件扫描，确保前端无需重启即可看到新技能。

### 1.3 生成 API 设计 (`routes/patterns.js`)
*   **`POST /api/patterns/generate`**:
    - 输入: `description` (用户需求), `referencePattern` (参考模式名称)。
    - 逻辑: 
        1. 读取参考模式的 `system.md` 作为结构参考。
        2. 调用 AI，使用专用的 "Pattern Architect" 系统提示词生成新 Pattern 的 `system.md`。
    - 返回: 生成的 Markdown 内容。

*   **`POST /api/patterns/save`**:
    - 输入: `name`, `content` (Markdown)。
    - 逻辑: 
        1. 验证文件夹是否已存在。
        2. 创建目录 `patterns/<name>`。
        3. 写入 `system.md`。
        4. 更新 `pattern_translations_zh.json` (可选，AI 可同时生成翻译)。
        5. 调用热加载。

## 2. Pattern 标准结构模板

为了确保生成的 Pattern 具有高质量和可读性，强制执行以下结构：

```markdown
# IDENTITY and PURPOSE
[此处定义 AI 的角色身份和核心目标。使用"You are..."。描述需极其详尽。]

Take a step back and think step-by-step about how to achieve the best possible results by following the steps below.

# GOALS
[罗列 1-3 个核心交付目标]

# STEPS
[详细的算法/处理步骤，以 "-" 开头]

# OUTPUT INSTRUCTIONS
[具体的格式要求、语调风格、负面禁忌等]

# INPUT
INPUT:
```

## 3. 前端交互方案 (Vanilla JS)

### 3.1 搜索空状态交互
- 当 `patternList` 搜索为空时，底部显示 "未找到匹配项？试试 AI 智能生成"。
- 点击弹出 `GenerateSkillModal`。

### 3.2 生成流程组件
- **Step 1: 描述需求**: 用户输入文字描述（如 "帮我写一个短视频分镜脚本"）。
- **Step 2: 参考模式**: 系统自动勾选推荐的 Pattern。
- **Step 3: AI 生成预览**: 显示生成的 Markdown，支持手动修改。
- **Step 4: 确认保存**: 确认标题，点击保存。

## 4. 自动化补丁 (针对 Windows 路径)
- 确保文件夹创建路径使用 `path.join` 且考虑反斜杠兼容。
- 保证文件写入编码为 `UTF-8`，避免中文乱码。
