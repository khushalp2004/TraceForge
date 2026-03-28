import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/throw", (_req, res) => {
  const enabled = (process.env.TRACEFORGE_DOGFOODING || "").toLowerCase() === "true";
  if (!enabled) return res.status(404).json({ error: "Not found" });
  throw new Error("TraceForge dogfooding test error");
});
