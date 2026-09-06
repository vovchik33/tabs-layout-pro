import { useCallback, useEffect, useState } from "react";
import {
  CUSTOM_LAYOUT_ID,
  DEFAULT_LAYOUTS,
  DEFAULT_LAYOUT_SETTINGS,
} from "../data/defaultLayouts";
import { useStorageSync } from "../hooks/useStorageSync";
import type {
  ArrangeWindowsResult,
  ExtensionUpdateNotice,
  GridLayout,
  LayoutSettings,
} from "../types";
import { cn } from "../utils/cn";
import { getDisplayWindowContext } from "../utils/displayBounds";
import { getStorageData, setStorageData } from "../utils/storage";
import styles from "./Popup.module.scss";

const LAYOUT_SETTINGS_KEY = "layoutSettings";
const STORAGE_KEYS = [LAYOUT_SETTINGS_KEY];
const isStandaloneWindow =
  new URLSearchParams(window.location.search).get("standalone") === "1";

interface ArrangeResponse {
  success: boolean;
  result?: ArrangeWindowsResult;
  error?: string;
}

function cloneDefaultSettings(): LayoutSettings {
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    customLayout: {
      ...DEFAULT_LAYOUT_SETTINGS.customLayout,
      margins: { ...DEFAULT_LAYOUT_SETTINGS.customLayout.margins },
    },
  };
}

export function Popup() {
  const [settings, setSettings] = useState<LayoutSettings>(cloneDefaultSettings);
  const [contextLabel, setContextLabel] = useState("Finding active display…");
  const [status, setStatus] = useState("Choose a layout for existing windows.");
  const [statusKind, setStatusKind] = useState<"idle" | "success" | "error">("idle");
  const [isApplying, setIsApplying] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<ExtensionUpdateNotice | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const saved = await getStorageData<LayoutSettings>(
        LAYOUT_SETTINGS_KEY,
        DEFAULT_LAYOUT_SETTINGS
      );
      setSettings(saved);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings.");
      setStatusKind("error");
    }
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const context = await getDisplayWindowContext();
      const displayName = context.display.name || context.display.id;
      const count = context.windows.length;
      setContextLabel(`${displayName} · ${count} window${count === 1 ? "" : "s"}`);
    } catch (error) {
      setContextLabel(error instanceof Error ? error.message : "No active display");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadContext();
  }, [loadContext, loadSettings]);

  useStorageSync(STORAGE_KEYS, loadSettings);

  useEffect(() => {
    const refreshContext = () => void loadContext();
    chrome.windows.onCreated.addListener(refreshContext);
    chrome.windows.onRemoved.addListener(refreshContext);
    chrome.windows.onFocusChanged.addListener(refreshContext);
    chrome.windows.onBoundsChanged.addListener(refreshContext);

    return () => {
      chrome.windows.onCreated.removeListener(refreshContext);
      chrome.windows.onRemoved.removeListener(refreshContext);
      chrome.windows.onFocusChanged.removeListener(refreshContext);
      chrome.windows.onBoundsChanged.removeListener(refreshContext);
    };
  }, [loadContext]);

  useEffect(() => {
    void chrome.storage.local.get("updateNotice").then((result) => {
      setUpdateNotice((result.updateNotice as ExtensionUpdateNotice | undefined) ?? null);
    });

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== "local" || !changes.updateNotice) return;
      setUpdateNotice(
        (changes.updateNotice.newValue as ExtensionUpdateNotice | undefined) ?? null
      );
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const selectLayout = async (layoutId: string) => {
    const previous = settings;
    const next = { ...settings, selectedLayoutId: layoutId };
    setSettings(next);
    try {
      await setStorageData(LAYOUT_SETTINGS_KEY, next);
    } catch (error) {
      setSettings(previous);
      setStatus(error instanceof Error ? error.message : "Could not save layout.");
      setStatusKind("error");
    }
  };

  const applySelectedLayout = async () => {
    setIsApplying(true);
    setStatusKind("idle");
    setStatus("Arranging windows…");

    try {
      const response = (await chrome.runtime.sendMessage({
        action: "arrange-windows",
        layoutId: settings.selectedLayoutId,
      })) as ArrangeResponse;

      if (!response.success || !response.result) {
        throw new Error(response.error || "Layout could not be applied.");
      }

      const { arrangedCount, eligibleCount, displayName } = response.result;
      const extraCount = eligibleCount - arrangedCount;
      setStatus(
        `Arranged ${arrangedCount} window${arrangedCount === 1 ? "" : "s"} on ${displayName}` +
          (extraCount > 0 ? `; ${extraCount} extra left unchanged.` : ".")
      );
      setStatusKind("success");
      await loadContext();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Layout could not be applied.");
      setStatusKind("error");
    } finally {
      setIsApplying(false);
    }
  };

  const openInSeparateWindow = async () => {
    await chrome.windows.create({
      url: `${chrome.runtime.getURL("src/popup/index.html")}?standalone=1`,
      type: "popup",
      width: 420,
      height: 640,
      focused: true,
    });
    window.close();
  };

  const dismissUpdateNotice = async () => {
    await Promise.all([
      chrome.storage.local.remove("updateNotice"),
      chrome.action.setBadgeText({ text: "" }),
    ]);
    setUpdateNotice(null);
  };

  const customPreset: GridLayout = {
    id: CUSTOM_LAYOUT_ID,
    name: "Custom Grid",
    description: `${settings.customLayout.columns} columns × ${settings.customLayout.rows} rows`,
    rows: settings.customLayout.rows,
    columns: settings.customLayout.columns,
  };

  return (
    <div className={cn(styles.container, isStandaloneWindow && styles.standalone)}>
      <header className={styles.header}>
        <div>
          <h1>Tabs Layout Pro</h1>
          <div className={styles.context}>{contextLabel}</div>
        </div>
        <div className={styles.headerActions}>
          {!isStandaloneWindow && (
            <button
              type="button"
              className={styles.iconButton}
              title="Open in separate window"
              aria-label="Open in separate window"
              onClick={() => void openInSeparateWindow()}
            >
              <OpenWindowIcon />
            </button>
          )}
          <button
            type="button"
            className={styles.iconButton}
            title="Settings"
            aria-label="Settings"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      {updateNotice && (
        <div className={styles.updateNotice} role="status">
          <span>
            Updated from v{updateNotice.previousVersion} to{" "}
            <strong>v{updateNotice.currentVersion}</strong>
          </span>
          <button
            type="button"
            className={styles.noticeClose}
            aria-label="Dismiss update notification"
            onClick={() => void dismissUpdateNotice()}
          >
            ×
          </button>
        </div>
      )}

      <main className={styles.content}>
        <div className={styles.layoutGrid}>
          {[...DEFAULT_LAYOUTS, customPreset].map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={cn(
                styles.layoutCard,
                settings.selectedLayoutId === layout.id && styles.layoutCardSelected
              )}
              onClick={() => void selectLayout(layout.id)}
            >
              <LayoutPreview layout={layout} />
              <span className={styles.layoutName}>{layout.name}</span>
              <span className={styles.layoutDescription}>{layout.description}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.customizeButton}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Configure custom grid, gaps, and margins
        </button>

        <div className={cn(styles.status, statusKind === "success" && styles.statusSuccess, statusKind === "error" && styles.statusError)}>
          {status}
        </div>
      </main>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.applyButton}
          disabled={isApplying}
          onClick={() => void applySelectedLayout()}
        >
          {isApplying ? "Applying…" : "Apply Layout"}
        </button>
      </footer>
    </div>
  );
}

function LayoutPreview({ layout }: { layout: GridLayout }) {
  const cellCount = layout.rows * layout.columns;
  return (
    <span
      className={styles.preview}
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: cellCount }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1.1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function OpenWindowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="16" height="16" rx="2" />
      <path d="M14 3h7v7M21 3l-9 9" />
    </svg>
  );
}
