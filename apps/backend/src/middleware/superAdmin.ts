import { NextFunction, Request, Response } from "express";
import { isSuperAdminEmail } from "../utils/superAdmin.js";

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const email = req.user?.email;

  if (!email || !isSuperAdminEmail(email)) {
    return res.status(403).json({ error: "Super admin access is required" });
  }

  return next();
};
