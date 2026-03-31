type TraceForgeConfig = {
    apiKey: string;
    endpoint?: string;
    autoCapture?: boolean;
    environment?: string;
    release?: string;
    tags?: Record<string, string>;
    ignoreErrors?: Array<string | RegExp>;
    beforeSend?: (event: TraceForgeEvent) => TraceForgeEvent | null;
};
type CapturePayload = {
    environment?: string;
    release?: string;
    payload?: Record<string, unknown>;
    tags?: Record<string, string>;
};
type TraceForgeEvent = {
    message: string;
    stackTrace: string;
    environment?: string;
    release?: string;
    payload?: Record<string, unknown>;
    tags?: Record<string, string>;
};
declare const TraceForge: {
    init: (options: TraceForgeConfig) => void;
    captureException: (error: unknown, extras?: CapturePayload) => Promise<void>;
};
declare const init: (options: TraceForgeConfig) => void;
declare const captureException: (error: unknown, extras?: CapturePayload) => Promise<void>;
export default TraceForge;
export { init, captureException };
export type { TraceForgeConfig, CapturePayload, TraceForgeEvent };
