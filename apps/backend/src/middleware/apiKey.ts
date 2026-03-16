import { NextFunction, Request, Response } from "express";
import prisma from "../db/prisma.js";

export const requireProjectApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.header("X-Traceforge-Key");

  if (!apiKey) {
    return res.status(401).json({ error: "Missing X-Traceforge-Key header" });
  }

  const project = await prisma.project.findUnique({ where: { apiKey } });

  if (!project) {
    return res.status(401).json({ error: "Invalid project API key" });
  }

  if (project.archivedAt) {
    return res.status(403).json({ error: "Project is archived" });
  }

  req.project = {
    id: project.id,
    name: project.name,
    apiKey: project.apiKey,
    userId: project.userId
  };

  return next();
};
