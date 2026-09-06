import type { LayoutSettings, WindowLayout } from "../types";
import defaultLayouts from "./defaultLayouts.json";

export const DEFAULT_LAYOUTS: WindowLayout[] = defaultLayouts;

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  selectedLayoutId: "two-columns",
  layouts: DEFAULT_LAYOUTS,
  gap: 8,
  margins: {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
  },
};

export function createDefaultLayoutSettings(): LayoutSettings {
  return structuredClone(DEFAULT_LAYOUT_SETTINGS);
}
