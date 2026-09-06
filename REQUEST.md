# AI Request: Extend Tabs Layout Pro

Read `AGENTS.md` first and use `README.md` for architecture and workflows.

Implement `<feature>` for Tabs Layout Pro.

Requirements:

- Expected user behavior: `<describe>`
- Popup changes: `<describe or none>`
- Settings changes: `<describe or none>`
- Background behavior: `<describe or none>`
- Storage changes: `<describe or none>`
- Permission changes: `<describe or determine minimum>`

Rules:

1. Arrange existing normal browser windows only; never create layout windows.
2. Target the monitor containing the last-focused normal window.
3. Keep display detection, pure grid geometry, and window mutation in their existing layers.
4. Put multi-step window operations in the service worker.
5. Preserve detached-popup targeting and post-update notification behavior.
6. Add only necessary permissions, storage, dependencies, and assets.
7. Do not edit `dist/` or release ZIP files.
8. Do not commit, tag, package, publish, or run destructive scripts unless requested.
9. Run `npm run lint` and `npm run build`.
10. Report implementation, architecture decisions, permissions, storage, verification, and manual test steps.
