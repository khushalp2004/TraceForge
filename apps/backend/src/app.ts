import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { ingestRouter } from "./routes/ingest.js";
import { errorsRouter } from "./routes/errors.js";
import { analyticsRouter } from "./routes/analytics.js";
import { orgsRouter } from "./routes/orgs.js";
import { passwordResetRouter } from "./routes/passwordReset.js";
import { notificationsRouter } from "./routes/notifications.js";
import { alertsRouter } from "./routes/alerts.js";
import { releasesRouter } from "./routes/releases.js";
import { paymentRouter } from "./routes/payment.js";
import { fxRouter } from "./routes/fx.js";
import { publicBillingRouter } from "./routes/publicBilling.js";
import { integrationsRouter } from "./routes/integrations.js";
import { supportRouter } from "./routes/support.js";

export const createApp = () => {
  const app = express();
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.APP_PUBLIC_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ].filter((value): value is string => Boolean(value && value.trim()));
  const corsOptions = {
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  };

  morgan.token("reqid", (req) => {
    return (req as express.Request & { requestId?: string }).requestId || "-";
  });

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(cors(corsOptions));
  app.use(
    express.json({
      limit: "512kb",
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "64kb" }));
  app.use((req, res, next) => {
    const requestId =
      (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()) ||
      crypto.randomUUID();
    (req as express.Request & { requestId?: string }).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });
  app.use(morgan(":method :url :status :response-time ms req=:reqid"));

  app.get("/", (_req, res) => {
    res.json({
      name: "TraceForge API",
      status: "ok"
    });
  });

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/auth/password", passwordResetRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/alerts", alertsRouter);
  app.use("/releases", releasesRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/public/fx", fxRouter);
  app.use("/public/billing", publicBillingRouter);
  app.use("/support", supportRouter);
  app.use("/integrations", integrationsRouter);
  app.use("/projects", projectsRouter);
  app.use("/orgs", orgsRouter);
  app.use("/ingest", ingestRouter);
  app.use("/errors", errorsRouter);
  app.use("/analytics", analyticsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((err as { type?: string; message?: string })?.type === "entity.too.large") {
      return res.status(413).json({ error: "Request payload is too large" });
    }

    if (err instanceof Error && err.message === "Origin not allowed by CORS") {
      return res.status(403).json({ error: err.message });
    }

    return next(err);
  });

  return app;
};
