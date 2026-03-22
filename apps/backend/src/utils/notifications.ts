import type { Response } from "express";

export type RealtimeNotification = {
  type:
    | "invite.received"
    | "join_request.received"
    | "alert.triggered"
    | "alert.created"
    | "alert.deleted";
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
  isTest?: boolean;
  createdAt: string;
};

const connections = new Map<string, Set<Response>>();

const writeEvent = (res: Response, payload: unknown) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const subscribeToNotifications = (userId: string, res: Response) => {
  const active = connections.get(userId) ?? new Set<Response>();
  active.add(res);
  connections.set(userId, active);

  writeEvent(res, { type: "connected" });
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
};

export const publishNotificationToUser = (
  userId: string,
  notification: RealtimeNotification
) => {
  const active = connections.get(userId);
  if (!active?.size) {
    return;
  }

  for (const res of active) {
    writeEvent(res, notification);
  }
};
