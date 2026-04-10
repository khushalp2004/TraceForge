import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import prisma from "../db/prisma.js";
import { readAuthTokenFromRequest } from "../utils/authCookies.js";

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

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        disabledAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (user.disabledAt) {
      return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
    }

    req.user = { id: user.id, email: user.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
