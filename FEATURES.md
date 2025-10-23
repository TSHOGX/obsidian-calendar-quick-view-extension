# Feature Documentation / 功能文档

## 🎯 Core Features / 核心功能

### 1. Calendar View with Content Preview / 日历视图与内容预览

在日历格子中直接显示日记内容的前 150 个字符。

**Display logic / 显示逻辑:**
- Removes front matter / 移除 frontmatter
- Removes markdown headers / 移除 markdown 标题
- Shows first 150 characters / 显示前 150 个字符
- Empty notes show "Empty note" / 空笔记显示 "Empty note"

```typescript
// Code location: src/CalendarView.tsx - getFilePreview()
const preview = content.trim().substring(0, 150);
```

### 2. Scrollable Full Content Modal / 可滚动完整内容模态框 ⭐ NEW

**Click behavior / 点击行为:**

| Action / 操作 | Result / 结果 |
|--------------|--------------|
| Normal Click / 普通点击 | Opens modal with full content / 打开显示完整内容的模态框 |
| Ctrl/Cmd + Click | Opens file in editor / 在编辑器中打开文件 |
| Click empty day / 点击空白日期 | Creates new diary file / 创建新日记文件 |

**Modal features / 模态框功能:**
- Full content display / 完整内容显示
- Scrollable content area / 可滚动内容区域
- "Open in Editor" button / "在编辑器中打开" 按钮
- Close with ESC key / ESC 键关闭
- Close by clicking outside / 点击外部关闭
- Animated entrance / 动画入场效果

```typescript
// Code location: src/CalendarView.tsx - handleDayClick()
const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
  const isCtrlClick = event.ctrlKey || event.metaKey;
  
  if (isCtrlClick) {
    // Open file directly
    await app.workspace.getLeaf(false).openFile(day.file);
  } else {
    // Show modal
    setDiaryModal({ isOpen: true, day, fullContent });
  }
};
```

### 3. Smart File Creation / 智能文件创建

**Automatic folder creation / 自动创建文件夹:**
- Checks if diary folder exists / 检查日记文件夹是否存在
- Creates folder if needed / 如果需要则创建文件夹
- Creates file with date as title / 创建以日期为标题的文件

```typescript
// Code location: src/CalendarView.tsx - createDiaryEntry()
if (folderPath && !folder) {
  await app.vault.createFolder(folderPath);
}
```

### 4. Flexible Date Format Support / 灵活的日期格式支持

**Supported formats / 支持的格式:**
- `YYYY-MM-DD` (default) - 2025-10-09
- `YYYYMMDD` - 20251009
- `YYYY/MM/DD` - 2025/10/09
- `MMM DD, YYYY` - Oct 09, 2025
- Any Moment.js format / 任何 Moment.js 格式

**Configuration / 配置:**
Settings → Calendar Quick View → Date Format

### 5. Calendar Navigation / 日历导航

**Features / 功能:**
- Previous/Next month buttons / 上/下月按钮
- "Today" quick jump button / "今天" 快速跳转按钮
- Week start configuration (Sunday/Monday) / 周开始配置（周日/周一）
- Weekend toggle / 周末显示开关

### 6. Theme Support / 主题支持

**Automatic adaptation / 自动适配:**
- Light theme / 亮色主题
- Dark theme / 暗色主题
- Custom CSS variables / 自定义 CSS 变量

**Theme variables used / 使用的主题变量:**
```css
--background-primary
--background-secondary
--text-normal
--text-muted
--interactive-accent
--background-modifier-hover
```

## 🎨 UI Components / UI 组件

### Calendar Grid / 日历网格

```
┌─────────────────────────────────────┐
│  Calendar Header                    │
│  ├── Previous Month Button          │
│  ├── Current Month Display          │
│  ├── Today Button                   │
│  └── Next Month Button              │
├─────────────────────────────────────┤
│  Weekday Headers                    │
│  (Sun, Mon, Tue, Wed, Thu, Fri, Sat)│
├─────────────────────────────────────┤
│  Calendar Days Grid (7x6)           │
│  ├── Day Number                     │
│  ├── Content Preview (150 chars)    │
│  └── "Click to create" hint         │
└─────────────────────────────────────┘
```

### Diary Modal / 日记模态框

```
┌─────────────────────────────────────┐
│  Modal Header                       │
│  ├── Date (YYYY-MM-DD)              │
│  ├── "Open in Editor" Button        │
│  └── Close Button (✕)               │
├─────────────────────────────────────┤
│  Modal Body (Scrollable)            │
│  └── Full Content Display           │
│      - Preserves formatting         │
│      - Shows all content            │
│      - Scrollbar when needed        │
└─────────────────────────────────────┘
```

## 🔧 Configuration Options / 配置选项

### Plugin Settings / 插件设置

| Setting / 设置 | Type / 类型 | Default / 默认值 | Description / 描述 |
|---------------|------------|----------------|-------------------|
| Diary Folder / 日记文件夹 | Text | "Diary" | Folder path for diary files / 日记文件的文件夹路径 |
| Date Format / 日期格式 | Text | "YYYY-MM-DD" | Filename date format / 文件名日期格式 |
| Start Week on Monday / 周一开始 | Toggle | false | Start week on Monday / 从周一开始一周 |
| Show Weekends / 显示周末 | Toggle | true | Display weekend columns / 显示周末列 |

## 🎹 Keyboard Shortcuts / 键盘快捷键

| Shortcut / 快捷键 | Action / 操作 |
|------------------|--------------|
| **Click** | Open modal with full content / 打开完整内容模态框 |
| **Ctrl/Cmd + Click** | Open file in editor / 在编辑器中打开文件 |
| **ESC** | Close modal / 关闭模态框 |
| **Click outside modal** | Close modal / 关闭模态框 |

## 📱 Responsive Design / 响应式设计

### Desktop / 桌面端
- Optimal viewing in sidebar / 侧边栏最佳显示
- Can be moved to main area / 可移至主区域
- Can be pinned / 可固定

### Mobile / 移动端
- Adapts to smaller screens / 适配小屏幕
- Modal takes 95% width / 模态框占 95% 宽度
- Touch-friendly buttons / 触摸友好按钮

```css
@media (max-width: 600px) {
  .diary-modal-content {
    width: 95%;
    max-height: 90vh;
  }
}
```

## 🎭 Animations / 动画

### Modal Entrance / 模态框入场
```css
@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### Modal Overlay / 模态框遮罩
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Calendar Cell Hover / 日历格子悬停
```css
.calendar-day:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

## 🔍 Implementation Details / 实现细节

### React State Management / React 状态管理

```typescript
// Main state
const [currentMonth, setCurrentMonth] = useState(moment());
const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
const [hoveredDay, setHoveredDay] = useState<string | null>(null);
const [diaryModal, setDiaryModal] = useState<DiaryModal>({
  isOpen: false,
  day: null,
  fullContent: "",
});
```

### File Reading / 文件读取

```typescript
// Preview (first 150 chars)
const getFilePreview = async (file: TFile): Promise<string> => {
  const content = await app.vault.cachedRead(file);
  // Process and return preview...
};

// Full content
const getFullContent = async (file: TFile): Promise<string> => {
  return await app.vault.cachedRead(file);
};
```

### Event Handling / 事件处理

```typescript
// ESC key listener
useEffect(() => {
  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && diaryModal.isOpen) {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleEscKey);
  return () => document.removeEventListener("keydown", handleEscKey);
}, [diaryModal.isOpen]);
```

## 🚀 Performance Optimizations / 性能优化

1. **Cached File Reading** / 缓存文件读取
   - Uses `app.vault.cachedRead()` instead of `read()`
   - Reduces file system operations / 减少文件系统操作

2. **Async File Loading** / 异步文件加载
   - Uses `Promise.all()` for parallel loading
   - Faster initial load / 更快的初始加载

3. **Conditional Rendering** / 条件渲染
   - Modal only renders when open / 模态框仅在打开时渲染
   - Reduces DOM complexity / 减少 DOM 复杂度

## 🔐 Security / 安全性

- Uses Obsidian's built-in file APIs / 使用 Obsidian 内置文件 API
- No external network requests / 无外部网络请求
- Sandboxed within Obsidian / 在 Obsidian 内沙箱化

## 🧪 Testing Checklist / 测试清单

- [ ] Calendar renders correctly / 日历正确渲染
- [ ] Preview shows in cells / 预览显示在格子中
- [ ] Normal click opens modal / 普通点击打开模态框
- [ ] Ctrl/Cmd+Click opens file / Ctrl/Cmd+点击打开文件
- [ ] Modal shows full content / 模态框显示完整内容
- [ ] ESC closes modal / ESC 关闭模态框
- [ ] Click outside closes modal / 点击外部关闭模态框
- [ ] "Open in Editor" button works / "在编辑器中打开" 按钮工作
- [ ] Empty days create new files / 空白日期创建新文件
- [ ] Month navigation works / 月份导航工作
- [ ] Today button works / Today 按钮工作
- [ ] Settings persist / 设置持久化
- [ ] Theme switching works / 主题切换工作

## 📊 File Structure / 文件结构

```
src/CalendarView.tsx          (317 lines)
├── Interfaces (11-23)
│   ├── CalendarViewProps
│   ├── CalendarDay
│   └── DiaryModal
├── State Management (30-37)
├── Effects (39-55)
│   ├── loadCalendarData
│   └── handleEscKey
├── Calendar Logic (57-101)
│   ├── generateCalendarDays
│   ├── getDiaryFile
│   ├── getFilePreview
│   └── getFullContent
├── Event Handlers (121-182)
│   ├── handleDayClick
│   ├── closeModal
│   ├── openFileFromModal
│   └── createDiaryEntry
├── Navigation (184-196)
│   ├── goToPreviousMonth
│   ├── goToNextMonth
│   └── goToToday
└── Render (219-319)
    ├── Calendar Header
    ├── Calendar Grid
    └── Diary Modal
```

## 🎓 Learn More / 了解更多

- [README.md](README.md) - Complete documentation / 完整文档
- [INSTALLATION.md](INSTALLATION.md) - Setup guide / 安装指南  
- [QUICKSTART.md](QUICKSTART.md) - Get started quickly / 快速开始
- [Obsidian API Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [React Documentation](https://react.dev/)

