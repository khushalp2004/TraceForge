import React, { Component, ErrorInfo, ReactNode } from "react";
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
export declare class TraceForgeErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    render(): React.ReactNode;
}
export declare function TraceForgeProvider({ children, apiKey, endpoint, }: {
    children: React.ReactNode;
    apiKey?: string;
    endpoint?: string;
}): React.JSX.Element;
export {};
