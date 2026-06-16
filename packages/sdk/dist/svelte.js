import TraceForge from "./index.js";
/**
 * Custom Error Handler for SvelteKit `src/hooks.client.ts` and `src/hooks.server.ts`
 *
 * Usage:
 * export const handleError = ({ error, event }) => {
 *   TraceForgeSvelte.handleError(error, event);
 * };
 */
export const handleError = (error, event, options) => {
    const customTags = options?.tags || {};
    let url = undefined;
    // Attempt to extract URL from SvelteKit event or window
    if (event && event.url) {
        url = event.url.href || event.url.toString();
    }
    else if (typeof window !== "undefined") {
        url = window.location.href;
    }
    TraceForge.captureException(error, {
        tags: {
            framework: "svelte",
            ...customTags
        },
        context: url ? { url } : undefined
    });
};
export const TraceForgeSvelte = {
    handleError,
    init: TraceForge.init,
    captureException: TraceForge.captureException
};
export default TraceForgeSvelte;
