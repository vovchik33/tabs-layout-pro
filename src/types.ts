export interface LayoutMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface NormalizedPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface LayoutWindow {
  position: NormalizedPosition;
}

export interface WindowLayout {
  id: string;
  windows: LayoutWindow[];
}

export interface LayoutSettings {
  selectedLayoutId: string;
  layouts: WindowLayout[];
  applyGap: boolean;
  gap: number;
  applyMargins: boolean;
  margins: LayoutMargins;
}

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ArrangeWindowsResult {
  arrangedCount: number;
  eligibleCount: number;
  displayName: string;
}

export interface ExtensionUpdateNotice {
  previousVersion: string;
  currentVersion: string;
}
