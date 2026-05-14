import { Router } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { limitConcurrentRequests } from "../middleware/concurrency.js";
import { groqRequestRateLimits } from "../middleware/groqRateLimit.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { getCachedUserOrgIds } from "../utils/access.js";
import {
  defaultAiModel,
  isSupportedAiModel,
  resolveAiModel,
  supportedAiModels
} from "../utils/aiModels.js";
import {
  getEffectiveAiUsage
} from "../utils/aiUsage.js";
import {
  DEV_MONTHLY_AI_LIMIT,
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isUserDevActive,
  isOrgTeamActive,
  isUserProActive
} from "../utils/billing.js";
import {
  GITHUB_REPO_ANALYSIS_COST,
  GITHUB_REPO_ANALYSIS_MODEL
} from "../utils/githubRepoAnalysis.js";
import { parseGithubMetadata } from "../utils/integrationConnectionState.js";
import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";
import { githubAnalysisQueue } from "../queue/queues.js";
import {
  decryptProjectApiKey,
  isEncryptedProjectApiKey,
  sealProjectApiKey
} from "../utils/projectApiKeys.js";
import {
  fetchGithubRepos
} from "../utils/integrationProviders.js";
import { deleteProjectGraph } from "../utils/projectDeletion.js";
import { redis } from "../db/redis.js";
import { invalidateCache } from "../middleware/cache.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const projectListConcurrencyLimit = limitConcurrentRequests({
  namespace: "projects:list",
  maxConcurrent: 500,
  message: "Project list is busy right now. Please try again in a moment."
});

const projectSelect = {
  id: true,
  name: true,
  apiKey: true,
  apiKeyHash: true,
  aiModel: true,
  githubRepoId: true,
  githubRepoName: true,
  githubRepoUrl: true,
  createdAt: true,
  archivedAt: true,
  configuredAt: true,
  lastConfiguredAt: true,
  orgId: true,
  githubRepoAnalysis: {
    select: {
      status: true,
      summary: true,
      generatedAt: true,
      lastError: true,
      updatedAt: true
    }
  },
  errors: {
    where: { archivedAt: null },
    orderBy: { lastSeen: "desc" as const },
    take: 1,
    select: { lastSeen: true }
  },
  _count: {
    select: {
      errors: {
        where: { archivedAt: null }
      }
    }
  }
} as const;

const PROJECT_CONFIGURATION_STALE_DAYS = 30;
const PROJECT_CONFIGURATION_STALE_MS =
  PROJECT_CONFIGURATION_STALE_DAYS * 24 * 60 * 60 * 1000;
type ProjectRecord = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

const resolveProjectApiKey = (project: Pick<ProjectRecord, "apiKey" | "apiKeyHash">) =>
  project.apiKeyHash || isEncryptedProjectApiKey(project.apiKey)
    ? decryptProjectApiKey(project.apiKey)
    : project.apiKey;

const serializeProject = <T extends ProjectRecord>(
  project: T,
  options?: {
    includeApiKey?: boolean;
  }
) => {
  const includeApiKey = options?.includeApiKey ?? true;
  const now = Date.now();
  const lastEventAt = project.errors[0]?.lastSeen ?? null;
  const lastSignalAt = project.lastConfiguredAt ?? project.configuredAt ?? lastEventAt;
  const handshakeFresh = Boolean(
    project.lastConfiguredAt &&
      now - project.lastConfiguredAt.getTime() <= PROJECT_CONFIGURATION_STALE_MS
  );
  const legacyConfigured = Boolean(
    lastEventAt && now - lastEventAt.getTime() <= PROJECT_CONFIGURATION_STALE_MS
  );
  const isConfigured = handshakeFresh || legacyConfigured;
  const configurationSource = isConfigured
    ? handshakeFresh
      ? "handshake"
      : "legacy_telemetry"
    : lastSignalAt
      ? "stale"
      : "pending";

  return {
    id: project.id,
    name: project.name,
    apiKey: includeApiKey ? resolveProjectApiKey(project) : null,
    aiModel: resolveAiModel(project.aiModel),
    githubRepoId: project.githubRepoId,
    githubRepoName: project.githubRepoName,
    githubRepoUrl: project.githubRepoUrl,
    createdAt: project.createdAt,
    archivedAt: project.archivedAt,
    configuredAt: project.configuredAt ?? lastEventAt,
    lastConfiguredAt: project.lastConfiguredAt ?? lastEventAt,
    orgId: project.orgId,
    githubRepoAnalysis: project.githubRepoAnalysis
      ? {
          status: project.githubRepoAnalysis.status,
          summary: project.githubRepoAnalysis.summary,
          generatedAt: project.githubRepoAnalysis.generatedAt,
          lastError: project.githubRepoAnalysis.lastError,
          updatedAt: project.githubRepoAnalysis.updatedAt
        }
      : null,
    telemetryStatus: isConfigured ? "configured" : "not_configured",
    configurationSource,
    lastEventAt,
    eventCount: project._count.errors
  };
};

const findProjectWithSameName = async ({
  name,
  userId,
  orgId,
  excludeProjectId
}: {
  name: string;
  userId: string;
  orgId?: string | null;
  excludeProjectId?: string;
}) =>
  prisma.project.findFirst({
    where: {
      id: excludeProjectId ? { not: excludeProjectId } : undefined,
      name: {
        equals: name,
        mode: "insensitive"
      },
      ...(orgId
        ? { orgId }
        : {
            orgId: null,
            userId
          })
    },
    select: { id: true }
  });

const resolveMappedGithubRepo = async ({
  userId,
  githubRepoId
}: {
  userId: string;
  githubRepoId?: string | null;
}) => {
  const normalizedRepoId = githubRepoId?.trim();
  if (!normalizedRepoId) {
    return {
      githubRepoId: null,
      githubRepoName: null,
      githubRepoUrl: null
    };
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId
      }
    }
  });

  if (!connection) {
    throw Object.assign(new Error("Connect GitHub in Settings first"), { status: 400 });
  }

  const metadata = parseGithubMetadata(connection.metadata);
  if (!metadata.selectedRepoIds?.includes(normalizedRepoId)) {
    throw Object.assign(
      new Error("Choose a repository already selected in Settings"),
      { status: 400 }
    );
  }

  const repos = await fetchGithubRepos(decryptIntegrationSecret(connection.accessTokenEncrypted));
  const repo = repos.find((entry) => entry.id === normalizedRepoId);

  if (!repo) {
    throw Object.assign(new Error("Selected GitHub repository is no longer available"), {
      status: 404
    });
  }

  return {
    githubRepoId: repo.id,
    githubRepoName: repo.fullName,
    githubRepoUrl: repo.url
  };
};

const getAccessibleProjectForUser = async (projectId: string, userId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: true,
      githubRepoAnalysis: true
    }
  });

  if (!project) {
    return null;
  }

  if (project.userId === userId) {
    return project;
  }

  if (!project.orgId) {
    return null;
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.orgId,
        userId
      }
    }
  });

  if (!membership) {
    return null;
  }

  return project;
};

projectsRouter.get("/", projectListConcurrencyLimit, cacheMiddleware({ ttl: 60, keyPrefix: "projects:list", useUserId: true }), async (req, res) => {
  const userId = req.user?.id;
  const includeArchived = req.query.includeArchived === "true";
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgIds = await getCachedUserOrgIds(userId);

  const projects = await prisma.project.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    orderBy: { createdAt: "desc" },
    select: projectSelect
  });

  return res.json({
    projects: projects.map((project) => serializeProject(project, { includeApiKey: false })),
    availableAiModels: supportedAiModels,
    defaultAiModel
  });
});

projectsRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  const { name, orgId, aiModel, githubRepoId } = req.body as {
    name?: string;
    orgId?: string;
    aiModel?: string;
    githubRepoId?: string;
  };
  const normalizedOrgId = orgId?.trim() || undefined;
  const normalizedAiModel = aiModel?.trim() || defaultAiModel;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const normalizedName = name?.trim();

  if (!normalizedName || normalizedName.length < 2) {
    return res.status(400).json({ error: "Project name is required" });
  }

  if (!isSupportedAiModel(normalizedAiModel)) {
    return res.status(400).json({ error: "Unsupported AI model" });
  }

  const existingProject = await findProjectWithSameName({
    name: normalizedName,
    userId,
    orgId: normalizedOrgId ?? null
  });

  if (existingProject) {
    return res.status(409).json({
      error: normalizedOrgId
        ? "A project with that name already exists in this organization."
        : "A personal project with that name already exists."
    });
  }

  if (normalizedOrgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: normalizedOrgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Not a member of that organization" });
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true }
    });
    const proActive =
      user?.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now());

    if (!proActive) {
      const activePersonalProjects = await prisma.project.count({
        where: {
          userId,
          orgId: null,
          archivedAt: null
        }
      });

      if (activePersonalProjects >= 3) {
        return res.status(402).json({
          error: "Free plan supports up to 3 personal projects. Upgrade to Pro to create more."
        });
      }
    }
  }

  const apiKey = crypto.randomBytes(24).toString("hex");
  const sealedApiKey = sealProjectApiKey(apiKey);
  let mappedGithubRepo: Awaited<ReturnType<typeof resolveMappedGithubRepo>>;
  try {
    mappedGithubRepo = await resolveMappedGithubRepo({
      userId,
      githubRepoId
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return res.status(status).json({
      error: error instanceof Error ? error.message : "Failed to validate GitHub repository"
    });
  }

  const project = await prisma.project.create({
    data: {
      userId,
      name: normalizedName,
      ...sealedApiKey,
      orgId: normalizedOrgId ?? null,
      aiModel: normalizedAiModel,
      ...mappedGithubRepo
    },
    select: projectSelect
  });

  // Invalidate project list cache for this user
  void invalidateCache(`projects:list:user:${userId}:*`);

  return res.status(201).json({ project: serializeProject(project) });
});

projectsRouter.patch("/:id", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const normalizedName = name?.trim();

  if (!normalizedName || normalizedName.length < 2) {
    return res.status(400).json({ error: "Project name is required" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can rename projects" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const existingProject = await findProjectWithSameName({
    name: normalizedName,
    userId: project.userId,
    orgId: project.orgId,
    excludeProjectId: projectId
  });

  if (existingProject) {
    return res.status(409).json({
      error: project.orgId
        ? "A project with that name already exists in this organization."
        : "A personal project with that name already exists."
    });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { name: normalizedName },
    select: projectSelect
  });

  // Invalidate project list cache for all users who might have access (simpler to clear user's cache)
  void invalidateCache(`projects:list:user:${userId}:*`);
  if (project.orgId) {
    // If it's an org project, we might need to invalidate for all org members, 
    // but for now, clearing the requester's cache is a good start.
    // A more thorough fix would invalidate by pattern: projects:list:*
    void invalidateCache(`projects:list:*`);
  }

  return res.json({ project: serializeProject(updated) });
});

projectsRouter.post("/:id/github-repo", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { githubRepoId } = req.body as { githubRepoId?: string | null };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can update project GitHub repo" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const mappedGithubRepo = await resolveMappedGithubRepo({
      userId,
      githubRepoId: typeof githubRepoId === "string" ? githubRepoId : null
    });

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: mappedGithubRepo,
      select: projectSelect
    });

    return res.json({ project: serializeProject(updated) });
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return res.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to update project GitHub repository"
    });
  }
});

projectsRouter.get("/:id/api-key", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await getAccessibleProjectForUser(projectId, userId);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.archivedAt) {
    return res.status(400).json({ error: "Archived project keys are unavailable" });
  }

  return res.json({ apiKey: resolveProjectApiKey(project) });
});

projectsRouter.get("/:id/github-analysis", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await getAccessibleProjectForUser(projectId, userId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  return res.json({
    analysisCost: GITHUB_REPO_ANALYSIS_COST,
    project: {
      id: project.id,
      name: project.name,
      githubRepoId: project.githubRepoId,
      githubRepoName: project.githubRepoName,
      githubRepoUrl: project.githubRepoUrl
    },
    analysis: project.githubRepoAnalysis
      ? {
          status: project.githubRepoAnalysis.status,
          model: project.githubRepoAnalysis.model,
          summary: project.githubRepoAnalysis.summary,
          architecture: project.githubRepoAnalysis.architecture,
          runtimeFlow: project.githubRepoAnalysis.runtimeFlow,
          developmentFlow: project.githubRepoAnalysis.developmentFlow,
          techStack: project.githubRepoAnalysis.techStack || [],
          keyModules: project.githubRepoAnalysis.keyModules || [],
          entryPoints: project.githubRepoAnalysis.entryPoints || [],
          risks: project.githubRepoAnalysis.risks || [],
          onboardingTips: project.githubRepoAnalysis.onboardingTips || [],
          lastError: project.githubRepoAnalysis.lastError,
          generatedAt: project.githubRepoAnalysis.generatedAt,
          updatedAt: project.githubRepoAnalysis.updatedAt
        }
      : null
  });
});

projectsRouter.post("/:id/github-analysis/analyze", ...groqRequestRateLimits, async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await getAccessibleProjectForUser(projectId, userId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.archivedAt) {
    return res.status(400).json({ error: "Archived projects cannot run repo analysis" });
  }

  if (!project.githubRepoId || !project.githubRepoName) {
    return res.status(400).json({ error: "Link a GitHub repository to this project first" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Connect GitHub in Settings first" });
  }

  const githubMetadata = parseGithubMetadata(connection.metadata);
  if (!githubMetadata.selectedRepoIds?.includes(project.githubRepoId)) {
    return res.status(400).json({
      error: "The linked GitHub repository is no longer selected in Settings"
    });
  }

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      plan: true,
      planExpiresAt: true
    }
  });

  if (!requester) {
    return res.status(404).json({ error: "User not found" });
  }

  const proActive = isUserProActive(requester);
  const devActive = isUserDevActive(requester);
  const teamActive = Boolean(project.orgId && project.org && isOrgTeamActive(project.org));
  const organizationId = teamActive ? project.orgId : null;
  const usageLimit = teamActive
    ? TEAM_MONTHLY_AI_LIMIT
    : devActive
      ? DEV_MONTHLY_AI_LIMIT
      : FREE_MONTHLY_AI_LIMIT;
  const limitMessage = teamActive
    ? "Monthly AI analysis limit reached for this team."
    : devActive
      ? "Monthly AI analysis limit reached for your Dev plan."
      : "Monthly AI analysis limit reached for this account.";
  const now = new Date();

  if (!proActive) {
    const used = await getEffectiveAiUsage({
      userId,
      organizationId,
      email: devActive ? null : requester.email,
      now
    });

    if (used + GITHUB_REPO_ANALYSIS_COST > usageLimit) {
      return res.status(402).json({ error: limitMessage });
    }
  }

  await prisma.githubRepoAnalysis.upsert({
    where: { projectId: project.id },
    update: {
      repoId: project.githubRepoId,
      repoName: project.githubRepoName,
      repoUrl: project.githubRepoUrl,
      status: "PENDING",
      model: resolveAiModel(project.aiModel),
      lastError: null
    },
    create: {
      projectId: project.id,
      repoId: project.githubRepoId,
      repoName: project.githubRepoName,
      repoUrl: project.githubRepoUrl,
      status: "PENDING",
      model: GITHUB_REPO_ANALYSIS_MODEL
    }
  });

  try {
    if (!redis.isOpen) {
      throw new Error("Repo analysis queue is unavailable");
    }

    await githubAnalysisQueue.add(
      "analyze-github-repository",
      {
        projectId: project.id,
        userId,
        orgId: organizationId,
        requesterEmail: requester.email || null,
        chargeCredits: !proActive,
        incrementFreeEmailUsage: !teamActive && !devActive && Boolean(requester.email),
        usageCost: GITHUB_REPO_ANALYSIS_COST,
        enqueuedAt: new Date().toISOString()
      },
      {
        attempts: Number(process.env.GITHUB_ANALYSIS_WORKER_MAX_ATTEMPTS || "2"),
        backoff: {
          type: "exponential",
          delay: 3_000
        },
        removeOnComplete: 500,
        removeOnFail: 1000
      }
    );

    return res.status(202).json({
      ok: true,
      queued: true,
      analysisCost: GITHUB_REPO_ANALYSIS_COST,
      analysis: {
        status: "PENDING",
        model: GITHUB_REPO_ANALYSIS_MODEL,
        summary: null,
        architecture: null,
        runtimeFlow: null,
        developmentFlow: null,
        techStack: [],
        keyModules: [],
        entryPoints: [],
        risks: [],
        onboardingTips: [],
        lastError: null,
        generatedAt: null,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await prisma.githubRepoAnalysis.upsert({
      where: { projectId: project.id },
      update: {
        status: "FAILED",
        model: resolveAiModel(project.aiModel),
        lastError: error instanceof Error ? error.message : "Repo analysis failed"
      },
      create: {
        projectId: project.id,
        repoId: project.githubRepoId,
        repoName: project.githubRepoName,
        repoUrl: project.githubRepoUrl,
        status: "FAILED",
        model: resolveAiModel(project.aiModel),
        lastError: error instanceof Error ? error.message : "Repo analysis failed"
      }
    });

    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to analyze GitHub repository"
    });
  }
});

projectsRouter.post("/:id/rotate-key", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can rotate keys" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (project.archivedAt) {
    return res.status(400).json({ error: "Archived project cannot rotate key" });
  }

  const newKey = crypto.randomBytes(24).toString("hex");
  const sealedApiKey = sealProjectApiKey(newKey);

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: sealedApiKey,
    select: projectSelect
  });

  return res.json({ project: serializeProject(updated) });
});

projectsRouter.post("/:id/ai-model", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { aiModel } = req.body as { aiModel?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!aiModel || !isSupportedAiModel(aiModel)) {
    return res.status(400).json({ error: "Unsupported AI model" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can update AI model" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (project.archivedAt) {
    return res.status(400).json({ error: "Archived project cannot update AI model" });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { aiModel },
    select: projectSelect
  });

  return res.json({ project: serializeProject(updated) });
});

projectsRouter.post("/:id/restore", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can restore" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: null },
    select: projectSelect
  });

  void invalidateCache(`projects:list:user:${userId}:*`);
  if (project.orgId) {
    void invalidateCache(`projects:list:*`);
  }

  return res.json({ project: serializeProject(updated) });
});

projectsRouter.delete("/:id", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can archive" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!name || name.trim() !== project.name) {
    return res.status(400).json({ error: "Project name confirmation does not match" });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
    select: projectSelect
  });

  void invalidateCache(`projects:list:user:${userId}:*`);
  if (project.orgId) {
    void invalidateCache(`projects:list:*`);
  }

  return res.json({ project: serializeProject(updated) });
});

projectsRouter.delete("/:id/permanent", async (req, res) => {
  const userId = req.user?.id;
  const projectId = req.params.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.orgId,
          userId
        }
      }
    });

    if (!membership || membership.role !== "OWNER") {
      return res.status(403).json({ error: "Only org owners can delete projects" });
    }
  } else if (project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!project.archivedAt) {
    return res.status(400).json({ error: "Archive the project before deleting it permanently" });
  }

  if (!name || name.trim() !== project.name) {
    return res.status(400).json({ error: "Project name confirmation does not match" });
  }

  await prisma.$transaction(async (tx) => {
    await deleteProjectGraph(tx, projectId);
  });

  void invalidateCache(`projects:list:user:${userId}:*`);
  if (project.orgId) {
    void invalidateCache(`projects:list:*`);
  }

  return res.json({ status: "deleted" });
});
