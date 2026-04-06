import { Router } from "express";
import { rateLimitByIp } from "../middleware/rateLimit.js";
import { sendEmail } from "../utils/mailer.js";
import { buildHelpRequestEmail } from "../utils/emailTemplates.js";

export const supportRouter = Router();
const helpRequestRateLimit = rateLimitByIp("support:help", {
  windowSeconds: 10 * 60,
  maxRequests: 5,
  message: "Too many help requests from this network. Please try again in a few minutes."
});

const supportInboxEmail = process.env.SUPPORT_INBOX_EMAIL || "patilkhushal54321@gmail.com";
const webBaseUrl = process.env.WEB_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

const normalizeIp = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "unknown");

supportRouter.post("/help", helpRequestRateLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const problem = typeof req.body?.problem === "string" ? req.body.problem.trim() : "";

  if (!email || !problem) {
    return res.status(400).json({ error: "Email and problem are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  if (problem.length < 20) {
    return res.status(400).json({ error: "Please share a little more detail so we can help." });
  }

  const ip = normalizeIp(req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress);

  try {
    const { text, html } = buildHelpRequestEmail({
      fromEmail: email,
      problem,
      ip,
      productUrl: webBaseUrl
    });

    await sendEmail({
      to: supportInboxEmail,
      replyTo: email,
      subject: `TraceForge help request from ${email}`,
      text,
      html
    });

    return res.json({ status: "ok" });
  } catch (error) {
    console.error("Failed to send help request", error);
    return res.status(500).json({ error: "Unable to send your request right now" });
  }
});
