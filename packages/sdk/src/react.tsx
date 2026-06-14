"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";
import TraceForge from "./index.js";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  environment?: string;
  release?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TraceForgeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    TraceForge.captureException(error, {
      environment: this.props.environment || "browser",
      release: this.props.release,
      tags: {
        componentStack: errorInfo.componentStack || "Unknown"
      }
    }).catch(() => undefined);
  }

  public render() {
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

export function TraceForgeProvider({ 
  children,
  apiKey,
  endpoint,
}: { 
  children: React.ReactNode;
  apiKey?: string;
  endpoint?: string;
}) {
  React.useEffect(() => {
    const finalApiKey = apiKey || process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY;
    const finalEndpoint = endpoint || process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL;
    
    if (finalApiKey) {
      TraceForge.init({
        apiKey: finalApiKey,
        endpoint: finalEndpoint,
      });
    }
  }, [apiKey, endpoint]);

  return <TraceForgeErrorBoundary>{children}</TraceForgeErrorBoundary>;
}
