import { Router } from "express";
import prisma from "../db/prisma.js";
import {
  FREE_MONTHLY_AI_LIMIT,
  FREE_ORG_CREATION_LIMIT,
  FREE_ORG_MEMBER_LIMIT,
  PRO_LAUNCH_MONTHLY_PRICE_PAISE,
  PRO_LAUNCH_YEARLY_PRICE_PAISE,
  PRO_STANDARD_MONTHLY_PRICE_PAISE,
  PRO_STANDARD_YEARLY_PRICE_PAISE,
  TEAM_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_PRICE_PAISE,
  TEAM_YEARLY_PRICE_PAISE,
  getLaunchSlotsConfigured
} from "../utils/billing.js";

export const publicBillingRouter = Router();

publicBillingRouter.get("/pricing", async (_req, res) => {
  const slotsTotal = getLaunchSlotsConfigured();
  const used = await prisma.user.count({ where: { proPricingTier: "LAUNCH" } });
  const slotsRemaining = Math.max(0, slotsTotal - used);

  return res.json({
    currency: "INR",
    free: {
      aiLimitMonthly: FREE_MONTHLY_AI_LIMIT,
      orgMemberLimit: FREE_ORG_MEMBER_LIMIT,
      orgCreationLimit: FREE_ORG_CREATION_LIMIT
    },
    pro: {
      launch: {
        monthlyPriceInr: PRO_LAUNCH_MONTHLY_PRICE_PAISE / 100,
        yearlyPriceInr: PRO_LAUNCH_YEARLY_PRICE_PAISE / 100,
        slotsTotal,
        slotsRemaining,
        orgCreationLimit: null
      },
      standard: {
        monthlyPriceInr: PRO_STANDARD_MONTHLY_PRICE_PAISE / 100,
        yearlyPriceInr: PRO_STANDARD_YEARLY_PRICE_PAISE / 100,
        orgCreationLimit: null
      }
    },
    team: {
      monthlyPriceInr: TEAM_MONTHLY_PRICE_PAISE / 100,
      yearlyPriceInr: TEAM_YEARLY_PRICE_PAISE / 100,
      aiLimitMonthly: TEAM_MONTHLY_AI_LIMIT
    }
  });
});
