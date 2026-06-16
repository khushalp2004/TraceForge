import TraceForge from "./index.js";
// We do NOT import @angular/core to avoid a hard dependency in the SDK package.
// Angular developers will provide this class as their ErrorHandler.
export class TraceForgeErrorHandler {
    handleError(error) {
        // Capture the error and tag it as coming from Angular
        TraceForge.captureException(error, {
            environment: "browser",
            tags: { framework: "angular" }
        });
        // Mirror Angular's default behavior of logging to console
        console.error("ERROR", error);
    }
}
export function initTraceForgeAngular(options) {
    TraceForge.init({
        ...options,
        autoCapture: options.autoCapture ?? true
    });
}
