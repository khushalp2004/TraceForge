import prisma from "../db/prisma.js";
import {
  FREE_MONTHLY_AI_LIMIT,
  isUserDevActive,
  isUserProActive
} from "./billing.js";
import { ensureFreeEmailUsageFloor, getEffectiveAiUsage } from "./aiUsage.js";

const chooseTransferTarget = (
  members: Array<{ userId: string; role: "OWNER" | "MEMBER" }>
) => members.find((member) => member.role === "OWNER") ?? members[0] ?? null;

export class UserLifecycleError extends Error {
  status: number;
  blockers?: { organizations?: string[] };

  constructor(
    message: string,
    options?: {
      status?: number;
      blockers?: { organizations?: string[] };
    }
  ) {
    super(message);
    this.name = "UserLifecycleError";
    this.status = options?.status ?? 400;
    this.blockers = options?.blockers;
  }
}

export const deleteUserAccount = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      plan: true,
      planExpiresAt: true
    }
  });

  if (!user) {
    throw new UserLifecycleError("User not found", { status: 404 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const orgIds = memberships.map((membership) => membership.organizationId);
  const otherMembers = orgIds.length
    ? await prisma.organizationMember.findMany({
        where: {
          organizationId: { in: orgIds },
          userId: { not: userId }
        },
        select: {
          organizationId: true,
          userId: true,
          role: true
        }
      })
    : [];

  const transferTargetByOrg = new Map<string, { userId: string; role: "OWNER" | "MEMBER" }>();
  const blockingOrganizations: string[] = [];

  for (const membership of memberships) {
    const candidates = otherMembers.filter(
      (entry) => entry.organizationId === membership.organizationId
    );
    const transferTarget = chooseTransferTarget(candidates);

    if (!transferTarget) {
      blockingOrganizations.push(membership.organization.name);
      continue;
    }

    transferTargetByOrg.set(membership.organizationId, transferTarget);
  }

  if (blockingOrganizations.length > 0) {
    throw new UserLifecycleError(
      "Leave or reassign organizations that do not have another member before deleting this account.",
      {
        status: 409,
        blockers: {
          organizations: blockingOrganizations
        }
      }
    );
  }

  if (!isUserProActive(user) && !isUserDevActive(user)) {
    const now = new Date();
    const freeUsage = await getEffectiveAiUsage({
      userId,
      email: user.email,
      now
    });

    if (freeUsage > 0) {
      await ensureFreeEmailUsageFloor({
        email: user.email,
        amount: Math.min(freeUsage, FREE_MONTHLY_AI_LIMIT),
        now
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const membership of memberships) {
      const transferTarget = transferTargetByOrg.get(membership.organizationId);
      if (!transferTarget) {
        continue;
      }

      if (membership.role === "OWNER" && transferTarget.role !== "OWNER") {
        await tx.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId: membership.organizationId,
              userId: transferTarget.userId
            }
          },
          data: {
            role: "OWNER"
          }
        });
      }

      await tx.project.updateMany({
        where: {
          userId,
          orgId: membership.organizationId
        },
        data: {
          userId: transferTarget.userId
        }
      });
    }

    const personalProjects = await tx.project.findMany({
      where: {
        userId,
        orgId: null
      },
      select: {
        id: true
      }
    });

    const personalProjectIds = personalProjects.map((project) => project.id);

    if (personalProjectIds.length > 0) {
      const personalErrors = await tx.error.findMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        },
        select: {
          id: true
        }
      });

      const personalErrorIds = personalErrors.map((error) => error.id);

      await tx.alertDelivery.deleteMany({
        where: {
          OR: [
            {
              projectId: {
                in: personalProjectIds
              }
            },
            personalErrorIds.length > 0
              ? {
                  errorId: {
                    in: personalErrorIds
                  }
                }
              : undefined
          ].filter(Boolean) as Array<Record<string, unknown>>
        }
      });

      if (personalErrorIds.length > 0) {
        await tx.errorAnalysis.deleteMany({
          where: {
            errorId: {
              in: personalErrorIds
            }
          }
        });

        await tx.errorEvent.deleteMany({
          where: {
            errorId: {
              in: personalErrorIds
            }
          }
        });

        await tx.error.deleteMany({
          where: {
            id: {
              in: personalErrorIds
            }
          }
        });
      }

      await tx.release.deleteMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        }
      });

      await tx.alertRule.deleteMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        }
      });

      await tx.project.deleteMany({
        where: {
          id: {
            in: personalProjectIds
          }
        }
      });
    }

    await tx.passwordResetToken.deleteMany({
      where: { userId }
    });
    await tx.emailVerificationCode.deleteMany({
      where: { userId }
    });
    await tx.organizationInvite.deleteMany({
      where: { createdById: userId }
    });
    await tx.orgJoinRequest.deleteMany({
      where: { requesterId: userId }
    });
    await tx.orgJoinRequest.updateMany({
      where: { resolvedById: userId },
      data: { resolvedById: null }
    });
    await tx.orgAuditLog.updateMany({
      where: { actorId: userId },
      data: { actorId: null }
    });
    await tx.alertRule.deleteMany({
      where: { userId }
    });
    await tx.payment.deleteMany({
      where: { userId }
    });
    await tx.organizationMember.deleteMany({
      where: { userId }
    });
    await tx.user.delete({
      where: { id: userId }
    });
  });
};
