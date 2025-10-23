# 调试指南 / Debug Guide

## 🔍 问题：格子里没有显示日记内容

### 快速检查清单 / Quick Checklist

1. **日记文件是否存在？**
   ```
   检查路径：YourVault/Diary/2025-10-09.md
   ```

2. **文件名格式是否正确？**
   ```
   设置中的格式：YYYY-MM-DD
   文件名应该是：2025-10-09.md
   ```

3. **文件是否有内容？**
   ```
   打开文件查看是否有文本内容
   ```

4. **插件是否正确构建？**
   ```bash
   npm run dev
   ```

5. **Obsidian 是否重新加载？**
   ```
   Ctrl+R (Windows/Linux)
   Cmd+R (macOS)
   ```

---

## 🛠️ 详细调试步骤 / Detailed Debug Steps

### 步骤 1: 检查文件路径和格式

**问题：** 文件路径或日期格式不匹配

**解决方法：**

1. 打开插件设置
2. 检查 "Diary Folder" 设置
3. 检查 "Date Format" 设置

**示例：**
```
设置：
- Diary Folder: Diary
- Date Format: YYYY-MM-DD

文件应该在：
YourVault/Diary/2025-10-09.md
```

### 步骤 2: 创建测试文件

在你的 vault 中创建测试文件：

**文件：`Diary/2025-10-09.md`**
```markdown
# 2025-10-09

这是测试内容。

## 列表测试
- 项目 1
- 项目 2
- 项目 3

## 段落测试
这是一段文字，用来测试 Markdown 渲染是否正常工作。
```

### 步骤 3: 打开浏览器控制台

**操作：**
1. 在 Obsidian 中按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS)
2. 切换到 Console 标签
3. 查看是否有红色错误信息

**常见错误：**

```javascript
// 错误 1: 文件未找到
Error: File not found

// 错误 2: 日期格式错误
Invalid date format

// 错误 3: Markdown 渲染失败
Cannot read property 'renderMarkdown'
```

### 步骤 4: 检查数据是否加载

**在控制台中运行：**

```javascript
// 检查月份数据
console.log('Months:', this.months);

// 检查是否有文件
this.months.forEach(m => {
  m.days.forEach(d => {
    if (d.file) {
      console.log('Found file:', d.date.format('YYYY-MM-DD'), d.file.path);
    }
  });
});
```

### 步骤 5: 检查 Markdown 渲染

**测试步骤：**

1. 打开日历
2. 查看 DOM 结构
3. 检查 `.calendar-day-content` 元素是否有内容

**使用浏览器开发者工具：**
```
1. 右键点击一个日历格子
2. 选择 "检查元素" / "Inspect"
3. 查找 class="calendar-day-content markdown-rendered"
4. 检查这个 div 内部是否有渲染的 HTML
```

---

## 🐛 常见问题和解决方案 / Common Issues

### 问题 1: 文件夹不存在

**症状：** 所有格子都是空的

**解决：**
```bash
# 在 vault 中创建 Diary 文件夹
mkdir Diary
```

或者在 Obsidian 中手动创建文件夹。

### 问题 2: 日期格式不匹配

**症状：** 文件存在但不显示内容

**解决：**
检查文件名格式是否与设置匹配：

| 设置格式 | 文件名应该是 |
|---------|------------|
| YYYY-MM-DD | 2025-10-09.md |
| YYYYMMDD | 20251009.md |
| YYYY/MM/DD | 2025/10/09.md |

### 问题 3: Markdown 没有渲染

**症状：** 格子里有文本但没有格式化

**检查：**

1. 打开控制台查看错误
2. 检查 `MarkdownRenderer` 是否正常工作
3. 尝试重新构建：
   ```bash
   rm -rf node_modules
   npm install
   npm run dev
   ```

### 问题 4: 内容不更新

**症状：** 编辑文件后内容不刷新

**解决：**

1. 滚动到其他月份再滚回来
2. 点击 "📍 Today" 按钮刷新
3. 重新加载 Obsidian (Ctrl+R / Cmd+R)

### 问题 5: 格子太小看不到内容

**症状：** 内容被隐藏

**解决：**

1. 在格子内滚动查看
2. 点击格子打开完整内容
3. 调整格子高度（在 CSS 中）

---

## 🔬 高级调试 / Advanced Debugging

### 添加调试日志

在 `CalendarView.tsx` 中添加日志：

```typescript
// 在 loadMonthsData 中
const daysWithContent = await Promise.all(
  days.map(async (day) => {
    const file = await getDiaryFile(day.date);
    const fullContent = file ? await getFullContent(file) : "";
    
    // 添加调试日志
    if (file) {
      console.log('Loaded file:', day.date.format('YYYY-MM-DD'), 
                  'Content length:', fullContent.length);
    }
    
    return { ...day, file, content: fullContent, fullContent };
  })
);
```

### 检查 ref 绑定

```typescript
// 在 renderAllMarkdown 中
const renderAllMarkdown = async (days: CalendarDay[]) => {
  for (const day of days) {
    if (day.file && day.content) {
      const dateKey = day.date.format("YYYY-MM-DD");
      const container = contentRefs.current.get(dateKey);
      
      // 添加调试日志
      console.log('Rendering:', dateKey, 
                  'Container:', container ? 'found' : 'NOT FOUND');
      
      if (container) {
        container.empty();
        await MarkdownRenderer.renderMarkdown(
          day.content,
          container,
          day.file.path,
          null as any
        );
        console.log('Rendered:', dateKey);
      }
    }
  }
};
```

### 监控状态变化

```typescript
// 在组件中添加
React.useEffect(() => {
  console.log('Months updated:', months.length);
  months.forEach(m => {
    const filesCount = m.days.filter(d => d.file).length;
    console.log(`${m.month.format('MMMM YYYY')}: ${filesCount} files`);
  });
}, [months]);
```

---

## ✅ 验证修复 / Verify Fix

### 测试检查清单

1. [ ] 打开日历插件
2. [ ] 看到多个月份显示
3. [ ] 当前月份高亮显示
4. [ ] 有内容的格子显示 Markdown 渲染的内容
5. [ ] 可以在格子内滚动查看更多内容
6. [ ] 点击格子打开编辑弹窗
7. [ ] 编辑并保存后内容更新
8. [ ] 上下滚动加载更多月份
9. [ ] 点击 "📍 Today" 按钮跳转到当前月份

### 性能检查

```javascript
// 在控制台中运行
console.time('render');
// 滚动日历
console.timeEnd('render');

// 应该在几百毫秒内完成
```

---

## 📞 获取帮助 / Get Help

如果以上步骤都无法解决问题：

1. **收集信息：**
   - Obsidian 版本
   - 插件版本
   - 操作系统
   - 控制台错误信息
   - 文件结构截图

2. **检查文件：**
   ```
   - main.js 是否存在
   - manifest.json 是否存在
   - styles.css 是否存在
   ```

3. **尝试清理重建：**
   ```bash
   rm -rf node_modules
   rm main.js
   npm install
   npm run dev
   ```

4. **检查 Obsidian 日志：**
   - Help → Toggle Developer Tools
   - Console 标签
   - 查找错误信息

---

## 🎯 快速修复脚本 / Quick Fix Script

```bash
#!/bin/bash

echo "🔧 Quick Fix for Calendar Quick View"

# 1. Clean build
echo "1. Cleaning old build..."
rm -f main.js main.js.map

# 2. Reinstall dependencies
echo "2. Reinstalling dependencies..."
npm install

# 3. Build
echo "3. Building plugin..."
npm run dev &

# 4. Wait for build
sleep 5

echo "✅ Done! Now reload Obsidian (Ctrl+R / Cmd+R)"
echo "📍 If still not working, check DEBUG_GUIDE.md"
```

保存为 `quick-fix.sh` 并运行：
```bash
chmod +x quick-fix.sh
./quick-fix.sh
```

---

## 💡 预防性检查 / Preventive Checks

### 定期检查

1. **每周检查：**
   - 插件是否正常工作
   - 内容是否正确显示
   - 性能是否良好

2. **更新后检查：**
   - Obsidian 更新后测试插件
   - 插件更新后测试所有功能

3. **备份：**
   - 定期备份日记文件
   - 保存插件设置

---

## 📚 相关文档 / Related Docs

- **README.md** - 完整功能说明
- **SCROLLABLE_CALENDAR.md** - 滚动功能详解
- **INTERACTION_GUIDE.md** - 交互指南
- **CELL_SIZE_FIX.md** - 格子大小修复

如果问题依然存在，请查看这些文档或在 GitHub 上提交 issue。

