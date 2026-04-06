import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../db/prisma.js";
import { generateResetToken } from "../utils/passwordReset.js";
import { sendEmail } from "../utils/mailer.js";
import { buildPasswordResetEmail } from "../utils/emailTemplates.js";

export const passwordResetRouter = Router();
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Password must be 10-64 characters and include uppercase, lowercase, number, and special character.";

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

  const resetUrl = `${process.env.WEB_BASE_URL || "http://localhost:3000"}/reset?token=${token}`;
  const { text, html } = buildPasswordResetEmail({
    fullName: user.fullName,
    resetUrl
  });

  await sendEmail({
    to: email,
    subject: "TraceForge password reset",
    text,
    html
  });

  return res.json({ status: "ok" });
});

passwordResetRouter.post("/confirm", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  if (!passwordPolicy.test(password)) {
    return res.status(400).json({ error: passwordPolicyMessage });
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
