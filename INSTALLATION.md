# Installation Guide / 安装指南

## 🚀 Quick Start / 快速开始

### Prerequisites / 前置要求

- Node.js (v16 or higher) / Node.js（16 或更高版本）
- npm or yarn / npm 或 yarn
- Obsidian (v0.15.0 or higher) / Obsidian（0.15.0 或更高版本）

### Step 1: Install Dependencies / 步骤 1：安装依赖

```bash
cd obsidian-calendar-quick-view-extension
npm install
```

### Step 2: Build the Plugin / 步骤 2：构建插件

For development with auto-rebuild / 开发模式（自动重建）:
```bash
npm run dev
```

For production build / 生产构建:
```bash
npm run build
```

### Step 3: Install to Obsidian / 步骤 3：安装到 Obsidian

#### Option A: Symlink (Recommended for Development) / 选项 A：符号链接（推荐用于开发）

**macOS/Linux:**
```bash
# Replace <YOUR_VAULT_PATH> with your actual vault path
ln -s "$(pwd)" "<YOUR_VAULT_PATH>/.obsidian/plugins/calendar-quick-view"
```

**Windows (Run as Administrator):**
```cmd
# Replace <YOUR_VAULT_PATH> with your actual vault path
mklink /D "<YOUR_VAULT_PATH>\.obsidian\plugins\calendar-quick-view" "%cd%"
```

#### Option B: Manual Copy / 选项 B：手动复制

1. Build the plugin / 构建插件:
   ```bash
   npm run build
   ```

2. Copy files to your vault / 将文件复制到你的 vault:
   ```bash
   # Create plugin directory
   mkdir -p "<YOUR_VAULT_PATH>/.obsidian/plugins/calendar-quick-view"
   
   # Copy necessary files
   cp main.js manifest.json styles.css "<YOUR_VAULT_PATH>/.obsidian/plugins/calendar-quick-view/"
   ```

### Step 4: Enable the Plugin / 步骤 4：启用插件

1. Open Obsidian / 打开 Obsidian
2. Go to Settings → Community Plugins / 进入 设置 → 社区插件
3. Disable "Safe Mode" if it's enabled / 如果启用了"安全模式"，请禁用它
4. Click "Reload plugins" / 点击"重新加载插件"
5. Enable "Calendar Quick View" / 启用 "Calendar Quick View"

## 🔧 Development Workflow / 开发工作流

### 1. Start Development Mode / 启动开发模式

```bash
npm run dev
```

This will watch for file changes and automatically rebuild.
这将监视文件更改并自动重建。

### 2. Make Changes / 进行更改

Edit files in `main.tsx` or `src/CalendarView.tsx`
编辑 `main.tsx` 或 `src/CalendarView.tsx` 中的文件

### 3. Reload Plugin in Obsidian / 在 Obsidian 中重新加载插件

After making changes / 更改后:
- Press `Ctrl+R` (Windows/Linux) or `Cmd+R` (macOS) to reload Obsidian
- Or use Command Palette: "Reload app without saving"
- 按 `Ctrl+R`（Windows/Linux）或 `Cmd+R`（macOS）重新加载 Obsidian
- 或使用命令面板："Reload app without saving"

## 📁 Folder Structure for Testing / 测试用的文件夹结构

Create a test diary structure / 创建测试日记结构:

```
YourVault/
├── Diary/
│   ├── 2025-10-01.md
│   ├── 2025-10-07.md
│   ├── 2025-10-08.md
│   └── 2025-10-09.md
└── .obsidian/
    └── plugins/
        └── calendar-quick-view/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

### Sample Diary Entry / 示例日记条目

Create a file `Diary/2025-10-09.md` with content:

```markdown
# 2025-10-09

Today I worked on my new Obsidian plugin. It's coming along great!

## What I Did
- Learned about Obsidian plugin development
- Created a calendar view component
- Added diary content preview
- Implemented scrollable modal for full content viewing
- Added smart click interaction (normal vs Ctrl+Click)

## Thoughts
This plugin will make it much easier to navigate my daily notes.

## Tomorrow's Plan
- Test the modal functionality
- Improve the UI design
- Add more customization options

## Notes
You can now click on any calendar day to see this full content in a beautiful modal window. 
Use Ctrl/Cmd+Click to open the file directly in the editor for editing!
```

### Interaction Examples / 交互示例

1. **Normal Click / 普通点击**:
   - Click on a calendar day → Opens modal with full scrollable content
   - 点击日历上的某一天 → 打开显示完整内容的模态框（可滚动）

2. **Ctrl/Cmd + Click**:
   - Ctrl/Cmd+Click on a calendar day → Opens file in editor
   - Ctrl/Cmd+点击日历上的某一天 → 在编辑器中打开文件

3. **Close Modal / 关闭模态框**:
   - Press ESC key / 按 ESC 键
   - Click outside the modal / 点击模态框外部
   - Click the ✕ button / 点击 ✕ 按钮

## 🐛 Troubleshooting / 故障排除

### Plugin doesn't appear / 插件未出现

1. Make sure all three files are in the plugin folder / 确保所有三个文件都在插件文件夹中:
   - `main.js`
   - `manifest.json`
   - `styles.css`

2. Check console for errors / 检查控制台错误:
   - Open Developer Tools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
   - Look for red error messages

3. Verify plugin is enabled / 验证插件已启用:
   - Settings → Community Plugins → Calendar Quick View (should be toggled on)

### Build fails / 构建失败

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### Plugin doesn't reload / 插件不重新加载

```bash
# Stop development mode
# Ctrl+C in terminal

# Clean build
rm main.js

# Restart development mode
npm run dev
```

### Diary files not showing / 日记文件未显示

1. Check plugin settings / 检查插件设置:
   - Settings → Calendar Quick View
   - Verify "Diary Folder" matches your actual folder name
   - Verify "Date Format" matches your file naming format

2. Check file names / 检查文件名:
   - Files should be named exactly as specified in date format
   - Example: if format is `YYYY-MM-DD`, file should be `2025-10-09.md`

## 🎨 Customization / 自定义

### Custom Styles / 自定义样式

You can customize the appearance by adding CSS to your vault's `<vault>/.obsidian/snippets/` folder:

你可以通过在 vault 的 `<vault>/.obsidian/snippets/` 文件夹中添加 CSS 来自定义外观：

```css
/* custom-calendar.css */

/* Change calendar cell background */
.calendar-day.has-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

/* Change today's highlight color */
.calendar-day.today {
  border-color: #ff6b6b;
}

/* Adjust content preview font size */
.calendar-day-content {
  font-size: 11px;
}
```

Then enable the snippet in Settings → Appearance → CSS Snippets.

然后在 设置 → 外观 → CSS 代码片段 中启用该代码片段。

## 📦 Distribution / 分发

### Prepare for Release / 准备发布

```bash
# Update version in package.json
# Update CHANGELOG.md
# Commit changes

# Build production version
npm run build

# Create release files
mkdir release
cp main.js manifest.json styles.css release/

# Zip for distribution
cd release
zip -r calendar-quick-view-v1.0.0.zip main.js manifest.json styles.css
```

## 🤝 Contributing / 贡献

See the main README.md for contribution guidelines.

查看主 README.md 了解贡献指南。

## 📝 License / 许可证

MIT License - See LICENSE file for details.

MIT 许可证 - 详见 LICENSE 文件。

