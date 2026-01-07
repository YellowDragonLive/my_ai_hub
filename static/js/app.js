// 极客 AI 助手前端逻辑

class App {
    constructor() {
        this.currentConversationId = null;
        this.currentPattern = null;
        this.patterns = [];
        this.isTyping = false;
        this.searchTimeout = null;

        this.init();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadConfigs();
        await this.loadConversations();
        await this.loadPatterns();
    }

    cacheElements() {
        // 核心元素
        this.convList = document.getElementById('conversationList');
        this.messagesCont = document.getElementById('messagesContainer');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.msgInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.enhanceBtn = document.getElementById('enhanceBtn');
        this.suggestBtn = document.getElementById('suggestBtn');
        this.patternIndicator = document.getElementById('patternIndicator');

        // Pattern 弹窗
        this.patternPopup = document.getElementById('patternPopup');
        this.patternListCont = document.getElementById('patternList');

        // 设置弹窗相关
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.configListCont = document.getElementById('configList');
        this.addConfigBtn = document.getElementById('addConfigBtn');
        this.configForm = document.getElementById('configForm');
        this.saveConfigBtn = document.getElementById('saveConfigBtn');
        this.cancelConfigBtn = document.getElementById('cancelConfigBtn');
    }

    bindEvents() {
        // 发送消息
        this.sendBtn.onclick = () => this.sendMessage();
        this.msgInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            if (e.key === '/') {
                this.showPatternPopup();
            }
        };

        // 新对话
        this.newChatBtn.onclick = () => this.startNewChat();

        // 搜索会话
        this.searchInput = document.getElementById('searchInput');
        this.searchInput.oninput = (e) => this.debounceSearch(e.target.value);

        // Pattern 搜索逻辑
        this.msgInput.oninput = (e) => {
            const val = e.target.value;
            if (val === '/') {
                this.showPatternPopup();
            } else if (!val.startsWith('/')) {
                this.hidePatternPopup();
            } else {
                this.filterPatterns(val.substring(1));
            }
        };

        // 增强 Prompt
        this.enhanceBtn.onclick = () => this.enhancePrompt();

        // AI 推荐技能
        this.suggestBtn.onclick = () => this.suggestPatterns();

        // 设置弹窗
        this.settingsBtn.onclick = () => this.openSettings();
        this.closeSettingsBtn.onclick = () => this.closeSettings();
        this.addConfigBtn.onclick = () => this.showConfigForm();
        this.cancelConfigBtn.onclick = () => this.hideConfigForm();
        this.saveConfigBtn.onclick = () => this.saveConfig();

        // 点击外部隐藏
        window.onclick = (e) => {
            if (e.target === this.settingsModal) this.closeSettings();
            if (!this.patternPopup.contains(e.target) && e.target !== this.msgInput) {
                this.hidePatternPopup();
            }
        };
    }

    // --- 数据加载 ---

    async loadConfigs() {
        const res = await fetch('/api/config');
        const json = await res.json();
        if (json.success) {
            this.modelSelect.innerHTML = json.data.map(c =>
                `<option value="${c.id}" ${c.isActive ? 'selected' : ''}>${c.name} (${c.model})</option>`
            ).join('');

            // 绑定切换事件
            this.modelSelect.onchange = (e) => this.switchConfig(e.target.value);
        }
    }

    async loadConversations() {
        const res = await fetch('/api/conversations');
        const json = await res.json();
        if (json.success) {
            this.renderConversationList(json.data);
        }
    }

    async loadPatterns() {
        const res = await fetch('/api/patterns');
        const json = await res.json();
        if (json.success) {
            this.patterns = json.data;
            this.renderPatternList(this.patterns);
        }
    }

    // --- 搜索逻辑 ---

    debounceSearch(query) {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.performSearch(query), 300);
    }

    async performSearch(query) {
        if (!query.trim()) {
            this.loadConversations();
            return;
        }
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) {
            this.renderConversationList(json.data);
        }
    }

    // --- UI 渲染 ---

    renderConversationList(convs) {
        this.convList.innerHTML = convs.map(c => `
            <div class="conv-item ${c.id === this.currentConversationId ? 'active' : ''}" data-id="${c.id}">
                ${c.title}
            </div>
        `).join('');

        this.convList.querySelectorAll('.conv-item').forEach(el => {
            el.onclick = () => this.selectConversation(el.dataset.id);
        });
    }

    renderPatternList(patterns) {
        this.patternListCont.innerHTML = patterns.map(p => {
            const desc = p.description_zh || p.description;
            const subtitle = p.description_zh ? p.description : '';
            return `
                <div class="pattern-item" data-name="${p.name}">
                    <div class="pattern-name">${p.name} <span class="pattern-category">${p.category}</span></div>
                    <div class="pattern-desc">${desc}</div>
                    ${subtitle ? `<div class="pattern-desc-en">${subtitle}</div>` : ''}
                </div>
            `;
        }).join('');

        this.patternListCont.querySelectorAll('.pattern-item').forEach(el => {
            el.onclick = () => this.selectPattern(el.dataset.name);
        });
    }

    addMessage(role, content, isStreaming = false) {
        if (this.welcomeScreen.style.display !== 'none') {
            this.welcomeScreen.style.display = 'none';
        }

        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `
            <div class="message-label">${role === 'user' ? 'You' : 'Claude'}</div>
            <div class="content">${content}</div>
        `;
        this.messagesCont.appendChild(div);
        this.messagesCont.scrollTop = this.messagesCont.scrollHeight;

        return div.querySelector('.content');
    }

    // --- 业务逻辑 ---

    async selectConversation(id) {
        this.currentConversationId = parseInt(id);
        this.renderConversationList(Array.from(this.convList.children).map(el => ({
            id: parseInt(el.dataset.id),
            title: el.innerText.trim()
        })));

        this.messagesCont.innerHTML = '';
        const res = await fetch(`/api/conversations/${id}/messages`);
        const json = await res.json();
        if (json.success) {
            json.data.forEach(msg => this.addMessage(msg.role, msg.content));
        }
    }

    startNewChat() {
        this.currentConversationId = null;
        this.currentPattern = null;
        this.patternIndicator.innerText = '';
        this.messagesCont.innerHTML = '';
        this.welcomeScreen.style.display = 'block';
        this.msgInput.value = '';
        this.msgInput.focus();
    }

    async sendMessage() {
        const text = this.msgInput.value.trim();
        if (!text || this.isTyping) return;

        this.msgInput.value = '';
        this.addMessage('user', text);
        this.isTyping = true;
        this.hidePatternPopup();

        const responseEl = this.addMessage('assistant', '', true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    content: text,
                    patternName: this.currentPattern
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        if (data.type === 'content') {
                            responseEl.innerText += data.content;
                        } else if (data.type === 'conversation') {
                            this.currentConversationId = data.id;
                        }
                    }
                }
                this.messagesCont.scrollTop = this.messagesCont.scrollHeight;
            }

            this.loadConversations(); // 刷新列表
        } catch (e) {
            responseEl.innerText = '错误: ' + e.message;
        } finally {
            this.isTyping = false;
        }
    }

    async enhancePrompt() {
        const text = this.msgInput.value.trim();
        if (!text) return;

        this.enhanceBtn.innerText = '⏳';
        try {
            const res = await fetch('/api/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text })
            });
            const json = await res.json();
            if (json.success) {
                this.msgInput.value = json.data;
            }
        } finally {
            this.enhanceBtn.innerText = '✨';
        }
    }

    // --- Pattern 管理 ---

    showPatternPopup() {
        this.patternPopup.style.display = 'block';
        this.filterPatterns('');
    }

    hidePatternPopup() {
        this.patternPopup.style.display = 'none';
    }

    filterPatterns(query) {
        const q = query.toLowerCase();
        const filtered = this.patterns.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.description_zh && p.description_zh.includes(q))
        );
        this.renderPatternList(filtered);
    }

    selectPattern(name) {
        this.currentPattern = name;
        this.patternIndicator.innerText = `技能: ${name}`;
        this.msgInput.value = '';
        this.msgInput.focus();
        this.hidePatternPopup();
    }

    // --- AI 技能推荐 ---

    async suggestPatterns() {
        const text = this.msgInput.value.trim();
        if (!text) {
            alert('请先输入任务描述，AI 将帮您推荐最合适的技能');
            return;
        }

        this.suggestBtn.innerText = '⏳';
        try {
            const res = await fetch('/api/patterns/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text })
            });
            const json = await res.json();

            if (json.success && json.data.length > 0) {
                // 显示推荐结果在 pattern popup 中
                this.showSuggestionResults(json.data);
            } else {
                alert('未找到匹配的技能，请尝试更具体的描述');
            }
        } catch (e) {
            alert('推荐失败: ' + e.message);
        } finally {
            this.suggestBtn.innerText = '🎯';
        }
    }

    showSuggestionResults(suggestions) {
        this.patternListCont.innerHTML = suggestions.map(s => {
            const pattern = this.patterns.find(p => p.name === s.name);
            const desc = pattern ? (pattern.description_zh || pattern.description) : s.reason;
            return `
                <div class="pattern-item suggested" data-name="${s.name}">
                    <div class="pattern-name">${s.name} <span class="pattern-category">推荐</span></div>
                    <div class="pattern-desc">${desc}</div>
                    <div class="pattern-reason">💡 ${s.reason}</div>
                </div>
            `;
        }).join('');

        this.patternListCont.querySelectorAll('.pattern-item').forEach(el => {
            el.onclick = () => this.selectPattern(el.dataset.name);
        });

        this.patternPopup.style.display = 'block';
    }

    // --- 设置相关 ---

    openSettings() { this.settingsModal.style.display = 'flex'; this.renderConfigList(); }
    closeSettings() { this.settingsModal.style.display = 'none'; this.hideConfigForm(); }

    async renderConfigList() {
        const res = await fetch('/api/config');
        const json = await res.json();
        if (json.success) {
            this.configListCont.innerHTML = json.data.map(c => `
                <div class="config-item ${c.isActive ? 'active' : ''}">
                    <span>${c.name} (${c.model})</span>
                    <button onclick="app.activateConfig(${c.id})">${c.isActive ? '当前' : '激活'}</button>
                    <button onclick="app.deleteConfig(${c.id})">删除</button>
                </div>
            `).join('');
        }
    }

    showConfigForm() { this.configForm.style.display = 'block'; }
    hideConfigForm() { this.configForm.style.display = 'none'; }

    async saveConfig() {
        const data = {
            name: document.getElementById('configName').value,
            vendor: document.getElementById('configVendor').value,
            model: document.getElementById('configModel').value,
            apiKey: document.getElementById('configApiKey').value,
            baseUrl: document.getElementById('configBaseUrl').value
        };
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            this.hideConfigForm();
            this.renderConfigList();
            this.loadConfigs();
        }
    }

    async activateConfig(id) {
        await fetch(`/api/config/${id}/activate`, { method: 'POST' });
        this.renderConfigList();
        this.loadConfigs();
    }

    async deleteConfig(id) {
        if (confirm('确认删除？')) {
            await fetch(`/api/config/${id}`, { method: 'DELETE' });
            this.renderConfigList();
            this.loadConfigs();
        }
    }

    async switchConfig(id) {
        await fetch(`/api/config/${id}/activate`, { method: 'POST' });
    }
}

const app = new App();
window.app = app; // 暴露给 HTML 里的 onclick
