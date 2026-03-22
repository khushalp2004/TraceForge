import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 1025);
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpFrom = process.env.SMTP_FROM || "TraceForge <no-reply@traceforge.local>";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

const createTransporter = async () => {
  if (!smtpHost) {
    throw new Error("SMTP is not configured");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser || smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
  });
};

const getTransporter = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }

  return transporterPromise;
};

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const sendEmail = async ({ to, subject, text, html }: SendEmailInput) => {
  if (!smtpHost) {
    console.log(`[mail:disabled] To=${to} Subject=${subject}\n${text}`);
    return;
  }

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html
  });
};
