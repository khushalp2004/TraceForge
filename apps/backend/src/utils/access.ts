import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";

const USER_ORG_IDS_CACHE_TTL_SECONDS = 10;
const getUserOrgIdsCacheKey = (userId: string) => `access:user-org-ids:${userId}`;
const ACCESSIBLE_PROJECTS_CACHE_TTL_SECONDS = 10;
const getAccessibleProjectsCacheKey = (userId: string) => `access:projects:${userId}`;

type AccessibleProject = {
  id: string;
  name: string;
  orgId: string | null;
};

export const getCachedUserOrgIds = async (userId: string) => {
  if (redis.isOpen) {
    const cached = await redis.get(getUserOrgIdsCacheKey(userId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as string[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Ignore malformed cache and refresh from DB.
      }
    }
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  const orgIds = memberships.map((membership) => membership.organizationId);

  if (redis.isOpen) {
    await redis.setEx(
      getUserOrgIdsCacheKey(userId),
      USER_ORG_IDS_CACHE_TTL_SECONDS,
      JSON.stringify(orgIds)
    );
  }

  return orgIds;
};

export const getCachedAccessibleProjects = async (userId: string) => {
  if (redis.isOpen) {
    const cached = await redis.get(getAccessibleProjectsCacheKey(userId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AccessibleProject[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Ignore malformed cache and refresh from DB.
      }
    }
  }

  const orgIds = await getCachedUserOrgIds(userId);
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ userId }, { orgId: { in: orgIds } }]
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      orgId: true
    }
  });

  if (redis.isOpen) {
    await redis.setEx(
      getAccessibleProjectsCacheKey(userId),
      ACCESSIBLE_PROJECTS_CACHE_TTL_SECONDS,
      JSON.stringify(projects)
    );
  }

  return projects;
};
