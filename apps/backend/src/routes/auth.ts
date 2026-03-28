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

  const [projectCount, membershipCount] = await Promise.all([
    prisma.project.count({
      where: { userId }
    }),
    prisma.organizationMember.count({
      where: { userId }
    })
  ]);

  if (projectCount > 0 || membershipCount > 0) {
    return res.status(409).json({
      error:
        "Leave organizations and remove or transfer your projects before deleting this account.",
      blockers: {
        projects: projectCount,
        memberships: membershipCount
      }
    });
  }

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId }
    }),
    prisma.emailVerificationCode.deleteMany({
      where: { userId }
    }),
    prisma.organizationInvite.deleteMany({
      where: { createdById: userId }
    }),
    prisma.orgJoinRequest.deleteMany({
      where: { requesterId: userId }
    }),
    prisma.orgJoinRequest.updateMany({
      where: { resolvedById: userId },
      data: { resolvedById: null }
    }),
    prisma.orgAuditLog.updateMany({
      where: { actorId: userId },
      data: { actorId: null }
    }),
    prisma.alertRule.deleteMany({
      where: { userId }
    }),
    prisma.user.delete({
      where: { id: userId }
    })
  ]);

  return res.json({ status: "deleted" });
});
