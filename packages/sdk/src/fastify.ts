import TraceForge from "./index.js";

/**
 * Fastify Error Handler for TraceForge
 * 
 * Usage:
 * fastify.setErrorHandler(TraceForgeFastify.errorHandler);
 */
export const errorHandler = (error: any, request: any, reply: any) => {
  let url = undefined;

  if (request) {
    url = `${request.protocol || 'http'}://${request.hostname}${request.url}`;
  }

  TraceForge.captureException(error, {
    tags: {
      framework: "fastify"
    },
    context: url ? { url, method: request.method } : undefined
  } as any);

  // Fastify default behavior: send the error to the client
  reply.status(error.statusCode || 500).send(error);
};

export const TraceForgeFastify = {
  errorHandler,
  init: TraceForge.init,
  captureException: TraceForge.captureException
};

export default TraceForgeFastify;
