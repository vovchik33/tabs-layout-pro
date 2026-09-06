export interface LayoutMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GridLayout {
  id: string;
  name: string;
  description: string;
  rows: number;
  columns: number;
}

export interface CustomLayout {
  rows: number;
  columns: number;
  gap: number;
  margins: LayoutMargins;
}

export interface LayoutSettings {
  selectedLayoutId: string;
  customLayout: CustomLayout;
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
