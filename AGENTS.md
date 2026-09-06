# Tabs Layout Pro — AI Guidelines

## Stack
- Chrome Manifest V3, React, strict TypeScript, Vite/CRXJS, and SCSS modules.
- Load and test generated `dist/`; never edit or commit it.
- Run `npm run lint` and `npm run build` after implementation changes.

## Architecture
- `background.ts`: install/update lifecycle, command, and async arrangement messages.
- `popup/`: toolbar and detached layout picker; `options/`: persisted settings.
- `displayBounds.ts`: active display/candidate windows; `gridLayout.ts`: pure geometry.
- `arrangeWindows.ts`: the only window mutation layer.
- Reuse `storage.ts` and `useStorageSync`; do not create another storage pattern.

## Invariants
- Arrange existing normal windows only; never create layout windows.
- Target only the monitor containing the last-focused normal browser window.
- Exclude popup/devtools/non-normal windows.
- Active window is first; remaining windows use deterministic spatial order.
- Arrange at most `rows × columns`; leave overflow windows unchanged.
- Use display `workArea`, margins, and gaps; support negative monitor coordinates.
- Normalize non-normal window states before applying bounds.
- Put multi-step window work in the service worker because toolbar popups are ephemeral.
- Register worker listeners at module scope and return `true` for async responses.
- Do not add `tabs` permission unless a feature truly needs tab data.

## Storage
- Sync key: `layoutSettings`.
- Local key: `updateNotice`.
- The worker seeds defaults and owns the post-update `NEW` badge.

## Boilerplate and release
- Replace identity, icons, store assets, docs, storage keys, and ZIP prefix for forks.
- Release scripts create commits, tags, and ZIP files and require explicit user approval.
- Never run `package:tag:remove` without explicit approval; it uses `git reset --hard`.
- Use repository commit style: `Fix:`, `Improvement:`, or `Chore:` plus an imperative summary.
