import nodemailer, { type Transporter } from "nodemailer";

const resendApiKey = process.env.RESEND_API_KEY;
const resendApiUrl = process.env.RESEND_API_URL || "https://api.resend.com/emails";
const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || "TraceForge <no-reply@traceforge.local>";
const smtpPort = Number(process.env.SMTP_PORT || 1025);
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpFrom = process.env.SMTP_FROM || "TraceForge <no-reply@traceforge.local>";
const isProduction = process.env.NODE_ENV === "production";

let transporterPromise: Promise<Transporter> | null = null;

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

const sendWithResend = async ({
  to,
  subject,
  text,
  html,
  replyTo
}: SendEmailInput) => {
  const response = await fetch(resendApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorBody}`);
  }
};

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export const sendEmail = async ({ to, subject, text, html, replyTo }: SendEmailInput) => {
  if (resendApiKey) {
    await sendWithResend({ to, subject, text, html, replyTo });
    return;
  }

  if (!smtpHost) {
    if (!isProduction) {
      console.info(`[mail:disabled] To=${to} Subject=${subject}\n${text}`);
    }
    return;
  }

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: smtpFrom,
    to,
    replyTo,
    subject,
    text,
    html
  });
};
