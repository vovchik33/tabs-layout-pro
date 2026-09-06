import type { LayoutSettings, WindowLayout } from "../types";
import defaultLayouts from "./defaultLayouts.json";

export const DEFAULT_LAYOUTS: WindowLayout[] = defaultLayouts;

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  selectedLayoutId: "two-columns",
  layouts: DEFAULT_LAYOUTS,
  applyGap: false,
  gap: 0,
  applyMargins: false,
  margins: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

export function createDefaultLayoutSettings(): LayoutSettings {
  return structuredClone(DEFAULT_LAYOUT_SETTINGS);
}
