import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";

export const webhooksRouter = Router();

const GITHUB_ANALYSIS_QUEUE_KEY = "github:analysis:queue";

webhooksRouter.post("/github", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  if (!signature) {
    return res.status(401).json({ error: "No signature provided" });
  }

  // Verify signature
  const payloadString = JSON.stringify(req.body);
  const hmac = crypto.createHmac("sha256", webhookSecret);
  const digest = `sha256=${hmac.update(payloadString).digest("hex")}`;

  // Use a simple timing-safe comparison if possible, or just strict equality
  if (signature !== digest) {
    console.error("GitHub webhook signature mismatch");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.headers["x-github-event"];
  
  if (event === "push") {
    const { repository, commits } = req.body;
    
    if (!repository?.full_name || !commits || commits.length === 0) {
      return res.status(200).json({ message: "No relevant changes or repo missing" });
    }

    // Find if we track this repository
    const project = await prisma.project.findFirst({
      where: { githubRepoName: repository.full_name }
    });

    if (!project) {
      return res.status(200).json({ message: "Repository not tracked" });
    }

    // Collect all added, modified, and removed files
    const addedFiles = new Set<string>();
    const modifiedFiles = new Set<string>();
    const removedFiles = new Set<string>();

    for (const commit of commits) {
      commit.added?.forEach((file: string) => addedFiles.add(file));
      commit.modified?.forEach((file: string) => modifiedFiles.add(file));
      commit.removed?.forEach((file: string) => removedFiles.add(file));
    }

    const filesToSync = Array.from(new Set([...addedFiles, ...modifiedFiles]));
    const filesToRemove = Array.from(removedFiles);

    if (filesToSync.length === 0 && filesToRemove.length === 0) {
      return res.status(200).json({ message: "No files to sync" });
    }

    // Enqueue a background job for the worker to process this specific sync
    const jobPayload = {
      projectId: project.id,
      userId: project.userId,
      analysisType: "sync",
      enqueuedAt: new Date().toISOString(),
      // We attach the specific files to sync to avoid re-reading the whole repo
      syncPayload: {
        filesToSync,
        filesToRemove
      }
    };

    await redis.lPush(GITHUB_ANALYSIS_QUEUE_KEY, JSON.stringify(jobPayload));
    console.log(`Enqueued webhook sync for ${repository.full_name} (${filesToSync.length} to sync, ${filesToRemove.length} to remove)`);
  }

  return res.status(200).json({ success: true });
});
