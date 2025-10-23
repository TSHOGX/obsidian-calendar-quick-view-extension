# Quick Start Guide / 快速开始指南

## 🚀 5 分钟上手 / Get Started in 5 Minutes

### Step 1: Install / 安装

```bash
cd /Users/hsw/Workspace/obsidian-calendar-quick-view-extension
npm install
npm run dev
```

### Step 2: Link to Your Vault / 链接到你的 Vault

```bash
# macOS/Linux
ln -s "$(pwd)" "/path/to/your/vault/.obsidian/plugins/calendar-quick-view"

# Windows (Run as Administrator)
mklink /D "C:\path\to\your\vault\.obsidian\plugins\calendar-quick-view" "%cd%"
```

### Step 3: Enable in Obsidian / 在 Obsidian 中启用

1. Open Obsidian / 打开 Obsidian
2. Settings → Community Plugins → Disable Safe Mode / 设置 → 社区插件 → 关闭安全模式
3. Reload plugins / 重新加载插件
4. Enable "Calendar Quick View" / 启用 "Calendar Quick View"

### Step 4: Create Test Diary / 创建测试日记

在你的 vault 中创建这些文件：

```
YourVault/
└── Diary/
    ├── 2025-10-01.md
    ├── 2025-10-08.md
    └── 2025-10-09.md
```

**File: `Diary/2025-10-09.md`**
```markdown
# 2025-10-09

今天天气很好！

## 工作
- 完成了新项目的开发
- 修复了几个 bug
- 开了团队会议

## 学习
- 学习了 React Hooks
- 阅读了 TypeScript 文档

## 想法
这个插件真的很有用，可以快速查看每天的日记内容！
```

### Step 5: Use the Plugin / 使用插件

1. **打开日历视图 / Open Calendar**:
   - Click the 📅 icon in the sidebar / 点击侧边栏的日历图标

2. **查看日记 / View Diary**:
   - **普通点击** → 弹出模态框，显示完整内容（可滚动）
   - **Normal Click** → Opens modal with full scrollable content

3. **编辑日记 / Edit Diary**:
   - **Ctrl/Cmd + 点击** → 直接在编辑器中打开文件
   - **Ctrl/Cmd + Click** → Opens file in editor

4. **创建新日记 / Create New Diary**:
   - Click on any empty day / 点击任意空白日期

## 🎯 Key Features Showcase / 核心功能演示

### 1. Content Preview in Calendar / 日历格子中的内容预览

```
┌─────────────────────────────────────┐
│         October 2025        [Today] │
├─────────────────────────────────────┤
│ Sun  Mon  Tue  Wed  Thu  Fri  Sat  │
├─────────────────────────────────────┤
│      1    2    3    4    5    6    │
│      [今天天气很好！工作...]          │
│  7   8    9   10   11   12   13    │
│     [...]                           │
└─────────────────────────────────────┘
```

### 2. Scrollable Modal / 可滚动模态框

Click on a day with content / 点击有内容的日期：

```
┌─────────────────────────────────────┐
│  2025-10-09        [📝 Open] [✕]   │
├─────────────────────────────────────┤
│                                     │
│  # 2025-10-09                       │
│                                     │
│  今天天气很好！                      │
│                                     │
│  ## 工作                            │
│  - 完成了新项目的开发                │
│  - 修复了几个 bug                   │
│  - 开了团队会议                      │
│                                     │
│  ## 学习                            │
│  - 学习了 React Hooks               │
│  ↓↓↓ Scroll for more ↓↓↓            │
└─────────────────────────────────────┘
```

### 3. Smart Click / 智能点击

```
┌─────────────┐
│     9       │  ← Click: Open Modal (查看完整内容)
│  [Content]  │  ← Ctrl+Click: Open in Editor (编辑)
└─────────────┘
```

## ⚙️ Configuration / 配置

Go to Settings → Calendar Quick View:

```
┌─────────────────────────────────────┐
│ Diary Folder: [Diary          ]    │  ← Your diary folder
│ Date Format:  [YYYY-MM-DD     ]    │  ← File naming format
│ ☑ Start Week on Monday             │  ← Week start day
│ ☑ Show Weekends                    │  ← Show/hide weekends
└─────────────────────────────────────┘
```

## 💡 Pro Tips / 使用技巧

### 1. Quick Navigation / 快速导航
- Use `←` `→` buttons to navigate months / 使用箭头按钮切换月份
- Click "Today" to jump to current month / 点击 "Today" 跳转到当月

### 2. Keyboard Shortcuts / 键盘快捷键
- **ESC** - Close modal / 关闭模态框
- **Ctrl/Cmd + Click** - Open in editor / 在编辑器中打开

### 3. View Options / 查看选项
- Toggle weekends on/off for a cleaner view / 开关周末显示以获得更简洁的视图
- Start week on Monday for international users / 国际用户可以从周一开始一周

### 4. Content Preview / 内容预览
- First 150 characters show in calendar cells / 前 150 个字符显示在日历格子中
- Click to see full content without switching files / 点击查看完整内容，无需切换文件

## 🎨 Customization / 自定义

### Custom Date Formats / 自定义日期格式

```
YYYY-MM-DD  → 2025-10-09
YYYYMMDD    → 20251009
YYYY/MM/DD  → 2025/10/09
MMM DD, YYYY → Oct 09, 2025
```

### Custom Folder Structure / 自定义文件夹结构

```
YourVault/
├── Journal/Daily/        ← Set "Journal/Daily" in settings
├── 日记/                 ← Or use Chinese folders
└── Notes/Diary/         ← Any nested structure works
```

## 🔄 Development Workflow / 开发工作流

```bash
# Terminal 1: Watch for changes / 监视文件变化
npm run dev

# Terminal 2: Your vault is linked / 你的 vault 已链接
# Just edit files and reload Obsidian (Ctrl+R)
# 只需编辑文件并重新加载 Obsidian (Ctrl+R)
```

## ❓ Common Questions / 常见问题

### Q: Modal doesn't show? / 模态框不显示？
A: Make sure the diary file exists. Empty days create new files instead.
确保日记文件存在。空白日期会创建新文件。

### Q: Content looks wrong? / 内容显示不正确？
A: Check your date format in settings matches your file names.
检查设置中的日期格式是否与文件名匹配。

### Q: How to change theme? / 如何更改主题？
A: The plugin automatically adapts to your Obsidian theme!
插件会自动适配你的 Obsidian 主题！

## 🎉 You're All Set! / 全部完成！

Start using Calendar Quick View to:
- 📖 Quick preview your daily thoughts / 快速预览每日想法
- 🖱️ Smart navigation with modal + editor / 通过模态框+编辑器智能导航  
- 📅 Beautiful calendar interface / 美观的日历界面

Happy journaling! / 开心记日记！

---

Need help? Check:
- 📖 [README.md](README.md) - Full documentation / 完整文档
- 🔧 [INSTALLATION.md](INSTALLATION.md) - Detailed setup / 详细设置
- 💬 GitHub Issues - Report bugs / 报告问题

