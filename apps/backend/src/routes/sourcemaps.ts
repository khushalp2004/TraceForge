import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireProjectApiKey } from "../middleware/apiKey.js";

export const sourcemapsRouter = Router();

// Allow larger payloads for source maps
import express from "express";
sourcemapsRouter.use(express.json({ limit: "50mb" }));

sourcemapsRouter.post("/", requireProjectApiKey, async (req, res) => {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { release, fileName, content } = req.body as {
    release?: string;
    fileName?: string;
    content?: string;
  };

  if (!release || !fileName || !content) {
    return res.status(400).json({ error: "release, fileName, and content are required" });
  }

  try {
    // Upsert the source map for this release and fileName
    const sourceMap = await prisma.sourceMap.upsert({
      where: {
        projectId_release_fileName: {
          projectId,
          release,
          fileName
        }
      },
      update: {
        content,
        createdAt: new Date()
      },
      create: {
        projectId,
        release,
        fileName,
        content
      }
    });

    return res.json({ 
      status: "success", 
      message: `Source map for ${fileName} (${release}) uploaded successfully.` 
    });
  } catch (error) {
    console.error("Failed to save source map:", error);
    return res.status(500).json({ error: "Failed to save source map" });
  }
});
