import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../db/redis.js";
import type { Prisma } from "@prisma/client";
import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";
import { parseGithubMetadata } from "../utils/integrationConnectionState.js";
import { createGithubIssue, fetchGithubRepos } from "../utils/integrationProviders.js";

export const errorsRouter = Router();

errorsRouter.use(requireAuth);

const isManualAlertPayload = (payload: Prisma.JsonValue | null | undefined) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return (payload as Record<string, unknown>).source === "manual-alert-trigger";
};

const hasManualAlertSource = (
  events: Array<{
    payload: Prisma.JsonValue | null;
  }>
) => events.some((event) => isManualAlertPayload(event.payload));

const getUserOrgIds = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return memberships.map((m) => m.organizationId);
};

errorsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, q, env, sort, severity, page, pageSize } = req.query as {
    projectId?: string;
    q?: string;
    env?: string;
    severity?: "critical" | "warning" | "info";
    sort?: "lastSeen" | "count";
    page?: string;
    pageSize?: string;
  };
  const archivedOnly = req.query.archivedOnly === "true";
  const currentPage = Math.max(1, Number.parseInt(page || "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, Number.parseInt(pageSize || "5", 10) || 5));

  const orgIds = await getUserOrgIds(userId);

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    select: { id: true }
  });

  const allowedProjectIds = new Set(projects.map((p) => p.id));

  if (projectId && !allowedProjectIds.has(projectId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const baseWhere: Prisma.ErrorWhereInput = projectId
    ? { projectId }
    : { projectId: { in: Array.from(allowedProjectIds) } };

  const andConditions: Prisma.ErrorWhereInput[] = [
    baseWhere,
    {
      archivedAt: archivedOnly ? { not: null } : null
    }
  ];

  if (q) {
    andConditions.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { stackTrace: { contains: q, mode: "insensitive" } },
        { analysis: { is: { aiExplanation: { contains: q, mode: "insensitive" } } } },
        { project: { name: { contains: q, mode: "insensitive" } } }
      ]
    });
  }

  if (env) {
    andConditions.push({
      events: {
        some: {
          environment: env
        }
      }
    });
  }

  if (severity === "critical") {
    andConditions.push({
      OR: [
        { message: { contains: "null", mode: "insensitive" } },
        { message: { contains: "undefined", mode: "insensitive" } },
        { message: { contains: "typeerror", mode: "insensitive" } }
      ]
    });
  }

  if (severity === "warning") {
    andConditions.push({
      AND: [
        {
          OR: [
            { message: { contains: "timeout", mode: "insensitive" } },
            { message: { contains: "network", mode: "insensitive" } },
            { message: { contains: "rate", mode: "insensitive" } }
          ]
        },
        {
          NOT: {
            OR: [
              { message: { contains: "null", mode: "insensitive" } },
              { message: { contains: "undefined", mode: "insensitive" } },
              { message: { contains: "typeerror", mode: "insensitive" } }
            ]
          }
        }
      ]
    });
  }

  if (severity === "info") {
    andConditions.push({
      NOT: {
        OR: [
          { message: { contains: "null", mode: "insensitive" } },
          { message: { contains: "undefined", mode: "insensitive" } },
          { message: { contains: "typeerror", mode: "insensitive" } },
          { message: { contains: "timeout", mode: "insensitive" } },
          { message: { contains: "network", mode: "insensitive" } },
          { message: { contains: "rate", mode: "insensitive" } }
        ]
      }
    });
  }

  const where: Prisma.ErrorWhereInput = { AND: andConditions };

  const orderBy: Prisma.ErrorOrderByWithRelationInput =
    sort === "count" ? { count: "desc" } : { lastSeen: "desc" };

  const [errors, total] = await Promise.all([
    prisma.error.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        projectId: true,
        message: true,
        stackTrace: true,
        count: true,
        lastSeen: true,
        archivedAt: true,
        aiStatus: true,
        aiLastError: true,
        aiRequestedAt: true,
        analysis: true,
        events: {
          select: {
            payload: true
          },
          orderBy: {
            timestamp: "desc"
          },
          take: 10
        }
      }
    }),
    prisma.error.count({ where })
  ]);

  return res.json({
    errors: errors.map((errorRecord) => ({
      ...errorRecord,
      isManualAlertIssue: hasManualAlertSource(errorRecord.events)
    })),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage))
    }
  });
});

errorsRouter.get("/:id", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      message: true,
      stackTrace: true,
      count: true,
      firstSeen: true,
      lastSeen: true,
      archivedAt: true,
      aiStatus: true,
      aiLastError: true,
      aiRequestedAt: true,
      aiCompletedAt: true,
      analysis: {
        select: {
          aiExplanation: true,
          suggestedFix: true
        }
      },
      project: {
        select: {
          id: true,
          userId: true,
          orgId: true,
          archivedAt: true,
          name: true,
          githubRepoId: true,
          githubRepoName: true,
          githubRepoUrl: true
        }
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 10
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  return res.json({
    error: {
      ...errorRecord,
      isManualAlertIssue: hasManualAlertSource(errorRecord.events)
    }
  });
});

errorsRouter.post("/:id/github-issue", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;
  const { repoId, title, body } = req.body as {
    repoId?: string;
    title?: string;
    body?: string;
  };

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      message: true,
      stackTrace: true,
      count: true,
      lastSeen: true,
      archivedAt: true,
      analysis: {
        select: {
          aiExplanation: true,
          suggestedFix: true
        }
      },
      project: {
        select: {
          id: true,
          name: true,
          userId: true,
          orgId: true,
          archivedAt: true,
          githubRepoId: true,
          githubRepoName: true,
          githubRepoUrl: true
        }
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 3
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt || errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
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

  const metadata = parseGithubMetadata(connection.metadata);
  if (!metadata.selectedRepoIds?.length) {
    return res.status(400).json({ error: "Choose at least one GitHub repository in Settings first" });
  }

  try {
    const accessToken = decryptIntegrationSecret(connection.accessTokenEncrypted);
    const repos = await fetchGithubRepos(accessToken);
    const fallbackRepoId = errorRecord.project.githubRepoId || "";
    const resolvedRepoId =
      typeof repoId === "string" && repoId.trim() ? repoId.trim() : fallbackRepoId;

    if (!resolvedRepoId) {
      return res.status(400).json({ error: "repoId is required" });
    }

    const repo = repos.find(
      (entry) => entry.id === resolvedRepoId && metadata.selectedRepoIds?.includes(entry.id)
    );

    if (!repo) {
      return res.status(404).json({ error: "Selected GitHub repository is not available" });
    }

    const githubIssue = await createGithubIssue({
      accessToken,
      repoFullName: repo.fullName,
      title:
        typeof title === "string" && title.trim()
          ? title.trim().slice(0, 240)
          : `[TraceForge] ${errorRecord.message}`.slice(0, 240),
      body:
        typeof body === "string" && body.trim()
          ? body.trim()
          : [
              `TraceForge issue: ${errorRecord.message}`,
              "",
              `Project: ${errorRecord.project.name}`,
              `Occurrences: ${errorRecord.count}`,
              `Last seen: ${errorRecord.lastSeen.toISOString()}`,
              "",
              "```",
              errorRecord.stackTrace,
              "```"
            ].join("\n")
    });

    return res.json({
      ok: true,
      issue: {
        id: githubIssue.id,
        number: githubIssue.number,
        title: githubIssue.title,
        url: githubIssue.url,
        repoFullName: repo.fullName
      }
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create GitHub issue"
    });
  }
});

errorsRouter.post("/:id/regenerate", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      },
      events: {
        select: {
          payload: true
        },
        orderBy: {
          timestamp: "desc"
        },
        take: 10
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.archivedAt) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (hasManualAlertSource(errorRecord.events)) {
    return res
      .status(400)
      .json({ error: "AI solution is not available for manual alert issues" });
  }

  await prisma.errorAnalysis.deleteMany({
    where: { errorId }
  });

  if (!redis.isOpen) {
    await prisma.error.update({
      where: { id: errorId },
      data: {
        aiStatus: "FAILED",
        aiLastError: "AI worker queue is unavailable.",
        aiRequestedAt: new Date(),
        aiCompletedAt: null
      }
    });

    return res.status(503).json({ error: "AI worker queue is unavailable. Try again shortly." });
  }

  await prisma.error.update({
    where: { id: errorId },
    data: {
      aiStatus: "PENDING",
      aiLastError: null,
      aiRequestedAt: new Date(),
      aiCompletedAt: null
    }
  });

  await prisma.error.update({
    where: { id: errorId },
    data: {
      aiRequestedByUserId: userId
    }
  });

  await redis.lPush(
    "ai:queue",
    JSON.stringify({
      errorId,
      requestedByUserId: userId
    })
  );
  const queueDepth = await redis.lLen("ai:queue");

  return res.status(202).json({ status: "queued", queueDepth });
});

errorsRouter.post("/:id/archive", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_archived" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: new Date() }
  });

  return res.status(200).json({ status: "archived" });
});

errorsRouter.post("/:id/restore", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true,
          archivedAt: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!errorRecord.archivedAt) {
    return res.status(200).json({ status: "already_active" });
  }

  if (errorRecord.project.archivedAt) {
    return res.status(403).json({ error: "Project is archived" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.error.update({
    where: { id: errorId },
    data: { archivedAt: null }
  });

  return res.status(200).json({ status: "restored" });
});

errorsRouter.delete("/:id", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const errorId = req.params.id;

  const errorRecord = await prisma.error.findUnique({
    where: { id: errorId },
    select: {
      id: true,
      archivedAt: true,
      project: {
        select: {
          userId: true,
          orgId: true
        }
      }
    }
  });

  if (!errorRecord) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!errorRecord.archivedAt) {
    return res.status(400).json({ error: "Archive the issue before deleting it permanently" });
  }

  if (errorRecord.project.userId !== userId) {
    if (!errorRecord.project.orgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: errorRecord.project.orgId,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  await prisma.$transaction([
    prisma.alertDelivery.deleteMany({ where: { errorId } }),
    prisma.errorAnalysis.deleteMany({ where: { errorId } }),
    prisma.errorEvent.deleteMany({ where: { errorId } }),
    prisma.error.delete({ where: { id: errorId } })
  ]);

  return res.status(200).json({ status: "deleted" });
});
