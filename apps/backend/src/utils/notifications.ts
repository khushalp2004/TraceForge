import type { Response } from "express";
import { redisPublisher, redisSubscriber } from "../db/redis.js";

export type RealtimeNotification = {
  type:
    | "invite.received"
    | "join_request.received"
    | "alert.triggered"
    | "alert.created"
    | "alert.deleted";
  notificationId?: string;
  title: string;
  message: string;
  orgId?: string;
  orgName?: string;
  projectId?: string;
  projectName?: string;
  ruleId?: string;
  errorId?: string;
  environment?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
};

const connections = new Map<string, Set<Response>>();
const KEEP_ALIVE_EVENT = ": keep-alive\n\n";
const REDIS_NOTIFICATION_CHANNEL = "realtime:notifications";
const MAX_NOTIFICATION_CONNECTIONS_PER_USER = Math.max(
  1,
  Number(process.env.NOTIFICATION_MAX_CONNECTIONS_PER_USER || "3")
);
let keepAliveTimer: NodeJS.Timeout | null = null;
let redisBridgeReady = false;
let redisBridgeInitializing = false;

const publishLocalNotification = (userId: string, notification: RealtimeNotification) => {
  const active = connections.get(userId);
  if (!active?.size) {
    return;
  }

  const payload = `data: ${JSON.stringify(notification)}\n\n`;
  for (const res of active) {
    writeRawEvent(userId, res, payload);
  }
};

const ensureRedisNotificationBridge = async () => {
  if (redisBridgeReady || !redisSubscriber.isOpen) {
    return;
  }

  if (redisBridgeInitializing) {
    // Wait for initialization to complete
    while (redisBridgeInitializing && !redisBridgeReady) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return;
  }

  redisBridgeInitializing = true;

  try {
    await redisSubscriber.subscribe(REDIS_NOTIFICATION_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message) as {
          userId?: string;
          notification?: RealtimeNotification;
        };

        if (!parsed.userId || !parsed.notification) {
          return;
        }

        publishLocalNotification(parsed.userId, parsed.notification);
      } catch {
        // Ignore malformed pub/sub messages.
      }
    });

    redisBridgeReady = true;
  } catch (error) {
    console.error("Failed to initialize Redis notification bridge:", error);
    redisBridgeInitializing = false;
    throw error;
  }
};

const cleanupClosedResponse = (userId: string, res: Response) => {
  unsubscribeFromNotifications(userId, res);
  if (!res.writableEnded) {
    res.end();
  }
};

const writeRawEvent = (userId: string, res: Response, payload: string) => {
  if (res.writableEnded || res.destroyed) {
    cleanupClosedResponse(userId, res);
    return false;
  }

  const accepted = res.write(payload);
  if (!accepted) {
    cleanupClosedResponse(userId, res);
    return false;
  }

  return true;
};

const startKeepAliveLoop = () => {
  if (keepAliveTimer) {
    return;
  }

  keepAliveTimer = setInterval(() => {
    for (const [userId, active] of connections.entries()) {
      for (const res of active) {
        writeRawEvent(userId, res, KEEP_ALIVE_EVENT);
      }
    }
  }, 20000);
};

const stopKeepAliveLoopIfIdle = () => {
  if (keepAliveTimer && connections.size === 0) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
};

export const subscribeToNotifications = (userId: string, res: Response) => {
  // Atomic read-modify-write on the connections Map
  let active = connections.get(userId);
  if (!active) {
    active = new Set<Response>();
    connections.set(userId, active);
  }
  active.add(res);
  startKeepAliveLoop();
  void ensureRedisNotificationBridge();

  writeRawEvent(userId, res, `data: ${JSON.stringify({ type: "connected" })}\n\n`);
  return true;
};

export const canSubscribeToNotifications = (userId: string) => {
  const active = connections.get(userId);
  return (active?.size ?? 0) < MAX_NOTIFICATION_CONNECTIONS_PER_USER;
};

export const unsubscribeFromNotifications = (userId: string, res: Response) => {
  const active = connections.get(userId);
  if (!active) {
    return;
  }

  active.delete(res);
  if (!active.size) {
    connections.delete(userId);
  }
  stopKeepAliveLoopIfIdle();
};

export const publishNotificationToUser = (
  userId: string,
  notification: RealtimeNotification
) => {
  if (redisPublisher.isOpen) {
    void redisPublisher.publish(
      REDIS_NOTIFICATION_CHANNEL,
      JSON.stringify({
        userId,
        notification
      })
    );
    return;
  }

  publishLocalNotification(userId, notification);
};
