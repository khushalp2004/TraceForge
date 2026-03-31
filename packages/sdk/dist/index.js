let config = null;
let autoCaptureInitialized = false;
let setupHandshakeSent = false;
const defaultEndpoint = "http://localhost:3001/ingest";
const getIngestEndpoint = () => config?.endpoint || defaultEndpoint;
const getSetupEndpoint = () => {
    const endpoint = getIngestEndpoint();
    const normalized = endpoint.replace(/\/+$/, "");
    if (normalized.endsWith("/setup")) {
        return normalized;
    }
    return `${normalized}/setup`;
};
const ensureConfig = () => {
    if (!config) {
        throw new Error("TraceForge not initialized. Call TraceForge.init({ apiKey }) first.");
    }
};
const normalizeError = (error) => {
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
const shouldIgnore = (message) => {
    const ignoreList = config?.ignoreErrors || [];
    return ignoreList.some((entry) => {
        if (typeof entry === "string") {
            return message.includes(entry);
        }
        return entry.test(message);
    });
};
const buildEvent = (error, extras) => {
    const { message, stackTrace } = normalizeError(error);
    return {
        message,
        stackTrace,
        environment: extras?.environment || config?.environment,
        release: extras?.release || config?.release,
        payload: extras?.payload,
        tags: { ...config?.tags, ...extras?.tags }
    };
};
const sendEvent = async (event) => {
    if (shouldIgnore(event.message)) {
        return;
    }
    const processed = config?.beforeSend ? config.beforeSend(event) : event;
    if (!processed) {
        return;
    }
    await fetch(getIngestEndpoint(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Traceforge-Key": config.apiKey
        },
        body: JSON.stringify(processed)
    });
};
const capture = async (error, extras) => {
    ensureConfig();
    const event = buildEvent(error, extras);
    await sendEvent(event);
};
const sendSetupHandshake = async () => {
    if (!config?.apiKey || setupHandshakeSent) {
        return;
    }
    setupHandshakeSent = true;
    try {
        await fetch(getSetupEndpoint(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Traceforge-Key": config.apiKey
            },
            body: JSON.stringify({
                environment: config.environment,
                release: config.release,
                tags: config.tags
            })
        });
    }
    catch {
        setupHandshakeSent = false;
    }
};
const setupAutoCapture = () => {
    if (autoCaptureInitialized)
        return;
    if (typeof window === "undefined")
        return;
    window.addEventListener("error", (event) => {
        if (event.error) {
            capture(event.error, { environment: "browser" }).catch(() => undefined);
        }
        else if (event.message) {
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
    init: (options) => {
        const previousApiKey = config?.apiKey ?? null;
        const previousEndpoint = config?.endpoint ?? defaultEndpoint;
        config = {
            endpoint: defaultEndpoint,
            autoCapture: false,
            ...options
        };
        const currentEndpoint = config.endpoint || defaultEndpoint;
        if (previousApiKey !== config.apiKey || previousEndpoint !== currentEndpoint) {
            setupHandshakeSent = false;
        }
        void sendSetupHandshake();
        if (config.autoCapture) {
            setupAutoCapture();
        }
    },
    captureException: async (error, extras) => {
        await capture(error, extras);
    }
};
const init = (options) => {
    TraceForge.init(options);
};
const captureException = async (error, extras) => {
    await TraceForge.captureException(error, extras);
};
export default TraceForge;
export { init, captureException };
