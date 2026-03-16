type TraceForgeConfig = {
  apiKey: string;
  endpoint?: string;
  autoCapture?: boolean;
  environment?: string;
  tags?: Record<string, string>;
  ignoreErrors?: Array<string | RegExp>;
  beforeSend?: (event: TraceForgeEvent) => TraceForgeEvent | null;
};

type CapturePayload = {
  environment?: string;
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
};

type TraceForgeEvent = {
  message: string;
  stackTrace: string;
  environment?: string;
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
};

let config: TraceForgeConfig | null = null;
let autoCaptureInitialized = false;

const defaultEndpoint = "http://localhost:3001/ingest";

const ensureConfig = () => {
  if (!config) {
    throw new Error("TraceForge not initialized. Call TraceForge.init({ apiKey }) first.");
  }
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stackTrace: error.stack || ""
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      stackTrace: ""
    };
  }

  return {
    message: "Unknown error",
    stackTrace: JSON.stringify(error)
  };
};

const shouldIgnore = (message: string) => {
  const ignoreList = config?.ignoreErrors || [];
  return ignoreList.some((entry) => {
    if (typeof entry === "string") {
      return message.includes(entry);
    }
    return entry.test(message);
  });
};

const buildEvent = (error: unknown, extras?: CapturePayload): TraceForgeEvent => {
  const { message, stackTrace } = normalizeError(error);
  return {
    message,
    stackTrace,
    environment: extras?.environment || config?.environment,
    payload: extras?.payload,
    tags: { ...config?.tags, ...extras?.tags }
  };
};

const sendEvent = async (event: TraceForgeEvent) => {
  if (shouldIgnore(event.message)) {
    return;
  }

  const processed = config?.beforeSend ? config.beforeSend(event) : event;
  if (!processed) {
    return;
  }

  await fetch(config!.endpoint || defaultEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Traceforge-Key": config!.apiKey
    },
    body: JSON.stringify(processed)
  });
};

const capture = async (error: unknown, extras?: CapturePayload) => {
  ensureConfig();
  const event = buildEvent(error, extras);
  await sendEvent(event);
};

const setupAutoCapture = () => {
  if (autoCaptureInitialized) return;
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    if (event.error) {
      capture(event.error, { environment: "browser" }).catch(() => undefined);
    } else if (event.message) {
      capture(new Error(event.message), { environment: "browser" }).catch(() => undefined);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    capture(event.reason ?? new Error("Unhandled promise rejection"), {
      environment: "browser"
    }).catch(() => undefined);
  });

  autoCaptureInitialized = true;
};

const TraceForge = {
  init: (options: TraceForgeConfig) => {
    config = {
      endpoint: defaultEndpoint,
      autoCapture: false,
      ...options
    };

    if (config.autoCapture) {
      setupAutoCapture();
    }
  },

  captureException: async (error: unknown, extras?: CapturePayload) => {
    await capture(error, extras);
  }
};

export default TraceForge;
export type { TraceForgeConfig, CapturePayload, TraceForgeEvent };
