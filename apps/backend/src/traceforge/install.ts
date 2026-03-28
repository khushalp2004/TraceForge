import express, { type Express, type NextFunction, type Request, type Response } from "express";

type CapturePayload = {
  message: string;
  stackTrace: string;
  environment?: string;
  release?: string;
  payload?: Record<string, unknown>;
};

const normalizeError = (err: unknown): { message: string; stackTrace: string } => {
  if (err instanceof Error) {
    return { message: err.message || "Error", stackTrace: err.stack || err.message };
  }
  const message = typeof err === "string" ? err : JSON.stringify(err);
  return { message: message || "Error", stackTrace: message || "Error" };
};

const captureToTraceForge = async (payload: CapturePayload) => {
  const ingestUrl = process.env.TRACEFORGE_INGEST_URL || "";
  const projectKey = process.env.TRACEFORGE_PROJECT_KEY || "";
  if (!ingestUrl || !projectKey) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch {
    // ignore (never crash the app while reporting an error)
  } finally {
    clearTimeout(timeout);
  }
};

export const installTraceForge = (app: Express) => {
  const enabled = (process.env.TRACEFORGE_DOGFOODING || "").toLowerCase() === "true";
  if (!enabled) return;

  const proxyPath = process.env.TRACEFORGE_PROXY_PATH || "/api/traceforge/ingest";
  const env = process.env.APP_ENV || process.env.NODE_ENV || "local";
  const release = process.env.APP_RELEASE || "traceforge-backend@dev";

  // Backend proxy for browser SDKs (no key in the browser; backend attaches it).
  app.post(proxyPath, express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
    const { message, stackTrace, environment, release: bodyRelease, payload } = req.body as Partial<CapturePayload>;
    if (!message || !stackTrace) {
      return res.status(400).json({ error: "message and stackTrace are required" });
    }

    await captureToTraceForge({
      message,
      stackTrace,
      environment: environment ?? env,
      release: bodyRelease ?? release,
      payload
    });

    return res.json({ ok: true });
  });

  // Capture server-side errors. Guard against loops (especially when dogfooding).
  app.use(async (err: unknown, req: Request, _res: Response, next: NextFunction) => {
    try {
      const url = req.originalUrl || "";
      const isIngest = url.startsWith("/ingest");
      const isProxy = url.startsWith(proxyPath);
      if (isIngest || isProxy) return next(err);

      const normalized = normalizeError(err);
      await captureToTraceForge({
        ...normalized,
        environment: env,
        release,
        payload: { route: url, method: req.method, source: "express" }
      });
    } catch {
      // ignore
    }

    return next(err);
  });

  process.on("unhandledRejection", async (reason) => {
    const normalized = normalizeError(reason);
    await captureToTraceForge({
      ...normalized,
      environment: env,
      release,
      payload: { source: "unhandledRejection" }
    });
  });

  process.on("uncaughtException", async (error) => {
    const normalized = normalizeError(error);
    await captureToTraceForge({
      ...normalized,
      environment: env,
      release,
      payload: { source: "uncaughtException" }
    });
  });
};
