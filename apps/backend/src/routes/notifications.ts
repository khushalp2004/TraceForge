import { Router } from "express";
import { verifyToken } from "../utils/jwt.js";
import {
  subscribeToNotifications,
  unsubscribeFromNotifications
} from "../utils/notifications.js";

export const notificationsRouter = Router();

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
