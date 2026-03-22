import crypto from "crypto";
import prisma from "../db/prisma.js";
import { sendEmail } from "./mailer.js";

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

  const greeting = fullName?.trim() ? `Hi ${fullName.trim()},` : "Hi,";
  const text = [
    greeting,
    "",
    `Your TraceForge verification code is ${code}.`,
    `It expires in ${verificationTtlMinutes} minutes.`,
    "",
    "If you did not request this code, you can ignore this email."
  ].join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>${greeting}</p>
      <p>Your TraceForge verification code is:</p>
      <div style="display: inline-block; padding: 12px 18px; border-radius: 14px; background: #fff7ed; border: 1px solid #fdba74; font-size: 28px; font-weight: 700; letter-spacing: 0.32em; color: #c2410c;">
        ${code}
      </div>
      <p style="margin-top: 16px;">It expires in ${verificationTtlMinutes} minutes.</p>
      <p style="color: #64748b;">If you did not request this code, you can ignore this email.</p>
    </div>
  `;

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
