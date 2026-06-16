import TraceForge, { TraceForgeConfig } from "./index.js";

export const TraceForgeVue = {
  install(app: any, options: TraceForgeConfig) {
    // Initialize TraceForge with autoCapture true by default for Vue apps
    TraceForge.init({
      ...options,
      autoCapture: options.autoCapture ?? true,
    });

    const originalErrorHandler = app.config.errorHandler;

    // Hook into Vue's global error handler to capture rendering/lifecycle errors
    app.config.errorHandler = (err: unknown, instance: any, info: string) => {
      TraceForge.captureException(err, { 
        environment: "browser", 
        tags: { framework: "vue", vueInfo: info } 
      });

      // Call the original error handler if it exists, otherwise log to console
      if (originalErrorHandler) {
        originalErrorHandler(err, instance, info);
      } else {
        console.error(err);
      }
    };
  }
};
