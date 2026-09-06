import type { WindowBounds } from "../types";

export interface DisplayWindowContext {
  activeWindow: chrome.windows.Window;
  display: chrome.system.display.DisplayUnitInfo;
  windows: chrome.windows.Window[];
}

function windowBounds(win: chrome.windows.Window): WindowBounds | null {
  if (
    win.left === undefined ||
    win.top === undefined ||
    win.width === undefined ||
    win.height === undefined
  ) {
    return null;
  }

  return {
    left: win.left,
    top: win.top,
    width: win.width,
    height: win.height,
  };
}

function intersectionArea(a: WindowBounds, b: chrome.system.display.Bounds): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export function findDisplayForWindow(
  win: chrome.windows.Window,
  displays: chrome.system.display.DisplayUnitInfo[]
): chrome.system.display.DisplayUnitInfo | undefined {
  const bounds = windowBounds(win);
  if (!bounds) {
    return displays.find((display) => display.isPrimary) ?? displays[0];
  }

  let bestDisplay: chrome.system.display.DisplayUnitInfo | undefined;
  let bestArea = 0;

  for (const display of displays) {
    const area = intersectionArea(bounds, display.bounds);
    if (area > bestArea) {
      bestArea = area;
      bestDisplay = display;
    }
  }

  if (bestDisplay) return bestDisplay;

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  return (
    displays.find(({ bounds: displayBounds }) => {
      return (
        centerX >= displayBounds.left &&
        centerX < displayBounds.left + displayBounds.width &&
        centerY >= displayBounds.top &&
        centerY < displayBounds.top + displayBounds.height
      );
    }) ??
    displays.find((display) => display.isPrimary) ??
    displays[0]
  );
}

export function displayWorkArea(
  display: chrome.system.display.DisplayUnitInfo
): WindowBounds {
  return {
    left: display.workArea.left,
    top: display.workArea.top,
    width: display.workArea.width,
    height: display.workArea.height,
  };
}

function sortWindows(
  windows: chrome.windows.Window[],
  activeWindowId: number | undefined
): chrome.windows.Window[] {
  return [...windows].sort((a, b) => {
    if (a.id === activeWindowId) return -1;
    if (b.id === activeWindowId) return 1;
    return (
      (a.top ?? 0) - (b.top ?? 0) ||
      (a.left ?? 0) - (b.left ?? 0) ||
      (a.id ?? 0) - (b.id ?? 0)
    );
  });
}

export async function getDisplayWindowContext(): Promise<DisplayWindowContext> {
  const [activeWindow, displays, windows] = await Promise.all([
    chrome.windows.getLastFocused({ windowTypes: ["normal"] }),
    chrome.system.display.getInfo(),
    chrome.windows.getAll({ windowTypes: ["normal"] }),
  ]);

  if (activeWindow.id === undefined) {
    throw new Error("No active browser window found.");
  }

  const display = findDisplayForWindow(activeWindow, displays);
  if (!display) {
    throw new Error("No display information is available.");
  }

  const displayWindows = windows.filter(
    (win) => findDisplayForWindow(win, displays)?.id === display.id
  );

  return {
    activeWindow,
    display,
    windows: sortWindows(displayWindows, activeWindow.id),
  };
}
