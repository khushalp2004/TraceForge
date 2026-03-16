import { Router } from "express";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const orgsRouter = Router();

orgsRouter.use(requireAuth);

const logEvent = async (
  organizationId: string,
  actorId: string | null,
  action: string,
  metadata?: Record<string, unknown>
) => {
  await prisma.orgAuditLog.create({
    data: {
      organizationId,
      actorId,
      action,
      metadata: metadata ?? undefined
    }
  });
};

const requireOwner = async (orgId: string, userId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership || membership.role !== "OWNER") {
    return null;
  }

  return membership;
};

orgsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true }
  });

  const orgs = memberships.map((member) => ({
    id: member.organization.id,
    name: member.organization.name,
    role: member.role,
    createdAt: member.organization.createdAt
  }));

  return res.json({ orgs });
});

orgsRouter.get("/invites/pending", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const invites = await prisma.organizationInvite.findMany({
    where: {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      email: user.email
    },
    include: { organization: true }
  });

  return res.json({
    invites: invites.map((invite) => ({
      token: invite.token,
      orgId: invite.organizationId,
      orgName: invite.organization.name,
      role: invite.role,
      expiresAt: invite.expiresAt
    }))
  });
});

orgsRouter.get("/requests/pending", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ownerMemberships = await prisma.organizationMember.findMany({
    where: { userId, role: "OWNER" }
  });
  const orgIds = ownerMemberships.map((m) => m.organizationId);

  if (!orgIds.length) {
    return res.json({ requests: [] });
  }

  const requests = await prisma.orgJoinRequest.findMany({
    where: {
      organizationId: { in: orgIds },
      status: "PENDING"
    },
    include: { requester: true, organization: true }
  });

  return res.json({
    requests: requests.map((request) => ({
      id: request.id,
      orgId: request.organizationId,
      orgName: request.organization.name,
      requesterEmail: request.requester.email,
      role: request.role,
      createdAt: request.createdAt
    }))
  });
});

orgsRouter.post("/requests/:id/approve", async (req, res) => {
  const userId = req.user?.id;
  const requestId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const request = await prisma.orgJoinRequest.findUnique({
    where: { id: requestId },
    include: { organization: true, requester: true }
  });

  if (!request || request.status !== "PENDING") {
    return res.status(404).json({ error: "Request not found" });
  }

  const owner = await requireOwner(request.organizationId, userId);
  if (!owner) {
    return res.status(403).json({ error: "Only owners can approve requests" });
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: request.organizationId,
        userId: request.requesterId
      }
    },
    update: { role: request.role },
    create: {
      organizationId: request.organizationId,
      userId: request.requesterId,
      role: request.role
    }
  });

  await prisma.orgJoinRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", resolvedAt: new Date(), resolvedById: userId }
  });

  await logEvent(request.organizationId, userId, "request.approved", {
    requesterEmail: request.requester.email,
    role: request.role
  });

  return res.json({ status: "approved" });
});

orgsRouter.post("/requests/:id/reject", async (req, res) => {
  const userId = req.user?.id;
  const requestId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const request = await prisma.orgJoinRequest.findUnique({
    where: { id: requestId },
    include: { requester: true }
  });

  if (!request || request.status !== "PENDING") {
    return res.status(404).json({ error: "Request not found" });
  }

  const owner = await requireOwner(request.organizationId, userId);
  if (!owner) {
    return res.status(403).json({ error: "Only owners can reject requests" });
  }

  await prisma.orgJoinRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", resolvedAt: new Date(), resolvedById: userId }
  });

  await logEvent(request.organizationId, userId, "request.rejected", {
    requesterId: request.requesterId
  });

  return res.json({ status: "rejected" });
});

orgsRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Organization name is required" });
  }

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      members: {
        create: {
          userId,
          role: "OWNER"
        }
      }
    }
  });

  await logEvent(org.id, userId, "org.created", { name: org.name });

  return res.status(201).json({
    org: {
      id: org.id,
      name: org.name,
      role: "OWNER",
      createdAt: org.createdAt
    }
  });
});

orgsRouter.get("/:id/members", async (req, res) => {
  const userId = req.user?.id;
  const orgId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId },
    include: { user: true }
  });

  return res.json({
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      role: member.role,
      createdAt: member.createdAt
    }))
  });
});

orgsRouter.get("/:id/audit", async (req, res) => {
  const userId = req.user?.id;
  const orgId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const logs = await prisma.orgAuditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: true }
  });

  return res.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actorEmail: log.actor?.email ?? "system",
      metadata: log.metadata,
      createdAt: log.createdAt
    }))
  });
});

orgsRouter.post("/:id/members", async (req, res) => {
  const userId = req.user?.id;
  const orgId = req.params.id;
  const { email, role } = req.body as { email?: string; role?: "OWNER" | "MEMBER" };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only owners can add members" });
  }

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const newMember = await prisma.organizationMember.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      role: role ?? "MEMBER"
    }
  });

  await logEvent(orgId, userId, "member.added", { email: user.email, role });

  return res.status(201).json({
    member: {
      id: newMember.id,
      userId: newMember.userId,
      role: newMember.role
    }
  });
});

orgsRouter.post("/:id/invites", async (req, res) => {
  const userId = req.user?.id;
  const orgId = req.params.id;
  const { email, role } = req.body as { email?: string; role?: "OWNER" | "MEMBER" };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only owners can create invites" });
  }

  const token = crypto.randomBytes(20).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId: orgId,
      token,
      role: role ?? "MEMBER",
      email: email?.trim() || null,
      createdById: userId,
      expiresAt
    }
  });

  await logEvent(orgId, userId, "invite.created", {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt
  });

  return res.status(201).json({
    invite: {
      token: invite.token,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt
    }
  });
});

orgsRouter.post("/invites/accept", async (req, res) => {
  const userId = req.user?.id;
  const { token } = req.body as { token?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!token) {
    return res.status(400).json({ error: "Invite token is required" });
  }

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: { organization: true }
  });

  if (!invite) {
    return res.status(404).json({ error: "Invite not found" });
  }

  if (invite.acceptedAt) {
    return res.status(400).json({ error: "Invite already accepted" });
  }

  if (invite.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invite expired" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (invite.email && invite.email !== user.email) {
    return res.status(403).json({ error: "Invite email mismatch" });
  }

  if (!invite.email) {
    const existing = await prisma.orgJoinRequest.findFirst({
      where: {
        organizationId: invite.organizationId,
        requesterId: userId,
        status: "PENDING"
      }
    });

    if (!existing) {
      await prisma.orgJoinRequest.create({
        data: {
          organizationId: invite.organizationId,
          requesterId: userId,
          inviteToken: invite.token,
          role: invite.role
        }
      });
      await logEvent(invite.organizationId, userId, "request.created", {
        role: invite.role
      });
    }

    return res.json({ status: "pending" });
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: invite.organizationId,
        userId
      }
    },
    update: { role: invite.role },
    create: {
      organizationId: invite.organizationId,
      userId,
      role: invite.role
    }
  });

  await prisma.organizationInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() }
  });

  await logEvent(invite.organizationId, userId, "invite.accepted", {
    email: user.email,
    role: invite.role
  });

  return res.status(200).json({
    org: {
      id: invite.organizationId,
      name: invite.organization.name
    }
  });
});

orgsRouter.patch("/:orgId/members/:memberId", async (req, res) => {
  const userId = req.user?.id;
  const { orgId, memberId } = req.params;
  const { role } = req.body as { role?: "OWNER" | "MEMBER" };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only owners can update members" });
  }

  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }

  const target = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    include: { user: true }
  });

  if (!target) {
    return res.status(404).json({ error: "Member not found" });
  }

  if (target.role === "OWNER" && role === "MEMBER") {
    const owners = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "OWNER" }
    });
    if (owners <= 1) {
      return res.status(400).json({ error: "Organization must have at least one owner" });
    }
  }

  const updated = await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role }
  });

  await logEvent(orgId, userId, "member.role_updated", {
    email: target.user.email,
    role
  });

  return res.json({
    member: {
      id: updated.id,
      userId: updated.userId,
      role: updated.role
    }
  });
});

orgsRouter.delete("/:orgId/members/:memberId", async (req, res) => {
  const userId = req.user?.id;
  const { orgId, memberId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only owners can remove members" });
  }

  const target = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    include: { user: true }
  });

  if (!target) {
    return res.status(404).json({ error: "Member not found" });
  }

  if (target.role === "OWNER") {
    const owners = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "OWNER" }
    });
    if (owners <= 1) {
      return res.status(400).json({ error: "Organization must have at least one owner" });
    }
  }

  await prisma.organizationMember.delete({
    where: { id: memberId }
  });

  await logEvent(orgId, userId, "member.removed", {
    email: target.user.email
  });

  return res.status(204).send();
});
