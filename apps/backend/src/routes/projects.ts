import { Router } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  defaultAiModel,
  isSupportedAiModel,
  resolveAiModel,
  supportedAiModels
} from "../utils/aiModels.js";
import {
  currentMonthKey,
  getEffectiveAiUsage,
  getFreeEmailUsageRedisKey,
  getRedisUsageKey,
  incrementFreeEmailUsage
} from "../utils/aiUsage.js";
import {
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isOrgTeamActive,
  isUserProActive
} from "../utils/billing.js";
import {
  GITHUB_REPO_ANALYSIS_COST,
  GITHUB_REPO_ANALYSIS_MODEL,
  generateGithubRepoAnalysis
} from "../utils/githubRepoAnalysis.js";
import { parseGithubMetadata } from "../utils/integrationConnectionState.js";
import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";
import {
  fetchGithubRepoFile,
  fetchGithubRepoSummary,
  fetchGithubRepos,
  fetchGithubRepoTree
} from "../utils/integrationProviders.js";
import { deleteProjectGraph } from "../utils/projectDeletion.js";
import { redis } from "../db/redis.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const projectSelect = {
  id: true,
  name: true,
  apiKey: true,
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

const serializeProject = <
  T extends {
    id: string;
    name: string;
    apiKey: string;
    aiModel: string;
    githubRepoId: string | null;
    githubRepoName: string | null;
    githubRepoUrl: string | null;
    createdAt: Date;
    archivedAt: Date | null;
    configuredAt: Date | null;
    lastConfiguredAt: Date | null;
    orgId: string | null;
    githubRepoAnalysis?: {
      status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
      summary: string | null;
      generatedAt: Date | null;
      lastError: string | null;
      updatedAt: Date;
    } | null;
    errors: Array<{ lastSeen: Date }>;
    _count: { errors: number };
  }
>(
  project: T
 ) => {
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
  apiKey: project.apiKey,
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

const getUserOrgIds = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return memberships.map((m) => m.organizationId);
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

const buildRepoAnalysisContext = async ({
  accessToken,
  repoFullName
}: {
  accessToken: string;
  repoFullName: string;
}) => {
  const summary = await fetchGithubRepoSummary(accessToken, repoFullName);
  const tree = await fetchGithubRepoTree({
    accessToken,
    repoFullName,
    branch: summary.defaultBranch
  });

  const rootEntries = tree
    .filter((entry) => !entry.path.includes("/"))
    .map((entry) => `${entry.type === "tree" ? "dir" : "file"}: ${entry.path}`)
    .slice(0, 80);

  const interestingFilePatterns = [
    "README.md",
    "readme.md",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "turbo.json",
    "nx.json",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "composer.json",
    "Gemfile"
  ];

  const selectedFiles = Array.from(
    new Set(
      interestingFilePatterns.flatMap((pattern) =>
        tree
          .filter((entry) => entry.type === "blob" && entry.path.toLowerCase() === pattern.toLowerCase())
          .map((entry) => entry.path)
      )
    )
  ).slice(0, 12);

  const fetchedFiles = await Promise.all(
    selectedFiles.map(async (path) => {
      const file = await fetchGithubRepoFile({
        accessToken,
        repoFullName,
        branch: summary.defaultBranch,
        path
      });

      if (!file) return null;
      return {
        path: file.path,
        content: file.content.slice(0, 12000)
      };
    })
  );

  const fileSections = fetchedFiles
    .filter((file): file is { path: string; content: string } => Boolean(file?.content))
    .map(
      (file) => `### ${file.path}\n${file.content}`
    );

  return {
    repoDescription: summary.description,
    defaultBranch: summary.defaultBranch,
    rootEntries,
    totalFiles: tree.filter((entry) => entry.type === "blob").length,
    totalDirectories: tree.filter((entry) => entry.type === "tree").length,
    context: [
      `Default branch: ${summary.defaultBranch}`,
      summary.description ? `Description: ${summary.description}` : "",
      `Top-level structure:\n${rootEntries.join("\n")}`,
      fileSections.length ? `Sampled files:\n\n${fileSections.join("\n\n")}` : ""
    ]
      .filter(Boolean)
      .join("\n\n")
  };
};

projectsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  const includeArchived = req.query.includeArchived === "true";
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgIds = await getUserOrgIds(userId);

  const projects = await prisma.project.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    orderBy: { createdAt: "desc" },
    select: projectSelect
  });

  return res.json({
    projects: projects.map(serializeProject),
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
      apiKey,
      orgId: normalizedOrgId ?? null,
      aiModel: normalizedAiModel,
      ...mappedGithubRepo
    },
    select: projectSelect
  });

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

projectsRouter.post("/:id/github-analysis/analyze", async (req, res) => {
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
  const teamActive = Boolean(project.orgId && project.org && isOrgTeamActive(project.org));
  const organizationId = teamActive ? project.orgId : null;
  const usageLimit = teamActive ? TEAM_MONTHLY_AI_LIMIT : FREE_MONTHLY_AI_LIMIT;
  const limitMessage = teamActive
    ? "Monthly AI analysis limit reached for this team."
    : "Monthly AI analysis limit reached for this account.";
  const now = new Date();
  const monthKey = currentMonthKey(now);
  const usageKey = teamActive
    ? getRedisUsageKey({
        userId,
        organizationId,
        monthKey
      })
    : requester.email
      ? getFreeEmailUsageRedisKey({
          email: requester.email,
          monthKey
        })
      : getRedisUsageKey({
          userId,
          organizationId,
          monthKey
        });

  let usageReservedInRedis = false;

  if (!proActive) {
    const used = await getEffectiveAiUsage({
      userId,
      organizationId,
      email: requester.email,
      now
    });

    if (used + GITHUB_REPO_ANALYSIS_COST > usageLimit) {
      return res.status(402).json({ error: limitMessage });
    }

    if (redis.isOpen) {
      if (!teamActive && requester.email) {
        const existingRedisUsage = Number((await redis.get(usageKey)) || "0");
        if (existingRedisUsage < used) {
          await redis.set(usageKey, String(used));
          await redis.expire(usageKey, 60 * 60 * 24 * 45);
        }
      }

      const nextUsed = await redis.incrBy(usageKey, GITHUB_REPO_ANALYSIS_COST);
      usageReservedInRedis = true;
      if (nextUsed === GITHUB_REPO_ANALYSIS_COST) {
        await redis.expire(usageKey, 60 * 60 * 24 * 45);
      }
      if (nextUsed > usageLimit) {
        await redis.decrBy(usageKey, GITHUB_REPO_ANALYSIS_COST);
        return res.status(402).json({ error: limitMessage });
      }
    }
  }

  await prisma.githubRepoAnalysis.upsert({
    where: { projectId: project.id },
    update: {
      repoId: project.githubRepoId,
      repoName: project.githubRepoName,
      repoUrl: project.githubRepoUrl,
      status: "PROCESSING",
      model: resolveAiModel(project.aiModel),
      lastError: null
    },
    create: {
      projectId: project.id,
      repoId: project.githubRepoId,
      repoName: project.githubRepoName,
      repoUrl: project.githubRepoUrl,
      status: "PROCESSING",
      model: GITHUB_REPO_ANALYSIS_MODEL
    }
  });

  try {
    const accessToken = decryptIntegrationSecret(connection.accessTokenEncrypted);
    const repoContext = await buildRepoAnalysisContext({
      accessToken,
      repoFullName: project.githubRepoName
    });

    const report = await generateGithubRepoAnalysis({
      repoName: project.githubRepoName,
      context: repoContext.context
    });

    const updated = await prisma.githubRepoAnalysis.upsert({
      where: { projectId: project.id },
      update: {
        repoId: project.githubRepoId,
        repoName: project.githubRepoName,
        repoUrl: project.githubRepoUrl,
        status: "READY",
        model: GITHUB_REPO_ANALYSIS_MODEL,
        summary: report.summary,
        architecture: report.architecture,
        runtimeFlow: report.runtimeFlow,
        developmentFlow: report.developmentFlow,
        techStack: report.techStack as unknown as Prisma.InputJsonValue,
        keyModules: report.keyModules as unknown as Prisma.InputJsonValue,
        entryPoints: report.entryPoints as unknown as Prisma.InputJsonValue,
        risks: report.risks as unknown as Prisma.InputJsonValue,
        onboardingTips: report.onboardingTips as unknown as Prisma.InputJsonValue,
        lastError: null,
        generatedAt: new Date()
      },
      create: {
        projectId: project.id,
        repoId: project.githubRepoId,
        repoName: project.githubRepoName,
        repoUrl: project.githubRepoUrl,
        status: "READY",
        model: resolveAiModel(project.aiModel),
        summary: report.summary,
        architecture: report.architecture,
        runtimeFlow: report.runtimeFlow,
        developmentFlow: report.developmentFlow,
        techStack: report.techStack as unknown as Prisma.InputJsonValue,
        keyModules: report.keyModules as unknown as Prisma.InputJsonValue,
        entryPoints: report.entryPoints as unknown as Prisma.InputJsonValue,
        risks: report.risks as unknown as Prisma.InputJsonValue,
        onboardingTips: report.onboardingTips as unknown as Prisma.InputJsonValue,
        generatedAt: new Date()
      }
    });

    if (!proActive) {
      await prisma.aiUsageEntry.create({
        data: {
          userId,
          organizationId,
          projectId: project.id,
          kind: "GITHUB_REPO_ANALYSIS",
          amount: GITHUB_REPO_ANALYSIS_COST
        }
      });

      if (!teamActive && requester.email) {
        await incrementFreeEmailUsage({
          email: requester.email,
          amount: GITHUB_REPO_ANALYSIS_COST,
          now
        });
      }
    }

    return res.json({
      ok: true,
      analysisCost: GITHUB_REPO_ANALYSIS_COST,
      analysis: {
        status: updated.status,
        model: updated.model,
        summary: updated.summary,
        architecture: updated.architecture,
        runtimeFlow: updated.runtimeFlow,
        developmentFlow: updated.developmentFlow,
        techStack: updated.techStack || [],
        keyModules: updated.keyModules || [],
        entryPoints: updated.entryPoints || [],
        risks: updated.risks || [],
        onboardingTips: updated.onboardingTips || [],
        lastError: updated.lastError,
        generatedAt: updated.generatedAt,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    if (usageReservedInRedis) {
      await redis.decrBy(usageKey, GITHUB_REPO_ANALYSIS_COST);
    }

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

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { apiKey: newKey },
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

  return res.json({ status: "deleted" });
});
