/**
 * Fastify Error Handler for TraceForge
 *
 * Usage:
 * fastify.setErrorHandler(TraceForgeFastify.errorHandler);
 */
export declare const errorHandler: (error: any, request: any, reply: any) => void;
export declare const TraceForgeFastify: {
    errorHandler: (error: any, request: any, reply: any) => void;
    init: (options: import("./index.js").TraceForgeConfig) => void;
    captureException: (error: unknown, extras?: import("./index.js").CapturePayload) => Promise<void>;
};
export default TraceForgeFastify;
