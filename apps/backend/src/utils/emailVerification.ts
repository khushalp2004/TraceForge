import crypto from "crypto";
import prisma from "../db/prisma.js";
import { sendEmail } from "./mailer.js";
import { buildVerificationCodeEmail } from "./emailTemplates.js";

const verificationTtlMinutes = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 10);

const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

export const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const issueEmailVerificationCode = async ({
  userId,
  email,
  fullName
}: {
  userId: string;
  email: string;
  fullName?: string | null;
}) => {
  const code = generateVerificationCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + verificationTtlMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.emailVerificationCode.deleteMany({
      where: {
        userId,
        usedAt: null
      }
    }),
    prisma.emailVerificationCode.create({
      data: {
        userId,
        codeHash,
        expiresAt
      }
    })
  ]);

  const { text, html } = buildVerificationCodeEmail({
    fullName,
    code,
    expiresInMinutes: verificationTtlMinutes
  });

  await sendEmail({
    to: email,
    subject: "TraceForge verification code",
    text,
    html
  });

  return {
    expiresAt,
    code
  };
};

export const findActiveVerificationCode = async (userId: string) =>
  prisma.emailVerificationCode.findFirst({
    where: {
      userId,
      usedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });

export const isVerificationCodeMatch = (plainCode: string, storedHash: string) =>
  hashCode(plainCode) === storedHash;
