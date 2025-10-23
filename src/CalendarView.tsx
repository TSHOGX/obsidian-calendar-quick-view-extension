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
