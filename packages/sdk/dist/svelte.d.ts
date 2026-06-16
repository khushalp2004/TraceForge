/**
 * Custom Error Handler for SvelteKit `src/hooks.client.ts` and `src/hooks.server.ts`
 *
 * Usage:
 * export const handleError = ({ error, event }) => {
 *   TraceForgeSvelte.handleError(error, event);
 * };
 */
export declare const handleError: (error: unknown, event?: any, options?: {
    tags?: Record<string, string | number | boolean>;
}) => void;
export declare const TraceForgeSvelte: {
    handleError: (error: unknown, event?: any, options?: {
        tags?: Record<string, string | number | boolean>;
    }) => void;
    init: (options: import("./index.js").TraceForgeConfig) => void;
    captureException: (error: unknown, extras?: import("./index.js").CapturePayload) => Promise<void>;
};
export default TraceForgeSvelte;
