import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyToken } from "../utils/jwt.js";
import {
  subscribeToNotifications,
  unsubscribeFromNotifications
} from "../utils/notifications.js";

export const notificationsRouter = Router();

notificationsRouter.get("/dismissals", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dismissals: Array<{
    kind: "ALERT" | "INVITE" | "JOIN_REQUEST";
    notificationKey: string;
  }> = await prisma.notificationDismissal.findMany({
    where: { userId },
    select: {
      kind: true,
      notificationKey: true
    }
  });

  return res.json({
    dismissals: {
      alerts: dismissals
        .filter((item) => item.kind === "ALERT")
        .map((item) => item.notificationKey),
      invites: dismissals
        .filter((item) => item.kind === "INVITE")
        .map((item) => item.notificationKey),
      joinRequests: dismissals
        .filter((item) => item.kind === "JOIN_REQUEST")
        .map((item) => item.notificationKey)
    }
  });
});

notificationsRouter.post("/dismissals", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validKinds = new Set(["ALERT", "INVITE", "JOIN_REQUEST"]);
  const sanitized: Array<{
    kind: "ALERT" | "INVITE" | "JOIN_REQUEST";
    notificationKey: string;
  }> = items
    .map((item: unknown) => {
      const record =
        typeof item === "object" && item !== null
          ? (item as { kind?: unknown; notificationKey?: unknown })
          : {};

      return {
        kind: typeof record.kind === "string" ? record.kind.toUpperCase() : "",
        notificationKey:
          typeof record.notificationKey === "string" ? record.notificationKey.trim() : ""
      };
    })
    .filter(
      (item: { kind: string; notificationKey: string }) =>
        validKinds.has(item.kind) &&
        item.notificationKey.length > 0
    ) as Array<{
      kind: "ALERT" | "INVITE" | "JOIN_REQUEST";
      notificationKey: string;
    }>;

  if (!sanitized.length) {
    return res.status(400).json({ error: "No valid notification dismissals were provided" });
  }

  await prisma.notificationDismissal.createMany({
    data: sanitized.map((item) => ({
      userId,
      kind: item.kind,
      notificationKey: item.notificationKey
    })),
    skipDuplicates: true
  });

  return res.status(201).json({ success: true });
});

notificationsRouter.get("/stream", (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = verifyToken(token);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    subscribeToNotifications(payload.sub, res);

    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribeFromNotifications(payload.sub, res);
      res.end();
    });

    return;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});
