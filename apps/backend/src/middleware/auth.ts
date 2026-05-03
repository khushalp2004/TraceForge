import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import prisma from "../db/prisma.js";
import { readAuthTokenFromRequest } from "../utils/authCookies.js";
import { redis } from "../db/redis.js";

const AUTH_USER_CACHE_TTL_SECONDS = 30;
const getAuthUserCacheKey = (userId: string) => `auth:user:${userId}`;

type CachedAuthUser = {
  id: string;
  email: string;
  disabledAt: string | null;
};

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.replace("Bearer ", "").trim();
  }

  return "";
};

const resolveAuthToken = (req: Request) => {
  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    return bearerToken;
  }

  return readAuthTokenFromRequest(req);
};

const readCachedAuthUser = async (userId: string) => {
  if (!redis.isOpen) {
    return null;
  }

  const cached = await redis.get(getAuthUserCacheKey(userId));
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as CachedAuthUser;
    return {
      id: parsed.id,
      email: parsed.email,
      disabledAt: parsed.disabledAt ? new Date(parsed.disabledAt) : null
    };
  } catch {
    return null;
  }
};

const writeCachedAuthUser = async (user: {
  id: string;
  email: string;
  disabledAt: Date | null;
}) => {
  if (!redis.isOpen) {
    return;
  }

  const payload: CachedAuthUser = {
    id: user.id,
    email: user.email,
    disabledAt: user.disabledAt ? user.disabledAt.toISOString() : null
  };

  await redis.setEx(
    getAuthUserCacheKey(user.id),
    AUTH_USER_CACHE_TTL_SECONDS,
    JSON.stringify(payload)
  );
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = resolveAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  try {
    let payload;

    try {
      payload = verifyToken(token);
    } catch {
      const cookieToken = readAuthTokenFromRequest(req);

      if (!cookieToken || cookieToken === token) {
        throw new Error("Invalid token");
      }

      payload = verifyToken(cookieToken);
    }

    const cachedUser = await readCachedAuthUser(payload.sub);
    const user =
      cachedUser ??
      (await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          disabledAt: true
        }
      }));

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (user.disabledAt) {
      return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
    }

    if (!cachedUser) {
      await writeCachedAuthUser(user);
    }

    req.user = { id: user.id, email: user.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
