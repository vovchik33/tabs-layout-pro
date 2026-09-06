import { CUSTOM_LAYOUT_ID, getLayoutById } from "../data/defaultLayouts";
import type { ArrangeWindowsResult, LayoutSettings } from "../types";
import { displayWorkArea, getDisplayWindowContext } from "./displayBounds";
import { calculateGridSlots, normalizeCustomLayout } from "./gridLayout";

export async function arrangeWindows(
  settings: LayoutSettings,
  requestedLayoutId = settings.selectedLayoutId
): Promise<ArrangeWindowsResult> {
  const customLayout = normalizeCustomLayout(settings.customLayout);
  const preset = getLayoutById(requestedLayoutId);

  if (requestedLayoutId !== CUSTOM_LAYOUT_ID && !preset) {
    throw new Error(`Unknown layout: ${requestedLayoutId}`);
  }

  const rows = preset?.rows ?? customLayout.rows;
  const columns = preset?.columns ?? customLayout.columns;
  const context = await getDisplayWindowContext();
  const slots = calculateGridSlots(
    displayWorkArea(context.display),
    rows,
    columns,
    customLayout.gap,
    customLayout.margins
  );
  const windowsToArrange = context.windows.slice(0, slots.length);
  const activeWindowId = context.activeWindow.id;
  if (activeWindowId === undefined) {
    throw new Error("No active browser window found.");
  }

  for (let index = 0; index < windowsToArrange.length; index += 1) {
    const win = windowsToArrange[index];
    const bounds = slots[index];
    if (win.id === undefined) continue;

    if (win.state !== "normal") {
      await chrome.windows.update(win.id, { state: "normal" });
    }

    await chrome.windows.update(win.id, {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }

  await chrome.windows.update(activeWindowId, { focused: true });

  return {
    arrangedCount: windowsToArrange.length,
    eligibleCount: context.windows.length,
    displayName: context.display.name || context.display.id,
  };
}
