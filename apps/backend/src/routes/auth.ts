import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db/prisma.js";
import { signToken } from "../utils/jwt.js";

export const authRouter = Router();

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
const isStrongEnoughPassword = (password: string) => password.length >= 8;

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email and password are required" });
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash
    }
  });

  const token = signToken({ sub: user.id, email: user.email });

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email }
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    token,
    user: { id: user.id, email: user.email }
  });
});
