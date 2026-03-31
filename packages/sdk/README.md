# usetraceforge

TraceForge JavaScript SDK for sending errors to your TraceForge backend.

## Install

```bash
npm install usetraceforge
```

## Local pack test

```bash
cd packages/sdk
npm run build
npm pack
```

Then in any local app:

```bash
npm install /path/to/usetraceforge-0.1.4.tgz
```

## Frontend setup
```ts
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true,
  environment: "production",
  release: "web@1.0.0"
});

try {
  throw new Error("Something broke");
} catch (error) {
  TraceForge.captureException(error, {
    payload: { route: "/signup" }
  });
}
```

## Backend setup
```ts
import express from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY!,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});

const app = express();

app.use((error: unknown, _req, res, _next) => {
  TraceForge.captureException(error, {
    payload: { route: "express-error-handler" }
  }).catch(() => undefined);

  res.status(500).json({ error: "Internal server error" });
});
```

## Environment variables
```env
TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_ENV=production
TRACEFORGE_RELEASE=web@1.0.0
```

## Options
- `autoCapture`: Listen to `window.onerror` and `window.onunhandledrejection`.
- `ignoreErrors`: Array of strings or regex to skip noisy errors.
- `beforeSend`: Hook to modify/drop events before sending.
- `release`: Stable release tag like `web@1.0.0` or `api@2.3.1`.

## Publish

```bash
cd packages/sdk
npm login
npm run build
npm version patch
npm publish --access public
```

After publish, consumers can install it with:

```bash
npm install usetraceforge
```
