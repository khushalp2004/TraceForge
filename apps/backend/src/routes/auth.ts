import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { signToken } from "../utils/jwt.js";
import {
  findActiveVerificationCode,
  isVerificationCodeMatch,
  issueEmailVerificationCode
} from "../utils/emailVerification.js";

export const authRouter = Router();

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Password must be 10-64 characters and include uppercase, lowercase, number, and special character.";
const isStrongEnoughPassword = (password: string) => passwordPolicy.test(password);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const chooseTransferTarget = (
  members: Array<{ userId: string; role: "OWNER" | "MEMBER" }>
) => members.find((member) => member.role === "OWNER") ?? members[0] ?? null;

authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      address: true,
      email: true,
      emailVerifiedAt: true,
      plan: true,
      proPricingTier: true,
      planExpiresAt: true,
      subscriptionStatus: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user });
});

authRouter.post("/register", async (req, res) => {
  const { fullName, address, email, password } = req.body as {
    fullName?: string;
    address?: string;
    email?: string;
    password?: string;
  };

  if (!fullName?.trim() || !address?.trim() || !email || !password || !isValidEmail(email)) {
    return res.status(400).json({
      error: "Full name, address, valid email, and password are required"
    });
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: passwordPolicyMessage });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing?.emailVerifiedAt) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: fullName.trim(),
          address: address.trim(),
          email: normalizedEmail,
          passwordHash
        }
      })
    : await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          address: address.trim(),
          email: normalizedEmail,
          passwordHash
        }
      });

  await issueEmailVerificationCode({
    userId: user.id,
    email: user.email,
    fullName: user.fullName
  });

  return res.status(201).json({
    status: "verification_required",
    email: user.email
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.emailVerifiedAt) {
    return res.status(403).json({
      error: "Verify your email before signing in",
      verificationRequired: true,
      email: user.email
    });
  }

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    token,
    user: { id: user.id, fullName: user.fullName, address: user.address, email: user.email }
  });
});

authRouter.post("/verify-email", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.status(400).json({ error: "Email and verification code are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  if (user.emailVerifiedAt) {
    const token = signToken({ sub: user.id, email: user.email });

    return res.json({
      status: "already_verified",
      token,
      user: { id: user.id, fullName: user.fullName, address: user.address, email: user.email }
    });
  }

  const activeCode = await findActiveVerificationCode(user.id);
  if (!activeCode || activeCode.expiresAt < new Date()) {
    return res.status(400).json({ error: "The verification code is invalid or expired" });
  }

  if (!isVerificationCodeMatch(code.trim(), activeCode.codeHash)) {
    return res.status(400).json({ error: "The verification code is invalid or expired" });
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: activeCode.id },
      data: { usedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    status: "verified",
    token,
    user: { id: user.id, fullName: user.fullName, address: user.address, email: user.email }
  });
});

authRouter.post("/verify-email/resend", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    return res.json({ status: "ok" });
  }

  if (user.emailVerifiedAt) {
    return res.status(409).json({ error: "This email is already verified" });
  }

  await issueEmailVerificationCode({
    userId: user.id,
    email: user.email,
    fullName: user.fullName
  });

  return res.json({ status: "ok" });
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const { fullName, address } = req.body as {
    fullName?: string;
    address?: string;
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!fullName?.trim() || !address?.trim()) {
    return res.status(400).json({ error: "Full name and address are required" });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: fullName.trim(),
      address: address.trim()
    },
    select: {
      id: true,
      fullName: true,
      address: true,
      email: true
    }
  });

  return res.json({ status: "ok", user });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ error: passwordPolicyMessage });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  return res.json({ status: "ok" });
});

authRouter.post("/leave-organizations", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
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

  if (!memberships.length) {
    return res.json({ status: "ok", left: 0 });
  }

  const blockingOrganizations: string[] = [];

  for (const membership of memberships) {
    if (membership.role !== "OWNER") {
      continue;
    }

    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: membership.organizationId,
        role: "OWNER"
      }
    });

    if (ownerCount <= 1) {
      blockingOrganizations.push(membership.organization.name);
    }
  }

  if (blockingOrganizations.length) {
    return res.status(409).json({
      error:
        "You are the only owner in one or more organizations. Add another owner or delete those organizations first.",
      blockers: blockingOrganizations
    });
  }

  await prisma.organizationMember.deleteMany({
    where: { userId }
  });

  return res.json({ status: "ok", left: memberships.length });
});

authRouter.delete("/account", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const { email, password } = req.body as { email?: string; password?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password confirmation are required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.email !== email) {
    return res.status(400).json({ error: "Email confirmation does not match this account" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Password confirmation is incorrect" });
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
    return res.status(409).json({
      error:
        "Leave or reassign organizations that do not have another member before deleting this account.",
      blockers: {
        organizations: blockingOrganizations
      }
    });
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

  return res.json({ status: "deleted" });
});
