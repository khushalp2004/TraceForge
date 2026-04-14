import { Router } from "express";
import { rateLimitByIp } from "../middleware/rateLimit.js";
import { subscribeMarketingEmail } from "../utils/marketingSubscribers.js";

export const marketingRouter = Router();

const subscribeRateLimit = rateLimitByIp("marketing:subscribe", {
  windowSeconds: 10 * 60,
  maxRequests: 10,
  message: "Too many subscribe attempts from this network. Please try again in a few minutes."
});

const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

marketingRouter.post("/subscribe", subscribeRateLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const sourcePath = typeof req.body?.sourcePath === "string" ? req.body.sourcePath.trim() : "";

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  try {
    const subscriber = await subscribeMarketingEmail({ email, sourcePath });

    return res.json({ status: "subscribed", subscriberId: subscriber.id });
  } catch (error) {
    console.error("Failed to store marketing subscriber", error);
    return res.status(500).json({ error: "Unable to save your subscription right now" });
  }
});
