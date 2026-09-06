import type { ArrangeWindowsResult, LayoutSettings } from "../types";
import { displayWorkArea, getDisplayWindowContext } from "./displayBounds";
import { calculateLayoutSlots, normalizeLayoutSettings } from "./gridLayout";

const ZERO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };

async function updateWindowBounds(
  win: chrome.windows.Window,
  bounds: { left: number; top: number; width: number; height: number }
) {
  if (win.id === undefined) return;
  if (win.state !== "normal") {
    await chrome.windows.update(win.id, { state: "normal" });
  }
  await chrome.windows.update(win.id, bounds);
}

function assignNearestSlots(
  windows: chrome.windows.Window[],
  slots: Array<{ left: number; top: number; width: number; height: number }>
) {
  const uniquelyAssignedWindows = windows.slice(0, slots.length);
  const candidates = uniquelyAssignedWindows.flatMap((win, windowIndex) => {
    const windowCenterX = (win.left ?? 0) + (win.width ?? 0) / 2;
    const windowCenterY = (win.top ?? 0) + (win.height ?? 0) / 2;
    return slots.map((slot, slotIndex) => {
      const horizontalDistance =
        windowCenterX - (slot.left + slot.width / 2);
      const verticalDistance =
        windowCenterY - (slot.top + slot.height / 2);
      return {
        windowIndex,
        slotIndex,
        distance:
          horizontalDistance * horizontalDistance +
          verticalDistance * verticalDistance,
      };
    });
  });
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.windowIndex - b.windowIndex ||
      a.slotIndex - b.slotIndex
  );

  const assignedWindows = new Set<number>();
  const assignedSlots = new Set<number>();
  const assignments: Array<{
    win: chrome.windows.Window;
    bounds: (typeof slots)[number];
  }> = [];
  for (const candidate of candidates) {
    if (
      assignedWindows.has(candidate.windowIndex) ||
      assignedSlots.has(candidate.slotIndex)
    ) {
      continue;
    }
    assignedWindows.add(candidate.windowIndex);
    assignedSlots.add(candidate.slotIndex);
    assignments.push({
      win: windows[candidate.windowIndex],
      bounds: slots[candidate.slotIndex],
    });
    if (assignments.length === uniquelyAssignedWindows.length) break;
  }
  return [
    ...assignments,
    ...windows.slice(slots.length).map((win, index) => ({
      win,
      bounds: slots[index % slots.length],
    })),
  ];
}

export async function arrangeWindows(
  settings: LayoutSettings,
  requestedLayoutId = settings.selectedLayoutId,
  preserveWindowSlots = false
): Promise<ArrangeWindowsResult> {
  const normalizedSettings = normalizeLayoutSettings(settings);
  const layout = normalizedSettings.layouts.find(
    (candidate) => candidate.id === requestedLayoutId
  );
  if (!layout) {
    throw new Error(`Unknown layout: ${requestedLayoutId}`);
  }

  const context = await getDisplayWindowContext();
  const slots = calculateLayoutSlots(
    displayWorkArea(context.display),
    layout,
    normalizedSettings.applyGap ? normalizedSettings.gap : 0,
    normalizedSettings.applyMargins ? normalizedSettings.margins : ZERO_MARGINS
  );
  const windowsToArrange = context.windows;
  const activeWindowId = context.activeWindow.id;
  if (activeWindowId === undefined) {
    throw new Error("No active browser window found.");
  }

  const assignments = preserveWindowSlots
    ? assignNearestSlots(windowsToArrange, slots)
    : windowsToArrange.map((win, index) => ({
        win,
        bounds: slots[index % slots.length],
      }));
  for (const { win, bounds } of assignments) {
    await updateWindowBounds(win, bounds);
  }

  await chrome.windows.update(activeWindowId, { focused: true });

  return {
    arrangedCount: windowsToArrange.length,
    eligibleCount: context.windows.length,
    displayName: context.display.name || context.display.id,
  };
}

export async function moveActiveWindowToSlot(
  settings: LayoutSettings,
  layoutId: string,
  slotIndex: number
): Promise<ArrangeWindowsResult> {
  const normalizedSettings = normalizeLayoutSettings(settings);
  const layout = normalizedSettings.layouts.find(
    (candidate) => candidate.id === layoutId
  );
  if (!layout) {
    throw new Error(`Unknown layout: ${layoutId}`);
  }
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= layout.windows.length
  ) {
    throw new Error("Unknown window position.");
  }

  const context = await getDisplayWindowContext();
  const slots = calculateLayoutSlots(
    displayWorkArea(context.display),
    layout,
    normalizedSettings.applyGap ? normalizedSettings.gap : 0,
    normalizedSettings.applyMargins ? normalizedSettings.margins : ZERO_MARGINS
  );
  const activeWindowId = context.activeWindow.id;
  if (activeWindowId === undefined) {
    throw new Error("No active browser window found.");
  }

  await updateWindowBounds(context.activeWindow, slots[slotIndex]);

  return {
    arrangedCount: 1,
    eligibleCount: context.windows.length,
    displayName: context.display.name || context.display.id,
  };
}

export async function arrangeWindowsWithActiveSlot(
  settings: LayoutSettings,
  layoutId: string,
  slotIndex: number
): Promise<ArrangeWindowsResult> {
  const normalizedSettings = normalizeLayoutSettings(settings);
  const layout = normalizedSettings.layouts.find(
    (candidate) => candidate.id === layoutId
  );
  if (!layout) {
    throw new Error(`Unknown layout: ${layoutId}`);
  }
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= layout.windows.length
  ) {
    throw new Error("Unknown window position.");
  }

  const context = await getDisplayWindowContext();
  const slots = calculateLayoutSlots(
    displayWorkArea(context.display),
    layout,
    normalizedSettings.applyGap ? normalizedSettings.gap : 0,
    normalizedSettings.applyMargins ? normalizedSettings.margins : ZERO_MARGINS
  );
  const activeWindowId = context.activeWindow.id;
  if (activeWindowId === undefined) {
    throw new Error("No active browser window found.");
  }

  const remainingSlotIndexes = slots
    .map((_, index) => index)
    .filter((index) => index !== slotIndex);
  const remainingWindows = context.windows.filter(
    (win) => win.id !== activeWindowId
  );
  await updateWindowBounds(context.activeWindow, slots[slotIndex]);
  for (let index = 0; index < remainingWindows.length; index += 1) {
    const firstCycleSlot = remainingSlotIndexes[index];
    const repeatedSlot =
      slots[(index - remainingSlotIndexes.length) % slots.length];
    await updateWindowBounds(
      remainingWindows[index],
      firstCycleSlot === undefined ? repeatedSlot : slots[firstCycleSlot]
    );
  }
  await chrome.windows.update(activeWindowId, { focused: true });

  return {
    arrangedCount: context.windows.length,
    eligibleCount: context.windows.length,
    displayName: context.display.name || context.display.id,
  };
}
