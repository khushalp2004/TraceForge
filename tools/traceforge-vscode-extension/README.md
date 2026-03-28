# TraceForge VS Code Extension (Cursor Compatible)

This is a VS Code extension that **initializes TraceForge instrumentation** in a workspace by editing your project files.

Because **Cursor** is VS Code-based, this extension also works in Cursor (and most VS Code forks).

## What it does

- Prompts for:
  - TraceForge ingest URL (example: `http://localhost:3001/ingest`)
  - TraceForge Project API key
- Detects backend/frontend folders by scanning `package.json` files.
- Backend:
  - Writes/updates `backend/.env` with `TRACEFORGE_INGEST_URL`, `TRACEFORGE_PROJECT_KEY`, `TRACEFORGE_PROXY_PATH`
  - Creates `backend/src/traceforge/install.ts` (+ `install.js`)
  - Patches the backend entry file to call `installTraceForge(app)` before `app.listen(...)`
- Frontend (Vite/React):
  - Creates `frontend/src/traceforge/browser.ts`
  - Patches `src/main.tsx` (or similar) to call `initTraceForgeBrowser()`

The frontend sends errors to your backend proxy (`/api/traceforge/ingest`) so you **don’t need frontend env keys**.

## Commands

- `TraceForge: Configure`
- `TraceForge: Initialize in Workspace`

## Limitations (current)

- Backend entrypoint patching expects an **ESM import** style file (`import ...`), not CommonJS `require(...)`.
- Frontend patching is optimized for **Vite + React** entrypoints (`src/main.tsx`).
- Next.js / other frameworks can still be supported, but need additional patch logic.

## Developing / running locally

1. Open this folder in VS Code/Cursor.
2. Run `npm install` (inside this folder).
3. Run `npm run build`.
4. Press `F5` to launch an Extension Development Host.

