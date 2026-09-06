# Tabs Layout Pro

Arrange existing Chrome windows into clean grid layouts on the monitor containing the active browser window.

## Features

- Built-in Two Columns, Two Rows, Three Columns, and Quadrants layouts
- Custom grid with 1–6 rows and columns
- Configurable gap and per-edge screen margins
- Uses each monitor's available work area, excluding docks and taskbars
- Arranges existing normal windows only; never creates layout windows
- Leaves overflow windows unchanged when the grid has fewer slots
- Toolbar popup, persistent detached popup, and keyboard shortcut
- Synced settings and a dismissible post-update notification

## Requirements and setup

- Current Node.js LTS and npm
- Chrome or another Chromium browser supporting Manifest V3
- Git; `zip` and Git LFS are also required for release packaging

```bash
npm install
npm run lint
npm run build
```

Load locally:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project's `dist/` directory.
5. Reload the extension card after every rebuild.

For watch mode:

```bash
npm run dev
```

This rebuilds `dist/` on changes; it does not provide HMR. If Chrome keeps stale worker code, remove the unpacked extension and load `dist/` again.

## Use

1. Open two or more normal Chrome windows on one monitor.
2. Open Tabs Layout Pro.
3. Select a preset or Custom Grid.
4. Click **Apply Layout**.

The active window is assigned first, followed by the remaining windows in top-to-bottom, left-to-right order. The extension arranges at most `rows × columns` windows. Extra windows remain unchanged.

Configure the shortcut at `chrome://extensions/shortcuts`. The default is `Ctrl+Shift+L` (`MacCtrl+Shift+L` on macOS).

## Architecture

```text
manifest.json
├── src/background.ts             Install/update events, command, message API
├── src/popup/                    Toolbar and detached layout picker
├── src/options/                  Grid, gap, margin, and default settings
├── src/data/defaultLayouts.ts    Built-in layouts and defaults
├── src/utils/
│   ├── arrangeWindows.ts         Window normalization and arrangement
│   ├── displayBounds.ts          Active display/window detection
│   ├── gridLayout.ts             Pure grid validation and slot geometry
│   └── storage.ts                Sync/local storage helpers
├── src/hooks/useStorageSync.ts   Cross-surface settings updates
├── src/styles/_tokens.scss       Shared design tokens
├── public/                       Icons and store assets
├── scripts/                      Versioning and release packaging
├── dist/                         Generated unpacked extension
└── releases/                     Generated Web Store ZIPs
```

### Runtime flow

```text
Popup or command
  -> background service worker
  -> load layoutSettings
  -> find last-focused normal window
  -> identify its display
  -> collect normal windows on that display
  -> calculate slots inside display.workArea
  -> normalize and update existing windows
```

Multi-step window mutations run in `src/background.ts` because toolbar popup execution can end when focus or window bounds change. The `arrange-windows` message accepts an optional `layoutId`; async handlers return `true` while awaiting `sendResponse`.

### Display selection

`src/utils/displayBounds.ts`:

1. Gets the last-focused normal browser window.
2. Reads displays through `chrome.system.display.getInfo()`.
3. Chooses the display with the largest intersection with the active window.
4. Falls back to the display containing the window center, then the primary display.
5. Includes only normal windows assigned to that same display.

Intersection logic supports monitors positioned left or above the primary monitor, where coordinates are negative. Layouts use `display.workArea`, not full display bounds.

### Grid calculation

The usable rectangle is:

```text
left   = workArea.left + margin.left
top    = workArea.top + margin.top
width  = workArea.width - left/right margins - horizontal gaps
height = workArea.height - top/bottom margins - vertical gaps
```

Integer remainders are distributed across the first rows/columns so slots cover the usable area without accumulating rounding gaps.

Before applying bounds, maximized, minimized, or fullscreen windows are changed to `"normal"`. Chrome requires moved/resized windows to remain sufficiently visible; keep custom margins and grid sizes reasonable.

### Popup modes

- Toolbar mode has bounded scrollable content.
- **Open in separate window** opens `?standalone=1` as a 420×640 popup and closes the toolbar popup.
- The detached window is excluded because arrangement queries only normal browser windows.
- Detached mode still targets the last-focused normal browser window, never its own popup host.

### Storage

Synced:

- `layoutSettings.selectedLayoutId`
- `layoutSettings.customLayout.rows`
- `layoutSettings.customLayout.columns`
- `layoutSettings.customLayout.gap`
- `layoutSettings.customLayout.margins`

Local:

- `updateNotice` — previous/current version shown after an installed update

The service worker seeds `layoutSettings` on first install. On update, it shows a `NEW` action badge; dismissing the popup banner clears the badge and local notice.

## Permissions

- `storage` — synchronize layout settings and keep the local update notice
- `commands` — apply the selected layout from a keyboard shortcut
- `system.display` — read monitor bounds and available work areas

The extension does not read page URLs or content and does not create, close, or move tabs.

## Development

```bash
npm run dev
npm run lint
npm run build
npm run clean
```

When adding a feature:

1. Add shared types to `src/types.ts`.
2. Keep pure geometry in `src/utils/gridLayout.ts`.
3. Keep monitor selection in `src/utils/displayBounds.ts`.
4. Run multi-step window mutations through the worker.
5. Request only the minimum manifest permission.
6. Register worker listeners synchronously at module scope.
7. Do not rely on worker memory; persist durable state.
8. Clean up Chrome listeners and timers created by React effects.
9. Test negative monitor coordinates and maximized windows.
10. Run lint and build before loading `dist/`.

## Manual test checklist

- One existing window with a larger grid
- Two windows in horizontal and vertical layouts
- Three windows in Three Columns
- Four windows in Quadrants
- More windows than slots; overflow windows remain unchanged
- Custom rows, columns, gap, and each margin
- Maximized and minimized windows
- Active window on a secondary monitor with negative coordinates
- Windows split across monitors; only active-monitor windows move
- Toolbar popup closes safely while worker arrangement completes
- Detached popup is not included in the layout
- Shortcut applies the saved default
- Settings persist after extension reload
- Update badge/banner and dismissal

## Release

Release commands require a clean Git working tree:

```bash
npm run package:build:patch
npm run package:build:minor
npm run package:build:major
```

They synchronize `package.json`, `package-lock.json`, and `manifest.json`, create `Release vX.Y.Z`, tag `vX.Y.Z`, build the extension, create `releases/tabs-layout-pro_vX.Y.Z.zip`, and commit `Add release vX.Y.Z`.

The ZIP contains the contents of `dist/`, with `manifest.json` at its root. Release archives are tracked through Git LFS. `package:tag:remove` rewrites local history with `git reset --hard`; use it only for an explicitly approved unpublished release rollback.

## Publish

1. Run lint and the appropriate release command.
2. Inspect the ZIP and built manifest.
3. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
4. Create or open the Tabs Layout Pro item.
5. Upload the new ZIP on the Package page.
6. Add current screenshots, promotional images, permission justification, and privacy disclosures.
7. Submit for review.
8. Push release commits and tags:

```bash
git push
git push --tags
```

Chrome requires every update's manifest version to be greater than the published version.

## AI agents

Read `AGENTS.md` before editing. Cursor, Copilot, Claude, and Gemini adapter files point to the same canonical instructions. `REQUEST.md` contains a reusable prompt for creating another extension from this boilerplate.
