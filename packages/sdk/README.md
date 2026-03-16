# traceforge-js

TraceForge client SDK for sending errors to your local TraceForge backend.

## Install (Local)
From the repo root:

```bash
cd packages/sdk
npm pack
```

Then in any local app:

```bash
npm install /path/to/traceforge-js-0.1.0.tgz
```

## Usage
```ts
import TraceForge from "traceforge-js";

TraceForge.init({
  apiKey: "YOUR_PROJECT_API_KEY",
  endpoint: "http://localhost:3001/ingest",
  autoCapture: true,
  environment: "development"
});

try {
  throw new Error("Something broke");
} catch (error) {
  TraceForge.captureException(error, {
    payload: { route: "/signup" }
  });
}
```

## Options
- `autoCapture`: Listen to `window.onerror` and `window.onunhandledrejection`.
- `ignoreErrors`: Array of strings or regex to skip noisy errors.
- `beforeSend`: Hook to modify/drop events before sending.
