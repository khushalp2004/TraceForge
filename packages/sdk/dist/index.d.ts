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
declare const TraceForge: {
    init: (options: TraceForgeConfig) => void;
    captureException: (error: unknown, extras?: CapturePayload) => Promise<void>;
};
export default TraceForge;
export type { TraceForgeConfig, CapturePayload, TraceForgeEvent };
