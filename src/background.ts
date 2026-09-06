import { DEFAULT_LAYOUT_SETTINGS } from "./data/defaultLayouts";
import type {
  ExtensionUpdateNotice,
  LayoutSettings,
} from "./types";
import { arrangeWindows } from "./utils/arrangeWindows";
import { getStorageData, setStorageData } from "./utils/storage";

const LAYOUT_SETTINGS_KEY = "layoutSettings";
let arrangementQueue: Promise<void> = Promise.resolve();

function applyLayout(layoutId?: string) {
  const operation = arrangementQueue.then(async () => {
    const settings = await getStorageData<LayoutSettings>(
      LAYOUT_SETTINGS_KEY,
      DEFAULT_LAYOUT_SETTINGS
    );
    return arrangeWindows(settings, layoutId);
  });

  arrangementQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existingSettings = await getStorageData<LayoutSettings | null>(
    LAYOUT_SETTINGS_KEY,
    null
  );
  if (!existingSettings) {
    await setStorageData(LAYOUT_SETTINGS_KEY, DEFAULT_LAYOUT_SETTINGS);
  }

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
  if (message.action !== "arrange-windows") return;

  applyLayout(typeof message.layoutId === "string" ? message.layoutId : undefined)
    .then((result) => sendResponse({ success: true, result }))
    .catch((error: Error) => {
      console.error("Failed to apply window layout:", error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
