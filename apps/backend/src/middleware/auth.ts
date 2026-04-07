import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import prisma from "../db/prisma.js";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    const payload = verifyToken(token);
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
