"use client";

import { useEffect } from "react";

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

const getProxyUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const proxyPath = process.env.NEXT_PUBLIC_TRACEFORGE_PROXY_PATH || "/api/traceforge/ingest";
  try {
    return new URL(proxyPath, apiUrl).toString();
  } catch {
    return `${apiUrl}${proxyPath.startsWith("/") ? "" : "/"}${proxyPath}`;
  }
};

export default function TraceForgeBrowserInit() {
  useEffect(() => {
    // Only enable when explicitly requested.
    const enabled = (process.env.NEXT_PUBLIC_TRACEFORGE_DOGFOODING || "").toLowerCase() === "true";
    if (!enabled) return;

    const proxyUrl = getProxyUrl();
    const env = "local";
    const release = "traceforge-frontend@dev";

    const recent = new Map<string, number>();
    const shouldSend = (key: string) => {
      const now = Date.now();
      const last = recent.get(key) || 0;
      if (now - last < 4000) return false;
      recent.set(key, now);
      return true;
    };

    const send = async (payload: CapturePayload) => {
      const signature = `${payload.message}\n${payload.stackTrace}`;
      if (!shouldSend(signature)) return;

      try {
        await fetch(proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch {
        // ignore
      }
    };

    const onError = (event: ErrorEvent) => {
      const normalized = normalizeError(event.error ?? event.message);
      void send({
        ...normalized,
        environment: env,
        release,
        payload: {
          source: "window.error",
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeError(event.reason);
      void send({
        ...normalized,
        environment: env,
        release,
        payload: {
          source: "unhandledrejection",
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

