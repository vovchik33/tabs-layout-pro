import { createDefaultLayoutSettings } from "../data/defaultLayouts";
import type {
  LayoutMargins,
  LayoutSettings,
  NormalizedPosition,
  WindowBounds,
  WindowLayout,
} from "../types";

export const GRID_LIMITS = {
  gap: { min: 0, max: 64 },
  margin: { min: 0, max: 240 },
  layouts: { min: 0, max: 20 },
  windowsPerLayout: { min: 1, max: 36 },
  totalWindows: 64,
} as const;

const MIN_WINDOW_WIDTH = 100;
const MIN_WINDOW_HEIGHT = 80;
const POSITION_EPSILON = 1e-9;

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function normalizeMargins(
  value: unknown,
  fallback: LayoutMargins = createDefaultLayoutSettings().margins
): LayoutMargins {
  const margins = isRecord(value) ? value : {};
  return {
    top: clampInteger(
      readNumber(margins.top, fallback.top),
      GRID_LIMITS.margin.min,
      GRID_LIMITS.margin.max
    ),
    right: clampInteger(
      readNumber(margins.right, fallback.right),
      GRID_LIMITS.margin.min,
      GRID_LIMITS.margin.max
    ),
    bottom: clampInteger(
      readNumber(margins.bottom, fallback.bottom),
      GRID_LIMITS.margin.min,
      GRID_LIMITS.margin.max
    ),
    left: clampInteger(
      readNumber(margins.left, fallback.left),
      GRID_LIMITS.margin.min,
      GRID_LIMITS.margin.max
    ),
  };
}

function parsePosition(value: unknown, label: string): NormalizedPosition {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const keys = ["top", "left", "width", "height"] as const;
  for (const key of keys) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new Error(`${label}.${key} must be a finite number.`);
    }
  }

  const position = {
    top: value.top as number,
    left: value.left as number,
    width: value.width as number,
    height: value.height as number,
  };
  if (position.top < 0 || position.left < 0) {
    throw new Error(`${label}.top and ${label}.left must be at least 0.`);
  }
  if (position.width <= 0 || position.height <= 0) {
    throw new Error(`${label}.width and ${label}.height must be greater than 0.`);
  }
  if (
    position.left + position.width > 1 + POSITION_EPSILON ||
    position.top + position.height > 1 + POSITION_EPSILON
  ) {
    throw new Error(`${label} must remain inside the normalized 0–1 area.`);
  }

  return position;
}

function positionsOverlap(a: NormalizedPosition, b: NormalizedPosition): boolean {
  return (
    a.left < b.left + b.width - POSITION_EPSILON &&
    a.left + a.width > b.left + POSITION_EPSILON &&
    a.top < b.top + b.height - POSITION_EPSILON &&
    a.top + a.height > b.top + POSITION_EPSILON
  );
}

export function layoutHasOverlaps(layout: WindowLayout): boolean {
  for (let first = 0; first < layout.windows.length; first += 1) {
    for (let second = first + 1; second < layout.windows.length; second += 1) {
      if (
        positionsOverlap(
          layout.windows[first].position,
          layout.windows[second].position
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): boolean {
  return (
    firstStart < secondEnd - POSITION_EPSILON &&
    firstEnd > secondStart + POSITION_EPSILON
  );
}

function hasSharedEdge(
  positions: NormalizedPosition[],
  index: number,
  edge: "top" | "right" | "bottom" | "left"
): boolean {
  const position = positions[index];
  return positions.some((candidate, candidateIndex) => {
    if (candidateIndex === index) return false;

    if (edge === "left" || edge === "right") {
      const boundary =
        edge === "left" ? position.left : position.left + position.width;
      const candidateBoundary =
        edge === "left"
          ? candidate.left + candidate.width
          : candidate.left;
      return (
        Math.abs(boundary - candidateBoundary) <= POSITION_EPSILON &&
        rangesOverlap(
          position.top,
          position.top + position.height,
          candidate.top,
          candidate.top + candidate.height
        )
      );
    }

    const boundary =
      edge === "top" ? position.top : position.top + position.height;
    const candidateBoundary =
      edge === "top" ? candidate.top + candidate.height : candidate.top;
    return (
      Math.abs(boundary - candidateBoundary) <= POSITION_EPSILON &&
      rangesOverlap(
        position.left,
        position.left + position.width,
        candidate.left,
        candidate.left + candidate.width
      )
    );
  });
}

export function parseLayoutCollection(value: unknown): WindowLayout[] {
  if (!Array.isArray(value)) {
    throw new Error("Layout configuration must be a JSON array.");
  }
  if (
    value.length < GRID_LIMITS.layouts.min ||
    value.length > GRID_LIMITS.layouts.max
  ) {
    throw new Error(
      `Layout configuration must contain ${GRID_LIMITS.layouts.min}–${GRID_LIMITS.layouts.max} layouts.`
    );
  }

  const ids = new Set<string>();
  let totalWindows = 0;
  return value.map((candidate, layoutIndex) => {
    const label = `Layout ${layoutIndex + 1}`;
    if (!isRecord(candidate)) {
      throw new Error(`${label} must be an object.`);
    }
    if (
      typeof candidate.id !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(candidate.id)
    ) {
      throw new Error(`${label}.id must be a valid identifier of 1–64 characters.`);
    }
    if (ids.has(candidate.id)) {
      throw new Error(`Duplicate layout id: ${candidate.id}`);
    }
    ids.add(candidate.id);

    if (
      !Array.isArray(candidate.windows) ||
      candidate.windows.length < GRID_LIMITS.windowsPerLayout.min ||
      candidate.windows.length > GRID_LIMITS.windowsPerLayout.max
    ) {
      throw new Error(
        `${label}.windows must contain ${GRID_LIMITS.windowsPerLayout.min}–${GRID_LIMITS.windowsPerLayout.max} entries.`
      );
    }

    totalWindows += candidate.windows.length;
    if (totalWindows > GRID_LIMITS.totalWindows) {
      throw new Error(
        `Layout configuration may contain at most ${GRID_LIMITS.totalWindows} window entries.`
      );
    }

    const windows = candidate.windows.map((windowCandidate, windowIndex) => {
      if (!isRecord(windowCandidate)) {
        throw new Error(`${label}.windows[${windowIndex}] must be an object.`);
      }
      return {
        position: parsePosition(
          windowCandidate.position,
          `${label}.windows[${windowIndex}].position`
        ),
      };
    });

    return {
      id: candidate.id,
      windows,
    };
  });
}

export function normalizeLayoutSettings(value: unknown): LayoutSettings {
  const defaults = createDefaultLayoutSettings();
  if (!isRecord(value)) return defaults;

  let layouts = defaults.layouts;
  if ("layouts" in value) {
    try {
      layouts = parseLayoutCollection(value.layouts);
    } catch {
      layouts = defaults.layouts;
    }
  }

  const legacyCustomLayout = isRecord(value.customLayout)
    ? value.customLayout
    : undefined;
  const normalizedGap = clampInteger(
    readNumber(value.gap, readNumber(legacyCustomLayout?.gap, defaults.gap)),
    GRID_LIMITS.gap.min,
    GRID_LIMITS.gap.max
  );
  const applyGap =
    typeof value.applyGap === "boolean" ? value.applyGap : defaults.applyGap;
  const gap = applyGap ? normalizedGap : 0;
  const applyMargins =
    typeof value.applyMargins === "boolean"
      ? value.applyMargins
      : defaults.applyMargins;
  const margins = applyMargins
    ? normalizeMargins(
        value.margins ?? legacyCustomLayout?.margins,
        defaults.margins
      )
    : { top: 0, right: 0, bottom: 0, left: 0 };
  const selectedLayoutId =
    typeof value.selectedLayoutId === "string" &&
    layouts.some((layout) => layout.id === value.selectedLayoutId)
      ? value.selectedLayoutId
      : (layouts[0]?.id ?? "");

  return {
    selectedLayoutId,
    layouts,
    applyGap,
    gap,
    applyMargins,
    margins,
  };
}

function roundNormalized(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(6));
}

export function captureLayoutWindows(
  workArea: WindowBounds,
  windowBounds: WindowBounds[],
  margins: LayoutMargins
): WindowLayout["windows"] {
  const safeMargins = normalizeMargins(margins);
  const availableWidth = workArea.width - safeMargins.left - safeMargins.right;
  const availableHeight = workArea.height - safeMargins.top - safeMargins.bottom;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error("The configured margins do not fit inside the active display.");
  }

  const originLeft = workArea.left + safeMargins.left;
  const originTop = workArea.top + safeMargins.top;
  const areaRight = originLeft + availableWidth;
  const areaBottom = originTop + availableHeight;

  return windowBounds.map((bounds, index) => {
    const left = Math.max(originLeft, bounds.left);
    const top = Math.max(originTop, bounds.top);
    const right = Math.min(areaRight, bounds.left + bounds.width);
    const bottom = Math.min(areaBottom, bounds.top + bounds.height);
    if (right <= left || bottom <= top) {
      throw new Error(
        `Window ${index + 1} is outside the configured layout area.`
      );
    }

    const normalizedTop = roundNormalized((top - originTop) / availableHeight);
    const normalizedLeft = roundNormalized((left - originLeft) / availableWidth);
    const normalizedRight = roundNormalized((right - originLeft) / availableWidth);
    const normalizedBottom = roundNormalized(
      (bottom - originTop) / availableHeight
    );
    return {
      position: {
        top: normalizedTop,
        left: normalizedLeft,
        width: roundNormalized(normalizedRight - normalizedLeft),
        height: roundNormalized(normalizedBottom - normalizedTop),
      },
    };
  });
}

export function calculateLayoutSlots(
  workArea: WindowBounds,
  layout: WindowLayout,
  gap: number,
  margins: LayoutMargins
): WindowBounds[] {
  const safeGap = clampInteger(gap, GRID_LIMITS.gap.min, GRID_LIMITS.gap.max);
  const safeMargins = normalizeMargins(margins);
  const availableWidth = workArea.width - safeMargins.left - safeMargins.right;
  const availableHeight = workArea.height - safeMargins.top - safeMargins.bottom;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error(
      "The configured margins do not fit inside the active display."
    );
  }

  const originLeft = workArea.left + safeMargins.left;
  const originTop = workArea.top + safeMargins.top;
  const beforeGap = Math.ceil(safeGap / 2);
  const afterGap = Math.floor(safeGap / 2);
  const positions = layout.windows.map(({ position }) => position);

  return layout.windows.map(({ position }, index) => {
    const normalizedRight = position.left + position.width;
    const normalizedBottom = position.top + position.height;
    const rawLeft = originLeft + Math.round(position.left * availableWidth);
    const rawTop = originTop + Math.round(position.top * availableHeight);
    const rawRight = originLeft + Math.round(normalizedRight * availableWidth);
    const rawBottom = originTop + Math.round(normalizedBottom * availableHeight);
    const leftInset = hasSharedEdge(positions, index, "left") ? beforeGap : 0;
    const topInset = hasSharedEdge(positions, index, "top") ? beforeGap : 0;
    const rightInset = hasSharedEdge(positions, index, "right") ? afterGap : 0;
    const bottomInset = hasSharedEdge(positions, index, "bottom") ? afterGap : 0;
    const bounds = {
      left: rawLeft + leftInset,
      top: rawTop + topInset,
      width: rawRight - rawLeft - leftInset - rightInset,
      height: rawBottom - rawTop - topInset - bottomInset,
    };

    if (bounds.width < MIN_WINDOW_WIDTH || bounds.height < MIN_WINDOW_HEIGHT) {
      throw new Error(
        `${layout.id} window ${index + 1} is too small for the active display, gap, and margins.`
      );
    }
    return bounds;
  });
}
