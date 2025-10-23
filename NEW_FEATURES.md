# New Features Guide / 新功能指南

## ✨ 主要功能更新 / Major Feature Updates

### 1. 📝 Markdown 渲染 / Markdown Rendering

日记内容现在直接在日历格子中以 **完整 Markdown 格式渲染**！

Diary content is now **fully rendered as Markdown** directly in calendar cells!

**支持的 Markdown 元素 / Supported Markdown Elements:**

```markdown
# Headers / 标题
## H2
### H3

**Bold text** / **粗体**
*Italic text* / *斜体*

- List item 1 / 列表项 1
- List item 2 / 列表项 2

1. Numbered list / 编号列表
2. Item 2

> Blockquotes / 引用块

`inline code` / 行内代码

[Links](url) / 链接
```

**效果展示 / Visual Effect:**

```
┌─────────────────┐
│      9          │
├─────────────────┤
│ 今天天气很好     │  ← Heading
│                 │
│ 工作内容：       │  ← Bold text
│ • 完成开发       │  ← List items
│ • 修复bug        │
│                 │
│ 明天计划：       │
│ 1. 测试功能      │  ← Numbered list
│ 2. 写文档        │
│ ↓ Scroll...     │  ← Scrollable
└─────────────────┘
```

### 2. 📜 格子内滚动 / Scrollable Cell Content

不再需要点击就能查看完整内容！每个日历格子现在都可以滚动。

No more clicking to view full content! Each calendar cell is now scrollable.

**如何使用 / How to Use:**

1. **鼠标悬停在格子上** / Hover over a cell
2. **使用鼠标滚轮滚动** / Use mouse wheel to scroll
3. **查看完整日记内容** / View full diary content
4. **无需打开弹窗**！ / No need to open modals!

**格子特性 / Cell Features:**

- **最小高度**: 120px - 足够显示内容 / Min height: 120px - enough to display content
- **最大高度**: 180px - 保持日历整洁 / Max height: 180px - keeps calendar tidy
- **可滚动**: 超出部分可滚动 / Scrollable: overflow content scrollable
- **细滚动条**: 4px 宽，不占用太多空间 / Thin scrollbar: 4px wide, minimal space

### 3. ✏️ 内联编辑 / Inline Editing

点击格子即可编辑，无需打开 Obsidian 编辑器！

Click a cell to edit directly without opening the Obsidian editor!

**编辑流程 / Editing Workflow:**

```
┌─────────────────────────────────────────┐
│  Click cell → Open Modal               │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  2025-10-09      [💾 Save]  [✕]  │ │
│  ├───────────────────────────────────┤ │
│  │                                   │ │
│  │  # 2025-10-09                     │ │
│  │                                   │ │
│  │  今天天气很好！                    │ │
│  │                                   │ │
│  │  ## 工作                          │ │
│  │  - 完成开发                       │ │
│  │  - 修复bug                        │ │
│  │  ← Edit here!                     │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Edit → Click Save → Changes Applied   │
└─────────────────────────────────────────┘
```

**编辑功能 / Edit Features:**

- ✅ **实时编辑** - 在 textarea 中直接编辑 / Edit directly in textarea
- ✅ **快速保存** - 点击保存按钮立即保存 / Quick save with save button
- ✅ **自动刷新** - 保存后日历自动更新 / Auto-refresh after save
- ✅ **ESC 关闭** - 按 ESC 键关闭编辑器 / Close with ESC key
- ✅ **等宽字体** - 编辑时使用等宽字体 / Monospace font for editing

### 4. 🎨 美化的日历界面 / Enhanced Calendar UI

**新的视觉设计 / New Visual Design:**

- **更高的格子** - 120-180px 高度，显示更多内容 / Taller cells - 120-180px height, show more content
- **更好的滚动条** - 4px 宽的细滚动条 / Better scrollbar - 4px thin scrollbar
- **Markdown 样式** - 标题、列表、代码都有专门样式 / Markdown styling - headers, lists, code styled
- **悬停效果** - 鼠标悬停时格子略微放大 / Hover effect - cells slightly scale up on hover

## 🚀 使用场景 / Use Cases

### 场景 1: 快速浏览 / Quick Browse

```
1. 打开日历视图
2. 滚动查看每天的内容
3. 无需点击或打开文件
4. 快速了解一周/一月的记录
```

**适合**: 回顾、总结、查找特定内容

### 场景 2: 快速编辑 / Quick Edit

```
1. 看到需要修改的内容
2. 直接点击格子
3. 在弹窗中编辑
4. 点击保存
5. 继续浏览其他日期
```

**适合**: 补充信息、修正错误、添加想法

### 场景 3: 内容创建 / Content Creation

```
1. 点击空白日期
2. 自动创建新文件
3. 开始编写日记
4. Markdown 自动渲染
5. 在日历中查看效果
```

**适合**: 每日记录、回顾笔记

## 💡 使用技巧 / Pro Tips

### Tip 1: 格子内直接阅读 / Read in Cells

不要急着点击！先试试在格子内滚动查看内容。大多数情况下，你不需要打开编辑器。

Don't rush to click! Try scrolling within cells first. Most of the time, you won't need to open the editor.

### Tip 2: 使用 Markdown / Use Markdown

充分利用 Markdown 格式：

```markdown
# 日期作为标题
2025-10-09

## 分类
### 工作
- 任务1
- 任务2

### 学习
- 内容A
- 内容B

## 想法
> 今天的思考...

## 代码
`重要代码片段`
```

### Tip 3: 保持简洁 / Keep It Concise

虽然格子可以显示很多内容，但保持日记简洁会让浏览更高效：

- 使用要点 / Use bullet points
- 简短段落 / Short paragraphs
- 清晰标题 / Clear headers

### Tip 4: 快速保存 / Quick Save

编辑时可以使用键盘快捷键（如果你设置了），或者直接点击保存按钮。保存是即时的！

Use keyboard shortcuts if you've set them, or just click the save button. Saving is instant!

## 📊 对比：之前 vs 现在 / Before vs Now

| 功能 / Feature | 之前 / Before | 现在 / Now |
|---------------|--------------|-----------|
| 内容显示 / Content Display | 只显示前 150 字符 / Only first 150 chars | 完整 Markdown 渲染 / Full Markdown rendering |
| 查看方式 / View Method | 需要点击查看 / Need to click to view | 格子内直接滚动 / Scroll within cell |
| 编辑 / Editing | Ctrl+Click 打开编辑器 / Ctrl+Click to open editor | 点击打开内联编辑器 / Click to open inline editor |
| 格式化 / Formatting | 纯文本 / Plain text | 完整 Markdown 支持 / Full Markdown support |
| 格子高度 / Cell Height | 60px 固定 / 60px fixed | 120-180px 可滚动 / 120-180px scrollable |

## 🎯 最佳实践 / Best Practices

### 1. 结构化你的日记 / Structure Your Diary

```markdown
# YYYY-MM-DD

## 📝 今日总结 / Daily Summary
- 重点内容

## 💼 工作 / Work
- 完成的任务
- 遇到的问题

## 📚 学习 / Learning
- 学到的新知识
- 有用的资源

## 💭 思考 / Thoughts
- 今天的感悟
- 明天的计划
```

### 2. 使用 Emoji / Use Emoji

Emoji 在 Markdown 渲染中很醒目：

```markdown
✅ 完成的任务
⏰ 待办事项
💡 好点子
⚠️ 注意事项
🎯 重要目标
```

### 3. 保持一致的格式 / Maintain Consistent Format

每天使用相同的模板会让浏览更容易：

Use the same template every day for easier browsing:

- Same sections / 相同的分节
- Same structure / 相同的结构
- Same style / 相同的风格

## 🐛 常见问题 / Troubleshooting

### Q: Markdown 没有渲染？ / Markdown not rendering?

**A**: 
1. 检查文件是否正确保存 / Check if file is saved correctly
2. 刷新日历（切换月份再切回来）/ Refresh calendar (switch month and back)
3. 检查文件格式是否正确 / Check if file format is correct

### Q: 滚动条不显示？ / Scrollbar not showing?

**A**: 
- 内容需要超过格子高度才会显示滚动条 / Scrollbar only shows when content exceeds cell height
- 鼠标悬停在格子上尝试滚动 / Hover over cell and try scrolling

### Q: 保存失败？ / Save failed?

**A**:
1. 检查文件权限 / Check file permissions
2. 确保文件未在其他地方打开 / Make sure file isn't open elsewhere
3. 查看控制台错误信息 / Check console for error messages

### Q: 格子内容显示不全？ / Cell content cut off?

**A**:
- 这是正常的！使用滚动查看完整内容 / This is normal! Use scroll to view full content
- 如果需要更大的视图，点击打开编辑器 / If you need larger view, click to open editor

## 🎉 总结 / Summary

新版本带来三大核心改进：

The new version brings three core improvements:

1. **📝 Markdown 渲染** - 更美观的内容展示 / More beautiful content display
2. **📜 格子内滚动** - 无需点击即可浏览 / Browse without clicking
3. **✏️ 内联编辑** - 快速编辑和保存 / Quick edit and save

这些改进让你能够：

These improvements allow you to:

- ✅ 更快速地浏览日记 / Browse diary faster
- ✅ 更方便地编辑内容 / Edit content more conveniently
- ✅ 更直观地查看格式化内容 / View formatted content more intuitively
- ✅ 在日历视图中完成大部分工作 / Complete most work in calendar view

开始使用吧！🚀 / Start using it now! 🚀

