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

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      }
    })
  );
  app.use(morgan("dev"));

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
  app.use("/integrations", integrationsRouter);
  app.use("/projects", projectsRouter);
  app.use("/orgs", orgsRouter);
  app.use("/ingest", ingestRouter);
  app.use("/errors", errorsRouter);
  app.use("/analytics", analyticsRouter);

  return app;
};
