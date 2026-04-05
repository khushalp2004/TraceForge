import prisma from "../db/prisma.js";

export const FREE_MONTHLY_AI_LIMIT = 50;
export const TEAM_MONTHLY_AI_LIMIT = 200;
export const FREE_ORG_MEMBER_LIMIT = 5;
export const FREE_ORG_CREATION_LIMIT = 3;
export const PRO_LAUNCH_MONTHLY_PRICE_PAISE = 39900;
export const PRO_STANDARD_MONTHLY_PRICE_PAISE = 59900;
export const PRO_LAUNCH_YEARLY_PRICE_PAISE = 358800;
export const PRO_STANDARD_YEARLY_PRICE_PAISE = 598800;
export const TEAM_MONTHLY_PRICE_PAISE = 79900;
export const TEAM_YEARLY_PRICE_PAISE = 838800;

export type BillingIntervalValue = "MONTHLY" | "YEARLY";
export type UserPlanValue = "FREE" | "PRO";
export type OrgPlanValue = "FREE" | "TEAM";

export const isFutureDate = (value?: Date | null) =>
  Boolean(value && value.getTime() > Date.now());

export const isUserProActive = (input?: {
  plan?: string | null;
  planExpiresAt?: Date | null;
} | null) => input?.plan === "PRO" && (!input.planExpiresAt || isFutureDate(input.planExpiresAt));

export const isOrgTeamActive = (input?: {
  plan?: string | null;
  planExpiresAt?: Date | null;
} | null) => input?.plan === "TEAM" && (!input.planExpiresAt || isFutureDate(input.planExpiresAt));

export const getLaunchSlotsConfigured = () => {
  const raw = Number(process.env.PRO_LAUNCH_SLOTS || "20");
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.max(1, Math.floor(raw));
};

export const getLaunchSlotsRemaining = async () => {
  const total = getLaunchSlotsConfigured();
  const used = await prisma.user.count({ where: { proPricingTier: "LAUNCH" } });
  return {
    total,
    used,
    remaining: Math.max(0, total - used)
  };
};

export const getProPriceForInterval = (
  interval: BillingIntervalValue,
  pricingTier: "LAUNCH" | "STANDARD"
) =>
  interval === "YEARLY"
    ? pricingTier === "LAUNCH"
      ? PRO_LAUNCH_YEARLY_PRICE_PAISE
      : PRO_STANDARD_YEARLY_PRICE_PAISE
    : pricingTier === "LAUNCH"
      ? PRO_LAUNCH_MONTHLY_PRICE_PAISE
      : PRO_STANDARD_MONTHLY_PRICE_PAISE;

export const getTeamPriceForInterval = (interval: BillingIntervalValue) =>
  interval === "YEARLY" ? TEAM_YEARLY_PRICE_PAISE : TEAM_MONTHLY_PRICE_PAISE;

export const normalizeInterval = (value: string | undefined | null): BillingIntervalValue =>
  value === "YEARLY" ? "YEARLY" : "MONTHLY";

export const getUserAiAllowance = () => ({
  kind: "user_free" as const,
  limit: FREE_MONTHLY_AI_LIMIT
});

export const getTeamAiAllowance = () => ({
  kind: "org_team" as const,
  limit: TEAM_MONTHLY_AI_LIMIT
});

export const getUnlimitedAiAllowance = () => ({
  kind: "user_pro" as const,
  limit: null
});
