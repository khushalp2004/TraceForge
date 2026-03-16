import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { generateResetToken } from "../utils/passwordReset.js";

export const passwordResetRouter = Router();

passwordResetRouter.post("/request", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond 200 to avoid user enumeration
  if (!user) {
    return res.json({ status: "ok" });
  }

  const { token, tokenHash } = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const resetUrl = `${process.env.WEB_BASE_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  console.log(`Password reset link for ${email}: ${resetUrl}`);

  return res.json({ status: "ok" });
});

passwordResetRouter.post("/confirm", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash }
  });

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return res.json({ status: "ok" });
});
