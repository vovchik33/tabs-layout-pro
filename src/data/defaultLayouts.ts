import type { GridLayout, LayoutSettings } from "../types";

export const CUSTOM_LAYOUT_ID = "custom";

export const DEFAULT_LAYOUTS: GridLayout[] = [
  {
    id: "two-columns",
    name: "Two Columns",
    description: "Two windows side by side",
    rows: 1,
    columns: 2,
  },
  {
    id: "two-rows",
    name: "Two Rows",
    description: "Two windows stacked vertically",
    rows: 2,
    columns: 1,
  },
  {
    id: "three-columns",
    name: "Three Columns",
    description: "Three equal vertical columns",
    rows: 1,
    columns: 3,
  },
  {
    id: "quadrants",
    name: "Quadrants",
    description: "Four windows in a 2 × 2 grid",
    rows: 2,
    columns: 2,
  },
];

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  selectedLayoutId: "two-columns",
  customLayout: {
    rows: 2,
    columns: 2,
    gap: 8,
    margins: {
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    },
  },
};

export function getLayoutById(layoutId: string): GridLayout | undefined {
  return DEFAULT_LAYOUTS.find((layout) => layout.id === layoutId);
}
