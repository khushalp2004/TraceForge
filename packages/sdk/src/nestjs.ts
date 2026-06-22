import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import TraceForge from './index.js';

@Catch()
export class TraceForgeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Default status to 500
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const url = `${request.protocol || 'http'}://${request.get('host') || 'localhost'}${request.originalUrl || request.url}`;

    // Send the error to TraceForge in the background
    TraceForge.captureException(exception, {
      tags: { framework: 'nestjs' },
      payload: { 
        url, 
        method: request.method,
        statusCode: status
      }
    });

    // We do NOT block or modify the response structure! We return a standard JSON response.
    // However, if the user wants to use TraceForge but KEEP their own exception filter format,
    // they should manually inject `TraceForgeNest.captureException()` into their own `@Catch` block.
    
    // Standard NestJS JSON response format
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : (message as any)?.message || message,
    });
  }
}

export const TraceForgeNest = {
  TraceForgeExceptionFilter,
  init: TraceForge.init,
  captureException: TraceForge.captureException
};

export default TraceForgeNest;
