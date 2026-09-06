import { useCallback, useEffect, useState } from "react";
import { createDefaultLayoutSettings } from "../data/defaultLayouts";
import { useStorageSync } from "../hooks/useStorageSync";
import type {
  ArrangeWindowsResult,
  ExtensionUpdateNotice,
  LayoutSettings,
  WindowLayout,
} from "../types";
import { cn } from "../utils/cn";
import { getDisplayWindowContext } from "../utils/displayBounds";
import { normalizeLayoutSettings } from "../utils/gridLayout";
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

interface CaptureResponse {
  success: boolean;
  result?: {
    layout: WindowLayout;
    hasOverlaps: boolean;
  };
  error?: string;
}

function cloneDefaultSettings(): LayoutSettings {
  return createDefaultLayoutSettings();
}

export function Popup() {
  const [settings, setSettings] = useState<LayoutSettings>(cloneDefaultSettings);
  const [contextLabel, setContextLabel] = useState("Finding active display…");
  const [status, setStatus] = useState("Choose a layout for existing windows.");
  const [statusKind, setStatusKind] = useState<
    "idle" | "success" | "warning" | "error"
  >("idle");
  const [isApplying, setIsApplying] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMovingWindow, setIsMovingWindow] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<ExtensionUpdateNotice | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const saved = await getStorageData<unknown>(
        LAYOUT_SETTINGS_KEY,
        createDefaultLayoutSettings()
      );
      setSettings(normalizeLayoutSettings(saved));
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

  const removeLayout = async (layoutId: string) => {
    const previous = settings;
    const layouts = settings.layouts.filter((layout) => layout.id !== layoutId);
    const next = {
      ...settings,
      layouts,
      selectedLayoutId:
        settings.selectedLayoutId === layoutId
          ? (layouts[0]?.id ?? "")
          : settings.selectedLayoutId,
    };
    setSettings(next);
    try {
      await setStorageData(LAYOUT_SETTINGS_KEY, next);
      setStatus("Layout removed.");
      setStatusKind("success");
    } catch (error) {
      setSettings(previous);
      setStatus(error instanceof Error ? error.message : "Could not remove layout.");
      setStatusKind("error");
    }
  };

  const restoreDefaultLayouts = async () => {
    const defaults = createDefaultLayoutSettings();
    const restored = {
      ...settings,
      selectedLayoutId: defaults.selectedLayoutId,
      layouts: defaults.layouts,
    };
    try {
      await setStorageData(LAYOUT_SETTINGS_KEY, restored);
      setSettings(restored);
      setStatus("Default layouts restored.");
      setStatusKind("success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not restore default layouts."
      );
      setStatusKind("error");
    }
  };

  const applyLayout = async (layoutId: string) => {
    setIsApplying(true);
    setStatusKind("idle");
    setStatus("Arranging windows…");

    try {
      const preserveWindowSlots = settings.selectedLayoutId === layoutId;
      await selectLayout(layoutId);
      const response = (await chrome.runtime.sendMessage({
        action: "arrange-windows",
        layoutId,
        preserveWindowSlots,
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

  const arrangeLayoutSlot = async (
    layoutId: string,
    slotIndex: number,
    moveOnlyCurrent: boolean
  ) => {
    setIsMovingWindow(true);
    setStatusKind("idle");
    setStatus(moveOnlyCurrent ? "Moving current window…" : "Arranging windows…");

    try {
      if (!moveOnlyCurrent) {
        await selectLayout(layoutId);
      }
      const response = (await chrome.runtime.sendMessage({
        action: "arrange-layout-slot",
        layoutId,
        slotIndex,
        moveOnlyCurrent,
      })) as ArrangeResponse;
      if (!response.success || !response.result) {
        throw new Error(response.error || "Current window could not be moved.");
      }

      setStatus(
        moveOnlyCurrent
          ? `Moved current window to position ${slotIndex + 1} on ${response.result.displayName}.`
          : `Arranged ${response.result.arrangedCount} window` +
            (response.result.arrangedCount === 1 ? "" : "s") +
            ` with the current window in position ${slotIndex + 1}.`
      );
      setStatusKind("success");
      await loadContext();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Current window could not be moved."
      );
      setStatusKind("error");
    } finally {
      setIsMovingWindow(false);
    }
  };

  const addCustomLayout = async () => {
    setIsCapturing(true);
    setStatusKind("idle");
    setStatus("Capturing current window positions…");

    try {
      const response = (await chrome.runtime.sendMessage({
        action: "capture-layout",
      })) as CaptureResponse;
      if (!response.success || !response.result) {
        throw new Error(response.error || "Current layout could not be saved.");
      }

      await loadSettings();
      const { layout, hasOverlaps } = response.result;
      setStatus(
        `Saved ${layout.id} with ${layout.windows.length} window` +
          (layout.windows.length === 1 ? "." : "s.") +
          (hasOverlaps ? " Warning: some window positions overlap." : "")
      );
      setStatusKind(hasOverlaps ? "warning" : "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Current layout could not be saved."
      );
      setStatusKind("error");
    } finally {
      setIsCapturing(false);
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
        <div
          className={cn(
            styles.layoutGrid,
            settings.layouts.length > 6 && styles.layoutGridDense
          )}
        >
          {settings.layouts.map((layout) => (
            <div key={layout.id} className={styles.layoutCardWrapper}>
              <div
                className={cn(
                  styles.layoutCard,
                  settings.selectedLayoutId === layout.id &&
                    styles.layoutCardSelected
                )}
                role="button"
                tabIndex={isApplying || isCapturing || isMovingWindow ? -1 : 0}
                aria-disabled={isApplying || isCapturing || isMovingWindow}
                onClick={() => {
                  if (!isApplying && !isCapturing && !isMovingWindow) {
                    void applyLayout(layout.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ") &&
                    !isApplying &&
                    !isCapturing &&
                    !isMovingWindow
                  ) {
                    event.preventDefault();
                    void applyLayout(layout.id);
                  }
                }}
              >
                <LayoutPreview
                  layout={layout}
                  disabled={isApplying || isCapturing || isMovingWindow}
                  onSelectSlot={(slotIndex, moveOnlyCurrent) =>
                    void arrangeLayoutSlot(
                      layout.id,
                      slotIndex,
                      moveOnlyCurrent
                    )
                  }
                />
              </div>
              <button
                type="button"
                className={styles.removeLayoutButton}
                aria-label={`Remove ${layout.id}`}
                title={`Remove ${layout.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void removeLayout(layout.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          {settings.layouts.length === 0 && (
            <div className={styles.emptyLayouts}>
              <span>
                No layouts. Capture the current windows or import a configuration.
              </span>
              <button
                type="button"
                className={styles.emptyRestoreButton}
                onClick={() => void restoreDefaultLayouts()}
              >
                Restore Defaults
              </button>
            </div>
          )}
        </div>

        <div className={styles.layoutActions}>
          <button
            type="button"
            className={styles.addCustomButton}
            disabled={isCapturing || isApplying || isMovingWindow}
            onClick={() => void addCustomLayout()}
          >
            {isCapturing ? "Saving…" : "Add Current"}
          </button>
        </div>

        <div
          className={cn(
            styles.status,
            statusKind === "success" && styles.statusSuccess,
            statusKind === "warning" && styles.statusWarning,
            statusKind === "error" && styles.statusError
          )}
        >
          {status}
        </div>
      </main>
    </div>
  );
}

interface LayoutPreviewProps {
  layout: WindowLayout;
  disabled: boolean;
  onSelectSlot: (slotIndex: number, moveOnlyCurrent: boolean) => void;
}

function LayoutPreview({ layout, disabled, onSelectSlot }: LayoutPreviewProps) {
  return (
    <div className={styles.preview}>
      {layout.windows.map(({ position }, index) => (
        <button
          key={index}
          type="button"
          className={styles.previewSlot}
          disabled={disabled}
          aria-label={`Arrange ${layout.id} with current window in position ${index + 1}; Shift click moves only the current window`}
          title={`Click to arrange all; Shift+click to move only current window`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectSlot(index, event.shiftKey);
          }}
          style={{
            top: `${position.top * 100}%`,
            left: `${position.left * 100}%`,
            width: `${position.width * 100}%`,
            height: `${position.height * 100}%`,
          }}
        />
      ))}
    </div>
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
