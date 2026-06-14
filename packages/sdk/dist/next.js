import TraceForge from "./index.js";
// A wrapper for Next.js API Routes (App Router or Pages Router)
export function withTraceForgeRoute(handler) {
    return async function (...args) {
        // Auto-initialize TraceForge in this isolated runtime if it hasn't been initialized
        try {
            if (process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY) {
                TraceForge.init({
                    apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY,
                    endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL,
                });
            }
        }
        catch (e) {
            // Ignore init errors here, it will fail gracefully during capture if truly unconfigured
        }
        try {
            return await handler(...args);
        }
        catch (error) {
            // Catch Next.js serverless API errors
            await TraceForge.captureException(error, {
                environment: process.env.NODE_ENV || "node",
                tags: {
                    runtime: "nextjs-api"
                }
            }).catch(() => undefined);
            // Re-throw so Next.js can handle the 500 response natively
            throw error;
        }
    };
}
