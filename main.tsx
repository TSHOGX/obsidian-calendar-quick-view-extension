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
const PLUGIN_ICON_ID = "calendar-clock";

export default class CalendarQuickViewPlugin extends Plugin {
  settings: CalendarQuickViewSettings;
  ribbonIconEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR_QUICK_VIEW,
      (leaf) => new CalendarQuickViewLeaf(leaf, this)
    );

    // Always add ribbon icon to activate view
    this.ribbonIconEl = this.addRibbonIcon(
      PLUGIN_ICON_ID,
      "Open Calendar Quick View",
      () => {
        this.activateView();
      }
    );

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
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
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
      leaf = workspace.getLeaf("tab");
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
    return PLUGIN_ICON_ID;
  }

  async onOpen() {
    this.refresh();
  }

  refresh() {
    const container = this.containerEl.children[1];
    if (!container) {
      console.error("Calendar Quick View: Container not found");
      return;
    }

    // First unmount any existing React component
    ReactDOM.unmountComponentAtNode(container);

    // Clear the container
    container.empty();
    container.addClass("calendar-view-container");

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
