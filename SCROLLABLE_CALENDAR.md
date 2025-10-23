# 可滚动日历功能 / Scrollable Calendar Feature

## 🎯 功能概述 / Feature Overview

**之前 / Before:**
- 只能通过左右箭头按钮翻页查看不同月份
- 一次只显示一个月份
- 需要多次点击才能查看历史记录

**现在 / Now:**
- ✅ **上下滚动浏览多个月份** / Scroll up and down through multiple months
- ✅ **同时显示多个月份** / Display multiple months at once
- ✅ **无限滚动加载** / Infinite scroll loading
- ✅ **快速跳转到今天** / Quick jump to today

---

## 🎨 视觉效果 / Visual Design

### 新的布局 / New Layout

```
┌─────────────────────────────────────┐
│  Calendar        [📍 Today]         │  ← Sticky Header
├─────────────────────────────────────┤
│                                     │
│  ┌─── September 2025 ───┐          │
│  │  Sun Mon Tue ... Sat  │          │
│  │  [Calendar Grid]      │          │
│  └────────────────────────┘          │
│                                     │  ← Scrollable Area
│  ┌─── October 2025 ───┐ ← Current  │
│  │  Sun Mon Tue ... Sat  │          │
│  │  [Calendar Grid]      │          │
│  └────────────────────────┘          │
│                                     │
│  ┌─── November 2025 ───┐           │
│  │  Sun Mon Tue ... Sat  │          │
│  │  [Calendar Grid]      │          │
│  └────────────────────────┘          │
│                                     │
│  ↓↓↓ Scroll for more ↓↓↓            │
└─────────────────────────────────────┘
```

### 当前月份高亮 / Current Month Highlight

当前月份会有特殊的视觉效果：
- 背景颜色不同
- 边框高亮
- 月份标题使用主题色

```
┌─── October 2025 ───┐  ← 高亮显示
│  Current Month      │
└────────────────────┘
```

---

## 🔧 技术实现 / Technical Implementation

### 1. 多月份数据结构 / Multiple Months Data Structure

```typescript
interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

const [months, setMonths] = useState<MonthData[]>([]);
```

### 2. 初始化加载 / Initial Load

初始加载 7 个月份（前 3 个月 + 当前月 + 后 3 个月）：

```typescript
const initializeCalendar = async () => {
  const today = moment();
  const monthsToLoad: MonthData[] = [];
  
  // Load 3 months before, current, and 3 months after
  for (let i = -3; i <= 3; i++) {
    const month = today.clone().add(i, "months");
    monthsToLoad.push({ month, days: [] });
  }
  
  await loadMonthsData(monthsToLoad);
};
```

### 3. 无限滚动 / Infinite Scroll

监听滚动位置，自动加载更多月份：

```typescript
const handleScroll = useCallback(() => {
  const container = scrollContainerRef.current;
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;

  // Load more when near top or bottom
  if (scrollTop < 300) {
    loadMoreMonths("before");  // 向上滚动
  } else if (scrollTop + clientHeight > scrollHeight - 300) {
    loadMoreMonths("after");   // 向下滚动
  }
}, [isLoadingMore, months]);
```

### 4. 动态加载 / Dynamic Loading

```typescript
const loadMoreMonths = async (direction: "before" | "after") => {
  if (direction === "before") {
    // Add 2 months before the first month
    const firstMonth = months[0].month;
    for (let i = 2; i >= 1; i--) {
      const month = firstMonth.clone().subtract(i, "months");
      newMonths.push({ month, days: [] });
    }
    setMonths([...newMonths, ...months]);
  } else {
    // Add 2 months after the last month
    const lastMonth = months[months.length - 1].month;
    for (let i = 1; i <= 2; i++) {
      const month = lastMonth.clone().add(i, "months");
      newMonths.push({ month, days: [] });
    }
    setMonths([...months, ...newMonths]);
  }
};
```

---

## 🎯 用户交互 / User Interactions

### 1. 滚动浏览 / Scroll to Browse

**操作 / Action:**
- 使用鼠标滚轮上下滚动
- 使用触摸板双指滑动
- 拖动滚动条

**效果 / Effect:**
- 流畅地浏览多个月份
- 接近顶部/底部时自动加载更多月份
- 当前月份保持高亮

### 2. 快速跳转 / Quick Jump

**操作 / Action:**
- 点击顶部的 "📍 Today" 按钮

**效果 / Effect:**
- 平滑滚动到当前月份
- 当前月份高亮显示

### 3. 所有原有功能保留 / All Original Features Retained

- ✅ 点击格子编辑日记
- ✅ Ctrl/Cmd+Click 在编辑器中打开
- ✅ 格子内滚动查看内容
- ✅ Markdown 渲染
- ✅ 创建新日记

---

## 📊 性能优化 / Performance Optimization

### 1. 按需加载 / Load on Demand

- 初始只加载 7 个月份
- 滚动时动态加载更多
- 避免一次性加载所有数据

### 2. 智能加载触发 / Smart Load Trigger

```typescript
// 接近边界 300px 时触发加载
if (scrollTop < 300) {
  loadMoreMonths("before");
}
```

### 3. 防抖处理 / Debounce

使用 `useCallback` 和 `isLoadingMore` 状态防止重复加载：

```typescript
const handleScroll = useCallback(() => {
  if (isLoadingMore) return;  // 防止重复加载
  // ...
}, [isLoadingMore, months]);
```

### 4. Markdown 渲染优化 / Markdown Rendering Optimization

```typescript
// 批量渲染，减少 DOM 操作
setTimeout(() => {
  updatedMonths.forEach((monthData) => {
    renderAllMarkdown(monthData.days);
  });
}, 100);
```

---

## 🎨 CSS 关键样式 / Key CSS Styles

### 1. Sticky Header

```css
.calendar-header-sticky {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
```

### 2. Scrollable Container

```css
.calendar-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}
```

### 3. Month Block

```css
.calendar-month-block {
  margin-bottom: 30px;
  border-radius: 8px;
}

.calendar-month-block.current-month-block {
  background: var(--background-primary-alt);
  padding: 10px;
  box-shadow: 0 0 0 2px var(--interactive-accent);
}
```

---

## 📱 响应式设计 / Responsive Design

布局在不同设备上都能良好工作：

**桌面端 / Desktop:**
- 完整的滚动体验
- 更大的月份间距
- 更多的可见月份

**移动端 / Mobile:**
- 触摸友好的滚动
- 紧凑的布局
- 保持所有功能

---

## 🔄 对比：翻页 vs 滚动 / Comparison: Pagination vs Scrolling

| 特性 | 翻页模式 (旧) | 滚动模式 (新) |
|------|-------------|-------------|
| **查看方式** | 点击按钮翻页 | 上下滚动 |
| **显示月份** | 一次 1 个 | 一次多个 |
| **跨月查看** | 需要多次点击 | 连续滚动 |
| **查找历史** | 逐月翻页 | 快速滚动 |
| **用户体验** | 跳跃式 | 流畅连续 |
| **操作效率** | 较低 | 较高 |

---

## 💡 使用场景 / Use Cases

### 场景 1: 回顾本月 / Review This Month

```
1. 打开日历
2. 当前月份默认高亮
3. 在格子内滚动查看每天的内容
4. 无需任何额外操作
```

### 场景 2: 查看历史 / View History

```
1. 向上滚动
2. 自动加载更早的月份
3. 继续滚动浏览历史记录
4. 找到目标日期后点击查看详情
```

### 场景 3: 计划未来 / Plan Ahead

```
1. 向下滚动
2. 自动加载未来的月份
3. 点击空白日期创建未来的日记
4. 提前规划和记录
```

### 场景 4: 快速返回今天 / Quick Return to Today

```
1. 滚动到任意位置
2. 点击 "📍 Today" 按钮
3. 平滑滚动回到当前月份
4. 继续当天的记录
```

---

## ✅ 功能检查清单 / Feature Checklist

- [x] 多月份同时显示
- [x] 上下滚动浏览
- [x] 无限滚动加载
- [x] 当前月份高亮
- [x] 快速跳转到今天
- [x] Sticky header 固定顶部
- [x] 加载状态提示
- [x] 流畅的滚动体验
- [x] 性能优化
- [x] 响应式设计

---

## 🎉 优势总结 / Benefits Summary

### 用户体验提升 / UX Improvements

1. **更直观** - 可以看到多个月份的整体情况
2. **更快速** - 滚动比点击更快
3. **更连续** - 浏览体验更流畅
4. **更灵活** - 可以快速跳跃或缓慢浏览

### 功能增强 / Feature Enhancements

1. **历史回顾更容易** - 快速滚动查看历史
2. **计划未来更方便** - 查看和规划未来日期
3. **概览更清晰** - 同时看到多个月份
4. **导航更自然** - 符合现代应用习惯

---

## 🚀 快速体验 / Quick Test

### 测试步骤 / Test Steps

1. **构建并运行**:
   ```bash
   npm run dev
   ```

2. **在 Obsidian 中重新加载**:
   - Ctrl+R (Windows/Linux)
   - Cmd+R (macOS)

3. **测试滚动**:
   - 使用鼠标滚轮上下滚动
   - 观察月份的加载和高亮
   
4. **测试跳转**:
   - 滚动到任意月份
   - 点击 "📍 Today" 按钮
   - 观察平滑滚动效果

5. **测试编辑**:
   - 点击任意格子编辑
   - 保存后观察日历刷新
   - 所有功能正常工作

---

## 📝 总结 / Summary

**核心改进 / Core Improvements:**
1. 从翻页模式改为**连续滚动模式**
2. 从单月显示改为**多月同时显示**
3. 从手动翻页改为**自动加载**

**用户受益 / User Benefits:**
- ⚡ 更快的浏览速度
- 🎯 更好的查找效率
- 💫 更流畅的体验
- 📊 更清晰的概览

现在你可以像滚动社交媒体 feed 一样流畅地浏览你的日记了！📅✨

