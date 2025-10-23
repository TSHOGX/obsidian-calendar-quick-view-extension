# Calendar Quick View for Obsidian

一个用于 Obsidian 的日历插件，可以在日历格子中预览每日日记内容。

A calendar plugin for Obsidian that displays diary content preview in calendar cells.

## Features / 功能特性

- 📅 **Scrollable Multi-Month View** - Continuously scroll through multiple months / 连续滚动浏览多个月份
- 🔄 **Infinite Scroll** - Automatically loads more months as you scroll / 滚动时自动加载更多月份
- 📝 **Markdown Rendered Content** - View formatted diary content with full Obsidian markdown support / 在格子中查看完整 Markdown 渲染的日记内容
- 📜 **Scrollable Cell Content** - Scroll through diary content directly in calendar cells / 直接在日历格子内滚动查看日记内容
- ✏️ **Inline Editing** - Click to open editable modal and save changes / 点击打开可编辑弹窗并保存更改
- 🗂️ **Customizable Folder** - Configure your diary folder location / 可配置日记文件夹位置
- 📆 **Flexible Date Format** - Support YYYY-MM-DD and other formats / 支持 YYYY-MM-DD 等多种日期格式
- ➕ **Quick Creation** - Click empty days to create new diary entries / 点击空白日期快速创建日记
- 🌓 **Theme Support** - Works seamlessly with light and dark themes / 完美支持亮色和暗色主题
- 📱 **Responsive Design** - Adapts to different screen sizes / 响应式设计，适配不同屏幕

## Installation / 安装

### From Community Plugins / 从社区插件安装 (Not yet available)

1. Open Obsidian Settings / 打开 Obsidian 设置
2. Go to Community Plugins and disable Safe Mode / 进入社区插件并关闭安全模式
3. Click Browse and search for "Calendar Quick View" / 点击浏览并搜索 "Calendar Quick View"
4. Click Install, then Enable / 点击安装，然后启用

### Manual Installation / 手动安装

1. Download the latest release / 下载最新版本
2. Extract the files to your vault's plugins folder: `<vault>/.obsidian/plugins/calendar-quick-view/`
3. Reload Obsidian / 重启 Obsidian
4. Enable the plugin in Settings → Community Plugins / 在设置 → 社区插件中启用插件

### Development Installation / 开发安装

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-calendar-quick-view-extension.git

# Navigate to the directory
cd obsidian-calendar-quick-view-extension

# Install dependencies
npm install

# Build the plugin
npm run build

# Or run in development mode with auto-rebuild
npm run dev
```

Then copy the built files (`main.js`, `manifest.json`, `styles.css`) to your vault's plugins folder.

然后将构建的文件（`main.js`、`manifest.json`、`styles.css`）复制到你的 vault 的插件文件夹中。

## Usage / 使用方法

1. **Open Calendar View / 打开日历视图**
   - Click the calendar icon in the ribbon / 点击侧边栏的日历图标
   - Or use Command Palette: "Open Calendar Quick View" / 或使用命令面板："Open Calendar Quick View"

2. **View Diary Content / 查看日记内容**
   - Diary content is **rendered as Markdown** directly in calendar cells / 日记内容直接在日历格子中以 **Markdown 格式渲染**
   - **Scroll within each cell** to view full content / **在格子内滚动**查看完整内容
   - Full Obsidian markdown support (headers, lists, code, blockquotes, etc.) / 完整支持 Obsidian Markdown（标题、列表、代码、引用等）

3. **Edit Diary / 编辑日记**
   - **Click** on any day with content to open editable modal / **点击**任意有内容的日期打开可编辑弹窗
   - **Ctrl/Cmd + Click** to open file in Obsidian editor / **Ctrl/Cmd + 点击**在 Obsidian 编辑器中打开文件
   - Edit content in the textarea (modal) or editor / 在文本框（弹窗）或编辑器中编辑内容
   - Click **"Save"** button to save changes / 点击 **"保存"** 按钮保存更改
   - Changes are immediately reflected in the calendar / 更改立即反映在日历中

4. **Create New Diary Entry / 创建新日记**
   - Click on any empty day to create a new entry / 点击任意空白日期创建新日记
   - A new diary file will be created with the date as the title / 将创建一个以日期为标题的新日记文件

5. **Navigate Calendar / 导航日历**
   - **Scroll up and down** to browse through multiple months / **上下滚动**浏览多个月份
   - **Infinite scroll** - automatically loads more months as you reach the top or bottom / **无限滚动** - 到达顶部或底部时自动加载更多月份
   - Click **"📍 Today"** button to quickly jump back to current month / 点击 **"📍 Today"** 按钮快速跳转回当前月份
   - Current month is highlighted for easy identification / 当前月份高亮显示便于识别

## Settings / 设置

- **Diary Folder** - Specify where your diary files are stored (e.g., "Diary", "Journal/Daily") / 指定日记文件存储位置
- **Date Format** - Configure the date format for file names (default: YYYY-MM-DD) / 配置文件名的日期格式
- **Start Week on Monday** - Toggle to start the week on Monday instead of Sunday / 切换为从周一开始一周
- **Show Weekends** - Toggle to show/hide weekend columns / 切换显示/隐藏周末列

## Supported Date Formats / 支持的日期格式

- `YYYY-MM-DD` (2025-10-09)
- `YYYY-MM-DD` (2025-10-08)
- `YYYYMMDD` (20251009)
- And any format supported by Moment.js / 以及 Moment.js 支持的任何格式

## File Structure / 文件结构

```
Diary/
├── 2025-10-01.md
├── 2025-10-07.md
├── 2025-10-08.md
└── 2025-10-09.md
```

## Keyboard Shortcuts / 键盘快捷键

- **Mouse Wheel / Trackpad** - Scroll through multiple months / 滚动浏览多个月份
- **Click** on a calendar day - Open editable modal / 打开可编辑弹窗
- **Ctrl/Cmd + Click** on a calendar day - Open file in Obsidian editor / 在 Obsidian 编辑器中打开文件
- **Scroll** within calendar cells - View full content without opening modal / 在格子内滚动查看完整内容
- **ESC** key or click outside modal - Close the modal editor / 关闭弹窗编辑器

You can also set custom hotkeys in Obsidian Settings → Hotkeys.

你也可以在 Obsidian 设置 → 快捷键中设置自定义热键。

## Comparison with Similar Plugins / 与类似插件对比

This plugin is inspired by:
- [obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin) - Focuses on navigation
- [Obsidian-Big-Calendar](https://github.com/Quorafind/Obsidian-Big-Calendar) - Full-featured calendar

**Calendar Quick View** focuses on:
- **Continuous scrolling** through multiple months / **连续滚动**浏览多个月份
- **Full Markdown rendering** in calendar cells / 在日历格子中**完整 Markdown 渲染**
- **Scrollable content** directly in cells / 格子内**可滚动内容**
- **Inline editing** with quick save / **内联编辑**快速保存
- **Infinite scroll loading** for seamless browsing / **无限滚动加载**实现无缝浏览
- Simple, clean interface / 简洁的界面
- View and edit without switching files / 无需切换文件即可查看和编辑

## Development / 开发

### Build Commands / 构建命令

```bash
# Development mode with auto-rebuild
npm run dev

# Production build
npm run build
```

### Project Structure / 项目结构

```
obsidian-calendar-quick-view-extension/
├── main.tsx              # Main plugin file
├── src/
│   └── CalendarView.tsx  # React calendar component
├── styles.css            # Plugin styles
├── manifest.json         # Plugin manifest
├── package.json          # Node dependencies
└── tsconfig.json         # TypeScript configuration
```

## Contributing / 贡献

Contributions are welcome! Please feel free to submit a Pull Request.

欢迎贡献！请随时提交 Pull Request。

## Support / 支持

If you encounter any issues or have feature requests, please open an issue on GitHub.

如果遇到任何问题或有功能请求，请在 GitHub 上提出 issue。

## License / 许可证

MIT License - see LICENSE file for details.

MIT 许可证 - 详见 LICENSE 文件。

## Changelog / 更新日志

### 1.0.0
- Initial release / 初始版本
- **Scrollable multi-month view** - Browse through months by scrolling / **可滚动多月视图** - 通过滚动浏览多个月份
- **Infinite scroll loading** - Automatically loads more months / **无限滚动加载** - 自动加载更多月份
- **Current month highlight** - Easy identification of current month / **当前月份高亮** - 轻松识别当前月份
- **Full Markdown rendering** in calendar cells / 日历格子中**完整 Markdown 渲染**
- **Scrollable content** directly within calendar cells / 日历格子内**可滚动内容**
- **Inline editing modal** with save functionality / **内联编辑弹窗**带保存功能
- **Smart click** - Normal click for modal, Ctrl/Cmd+Click for editor / **智能点击** - 普通点击打开弹窗，Ctrl/Cmd+点击打开编辑器
- Support for all Obsidian markdown features (headers, lists, code, blockquotes) / 支持所有 Obsidian Markdown 功能（标题、列表、代码、引用）
- ESC key support to close modal / 支持 ESC 键关闭模态框
- Configurable diary folder and date format / 可配置的日记文件夹和日期格式
- Support for custom themes / 支持自定义主题
- Responsive design for mobile and desktop / 响应式设计，支持移动端和桌面端

