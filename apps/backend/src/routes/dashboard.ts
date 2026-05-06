import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { rateLimitByUser } from "../middleware/rateLimit.js";
import { withCircuitBreaker } from "../utils/circuitBreaker.js";
import prisma from "../db/prisma.js";

const dashboardRouter = Router();

const dashboardRateLimit = rateLimitByUser("dashboard:data", {
  windowSeconds: 60,
  maxRequests: 100,
  message: "Too many dashboard requests. Please wait before trying again."
});

// Circuit breakers for database operations
const userCircuitBreaker = withCircuitBreaker(
  "db:user:findUnique",
  (userId: string) => prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      plan: true,
      subscriptionStatus: true
    }
  }),
  { timeout: 5000 }
);

const projectsCircuitBreaker = withCircuitBreaker(
  "db:projects:findMany",
  (userId: string) => prisma.project.findMany({
    where: {
      archivedAt: null,
      userId
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      createdAt: true,
      userId: true,
      aiModel: true
    }
  }),
  { timeout: 5000 }
);

const organizationsCircuitBreaker = withCircuitBreaker(
  "db:organizations:findMany",
  (userId: string) => prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          plan: true
        }
      }
    },
    take: 20
  }),
  { timeout: 5000 }
);

const alertRulesCircuitBreaker = withCircuitBreaker(
  "db:alertRules:findMany",
  (userId: string) => prisma.alertRule.findMany({
    where: {
      archivedAt: null,
      userId
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      projectId: true,
      createdAt: true
    }
  }),
  { timeout: 5000 }
);

dashboardRouter.get(
  "/",
  requireAuth,
  cacheMiddleware({ ttl: 30, keyPrefix: "dashboard:data", useUserId: true }),
  dashboardRateLimit,
  async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Fetch all data in parallel with circuit breakers
      const [user, projects, organizations, alertRules] = await Promise.all([
        // Fetch user data with circuit breaker
        userCircuitBreaker(userId),
        // Fetch projects with circuit breaker
        projectsCircuitBreaker(userId),
        // Fetch organizations with circuit breaker
        organizationsCircuitBreaker(userId),
        // Fetch alert rules with circuit breaker
        alertRulesCircuitBreaker(userId)
      ]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get usage summary
      const usage = {
        totalProjects: projects.length,
        totalOrganizations: organizations.length,
        totalAlerts: alertRules.length
      };

      return res.json({
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus
        },
        usage,
        projects,
        organizations: organizations.map((m) => ({
          ...m.organization,
          role: m.role
        })),
        alerts: alertRules
      });
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  }
);

export { dashboardRouter };
