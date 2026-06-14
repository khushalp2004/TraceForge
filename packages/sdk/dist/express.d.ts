import { Request, Response, NextFunction } from "express";
/**
 * Express middleware to catch unhandled errors and report them to TraceForge.
 * Ensure this is added AFTER all your routes and controllers, but BEFORE your custom error handler.
 */
export declare const TraceForgeErrorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
