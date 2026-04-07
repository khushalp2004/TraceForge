import { Router } from "express";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/superAdmin.js";
import { rateLimitByUser } from "../middleware/rateLimit.js";
import { sendEmail } from "../utils/mailer.js";
import { buildSuperAdminAccessRequestEmail } from "../utils/emailTemplates.js";
import { getSuperAdminInboxEmail, isSuperAdminEmail } from "../utils/superAdmin.js";
import { deleteUserAccount, UserLifecycleError } from "../utils/userLifecycle.js";

export const adminRouter = Router();

const adminRequestRateLimit = rateLimitByUser("admin:request-access", {
  windowSeconds: 10 * 60,
  maxRequests: 3,
  message: "Too many admin access requests. Please wait before trying again."
});

const adminManagementRateLimit = rateLimitByUser("admin:management", {
  windowSeconds: 5 * 60,
  maxRequests: 60,
  message: "Too many admin actions. Please slow down and try again."
});

const addDays = (from: Date, days: number) => {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
};

adminRouter.post("/request-access", requireAuth, adminRequestRateLimit, async (req, res) => {
  const userId = req.user?.id;
  const email = req.user?.email;

  if (!userId || !email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (isSuperAdminEmail(email)) {
    return res.json({ ok: true, alreadyApproved: true });
  }

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      email: true
    }
  });

  if (!requester) {
    return res.status(404).json({ error: "User not found" });
  }

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const productUrl = process.env.WEB_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    const { text, html } = buildSuperAdminAccessRequestEmail({
      requesterEmail: requester.email,
      requesterName: requester.fullName,
      reason,
      productUrl
    });

    await sendEmail({
      to: getSuperAdminInboxEmail(),
      replyTo: requester.email,
      subject: `TraceForge super admin access request from ${requester.email}`,
      text,
      html
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to send super admin access request", error);
    return res.status(500).json({ error: "Unable to send the access request right now" });
  }
});

adminRouter.use(requireAuth, requireSuperAdmin, adminManagementRateLimit);

adminRouter.get("/overview", async (_req, res) => {
  const now = new Date();
  const [
    totalUsers,
    totalOrganizations,
    totalProjects,
    totalErrors,
    activePersonalPlans,
    activeTeamPlans,
    suspendedUsers,
    recentUsers,
    recentPayments,
    integrationCounts
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.project.count({ where: { archivedAt: null } }),
    prisma.error.count({ where: { archivedAt: null } }),
    prisma.user.count({
      where: {
        plan: { in: ["DEV", "PRO"] },
        OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }]
      }
    }),
    prisma.organization.count({
      where: {
        plan: "TEAM",
        OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }]
      }
    }),
    prisma.user.count({
      where: {
        disabledAt: { not: null }
      }
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        fullName: true,
        email: true,
        plan: true,
        disabledAt: true,
        createdAt: true,
        planExpiresAt: true
      }
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        plan: true,
        interval: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            fullName: true
          }
        },
        organization: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.integrationConnection.groupBy({
      by: ["provider"],
      _count: {
        _all: true
      }
    })
  ]);

  return res.json({
    stats: {
      totalUsers,
      totalOrganizations,
      totalProjects,
      totalErrors,
      activePersonalPlans,
      activeTeamPlans,
      suspendedUsers
    },
    integrations: integrationCounts.map((entry) => ({
      provider: entry.provider,
      count: entry._count._all
    })),
    recentUsers,
    recentPayments
  });
});

adminRouter.get("/users", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const page = Math.max(1, Number(req.query.page || "1"));
  const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || "10")));

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { fullName: { contains: search, mode: "insensitive" as const } }
        ]
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        plan: true,
        planInterval: true,
        planExpiresAt: true,
        disabledAt: true,
        disabledReason: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: {
          select: {
            projects: true,
            memberships: true,
            payments: true
          }
        }
      }
    })
  ]);

  return res.json({
    users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

adminRouter.get("/users/:userId", async (req, res) => {
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      fullName: true,
      email: true,
      plan: true,
      planInterval: true,
      proPricingTier: true,
      planExpiresAt: true,
      subscriptionStatus: true,
      emailVerifiedAt: true,
      createdAt: true,
      disabledAt: true,
      disabledReason: true,
      projects: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          orgId: true,
          createdAt: true
        }
      },
      memberships: {
        orderBy: { createdAt: "desc" },
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              plan: true
            }
          }
        }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          plan: true,
          interval: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      _count: {
        select: {
          projects: true,
          memberships: true,
          payments: true
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user });
});

adminRouter.patch("/users/:userId/status", async (req, res) => {
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  const action = req.body?.action === "reactivate" ? "reactivate" : "suspend";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      fullName: true,
      disabledAt: true
    }
  });

  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (action === "suspend" && isSuperAdminEmail(existingUser.email)) {
    return res.status(403).json({ error: "Allowlisted super admin accounts cannot be suspended here." });
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data:
      action === "reactivate"
        ? {
            disabledAt: null,
            disabledReason: null
          }
        : {
            disabledAt: new Date(),
            disabledReason: reason || "Suspended by super admin"
          },
    select: {
      id: true,
      email: true,
      fullName: true,
      disabledAt: true,
      disabledReason: true
    }
  });

  return res.json({
    ok: true,
    user: updated
  });
});

adminRouter.patch("/users/:userId/plan", async (req, res) => {
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  const plan = req.body?.plan === "PRO" ? "PRO" : req.body?.plan === "DEV" ? "DEV" : "FREE";
  const durationDays = Math.max(1, Math.min(365, Number(req.body?.durationDays || "30")));

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      fullName: true
    }
  });

  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = new Date();
  const expiresAt = plan === "FREE" ? null : addDays(now, durationDays);

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      plan,
      planInterval: plan === "FREE" ? null : "MONTHLY",
      subscriptionStatus: plan === "FREE" ? null : "admin_granted",
      planExpiresAt: expiresAt,
      razorpaySubscriptionId: plan === "FREE" ? null : undefined,
      lastPaymentId: plan === "FREE" ? null : undefined,
      lastPaymentProvider: plan === "FREE" ? null : undefined,
      proPricingTier: plan === "PRO" ? "STANDARD" : null
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      plan: true,
      planInterval: true,
      planExpiresAt: true,
      subscriptionStatus: true
    }
  });

  return res.json({ ok: true, user: updated });
});

adminRouter.delete("/users/:userId", async (req, res) => {
  const targetUserId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";

  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true
    }
  });

  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (isSuperAdminEmail(existingUser.email)) {
    return res.status(403).json({ error: "Allowlisted super admin accounts cannot be deleted here." });
  }

  try {
    await deleteUserAccount(targetUserId);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.blockers ? { blockers: error.blockers } : {})
      });
    }

    console.error("Failed to delete user from admin panel", error);
    return res.status(500).json({ error: "Unable to delete this user right now" });
  }
});
