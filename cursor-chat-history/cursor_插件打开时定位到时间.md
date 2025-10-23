# 插件打开时定位到今天
_Exported on 10/23/2025 at 11:27:11 GMT+8 from Cursor (1.7.54)_

---

**User**

我希望刚打开插件的时候可以定位在今天，然后在 header 显示当前页面的年月，并且点击 header 的年月的时候可以允许用户选择年月实现快速跳转

---

**Cursor**

我来帮你实现这些功能。首先让我查看一下当前的代码结构。

我来帮你实现这些功能。我会：
1. 在组件挂载时自动滚动到今天
2. 在 header 显示当前可见的年月
3. 添加一个年月选择器，点击 header 年月时可以快速跳转

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);

    // Render markdown after state update
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months
  const handleScroll = React.useCallback(() => {
    if (isLoadingMore || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Load more months when near top or bottom
    if (scrollTop < 300) {
      loadMoreMonths("before");
    } else if (scrollTop + clientHeight > scrollHeight - 300) {
      loadMoreMonths("after");
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3>Calendar</h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months
  const handleScroll = React.useCallback(() => {
    if (isLoadingMore || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Load more months when near top or bottom
    if (scrollTop < 300) {
      loadMoreMonths("before");
    } else if (scrollTop + clientHeight > scrollHeight - 300) {
      loadMoreMonths("after");
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3>Calendar</h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;
    
    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3>Calendar</h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;
    
    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];
    
    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );
        
        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3>Calendar</h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;
    
    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];
    
    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );
        
        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3 
            className="calendar-current-month-title" 
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: 'pointer' }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;
    
    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];
    
    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );
        
        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3 
            className="calendar-current-month-title" 
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: 'pointer' }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div className="month-picker-overlay" onClick={() => setShowMonthPicker(false)}>
          <div className="month-picker-content" onClick={(e) => e.stopPropagation()}>
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth.month());

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>✕</button>
      </div>
      
      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${selectedYear === year ? 'selected' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
        
        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${selectedMonth === index ? 'selected' : ''}`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] = React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );
        
        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;
    
    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];
    
    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });
      
      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );
        
        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3 
            className="calendar-current-month-title" 
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: 'pointer' }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div className="month-picker-overlay" onClick={() => setShowMonthPicker(false)}>
          <div className="month-picker-content" onClick={(e) => e.stopPropagation()}>
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(dateKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

现在我需要添加月份选择器的样式。让我查看一下当前的 CSS 文件。

```css
/* Calendar Quick View Styles */

.calendar-quick-view-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-interface);
  overflow: hidden;
}

.calendar-header-sticky {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 10;
  padding: 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.calendar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.calendar-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
  flex: 1;
}

.calendar-today-button {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.calendar-today-button:hover {
  opacity: 0.8;
}

/* Scrollable container for months */
.calendar-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}

/* Month block */
.calendar-month-block {
  margin-bottom: 30px;
  border-radius: 8px;
  transition: all 0.3s;
}

.calendar-month-block.current-month-block {
  background: var(--background-primary-alt);
  padding: 10px;
  box-shadow: 0 0 0 2px var(--interactive-accent);
}

.calendar-month-header {
  padding: 10px 5px;
  margin-bottom: 10px;
  border-bottom: 2px solid var(--background-modifier-border);
}

.calendar-month-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
}

.current-month-block .calendar-month-header h4 {
  color: var(--interactive-accent);
}

.calendar-grid {
  display: flex;
  flex-direction: column;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 5px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.calendar-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  flex: 1;
  align-content: start;
}

.calendar-day {
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  background: var(--background-primary);
  position: relative;
  height: 140px;
  width: 100%;
  overflow: hidden;
}

.calendar-day:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.calendar-day.other-month {
  opacity: 0.3;
}

.calendar-day.today {
  border-color: var(--interactive-accent);
  border-width: 2px;
  background: var(--background-primary-alt);
}

.calendar-day.has-content {
  background: var(--background-secondary);
}

.calendar-day.weekend {
  background: var(--background-secondary-alt);
}

.calendar-day-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-normal);
  margin-bottom: 4px;
  flex-shrink: 0;
  height: 18px;
  line-height: 18px;
}

.calendar-day.today .calendar-day-number {
  color: var(--interactive-accent);
}

.calendar-day-content {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-normal);
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 2px;
  min-height: 0;
  max-height: calc(140px - 30px);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Markdown rendered content in calendar cells */
.calendar-day-content.markdown-rendered {
  font-family: var(--font-text);
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.calendar-day-content.markdown-rendered * {
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: break-word;
}

.calendar-day-content.markdown-rendered p {
  margin: 0.3em 0;
  font-size: 10px;
  line-height: 1.3;
}

.calendar-day-content.markdown-rendered h1,
.calendar-day-content.markdown-rendered h2,
.calendar-day-content.markdown-rendered h3,
.calendar-day-content.markdown-rendered h4 {
  font-size: 11px;
  font-weight: 600;
  margin: 0.4em 0 0.2em 0;
  color: var(--text-accent);
}

.calendar-day-content.markdown-rendered ul,
.calendar-day-content.markdown-rendered ol {
  margin: 0.2em 0;
  padding-left: 1.2em;
  font-size: 10px;
}

.calendar-day-content.markdown-rendered li {
  margin: 0.1em 0;
}

.calendar-day-content.markdown-rendered code {
  font-size: 9px;
  background: var(--background-primary-alt);
  padding: 1px 3px;
  border-radius: 2px;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.calendar-day-content.markdown-rendered pre {
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-width: 100%;
}

.calendar-day-content.markdown-rendered img,
.calendar-day-content.markdown-rendered video {
  max-width: 100%;
  height: auto;
}

.calendar-day-content.markdown-rendered blockquote {
  border-left: 2px solid var(--text-accent);
  padding-left: 0.5em;
  margin: 0.3em 0;
  font-size: 10px;
  color: var(--text-muted);
}

/* Scrollbar for calendar day content */
.calendar-day-content::-webkit-scrollbar {
  width: 4px;
}

.calendar-day-content::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-day-content::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 2px;
}

.calendar-day-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.calendar-day-empty {
  font-size: 9px;
  color: var(--text-faint);
  text-align: center;
  margin-top: auto;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.calendar-day:hover .calendar-day-empty {
  opacity: 1;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 600px) {
  .calendar-day {
    height: 120px;
  }
  
  .calendar-day-content {
    font-size: 9px;
    max-height: calc(120px - 30px);
  }

  .calendar-day-content.markdown-rendered p,
  .calendar-day-content.markdown-rendered ul,
  .calendar-day-content.markdown-rendered ol {
    font-size: 9px;
  }
}

/* Dark mode adjustments */
.theme-dark .calendar-day.has-content {
  background: rgba(255, 255, 255, 0.05);
}

.theme-dark .calendar-day.weekend {
  background: rgba(255, 255, 255, 0.02);
}

/* Light mode adjustments */
.theme-light .calendar-day.has-content {
  background: rgba(0, 0, 0, 0.03);
}

.theme-light .calendar-day.weekend {
  background: rgba(0, 0, 0, 0.01);
}

/* Loading indicator */
.calendar-loading {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
}

/* Scrollbar styling for scroll container */
.calendar-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.calendar-scroll-container::-webkit-scrollbar-track {
  background: var(--background-primary);
}

.calendar-scroll-container::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 4px;
}

.calendar-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Diary Modal Styles */
.diary-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.diary-modal-content {
  background: var(--background-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
  border: 1px solid var(--background-modifier-border);
}

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

.diary-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--background-modifier-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.diary-modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-normal);
}

.diary-modal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diary-modal-button {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.diary-modal-button:hover {
  opacity: 0.85;
}

.diary-modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.diary-modal-close:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.diary-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.diary-modal-textarea {
  width: 100%;
  height: 100%;
  min-height: 400px;
  font-family: var(--font-monospace);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-normal);
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 12px;
  resize: vertical;
  outline: none;
}

.diary-modal-textarea:focus {
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 2px var(--interactive-accent-hover);
}

.diary-modal-save {
  background: var(--interactive-success);
}

.diary-modal-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.diary-modal-edit .diary-modal-body {
  padding: 16px;
}

/* Scrollbar styling for modal */
.diary-modal-body::-webkit-scrollbar {
  width: 10px;
}

.diary-modal-body::-webkit-scrollbar-track {
  background: var(--background-secondary);
  border-radius: 5px;
}

.diary-modal-body::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 5px;
}

.diary-modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Responsive modal for smaller screens */
@media (max-width: 600px) {
  .diary-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .diary-modal-header {
    padding: 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .diary-modal-header h2 {
    font-size: 18px;
  }

  .diary-modal-actions {
    width: 100%;
    justify-content: space-between;
  }

  .diary-modal-body {
    padding: 16px;
  }

  .diary-modal-text {
    font-size: 13px;
  }
}

/* Month Year Picker Styles */
.month-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(3px);
  animation: fadeIn 0.2s ease-in-out;
}

.month-picker-content {
  background: var(--background-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  animation: slideIn 0.3s ease-out;
  border: 1px solid var(--background-modifier-border);
}

.month-year-picker {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.month-year-picker-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.month-year-picker-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-normal);
}

.month-picker-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.month-picker-close:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.month-year-picker-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  gap: 20px;
}

.year-selector,
.month-selector {
  flex: 1;
}

.year-selector h4,
.month-selector h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

.year-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 8px;
}

.year-list::-webkit-scrollbar {
  width: 6px;
}

.year-list::-webkit-scrollbar-track {
  background: var(--background-secondary);
  border-radius: 3px;
}

.year-list::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 3px;
}

.year-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.year-button {
  padding: 8px 12px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  text-align: left;
}

.year-button:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
}

.year-button.selected {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
  font-weight: 600;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.month-button {
  padding: 10px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  text-align: center;
}

.month-button:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
}

.month-button.selected {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
  font-weight: 600;
}

.month-year-picker-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--background-modifier-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.month-picker-cancel,
.month-picker-confirm {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.month-picker-cancel {
  background: var(--background-secondary);
  color: var(--text-normal);
}

.month-picker-cancel:hover {
  background: var(--background-modifier-hover);
}

.month-picker-confirm {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.month-picker-confirm:hover {
  opacity: 0.85;
}

.calendar-current-month-title {
  transition: color 0.2s;
}

.calendar-current-month-title:hover {
  color: var(--interactive-accent);
}

/* Responsive for month picker */
@media (max-width: 600px) {
  .month-year-picker-body {
    flex-direction: column;
  }

  .year-list {
    max-height: 150px;
  }

  .month-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}


```

现在让我检查一下是否有任何 lint 错误。

太好了！没有 lint 错误。现在让我构建项目来测试一下。

完美！构建成功。我已经为你实现了所有需要的功能：

## ✅ 已完成的功能

### 1. **自动定位到今天** 
   - 插件启动时会自动滚动到今天所在的月份
   - 使用 `hasInitialScrolled` ref 确保只在初次加载时滚动一次

### 2. **Header 显示当前可见的年月** 
   - Header 中的标题现在显示当前滚动到的月份（格式：`2024年10月`）
   - 滚动日历时，标题会自动更新为当前可见的月份
   - 标题文字可以点击，鼠标悬停时会变色提示可交互

### 3. **年月选择器实现快速跳转** 
   - 点击 Header 的年月标题会弹出一个优雅的选择器
   - 选择器包含两部分：
     - **年份列表**：显示当前年份前后各10年（可滚动）
     - **月份网格**：显示全部12个月
   - 已选中的年份和月份会高亮显示
   - 点击"确定"按钮跳转到选中的月份
   - 如果目标月份未加载，会自动加载并跳转
   - 点击"取消"或遮罩层可关闭选择器

### 其他改进
- 在每个月份块添加了 `data-month` 属性，方便追踪滚动位置
- 添加了完整的 CSS 样式，包含响应式设计
- 支持深色/浅色主题
- 流畅的动画效果

现在你可以在 Obsidian 中重新加载插件来测试这些新功能了！

---

**User**

你现在给今天和今月加上了边框来区分，我想保留今天的边框，但是希望去掉今月的边框

---

**Cursor**

我明白了，你想保留今天的边框，但去掉当前月份块的边框。让我修改 CSS 样式。

```css
/* Calendar Quick View Styles */

.calendar-quick-view-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-interface);
  overflow: hidden;
}

.calendar-header-sticky {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 10;
  padding: 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.calendar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.calendar-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
  flex: 1;
}

.calendar-today-button {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.calendar-today-button:hover {
  opacity: 0.8;
}

/* Scrollable container for months */
.calendar-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}

/* Month block */
.calendar-month-block {
  margin-bottom: 30px;
  border-radius: 8px;
  transition: all 0.3s;
}

.calendar-month-block.current-month-block {
  background: var(--background-primary-alt);
  padding: 10px;
}

.calendar-month-header {
  padding: 10px 5px;
  margin-bottom: 10px;
  border-bottom: 2px solid var(--background-modifier-border);
}

.calendar-month-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
}

.current-month-block .calendar-month-header h4 {
  color: var(--interactive-accent);
}

.calendar-grid {
  display: flex;
  flex-direction: column;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 5px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.calendar-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  flex: 1;
  align-content: start;
}

.calendar-day {
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  background: var(--background-primary);
  position: relative;
  height: 140px;
  width: 100%;
  overflow: hidden;
}

.calendar-day:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.calendar-day.other-month {
  opacity: 0.3;
}

.calendar-day.today {
  border-color: var(--interactive-accent);
  border-width: 2px;
  background: var(--background-primary-alt);
}

.calendar-day.has-content {
  background: var(--background-secondary);
}

.calendar-day.weekend {
  background: var(--background-secondary-alt);
}

.calendar-day-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-normal);
  margin-bottom: 4px;
  flex-shrink: 0;
  height: 18px;
  line-height: 18px;
}

.calendar-day.today .calendar-day-number {
  color: var(--interactive-accent);
}

.calendar-day-content {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-normal);
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 2px;
  min-height: 0;
  max-height: calc(140px - 30px);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Markdown rendered content in calendar cells */
.calendar-day-content.markdown-rendered {
  font-family: var(--font-text);
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.calendar-day-content.markdown-rendered * {
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: break-word;
}

.calendar-day-content.markdown-rendered p {
  margin: 0.3em 0;
  font-size: 10px;
  line-height: 1.3;
}

.calendar-day-content.markdown-rendered h1,
.calendar-day-content.markdown-rendered h2,
.calendar-day-content.markdown-rendered h3,
.calendar-day-content.markdown-rendered h4 {
  font-size: 11px;
  font-weight: 600;
  margin: 0.4em 0 0.2em 0;
  color: var(--text-accent);
}

.calendar-day-content.markdown-rendered ul,
.calendar-day-content.markdown-rendered ol {
  margin: 0.2em 0;
  padding-left: 1.2em;
  font-size: 10px;
}

.calendar-day-content.markdown-rendered li {
  margin: 0.1em 0;
}

.calendar-day-content.markdown-rendered code {
  font-size: 9px;
  background: var(--background-primary-alt);
  padding: 1px 3px;
  border-radius: 2px;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.calendar-day-content.markdown-rendered pre {
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-width: 100%;
}

.calendar-day-content.markdown-rendered img,
.calendar-day-content.markdown-rendered video {
  max-width: 100%;
  height: auto;
}

.calendar-day-content.markdown-rendered blockquote {
  border-left: 2px solid var(--text-accent);
  padding-left: 0.5em;
  margin: 0.3em 0;
  font-size: 10px;
  color: var(--text-muted);
}

/* Scrollbar for calendar day content */
.calendar-day-content::-webkit-scrollbar {
  width: 4px;
}

.calendar-day-content::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-day-content::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 2px;
}

.calendar-day-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.calendar-day-empty {
  font-size: 9px;
  color: var(--text-faint);
  text-align: center;
  margin-top: auto;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.calendar-day:hover .calendar-day-empty {
  opacity: 1;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 600px) {
  .calendar-day {
    height: 120px;
  }
  
  .calendar-day-content {
    font-size: 9px;
    max-height: calc(120px - 30px);
  }

  .calendar-day-content.markdown-rendered p,
  .calendar-day-content.markdown-rendered ul,
  .calendar-day-content.markdown-rendered ol {
    font-size: 9px;
  }
}

/* Dark mode adjustments */
.theme-dark .calendar-day.has-content {
  background: rgba(255, 255, 255, 0.05);
}

.theme-dark .calendar-day.weekend {
  background: rgba(255, 255, 255, 0.02);
}

/* Light mode adjustments */
.theme-light .calendar-day.has-content {
  background: rgba(0, 0, 0, 0.03);
}

.theme-light .calendar-day.weekend {
  background: rgba(0, 0, 0, 0.01);
}

/* Loading indicator */
.calendar-loading {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
}

/* Scrollbar styling for scroll container */
.calendar-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.calendar-scroll-container::-webkit-scrollbar-track {
  background: var(--background-primary);
}

.calendar-scroll-container::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 4px;
}

.calendar-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Diary Modal Styles */
.diary-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.diary-modal-content {
  background: var(--background-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
  border: 1px solid var(--background-modifier-border);
}

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

.diary-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--background-modifier-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.diary-modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-normal);
}

.diary-modal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diary-modal-button {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.diary-modal-button:hover {
  opacity: 0.85;
}

.diary-modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.diary-modal-close:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.diary-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.diary-modal-textarea {
  width: 100%;
  height: 100%;
  min-height: 400px;
  font-family: var(--font-monospace);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-normal);
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 12px;
  resize: vertical;
  outline: none;
}

.diary-modal-textarea:focus {
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 2px var(--interactive-accent-hover);
}

.diary-modal-save {
  background: var(--interactive-success);
}

.diary-modal-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.diary-modal-edit .diary-modal-body {
  padding: 16px;
}

/* Scrollbar styling for modal */
.diary-modal-body::-webkit-scrollbar {
  width: 10px;
}

.diary-modal-body::-webkit-scrollbar-track {
  background: var(--background-secondary);
  border-radius: 5px;
}

.diary-modal-body::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 5px;
}

.diary-modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Responsive modal for smaller screens */
@media (max-width: 600px) {
  .diary-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .diary-modal-header {
    padding: 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .diary-modal-header h2 {
    font-size: 18px;
  }

  .diary-modal-actions {
    width: 100%;
    justify-content: space-between;
  }

  .diary-modal-body {
    padding: 16px;
  }

  .diary-modal-text {
    font-size: 13px;
  }
}

/* Month Year Picker Styles */
.month-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(3px);
  animation: fadeIn 0.2s ease-in-out;
}

.month-picker-content {
  background: var(--background-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  animation: slideIn 0.3s ease-out;
  border: 1px solid var(--background-modifier-border);
}

.month-year-picker {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.month-year-picker-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.month-year-picker-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-normal);
}

.month-picker-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.month-picker-close:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.month-year-picker-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  gap: 20px;
}

.year-selector,
.month-selector {
  flex: 1;
}

.year-selector h4,
.month-selector h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

.year-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 8px;
}

.year-list::-webkit-scrollbar {
  width: 6px;
}

.year-list::-webkit-scrollbar-track {
  background: var(--background-secondary);
  border-radius: 3px;
}

.year-list::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 3px;
}

.year-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.year-button {
  padding: 8px 12px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  text-align: left;
}

.year-button:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
}

.year-button.selected {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
  font-weight: 600;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.month-button {
  padding: 10px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  text-align: center;
}

.month-button:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
}

.month-button.selected {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
  font-weight: 600;
}

.month-year-picker-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--background-modifier-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.month-picker-cancel,
.month-picker-confirm {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.month-picker-cancel {
  background: var(--background-secondary);
  color: var(--text-normal);
}

.month-picker-cancel:hover {
  background: var(--background-modifier-hover);
}

.month-picker-confirm {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.month-picker-confirm:hover {
  opacity: 0.85;
}

.calendar-current-month-title {
  transition: color 0.2s;
}

.calendar-current-month-title:hover {
  color: var(--interactive-accent);
}

/* Responsive for month picker */
@media (max-width: 600px) {
  .month-year-picker-body {
    flex-direction: column;
  }

  .year-list {
    max-height: 150px;
  }

  .month-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}


```

完成！我已经移除了当前月份块的边框（box-shadow），现在：

✅ **保留**：今天的日期仍然有蓝色边框高亮（`.calendar-day.today` 的 2px 边框）
✅ **移除**：当前月份块不再有外围的蓝色边框，只保留浅色背景来区分

现在当前月份块只会有轻微的背景色变化来标识，而不会有醒目的边框。今天的日期依然会在日历格子中有明显的边框标识。

你可以在 Obsidian 中重新加载插件来查看效果！

---

**User**

现在我希望点按 Obsidian 侧边按钮的时候，刷新当前插件页面或者在新的主页面打开当前插件，而不是在侧边栏里打开

---

**Cursor**

我需要查看主插件文件来修改侧边栏按钮的行为。让我先看看当前的实现。

我明白了，现在插件是在右侧边栏打开的。我需要修改 `activateView()` 方法，让它在主工作区打开或刷新视图。

```typescriptreact
import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  ItemView,
  TFile,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CalendarView } from "./src/CalendarView";

interface CalendarQuickViewSettings {
  diaryFolder: string;
  dateFormat: string;
  showWeekends: boolean;
  startWeekOnMonday: boolean;
}

const DEFAULT_SETTINGS: CalendarQuickViewSettings = {
  diaryFolder: "Diary",
  dateFormat: "YYYY-MM-DD",
  showWeekends: true,
  startWeekOnMonday: false,
};

export const VIEW_TYPE_CALENDAR_QUICK_VIEW = "calendar-quick-view";

export default class CalendarQuickViewPlugin extends Plugin {
  settings: CalendarQuickViewSettings;

  async onload() {
    await this.loadSettings();

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR_QUICK_VIEW,
      (leaf) => new CalendarQuickViewLeaf(leaf, this)
    );

    // Add ribbon icon to activate view
    this.addRibbonIcon("calendar", "Open Calendar Quick View", () => {
      this.activateView();
    });

    // Add command to open calendar view
    this.addCommand({
      id: "open-calendar-quick-view",
      name: "Open Calendar Quick View",
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new CalendarQuickViewSettingTab(this.app, this));
  }

  onunload() {
    // Detach all calendar views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh all calendar views
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW)
      .forEach((leaf) => {
        if (leaf.view instanceof CalendarQuickViewLeaf) {
          leaf.view.refresh();
        }
      });
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);

    if (leaves.length > 0) {
      // A leaf with our view already exists, refresh and reveal it
      leaf = leaves[0];
      if (leaf.view instanceof CalendarQuickViewLeaf) {
        leaf.view.refresh();
      }
    } else {
      // Our view could not be found in the workspace, create a new leaf in the main area
      leaf = workspace.getLeaf(false);
      await leaf?.setViewState({
        type: VIEW_TYPE_CALENDAR_QUICK_VIEW,
        active: true,
      });
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}

class CalendarQuickViewLeaf extends ItemView {
  plugin: CalendarQuickViewPlugin;
  reactRoot: React.ReactElement;

  constructor(leaf: WorkspaceLeaf, plugin: CalendarQuickViewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR_QUICK_VIEW;
  }

  getDisplayText(): string {
    return "Calendar Quick View";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen() {
    this.refresh();
  }

  refresh() {
    const container = this.containerEl.children[1];
    container.empty();

    this.reactRoot = React.createElement(CalendarView, {
      app: this.app,
      plugin: this.plugin,
      settings: this.plugin.settings,
    });

    ReactDOM.render(this.reactRoot, container);
  }

  async onClose() {
    const container = this.containerEl.children[1];
    ReactDOM.unmountComponentAtNode(container);
  }
}

class CalendarQuickViewSettingTab extends PluginSettingTab {
  plugin: CalendarQuickViewPlugin;

  constructor(app: App, plugin: CalendarQuickViewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Calendar Quick View Settings" });

    new Setting(containerEl)
      .setName("Diary Folder")
      .setDesc("The folder where your diary files are stored")
      .addText((text) =>
        text
          .setPlaceholder("Diary")
          .setValue(this.plugin.settings.diaryFolder)
          .onChange(async (value) => {
            this.plugin.settings.diaryFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date Format")
      .setDesc("Date format for diary file names (e.g., YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start Week on Monday")
      .setDesc("Toggle to start the week on Monday instead of Sunday")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.startWeekOnMonday)
          .onChange(async (value) => {
            this.plugin.settings.startWeekOnMonday = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Weekends")
      .setDesc("Toggle to show/hide weekends")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekends)
          .onChange(async (value) => {
            this.plugin.settings.showWeekends = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

```

完成！我已经修改了插件的打开行为。现在的功能如下：

## ✅ 修改内容

### 主要变更：
1. **首次打开**：点击侧边栏按钮时，插件会在**主工作区**（中间区域）打开，而不是在侧边栏
   - 从 `workspace.getRightLeaf(false)` 改为 `workspace.getLeaf(false)`

2. **已打开时**：如果插件已经在某处打开，点击按钮会：
   - 刷新当前视图的内容（重新加载日历数据）
   - 激活并聚焦到该视图

### 代码更改：
- 将视图创建位置从右侧边栏改为主工作区
- 添加了刷新逻辑，当视图已存在时会调用 `refresh()` 方法重新渲染

现在你可以在 Obsidian 中重新加载插件测试。点击侧边栏的日历图标时，插件会在主页面打开，如果已经打开则会刷新内容！

---

**User**

现在有已打开页面时点按，会聚焦，但刷新完日历就空白了，没有任何显示；并且没有已打开页面时点按，会在中间区域打开，但是不会在新的页面打开。请修改

---

**Cursor**

我理解了问题。让我修复这两个问题：
1. 刷新后日历空白的问题
2. 在新标签页打开而不是替换当前页面

```typescriptreact
import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  ItemView,
  TFile,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CalendarView } from "./src/CalendarView";

interface CalendarQuickViewSettings {
  diaryFolder: string;
  dateFormat: string;
  showWeekends: boolean;
  startWeekOnMonday: boolean;
}

const DEFAULT_SETTINGS: CalendarQuickViewSettings = {
  diaryFolder: "Diary",
  dateFormat: "YYYY-MM-DD",
  showWeekends: true,
  startWeekOnMonday: false,
};

export const VIEW_TYPE_CALENDAR_QUICK_VIEW = "calendar-quick-view";

export default class CalendarQuickViewPlugin extends Plugin {
  settings: CalendarQuickViewSettings;

  async onload() {
    await this.loadSettings();

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR_QUICK_VIEW,
      (leaf) => new CalendarQuickViewLeaf(leaf, this)
    );

    // Add ribbon icon to activate view
    this.addRibbonIcon("calendar", "Open Calendar Quick View", () => {
      this.activateView();
    });

    // Add command to open calendar view
    this.addCommand({
      id: "open-calendar-quick-view",
      name: "Open Calendar Quick View",
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new CalendarQuickViewSettingTab(this.app, this));
  }

  onunload() {
    // Detach all calendar views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh all calendar views
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW)
      .forEach((leaf) => {
        if (leaf.view instanceof CalendarQuickViewLeaf) {
          leaf.view.refresh();
        }
      });
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);

    if (leaves.length > 0) {
      // A leaf with our view already exists, reveal it
      leaf = leaves[0];
      workspace.revealLeaf(leaf);
      // Refresh the view
      if (leaf.view instanceof CalendarQuickViewLeaf) {
        leaf.view.refresh();
      }
    } else {
      // Our view could not be found in the workspace, create a new leaf in a new tab
      leaf = workspace.getLeaf('tab');
      await leaf?.setViewState({
        type: VIEW_TYPE_CALENDAR_QUICK_VIEW,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
}

class CalendarQuickViewLeaf extends ItemView {
  plugin: CalendarQuickViewPlugin;
  reactRoot: React.ReactElement;

  constructor(leaf: WorkspaceLeaf, plugin: CalendarQuickViewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR_QUICK_VIEW;
  }

  getDisplayText(): string {
    return "Calendar Quick View";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen() {
    this.refresh();
  }

  refresh() {
    const container = this.containerEl.children[1];
    container.empty();

    this.reactRoot = React.createElement(CalendarView, {
      app: this.app,
      plugin: this.plugin,
      settings: this.plugin.settings,
    });

    ReactDOM.render(this.reactRoot, container);
  }

  async onClose() {
    const container = this.containerEl.children[1];
    ReactDOM.unmountComponentAtNode(container);
  }
}

class CalendarQuickViewSettingTab extends PluginSettingTab {
  plugin: CalendarQuickViewPlugin;

  constructor(app: App, plugin: CalendarQuickViewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Calendar Quick View Settings" });

    new Setting(containerEl)
      .setName("Diary Folder")
      .setDesc("The folder where your diary files are stored")
      .addText((text) =>
        text
          .setPlaceholder("Diary")
          .setValue(this.plugin.settings.diaryFolder)
          .onChange(async (value) => {
            this.plugin.settings.diaryFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date Format")
      .setDesc("Date format for diary file names (e.g., YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start Week on Monday")
      .setDesc("Toggle to start the week on Monday instead of Sunday")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.startWeekOnMonday)
          .onChange(async (value) => {
            this.plugin.settings.startWeekOnMonday = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Weekends")
      .setDesc("Toggle to show/hide weekends")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekends)
          .onChange(async (value) => {
            this.plugin.settings.showWeekends = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

```

现在我需要修复 `refresh()` 方法，确保它能正确渲染组件：

```typescriptreact
import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  ItemView,
  TFile,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CalendarView } from "./src/CalendarView";

interface CalendarQuickViewSettings {
  diaryFolder: string;
  dateFormat: string;
  showWeekends: boolean;
  startWeekOnMonday: boolean;
}

const DEFAULT_SETTINGS: CalendarQuickViewSettings = {
  diaryFolder: "Diary",
  dateFormat: "YYYY-MM-DD",
  showWeekends: true,
  startWeekOnMonday: false,
};

export const VIEW_TYPE_CALENDAR_QUICK_VIEW = "calendar-quick-view";

export default class CalendarQuickViewPlugin extends Plugin {
  settings: CalendarQuickViewSettings;

  async onload() {
    await this.loadSettings();

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR_QUICK_VIEW,
      (leaf) => new CalendarQuickViewLeaf(leaf, this)
    );

    // Add ribbon icon to activate view
    this.addRibbonIcon("calendar", "Open Calendar Quick View", () => {
      this.activateView();
    });

    // Add command to open calendar view
    this.addCommand({
      id: "open-calendar-quick-view",
      name: "Open Calendar Quick View",
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new CalendarQuickViewSettingTab(this.app, this));
  }

  onunload() {
    // Detach all calendar views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh all calendar views
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW)
      .forEach((leaf) => {
        if (leaf.view instanceof CalendarQuickViewLeaf) {
          leaf.view.refresh();
        }
      });
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);

    if (leaves.length > 0) {
      // A leaf with our view already exists, reveal it
      leaf = leaves[0];
      workspace.revealLeaf(leaf);
      // Refresh the view
      if (leaf.view instanceof CalendarQuickViewLeaf) {
        leaf.view.refresh();
      }
    } else {
      // Our view could not be found in the workspace, create a new leaf in a new tab
      leaf = workspace.getLeaf('tab');
      await leaf?.setViewState({
        type: VIEW_TYPE_CALENDAR_QUICK_VIEW,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
}

class CalendarQuickViewLeaf extends ItemView {
  plugin: CalendarQuickViewPlugin;
  reactRoot: React.ReactElement;

  constructor(leaf: WorkspaceLeaf, plugin: CalendarQuickViewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR_QUICK_VIEW;
  }

  getDisplayText(): string {
    return "Calendar Quick View";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen() {
    this.refresh();
  }

  refresh() {
    const container = this.containerEl.children[1];
    if (!container) {
      console.error('Calendar Quick View: Container not found');
      return;
    }
    
    container.empty();
    container.addClass('calendar-view-container');

    this.reactRoot = React.createElement(CalendarView, {
      app: this.app,
      plugin: this.plugin,
      settings: this.plugin.settings,
    });

    ReactDOM.render(this.reactRoot, container);
  }

  async onClose() {
    const container = this.containerEl.children[1];
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
    }
  }
}

class CalendarQuickViewSettingTab extends PluginSettingTab {
  plugin: CalendarQuickViewPlugin;

  constructor(app: App, plugin: CalendarQuickViewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Calendar Quick View Settings" });

    new Setting(containerEl)
      .setName("Diary Folder")
      .setDesc("The folder where your diary files are stored")
      .addText((text) =>
        text
          .setPlaceholder("Diary")
          .setValue(this.plugin.settings.diaryFolder)
          .onChange(async (value) => {
            this.plugin.settings.diaryFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date Format")
      .setDesc("Date format for diary file names (e.g., YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start Week on Monday")
      .setDesc("Toggle to start the week on Monday instead of Sunday")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.startWeekOnMonday)
          .onChange(async (value) => {
            this.plugin.settings.startWeekOnMonday = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Weekends")
      .setDesc("Toggle to show/hide weekends")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekends)
          .onChange(async (value) => {
            this.plugin.settings.showWeekends = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

```

```typescriptreact
import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  ItemView,
  TFile,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CalendarView } from "./src/CalendarView";

interface CalendarQuickViewSettings {
  diaryFolder: string;
  dateFormat: string;
  showWeekends: boolean;
  startWeekOnMonday: boolean;
}

const DEFAULT_SETTINGS: CalendarQuickViewSettings = {
  diaryFolder: "Diary",
  dateFormat: "YYYY-MM-DD",
  showWeekends: true,
  startWeekOnMonday: false,
};

export const VIEW_TYPE_CALENDAR_QUICK_VIEW = "calendar-quick-view";

export default class CalendarQuickViewPlugin extends Plugin {
  settings: CalendarQuickViewSettings;

  async onload() {
    await this.loadSettings();

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR_QUICK_VIEW,
      (leaf) => new CalendarQuickViewLeaf(leaf, this)
    );

    // Add ribbon icon to activate view
    this.addRibbonIcon("calendar", "Open Calendar Quick View", () => {
      this.activateView();
    });

    // Add command to open calendar view
    this.addCommand({
      id: "open-calendar-quick-view",
      name: "Open Calendar Quick View",
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new CalendarQuickViewSettingTab(this.app, this));
  }

  onunload() {
    // Detach all calendar views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh all calendar views
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW)
      .forEach((leaf) => {
        if (leaf.view instanceof CalendarQuickViewLeaf) {
          leaf.view.refresh();
        }
      });
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR_QUICK_VIEW);

    if (leaves.length > 0) {
      // A leaf with our view already exists, reveal it
      leaf = leaves[0];
      workspace.revealLeaf(leaf);
      // Refresh the view
      if (leaf.view instanceof CalendarQuickViewLeaf) {
        leaf.view.refresh();
      }
    } else {
      // Our view could not be found in the workspace, create a new leaf in a new tab
      leaf = workspace.getLeaf('tab');
      await leaf?.setViewState({
        type: VIEW_TYPE_CALENDAR_QUICK_VIEW,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
}

class CalendarQuickViewLeaf extends ItemView {
  plugin: CalendarQuickViewPlugin;
  reactRoot: React.ReactElement;

  constructor(leaf: WorkspaceLeaf, plugin: CalendarQuickViewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR_QUICK_VIEW;
  }

  getDisplayText(): string {
    return "Calendar Quick View";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen() {
    this.refresh();
  }

  refresh() {
    const container = this.containerEl.children[1];
    if (!container) {
      console.error('Calendar Quick View: Container not found');
      return;
    }
    
    // First unmount any existing React component
    ReactDOM.unmountComponentAtNode(container);
    
    // Clear the container
    container.empty();
    container.addClass('calendar-view-container');

    // Create and render new React component with a unique key to force remount
    this.reactRoot = React.createElement(CalendarView, {
      key: Date.now(), // Force React to create a new component instance
      app: this.app,
      plugin: this.plugin,
      settings: this.plugin.settings,
    });

    ReactDOM.render(this.reactRoot, container);
  }

  async onClose() {
    const container = this.containerEl.children[1];
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
    }
  }
}

class CalendarQuickViewSettingTab extends PluginSettingTab {
  plugin: CalendarQuickViewPlugin;

  constructor(app: App, plugin: CalendarQuickViewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Calendar Quick View Settings" });

    new Setting(containerEl)
      .setName("Diary Folder")
      .setDesc("The folder where your diary files are stored")
      .addText((text) =>
        text
          .setPlaceholder("Diary")
          .setValue(this.plugin.settings.diaryFolder)
          .onChange(async (value) => {
            this.plugin.settings.diaryFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date Format")
      .setDesc("Date format for diary file names (e.g., YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Start Week on Monday")
      .setDesc("Toggle to start the week on Monday instead of Sunday")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.startWeekOnMonday)
          .onChange(async (value) => {
            this.plugin.settings.startWeekOnMonday = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Weekends")
      .setDesc("Toggle to show/hide weekends")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekends)
          .onChange(async (value) => {
            this.plugin.settings.showWeekends = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

```

完成！我已经修复了两个问题。让我总结一下修改内容：

## ✅ 修复内容

### 1. **修复刷新后空白的问题**
   - 在 `refresh()` 方法中，先正确卸载旧的 React 组件
   - 然后清空容器，再重新渲染
   - 添加了 `key={Date.now()}` 强制 React 创建全新的组件实例
   - 添加了容器检查和错误日志，便于调试

### 2. **在新标签页打开**
   - 将 `workspace.getLeaf(false)` 改为 `workspace.getLeaf('tab')`
   - 现在首次打开时会在新的标签页打开，而不是替换当前页面

### 3. **改进刷新逻辑**
   - 调整了刷新的顺序：先 reveal（显示），再 refresh（刷新）
   - 确保视图可见后再进行刷新操作

现在的行为：
- **首次点击**：在新标签页打开日历视图
- **再次点击**：聚焦到已打开的日历视图，并刷新内容（重新加载日历数据）
- **刷新不会空白**：正确卸载和重新挂载 React 组件

你可以在 Obsidian 中重新加载插件来测试这些修复！

---

**User**

现在在渲染格子上似乎有点问题，比如图中显示了2025 年十月的内容，月份的 group 中为了填满补全，会显示 2025 年九月的最后两天（周一周二），然后现在这两天都有日记，且都在十月的 group 里显示了出来，但是九月的末尾没有日记内容的显示，怎么回事？

---

**Cursor**

我理解问题了。9月的最后两天（29、30号）在9月的组里应该显示日记内容，但现在没有显示。而这两天在10月的组里却显示出来了。让我检查一下日历渲染的逻辑。

```typescriptreact
{!day.file && day.isCurrentMonth && (
  <div className="calendar-day-empty">
    Click to create
  </div>
)}
```

```typescriptreact
{day.content && (
  <div
    className="calendar-day-content markdown-rendered"
    ref={(el) => {
      if (el) {
        contentRefs.current.set(dateKey, el as any);
      }
    }}
  />
)}
```

```typescriptreact
{!day.file && day.isCurrentMonth && (
  <div className="calendar-day-empty">
    Click to create
  </div>
)}
```

```typescriptreact
{day.content && (
  <div
    className="calendar-day-content markdown-rendered"
    ref={(el) => {
      if (el) {
        contentRefs.current.set(dateKey, el as any);
      }
    }}
  />
)}
```

让我检查一下 CSS 中对 `other-month` 的样式设置：

让我检查一下 `renderAllMarkdown` 函数和内容加载的逻辑：

```typescriptreact
ref={(el) => {
  if (el) {
    contentRefs.current.set(dateKey, el as any);
  }
}}
```

我发现问题了！问题在于 `contentRefs` 使用日期作为 key，但是同一个日期（比如9月29日）会在两个月份组中出现：
1. 在9月组中作为当月日期
2. 在10月组中作为填充日期

当10月组渲染时，它会覆盖9月29日的 ref，所以 markdown 只会渲染到10月组中的那个格子里。

让我修复这个问题，为每个格子创建唯一的 ref key：

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[]) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const container = contentRefs.current.get(dateKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

现在我需要更新 `renderAllMarkdown` 函数，让它也使用月份信息来生成唯一的 key：

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days);
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days);
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day
      setTimeout(() => {
        const container = contentRefs.current.get(dateKey);
        if (container && diaryModal.day?.file) {
          container.empty();
          MarkdownRenderer.renderMarkdown(
            updatedContent,
            container,
            diaryModal.day.file.path,
            null as any
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && diaryModal.isOpen) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [diaryModal.isOpen]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day in all months where it appears
      setTimeout(() => {
        months.forEach((monthData) => {
          const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
          const container = contentRefs.current.get(uniqueKey);
          if (container && diaryModal.day?.file) {
            container.empty();
            MarkdownRenderer.renderMarkdown(
              updatedContent,
              container,
              diaryModal.day.file.path,
              null as any
            );
          }
        });
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

完美！我已经修复了日历渲染的问题。问题的根源和解决方案如下：

## 🐛 问题根源

之前使用 `dateKey`（如 `2025-09-29`）作为唯一标识来存储内容容器的引用。但是同一个日期会出现在多个月份组中：
- 9月29日在9月组中（作为当月日期）
- 9月29日也在10月组中（作为填充日期）

当10月组渲染时，它会**覆盖** 9月29日的 ref，导致 markdown 只渲染到10月组中的格子，而9月组的格子空白。

## ✅ 解决方案

### 1. **创建唯一的 ref key**
   - 将 `dateKey` 改为 `uniqueKey = 月份-日期`（如 `2025-09-2025-09-29`）
   - 这样每个月份组中的同一日期都有独立的引用

### 2. **更新所有 renderAllMarkdown 调用**
   - 给函数添加 `monthKey` 参数
   - 所有调用处都传入对应的月份标识

### 3. **修复保存后的刷新**
   - 保存日记内容后，遍历所有月份组
   - 更新所有包含该日期的格子

现在每个日期在不同月份组中的显示都是独立的，9月29日和30日会在9月组中正确显示内容，同时在10月组中也会显示（作为填充日期）。

你可以在 Obsidian 中重新加载插件来测试修复效果！

---

**User**

检查一下现在在各个页面/功能窗口按 esc 的作用逻辑，现在似乎会直接跳转到别的页面去（跳出插件页面），很奇怪

---

**Cursor**

让我检查一下 ESC 键的处理逻辑。

我发现问题了！ESC 键处理没有阻止事件的默认行为和传播，导致事件继续冒泡到 Obsidian，触发了 Obsidian 的其他行为。另外，月份选择器也没有 ESC 键处理。让我修复这个问题：

```typescriptreact
import * as React from "react";
import { App, TFile, moment, MarkdownRenderer } from "obsidian";
import type CalendarQuickViewPlugin from "../main";

interface CalendarViewProps {
  app: App;
  plugin: CalendarQuickViewPlugin;
  settings: any;
}

interface CalendarDay {
  date: moment.Moment;
  isCurrentMonth: boolean;
  isToday: boolean;
  content: string;
  fullContent: string;
  file: TFile | null;
}

interface DiaryModal {
  isOpen: boolean;
  day: CalendarDay | null;
  editableContent: string;
}

interface MonthData {
  month: moment.Moment;
  days: CalendarDay[];
}

interface MonthYearPickerProps {
  currentMonth: moment.Moment;
  onSelectMonth: (month: moment.Moment) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  const [selectedYear, setSelectedYear] = React.useState(currentMonth.year());
  const [selectedMonth, setSelectedMonth] = React.useState(
    currentMonth.month()
  );

  const currentYear = moment().year();
  const years = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  const months = moment.months();

  const handleConfirm = () => {
    const newMonth = moment().year(selectedYear).month(selectedMonth);
    onSelectMonth(newMonth);
  };

  return (
    <div className="month-year-picker">
      <div className="month-year-picker-header">
        <h3>选择年月</h3>
        <button className="month-picker-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="month-year-picker-body">
        <div className="year-selector">
          <h4>年份</h4>
          <div className="year-list">
            {years.map((year) => (
              <button
                key={year}
                className={`year-button ${
                  selectedYear === year ? "selected" : ""
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="month-selector">
          <h4>月份</h4>
          <div className="month-grid">
            {months.map((month, index) => (
              <button
                key={index}
                className={`month-button ${
                  selectedMonth === index ? "selected" : ""
                }`}
                onClick={() => setSelectedMonth(index)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="month-year-picker-footer">
        <button className="month-picker-cancel" onClick={onClose}>
          取消
        </button>
        <button className="month-picker-confirm" onClick={handleConfirm}>
          确定
        </button>
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  app,
  plugin,
  settings,
}) => {
  const [months, setMonths] = React.useState<MonthData[]>([]);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [diaryModal, setDiaryModal] = React.useState<DiaryModal>({
    isOpen: false,
    day: null,
    editableContent: "",
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const contentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [currentVisibleMonth, setCurrentVisibleMonth] =
    React.useState<moment.Moment>(moment());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const hasInitialScrolled = React.useRef(false);

  // Initialize with current month and surrounding months
  React.useEffect(() => {
    initializeCalendar();
  }, [settings]);

  // Handle ESC key to close modals
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Check if any modal is open and close it
        if (diaryModal.isOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeModal();
        } else if (showMonthPicker) {
          event.preventDefault();
          event.stopPropagation();
          setShowMonthPicker(false);
        }
      }
    };

    document.addEventListener("keydown", handleEscKey, true); // Use capture phase
    return () => {
      document.removeEventListener("keydown", handleEscKey, true);
    };
  }, [diaryModal.isOpen, showMonthPicker]);

  const initializeCalendar = async () => {
    const today = moment();
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before, current, and 3 months after
    for (let i = -3; i <= 3; i++) {
      const month = today.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(today);

    // Scroll to today's month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      // Scroll to today's month
      if (!hasInitialScrolled.current && scrollContainerRef.current) {
        const todayMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(today, "month")
        );

        if (todayMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[todayMonthIndex]) {
            monthElements[todayMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
            hasInitialScrolled.current = true;
          }
        }
      }
    }, 200);
  };

  const loadMonthsData = async (
    monthsToLoad: MonthData[]
  ): Promise<MonthData[]> => {
    const updatedMonths = await Promise.all(
      monthsToLoad.map(async (monthData) => {
        const days = generateCalendarDays(
          monthData.month,
          settings.startWeekOnMonday
        );
        const daysWithContent = await Promise.all(
          days.map(async (day) => {
            const file = await getDiaryFile(day.date);
            const fullContent = file ? await getFullContent(file) : "";
            const content = fullContent;
            return { ...day, file, content, fullContent };
          })
        );
        return { ...monthData, days: daysWithContent };
      })
    );

    return updatedMonths;
  };

  const renderAllMarkdown = async (days: CalendarDay[], monthKey: string) => {
    for (const day of days) {
      if (day.file && day.content) {
        const dateKey = day.date.format("YYYY-MM-DD");
        const uniqueKey = `${monthKey}-${dateKey}`;
        const container = contentRefs.current.get(uniqueKey);
        if (container) {
          container.empty();
          await MarkdownRenderer.renderMarkdown(
            day.content,
            container,
            day.file.path,
            null as any
          );
        }
      }
    }
  };

  // Handle scroll to load more months and update visible month
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Update current visible month based on scroll position
    const monthElements = container.querySelectorAll(".calendar-month-block");
    const containerTop = container.getBoundingClientRect().top;

    for (let i = 0; i < monthElements.length; i++) {
      const element = monthElements[i];
      const rect = element.getBoundingClientRect();
      // Check if this month block is in the viewport (top part visible)
      if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
        const monthKey = element.getAttribute("data-month");
        if (monthKey && months[i]) {
          setCurrentVisibleMonth(months[i].month);
        }
        break;
      }
    }

    // Load more months when near top or bottom
    if (!isLoadingMore) {
      if (scrollTop < 300) {
        loadMoreMonths("before");
      } else if (scrollTop + clientHeight > scrollHeight - 300) {
        loadMoreMonths("after");
      }
    }
  }, [isLoadingMore, months]);

  const loadMoreMonths = async (direction: "before" | "after") => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    const newMonths: MonthData[] = [];
    if (direction === "before") {
      // Add 2 months before the first month
      const firstMonth = months[0].month;
      for (let i = 2; i >= 1; i--) {
        const month = firstMonth.clone().subtract(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...loadedMonths, ...months];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    } else {
      // Add 2 months after the last month
      const lastMonth = months[months.length - 1].month;
      for (let i = 1; i <= 2; i++) {
        const month = lastMonth.clone().add(i, "months");
        newMonths.push({ month, days: [] });
      }

      const loadedMonths = await loadMonthsData(newMonths);
      const allMonths = [...months, ...loadedMonths];
      setMonths(allMonths);

      // Render markdown after state update
      setTimeout(() => {
        loadedMonths.forEach((monthData) => {
          renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
        });
      }, 200);
    }

    setIsLoadingMore(false);
  };

  const generateCalendarDays = (
    month: moment.Moment,
    startMonday: boolean
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const startOfMonth = month.clone().startOf("month");
    const endOfMonth = month.clone().endOf("month");
    const today = moment().startOf("day");

    // Calculate the first day to display
    let firstDay = startOfMonth.clone();
    const dayOfWeek = startMonday ? firstDay.isoWeekday() : firstDay.day();
    const offset = startMonday ? dayOfWeek - 1 : dayOfWeek;
    firstDay.subtract(offset, "days");

    // Generate 6 weeks of days (42 days)
    for (let i = 0; i < 42; i++) {
      const date = firstDay.clone().add(i, "days");
      days.push({
        date,
        isCurrentMonth: date.isSame(month, "month"),
        isToday: date.isSame(today, "day"),
        content: "",
        fullContent: "",
        file: null,
      });
    }

    return days;
  };

  const getDiaryFile = async (date: moment.Moment): Promise<TFile | null> => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const file = app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  };

  const getFullContent = async (file: TFile): Promise<string> => {
    try {
      const content = await app.vault.cachedRead(file);
      return content || "Empty note";
    } catch (error) {
      console.error("Error reading file:", error);
      return "";
    }
  };

  const handleDayClick = async (day: CalendarDay, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd key is pressed
    const isCtrlClick = event.ctrlKey || event.metaKey;

    if (day.file) {
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: Open file in editor
        await app.workspace.getLeaf(false).openFile(day.file);
      } else {
        // Normal Click: Open editable modal
        const fullContent = await getFullContent(day.file);
        setDiaryModal({
          isOpen: true,
          day: day,
          editableContent: fullContent,
        });
      }
    } else {
      // No file exists, create it
      await createDiaryEntry(day.date);
    }
  };

  const closeModal = () => {
    setDiaryModal({
      isOpen: false,
      day: null,
      editableContent: "",
    });
    setIsSaving(false);
  };

  const saveModalContent = async () => {
    if (!diaryModal.day?.file) return;

    setIsSaving(true);
    try {
      await app.vault.modify(diaryModal.day.file, diaryModal.editableContent);
      closeModal();

      // Refresh the specific day's content
      const updatedContent = diaryModal.editableContent;
      const dateKey = diaryModal.day.date.format("YYYY-MM-DD");

      // Update the content in state
      setMonths(
        months.map((monthData) => ({
          ...monthData,
          days: monthData.days.map((day) => {
            if (day.date.format("YYYY-MM-DD") === dateKey) {
              return {
                ...day,
                content: updatedContent,
                fullContent: updatedContent,
              };
            }
            return day;
          }),
        }))
      );

      // Re-render markdown for this specific day in all months where it appears
      setTimeout(() => {
        months.forEach((monthData) => {
          const uniqueKey = `${monthData.month.format("YYYY-MM")}-${dateKey}`;
          const container = contentRefs.current.get(uniqueKey);
          if (container && diaryModal.day?.file) {
            container.empty();
            MarkdownRenderer.renderMarkdown(
              updatedContent,
              container,
              diaryModal.day.file.path,
              null as any
            );
          }
        });
      }, 100);
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file. Please try again.");
      setIsSaving(false);
    }
  };

  const handleModalContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDiaryModal({
      ...diaryModal,
      editableContent: event.target.value,
    });
  };

  const createDiaryEntry = async (date: moment.Moment) => {
    const dateStr = date.format(settings.dateFormat);
    const fileName = `${dateStr}.md`;
    const folderPath = settings.diaryFolder;
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Ensure folder exists
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create the file
    const file = await app.vault.create(filePath, `# ${dateStr}\n\n`);
    await app.workspace.getLeaf(false).openFile(file);

    // Refresh calendar
    initializeCalendar();
  };

  const goToToday = () => {
    // Find the month containing today
    const today = moment();
    const todayMonthIndex = months.findIndex((m) =>
      m.month.isSame(today, "month")
    );

    if (todayMonthIndex >= 0 && scrollContainerRef.current) {
      // Scroll to today's month
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[todayMonthIndex]) {
        monthElements[todayMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // Today's month not loaded, reinitialize
      initializeCalendar();
    }
  };

  const goToMonth = (targetMonth: moment.Moment) => {
    const targetMonthIndex = months.findIndex((m) =>
      m.month.isSame(targetMonth, "month")
    );

    if (targetMonthIndex >= 0 && scrollContainerRef.current) {
      // Month is loaded, scroll to it
      const monthElements = scrollContainerRef.current.querySelectorAll(
        ".calendar-month-block"
      );
      if (monthElements[targetMonthIndex]) {
        monthElements[targetMonthIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setCurrentVisibleMonth(targetMonth);
      }
    } else {
      // Month not loaded, load it
      loadMonthRange(targetMonth);
    }
    setShowMonthPicker(false);
  };

  const loadMonthRange = async (centerMonth: moment.Moment) => {
    const monthsToLoad: MonthData[] = [];

    // Load 3 months before and after the target month
    for (let i = -3; i <= 3; i++) {
      const month = centerMonth.clone().add(i, "months");
      monthsToLoad.push({
        month: month,
        days: [],
      });
    }

    const loadedMonths = await loadMonthsData(monthsToLoad);
    setMonths(loadedMonths);
    setCurrentVisibleMonth(centerMonth);

    // Scroll to target month after rendering
    setTimeout(() => {
      loadedMonths.forEach((monthData) => {
        renderAllMarkdown(monthData.days, monthData.month.format("YYYY-MM"));
      });

      if (scrollContainerRef.current) {
        const targetMonthIndex = loadedMonths.findIndex((m) =>
          m.month.isSame(centerMonth, "month")
        );

        if (targetMonthIndex >= 0) {
          const monthElements = scrollContainerRef.current.querySelectorAll(
            ".calendar-month-block"
          );
          if (monthElements[targetMonthIndex]) {
            monthElements[targetMonthIndex].scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }
        }
      }
    }, 200);
  };

  const weekDays = settings.startWeekOnMonday
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const visibleWeekDays = settings.showWeekends
    ? weekDays
    : weekDays.slice(settings.startWeekOnMonday ? 0 : 1, -1);

  const getVisibleDays = (days: CalendarDay[]) => {
    return settings.showWeekends
      ? days
      : days.filter((day) => {
          const dayOfWeek = settings.startWeekOnMonday
            ? day.date.isoWeekday()
            : day.date.day();
          return settings.startWeekOnMonday
            ? dayOfWeek <= 5
            : dayOfWeek > 0 && dayOfWeek < 6;
        });
  };

  return (
    <div className="calendar-quick-view-container">
      <div className="calendar-header-sticky">
        <div className="calendar-title">
          <h3
            className="calendar-current-month-title"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ cursor: "pointer" }}
            title="Click to select month"
          >
            {currentVisibleMonth.format("YYYY年MM月")}
          </h3>
          <button className="calendar-today-button" onClick={goToToday}>
            📍 Today
          </button>
        </div>
      </div>

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div
          className="month-picker-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="month-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MonthYearPicker
              currentMonth={currentVisibleMonth}
              onSelectMonth={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          </div>
        </div>
      )}

      <div
        className="calendar-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {months.map((monthData, monthIndex) => {
          const visibleDays = getVisibleDays(monthData.days);
          const isCurrentMonth = monthData.month.isSame(moment(), "month");

          return (
            <div
              key={monthData.month.format("YYYY-MM")}
              data-month={monthData.month.format("YYYY-MM")}
              className={`calendar-month-block ${
                isCurrentMonth ? "current-month-block" : ""
              }`}
            >
              <div className="calendar-month-header">
                <h4>{monthData.month.format("MMMM YYYY")}</h4>
              </div>

              <div className="calendar-grid">
                <div className="calendar-weekdays">
                  {visibleWeekDays.map((day) => (
                    <div key={day} className="calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-days">
                  {visibleDays.map((day, index) => {
                    const dateKey = day.date.format("YYYY-MM-DD");
                    const uniqueKey = `${monthData.month.format(
                      "YYYY-MM"
                    )}-${dateKey}`;
                    const isWeekend =
                      day.date.day() === 0 || day.date.day() === 6;

                    return (
                      <div
                        key={index}
                        className={`calendar-day ${
                          day.isCurrentMonth ? "current-month" : "other-month"
                        } ${day.isToday ? "today" : ""} ${
                          day.file ? "has-content" : ""
                        } ${isWeekend ? "weekend" : ""}`}
                        onClick={(e) => handleDayClick(day, e)}
                        onMouseEnter={() => setHoveredDay(dateKey)}
                        onMouseLeave={() => setHoveredDay(null)}
                      >
                        <div className="calendar-day-number">
                          {day.date.format("D")}
                        </div>
                        {day.content && (
                          <div
                            className="calendar-day-content markdown-rendered"
                            ref={(el) => {
                              if (el) {
                                contentRefs.current.set(uniqueKey, el as any);
                              }
                            }}
                          />
                        )}
                        {!day.file && day.isCurrentMonth && (
                          <div className="calendar-day-empty">
                            Click to create
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoadingMore && (
          <div className="calendar-loading">Loading more months...</div>
        )}
      </div>

      {/* Diary Edit Modal */}
      {diaryModal.isOpen && diaryModal.day && (
        <div className="diary-modal-overlay" onClick={closeModal}>
          <div
            className="diary-modal-content diary-modal-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="diary-modal-header">
              <h2>{diaryModal.day.date.format("YYYY-MM-DD")}</h2>
              <div className="diary-modal-actions">
                <button
                  className="diary-modal-button diary-modal-save"
                  onClick={saveModalContent}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? "💾 Saving..." : "💾 Save"}
                </button>
                <button
                  className="diary-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="diary-modal-body">
              <textarea
                className="diary-modal-textarea"
                value={diaryModal.editableContent}
                onChange={handleModalContentChange}
                placeholder="Write your diary here..."
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

```

完成！我已经修复了 ESC 键的处理逻辑。问题和解决方案如下：

## 🐛 问题原因

之前的 ESC 键处理没有阻止事件的默认行为和传播，导致：
1. ESC 事件继续冒泡到 Obsidian 的其他处理器
2. Obsidian 的默认 ESC 行为（如关闭面板、跳转等）被触发
3. 月份选择器没有 ESC 键处理

## ✅ 修复内容

### 1. **阻止事件传播**
   - 添加 `event.preventDefault()` - 阻止默认行为
   - 添加 `event.stopPropagation()` - 阻止事件冒泡到父级

### 2. **使用捕获阶段**
   - `addEventListener` 的第三个参数设为 `true`
   - 确保我们的处理器在捕获阶段先于其他处理器执行

### 3. **支持月份选择器**
   - ESC 键现在也能关闭月份选择器
   - 优先级：日记弹窗 > 月份选择器

### 4. **优化处理逻辑**
   - 只有在相关弹窗打开时才处理 ESC 键
   - 处理完后立即阻止事件传播，避免影响其他组件

现在的行为：
- 在日记编辑窗口按 ESC → 关闭日记窗口，**不会跳转页面**
- 在月份选择器按 ESC → 关闭选择器，**不会跳转页面**
- 没有弹窗打开时按 ESC → 不做处理，让 Obsidian 处理

你可以在 Obsidian 中重新加载插件来测试修复效果！

