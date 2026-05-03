import { PrismaClient } from "@prisma/client";
import { recordQueryMetric } from "../utils/queryMetrics.js";

const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" }
  ]
});

prisma.$on("query", (event) => {
  recordQueryMetric({
    model: event.target,
    action: "query",
    durationMs: event.duration
  });
});

export default prisma;
