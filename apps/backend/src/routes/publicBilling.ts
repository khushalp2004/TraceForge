import { Router } from "express";
import prisma from "../db/prisma.js";

const DEFAULT_LAUNCH_SLOTS = 20;

const getLaunchSlots = () => {
  const raw = Number(process.env.PRO_LAUNCH_SLOTS || "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LAUNCH_SLOTS;
  return Math.min(Math.max(1, Math.floor(raw)), 1000);
};

export const publicBillingRouter = Router();

publicBillingRouter.get("/pricing", async (_req, res) => {
  const slotsTotal = getLaunchSlots();
  const used = await prisma.user.count({ where: { proPricingTier: "LAUNCH" } });
  const slotsRemaining = Math.max(0, slotsTotal - used);

  return res.json({
    currency: "INR",
    pro: {
      launch: {
        priceInr: 299,
        slotsTotal,
        slotsRemaining
      },
      standard: {
        priceInr: 499
      }
    }
  });
});

