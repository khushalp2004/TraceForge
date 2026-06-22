import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export declare class TraceForgeExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
export declare const TraceForgeNest: {
    TraceForgeExceptionFilter: typeof TraceForgeExceptionFilter;
    init: (options: import("./index.js").TraceForgeConfig) => void;
    captureException: (error: unknown, extras?: import("./index.js").CapturePayload) => Promise<void>;
};
export default TraceForgeNest;
