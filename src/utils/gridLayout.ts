import type { CustomLayout, LayoutMargins, WindowBounds } from "../types";

export const GRID_LIMITS = {
  rows: { min: 1, max: 6 },
  columns: { min: 1, max: 6 },
  gap: { min: 0, max: 64 },
  margin: { min: 0, max: 240 },
} as const;

const MIN_WINDOW_WIDTH = 100;
const MIN_WINDOW_HEIGHT = 80;

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeMargins(margins: LayoutMargins): LayoutMargins {
  return {
    top: clampInteger(margins.top, GRID_LIMITS.margin.min, GRID_LIMITS.margin.max),
    right: clampInteger(margins.right, GRID_LIMITS.margin.min, GRID_LIMITS.margin.max),
    bottom: clampInteger(margins.bottom, GRID_LIMITS.margin.min, GRID_LIMITS.margin.max),
    left: clampInteger(margins.left, GRID_LIMITS.margin.min, GRID_LIMITS.margin.max),
  };
}

export function normalizeCustomLayout(layout: CustomLayout): CustomLayout {
  return {
    rows: clampInteger(layout.rows, GRID_LIMITS.rows.min, GRID_LIMITS.rows.max),
    columns: clampInteger(
      layout.columns,
      GRID_LIMITS.columns.min,
      GRID_LIMITS.columns.max
    ),
    gap: clampInteger(layout.gap, GRID_LIMITS.gap.min, GRID_LIMITS.gap.max),
    margins: normalizeMargins(layout.margins),
  };
}

export function calculateGridSlots(
  workArea: WindowBounds,
  rows: number,
  columns: number,
  gap: number,
  margins: LayoutMargins
): WindowBounds[] {
  const safeRows = clampInteger(rows, GRID_LIMITS.rows.min, GRID_LIMITS.rows.max);
  const safeColumns = clampInteger(
    columns,
    GRID_LIMITS.columns.min,
    GRID_LIMITS.columns.max
  );
  const safeGap = clampInteger(gap, GRID_LIMITS.gap.min, GRID_LIMITS.gap.max);
  const safeMargins = normalizeMargins(margins);

  const availableWidth =
    workArea.width -
    safeMargins.left -
    safeMargins.right -
    safeGap * (safeColumns - 1);
  const availableHeight =
    workArea.height -
    safeMargins.top -
    safeMargins.bottom -
    safeGap * (safeRows - 1);

  if (
    availableWidth < safeColumns * MIN_WINDOW_WIDTH ||
    availableHeight < safeRows * MIN_WINDOW_HEIGHT
  ) {
    throw new Error(
      "This grid, gap, and margin combination does not fit on the active display."
    );
  }
  const baseWidth = Math.floor(availableWidth / safeColumns);
  const baseHeight = Math.floor(availableHeight / safeRows);
  const widthRemainder = availableWidth - baseWidth * safeColumns;
  const heightRemainder = availableHeight - baseHeight * safeRows;
  const slots: WindowBounds[] = [];

  let top = workArea.top + safeMargins.top;
  for (let row = 0; row < safeRows; row += 1) {
    const height = baseHeight + (row < heightRemainder ? 1 : 0);
    let left = workArea.left + safeMargins.left;

    for (let column = 0; column < safeColumns; column += 1) {
      const width = baseWidth + (column < widthRemainder ? 1 : 0);
      slots.push({ left, top, width, height });
      left += width + safeGap;
    }

    top += height + safeGap;
  }

  return slots;
}
