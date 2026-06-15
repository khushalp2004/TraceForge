"use client";
import React, { Component } from "react";
import TraceForge from "./index.js";
export class TraceForgeErrorBoundary extends Component {
    state = {
        hasError: false,
        error: null
    };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        TraceForge.captureException(error, {
            environment: this.props.environment || "browser",
            release: this.props.release,
            tags: {
                componentStack: errorInfo.componentStack || "Unknown"
            }
        }).catch(() => undefined);
    }
    render() {
        if (this.state.hasError && this.state.error) {
            if (typeof this.props.fallback === "function") {
                return this.props.fallback(this.state.error);
            }
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // Default fallback if nothing is provided
            return null;
        }
        return this.props.children;
    }
}
export function TraceForgeProvider({ children, apiKey, endpoint, }) {
    React.useEffect(() => {
        const envObj = typeof process !== "undefined" && process.env ? process.env : {};
        const finalApiKey = apiKey || envObj.NEXT_PUBLIC_TRACEFORGE_API_KEY;
        const finalEndpoint = endpoint || envObj.NEXT_PUBLIC_TRACEFORGE_INGEST_URL;
        if (finalApiKey) {
            TraceForge.init({
                apiKey: finalApiKey,
                endpoint: finalEndpoint,
            });
        }
    }, [apiKey, endpoint]);
    return React.createElement(TraceForgeErrorBoundary, null, children);
}
