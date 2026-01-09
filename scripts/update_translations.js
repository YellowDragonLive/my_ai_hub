const fs = require('fs');
const path = require('path');

/**
 * 批量更新翻译文件
 * @param {Object} updates - 键值对，键为模式名，值为包含 description 和 keywords 的对象
 */
function updateTranslations(updates) {
    const transPath = path.join(__dirname, '../patterns/pattern_translations_zh.json');

    if (!fs.existsSync(transPath)) {
        console.error('错误: 找不到翻译文件:', transPath);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(transPath, 'utf-8');
        const translations = JSON.parse(content);

        Object.keys(updates).forEach(key => {
            const update = updates[key];
            if (translations[key]) {
                // 如果原来是字符串，转换为对象
                if (typeof translations[key] === 'string') {
                    translations[key] = {
                        description: update.description || translations[key],
                        keywords: update.keywords || []
                    };
                } else {
                    // 如果已经是对象，合并
                    translations[key].description = update.description || translations[key].description;
                    translations[key].keywords = Array.from(new Set([...(translations[key].keywords || []), ...(update.keywords || [])]));
                }
                console.log(`[OK] 更新了键: ${key}`);
            } else {
                console.log(`[WARN] 跳过未知键: ${key}`);
            }
        });

        fs.writeFileSync(transPath, JSON.stringify(translations, null, 2), 'utf-8');
        console.log('\n[成功] 翻译文件已保存。');
    } catch (e) {
        console.error('更新失败:', e.message);
    }
}

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length === 1) {
    const arg = args[0];
    let updates;

    // 尝试作为文件路径读取
    const filePath = path.resolve(arg);
    if (fs.existsSync(filePath) && filePath.endsWith('.json')) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            updates = JSON.parse(fileContent);
            console.log(`[INFO] 从文件读取更新数据: ${filePath}`);
        } catch (e) {
            console.error('文件读取或解析失败:', e.message);
            process.exit(1);
        }
    } else {
        // 尝试作为 JSON 字符串解析
        try {
            updates = JSON.parse(arg);
        } catch (e) {
            console.error('参数解析失败，请输入有效的 JSON 字符串或 JSON 文件路径。');
            process.exit(1);
        }
    }

    updateTranslations(updates);
} else {
    console.log('使用方法: node scripts/update_translations.js <JSON_FILE_PATH>');
    console.log('       或: node scripts/update_translations.js \'<JSON_STRING>\'');
}
