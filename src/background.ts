import { createDefaultLayoutSettings } from "./data/defaultLayouts";
import type {
  ExtensionUpdateNotice,
  WindowBounds,
  WindowLayout,
} from "./types";
import { arrangeWindows } from "./utils/arrangeWindows";
import {
  captureLayoutWindows,
  layoutHasOverlaps,
  normalizeLayoutSettings,
  parseLayoutCollection,
} from "./utils/gridLayout";
import {
  displayWorkArea,
  getDisplayWindowContext,
} from "./utils/displayBounds";
import { getStorageData, setStorageData } from "./utils/storage";

const LAYOUT_SETTINGS_KEY = "layoutSettings";
let arrangementQueue: Promise<void> = Promise.resolve();

function applyLayout(layoutId?: string) {
  const operation = arrangementQueue.then(async () => {
    const savedSettings = await getStorageData<unknown>(
      LAYOUT_SETTINGS_KEY,
      createDefaultLayoutSettings()
    );
    const settings = normalizeLayoutSettings(savedSettings);
    return arrangeWindows(settings, layoutId);
  });

  arrangementQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function getWindowBounds(win: chrome.windows.Window, index: number): WindowBounds {
  if (
    win.left === undefined ||
    win.top === undefined ||
    win.width === undefined ||
    win.height === undefined
  ) {
    throw new Error(`Window ${index + 1} has no available bounds.`);
  }
  return {
    left: win.left,
    top: win.top,
    width: win.width,
    height: win.height,
  };
}

function captureCurrentLayout() {
  const operation = arrangementQueue.then(async () => {
    const savedSettings = await getStorageData<unknown>(
      LAYOUT_SETTINGS_KEY,
      createDefaultLayoutSettings()
    );
    const settings = normalizeLayoutSettings(savedSettings);
    const context = await getDisplayWindowContext();
    const windows = captureLayoutWindows(
      displayWorkArea(context.display),
      context.windows.map(getWindowBounds),
      settings.margins
    );

    let suffix = 1;
    while (settings.layouts.some((layout) => layout.id === `custom-${suffix}`)) {
      suffix += 1;
    }
    const layout: WindowLayout = {
      id: `custom-${suffix}`,
      name: `Custom Layout ${suffix}`,
      windows,
    };
    const layouts = parseLayoutCollection([...settings.layouts, layout]);
    await setStorageData(LAYOUT_SETTINGS_KEY, {
      ...settings,
      selectedLayoutId: layout.id,
      layouts,
    });
    return {
      layout,
      hasOverlaps: layoutHasOverlaps(layout),
    };
  });

  arrangementQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existingSettings = await getStorageData<unknown | null>(
    LAYOUT_SETTINGS_KEY,
    null
  );
  await setStorageData(
    LAYOUT_SETTINGS_KEY,
    normalizeLayoutSettings(existingSettings)
  );

  if (details.reason === "update" && details.previousVersion) {
    const updateNotice: ExtensionUpdateNotice = {
      previousVersion: details.previousVersion,
      currentVersion: chrome.runtime.getManifest().version,
    };
    await chrome.storage.local.set({ updateNotice });
    await chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
    await chrome.action.setBadgeText({ text: "NEW" });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "apply-layout") return;

  try {
    await applyLayout();
  } catch (error) {
    console.error("Failed to apply window layout:", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const operation =
    message.action === "arrange-windows"
      ? applyLayout(
          typeof message.layoutId === "string" ? message.layoutId : undefined
        )
      : message.action === "capture-layout"
        ? captureCurrentLayout()
        : undefined;
  if (!operation) return;

  operation
    .then((result) => sendResponse({ success: true, result }))
    .catch((error: Error) => {
      console.error("Window layout operation failed:", error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
