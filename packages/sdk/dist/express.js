import TraceForge from "./index.js";
/**
 * Express middleware to catch unhandled errors and report them to TraceForge.
 * Ensure this is added AFTER all your routes and controllers, but BEFORE your custom error handler.
 */
export const TraceForgeErrorHandler = (error, req, res, next) => {
    TraceForge.captureException(error, {
        environment: "node",
        tags: {
            method: req.method,
            url: req.url,
            path: req.path,
            ip: req.ip || "Unknown"
        },
        payload: {
            query: req.query,
            body: req.body,
            headers: {
                ...req.headers,
                authorization: req.headers.authorization ? "[REDACTED]" : undefined,
                cookie: req.headers.cookie ? "[REDACTED]" : undefined
            }
        }
    }).catch(() => undefined);
    // Pass the error to the next error handler
    next(error);
};
