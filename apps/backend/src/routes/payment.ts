import { Request, Router } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitByUser, rateLimitByIp } from "../middleware/rateLimit.js";
import {
  BillingIntervalValue,
  DEV_MONTHLY_PRICE_PAISE,
  PRO_STANDARD_MONTHLY_PRICE_PAISE,
  TEAM_MONTHLY_PRICE_PAISE,
  getDevPriceForInterval,
  getLaunchSlotsRemaining,
  getProPriceForInterval,
  getTeamPriceForInterval,
  isUserDevActive,
  isOrgTeamActive,
  isUserProActive,
  normalizeInterval
} from "../utils/billing.js";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const PROVIDER = "razorpay";
type CheckoutPlan = "DEV" | "PRO" | "TEAM";
type BillingScope = "USER" | "ORGANIZATION";
type PricingTier = "LAUNCH" | "STANDARD" | null;

const paymentMutationRateLimit = rateLimitByUser("payment:mutations", {
  windowSeconds: 5 * 60,
  maxRequests: 25,
  message: "Too many billing requests. Please wait and try again."
});

const webhookRateLimit = rateLimitByIp("payment:webhook", {
  windowSeconds: 60,
  maxRequests: 180,
  message: "Too many webhook requests. Please try again later.",
  failOpen: true
});

const getRazorpayKeys = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  return {
    keyId,
    keySecret,
    webhookSecret,
    devMonthlyPlanId: process.env.RAZORPAY_PLAN_DEV_MONTHLY_ID?.trim() || "",
    proLaunchMonthlyPlanId: process.env.RAZORPAY_PLAN_PRO_MONTHLY_ID?.trim() || "",
    proStandardMonthlyPlanId:
      process.env.RAZORPAY_PLAN_PRO_MONTHLY_STANDARD_ID?.trim() || "",
    proLaunchYearlyPlanId: process.env.RAZORPAY_PLAN_PRO_YEARLY_ID?.trim() || "",
    proStandardYearlyPlanId: process.env.RAZORPAY_PLAN_PRO_YEARLY_STANDARD_ID?.trim() || "",
    teamMonthlyPlanId: process.env.RAZORPAY_PLAN_TEAM_MONTHLY_ID?.trim() || "",
    teamYearlyPlanId: process.env.RAZORPAY_PLAN_TEAM_YEARLY_ID?.trim() || ""
  };
};

const assertConfigured = () => {
  const { keyId, keySecret } = getRazorpayKeys();
  if (!keyId || !keySecret) {
    const missing = [
      !keyId ? "RAZORPAY_KEY_ID" : null,
      !keySecret ? "RAZORPAY_KEY_SECRET" : null
    ]
      .filter(Boolean)
      .join(", ");
    const err = new Error(
      missing
        ? `Razorpay is not configured (missing ${missing})`
        : "Razorpay is not configured"
    );
    (err as { status?: number }).status = 501;
    throw err;
  }
  return { keyId, keySecret };
};

const razorpayRequest = async <T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T> => {
  const { keyId, keySecret } = assertConfigured();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { description?: string } | string;
  };
  if (!res.ok) {
    const providerMessage =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.description || `Razorpay request failed (${res.status})`;
    const message =
      res.status === 401
        ? "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, and make sure they match the same test or live account as your plan IDs."
        : res.status === 404
          ? "Razorpay could not find the requested billing resource. Check that your plan IDs exist in the same Razorpay mode as your keys."
          : providerMessage;
    const err = new Error(message);
    (err as { status?: number }).status = 502;
    throw err;
  }

  return data as T;
};

const addOneMonth = (from: Date) => {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
};

const addOneYear = (from: Date) => {
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + 1);
  return next;
};

type RazorpaySubscription = {
  id: string;
  status: string;
  plan_id?: string | null;
  notes?: Record<string, unknown> | null;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  created_at?: number | null;
};

const addInterval = (from: Date, interval: BillingIntervalValue) =>
  interval === "YEARLY" ? addOneYear(from) : addOneMonth(from);

const getPlanAmount = ({
  plan,
  interval,
  pricingTier
}: {
  plan: CheckoutPlan;
  interval: BillingIntervalValue;
  pricingTier?: PricingTier;
}) =>
  plan === "TEAM"
    ? getTeamPriceForInterval(interval)
    : plan === "DEV"
      ? getDevPriceForInterval(interval)
    : getProPriceForInterval(interval, pricingTier === "STANDARD" ? "STANDARD" : "LAUNCH");

const subscriptionExpiryFromEntity = (
  sub: RazorpaySubscription | null,
  fallbackFrom: Date,
  interval: BillingIntervalValue
) => {
  const currentEnd = sub?.current_end ?? null;
  if (typeof currentEnd === "number" && Number.isFinite(currentEnd) && currentEnd > 0) {
    return new Date(currentEnd * 1000);
  }
  return addInterval(fallbackFrom, interval);
};

const getSubscriptionTotalCount = (interval: BillingIntervalValue) =>
  interval === "YEARLY" ? 100 : 120;

const fetchSubscription = async (subscriptionId: string) =>
  razorpayRequest<RazorpaySubscription>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);

const getEffectiveUserPlan = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planInterval: true,
      planExpiresAt: true,
      subscriptionStatus: true,
      razorpaySubscriptionId: true,
      proPricingTier: true
    }
  });

  if (!user) {
    return null;
  }

  if (isUserProActive(user)) {
    return user;
  }

  if (isUserDevActive(user)) {
    return user;
  }

  return {
    ...user,
    plan: "FREE" as const,
    planInterval: null,
    planExpiresAt: null,
    subscriptionStatus: null
  };
};

const getEffectiveOrgPlan = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      plan: true,
      planInterval: true,
      planExpiresAt: true,
      subscriptionStatus: true,
      razorpaySubscriptionId: true
    }
  });

  if (!organization) {
    return null;
  }

  if (isOrgTeamActive(organization)) {
    return organization;
  }

  return {
    ...organization,
    plan: "FREE" as const,
    planInterval: null,
    planExpiresAt: null,
    subscriptionStatus: null
  };
};

const assertOwnerForOrganization = async (organizationId: string, userId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId
      }
    }
  });

  return membership?.role === "OWNER";
};

const resolvePlanSelection = async ({
  plan,
  interval,
  userId
}: {
  plan: CheckoutPlan;
  interval: BillingIntervalValue;
  userId: string;
}) => {
  const keys = getRazorpayKeys();

  if (plan === "TEAM") {
    const planId = interval === "YEARLY" ? keys.teamYearlyPlanId : keys.teamMonthlyPlanId;
    if (!planId) {
      throw Object.assign(new Error(`Missing ${interval === "YEARLY" ? "RAZORPAY_PLAN_TEAM_YEARLY_ID" : "RAZORPAY_PLAN_TEAM_MONTHLY_ID"}`), { status: 501 });
    }

    return {
      planId,
      amount: getTeamPriceForInterval(interval),
      pricingTier: null as PricingTier
    };
  }

  if (plan === "DEV") {
    if (!keys.devMonthlyPlanId) {
      throw Object.assign(new Error("Missing RAZORPAY_PLAN_DEV_MONTHLY_ID"), { status: 501 });
    }

    return {
      planId: keys.devMonthlyPlanId,
      amount: getDevPriceForInterval("MONTHLY"),
      pricingTier: null as PricingTier
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { proPricingTier: true }
  });
  const slots = await getLaunchSlotsRemaining();
  const wantsLaunch =
    user?.proPricingTier === "LAUNCH" || (!user?.proPricingTier && slots.remaining > 0);
  const pricingTier: PricingTier = wantsLaunch ? "LAUNCH" : "STANDARD";
  const planId =
    interval === "YEARLY"
      ? wantsLaunch
        ? keys.proLaunchYearlyPlanId
        : keys.proStandardYearlyPlanId
      : wantsLaunch
        ? keys.proLaunchMonthlyPlanId
        : keys.proStandardMonthlyPlanId;
  const missingKey =
    interval === "YEARLY"
      ? wantsLaunch
        ? "RAZORPAY_PLAN_PRO_YEARLY_ID"
        : "RAZORPAY_PLAN_PRO_YEARLY_STANDARD_ID"
      : wantsLaunch
        ? "RAZORPAY_PLAN_PRO_MONTHLY_ID"
        : "RAZORPAY_PLAN_PRO_MONTHLY_STANDARD_ID";

  if (!planId) {
    throw Object.assign(new Error(`Missing ${missingKey}`), { status: 501 });
  }

  return {
    planId,
    amount: getProPriceForInterval(interval, pricingTier),
    pricingTier
  };
};

type RawBodyRequest = Request & { rawBody?: Buffer };

export const paymentRouter = Router();

paymentRouter.post("/create-order", requireAuth, paymentMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  const email = req.user?.email;
  if (!userId || !email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = (req.body || {}) as {
      plan?: string;
      interval?: string;
      organizationId?: string;
    };
    const plan = body.plan === "TEAM" ? "TEAM" : body.plan === "DEV" ? "DEV" : "PRO";
    const interval = plan === "DEV" ? "MONTHLY" : normalizeInterval(body.interval);
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    if (plan === "TEAM") {
      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required for Team billing" });
      }

      const isOwner = await assertOwnerForOrganization(organizationId, userId);
      if (!isOwner) {
        return res.status(403).json({ error: "Only organization owners can manage Team billing" });
      }

      const orgState = await getEffectiveOrgPlan(organizationId);
      if (orgState?.plan === "TEAM") {
        return res.json({
          alreadyActive: true,
          plan: "team",
          interval: orgState.planInterval?.toLowerCase() || interval.toLowerCase(),
          expiresAt: orgState.planExpiresAt?.toISOString() || null,
          organizationId
        });
      }
    } else {
      const userState = await getEffectiveUserPlan(userId);
      if (userState?.plan === plan) {
        return res.json({
          alreadyActive: true,
          plan: plan.toLowerCase(),
          interval: userState.planInterval?.toLowerCase() || interval.toLowerCase(),
          expiresAt: userState.planExpiresAt?.toISOString() || null
        });
      }
      if (userState && userState.plan !== "FREE") {
        return res.status(400).json({
          error: "Cancel your current personal subscription before switching plans."
        });
      }
    }
    const { planId, amount, pricingTier } = await resolvePlanSelection({
      plan,
      interval,
      userId
    });
    const currency = "INR";
    const receipt =
      `${plan.toLowerCase()}_${interval.toLowerCase()}_${Date.now().toString(36)}_${userId.slice(-6)}`.slice(
        0,
        40
      );

    const subscription = await razorpayRequest<{
      id: string;
      status: string;
    }>("POST", "/subscriptions", {
      plan_id: planId,
      total_count: getSubscriptionTotalCount(interval),
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId,
        organizationId,
        scope: plan === "TEAM" ? "ORGANIZATION" : "USER",
        plan: plan.toLowerCase(),
        interval: interval.toLowerCase(),
        pricingTier: pricingTier || undefined
      }
    });

    await prisma.payment.create({
      data: {
        userId,
        organizationId,
        provider: PROVIDER,
        plan,
        interval,
        amount,
        currency,
        status: "subscription_created",
        razorpaySubscriptionId: subscription.id,
        payload: { subscription, receipt } as unknown as Prisma.InputJsonValue
      }
    });

    const { keyId } = assertConfigured();

    return res.json({
      keyId,
      subscriptionId: subscription.id,
      amount,
      currency,
      receipt,
      plan: plan.toLowerCase(),
      interval: interval.toLowerCase(),
      organizationId
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/verify", requireAuth, paymentMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing Razorpay payment fields" });
  }
  if (!razorpay_subscription_id && !razorpay_order_id) {
    return res.status(400).json({ error: "Missing order_id or subscription_id" });
  }

  try {
    const { keySecret } = assertConfigured();
    const signaturePayload = razorpay_subscription_id
      ? `${razorpay_payment_id}|${razorpay_subscription_id}`
      : `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", keySecret).update(signaturePayload).digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const subscriptionEntity = razorpay_subscription_id
      ? await fetchSubscription(razorpay_subscription_id)
      : null;
    const pendingPayment = razorpay_subscription_id
      ? await prisma.payment.findFirst({
          where: {
            userId,
            razorpaySubscriptionId: razorpay_subscription_id
          },
          orderBy: { createdAt: "desc" }
        })
      : null;

    if (subscriptionEntity) {
      const notesUserId = (subscriptionEntity.notes as Record<string, unknown> | null)?.userId;
      if (!notesUserId || String(notesUserId) !== userId) {
        return res.status(400).json({ error: "Subscription does not belong to this user" });
      }
      const keys = getRazorpayKeys();
      const allowedPlanIds = [
        keys.devMonthlyPlanId,
        keys.proLaunchMonthlyPlanId,
        keys.proStandardMonthlyPlanId,
        keys.proLaunchYearlyPlanId,
        keys.proStandardYearlyPlanId,
        keys.teamMonthlyPlanId,
        keys.teamYearlyPlanId
      ].filter(Boolean);
      if (allowedPlanIds.length > 0 && subscriptionEntity.plan_id && !allowedPlanIds.includes(subscriptionEntity.plan_id)) {
        return res.status(400).json({ error: "Subscription plan mismatch" });
      }
    }

    let payment = await razorpayRequest<{
      id: string;
      order_id: string | null;
      subscription_id?: string | null;
      amount: number;
      currency: string;
      status: string;
      captured: boolean;
    }>("GET", `/payments/${encodeURIComponent(razorpay_payment_id)}`);

    if (razorpay_subscription_id) {
      if (payment.subscription_id && payment.subscription_id !== razorpay_subscription_id) {
        return res.status(400).json({ error: "Payment does not match the subscription" });
      }
    } else if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: "Payment does not match the order" });
    }

    if (
      payment.currency !== "INR" ||
      (pendingPayment?.amount && pendingPayment.amount !== payment.amount)
    ) {
      return res.status(400).json({ error: "Payment amount or currency mismatch" });
    }

    if ((payment.status === "authorized" || !payment.captured) && payment.status !== "captured") {
      if (payment.status === "authorized") {
        await razorpayRequest(
          "POST",
          `/payments/${encodeURIComponent(payment.id)}/capture`,
          {
            amount: payment.amount,
            currency: payment.currency
          }
        );
        payment = await razorpayRequest<{
          id: string;
          order_id: string | null;
          subscription_id?: string | null;
          amount: number;
          currency: string;
          status: string;
          captured: boolean;
        }>("GET", `/payments/${encodeURIComponent(razorpay_payment_id)}`);
      }

      if (payment.status !== "captured" && !payment.captured) {
        return res.status(400).json({ error: "Payment not captured" });
      }
    }

    const now = new Date();
    const plan =
      pendingPayment?.plan === "TEAM"
        ? "TEAM"
        : pendingPayment?.plan === "DEV" ||
            String(subscriptionEntity?.notes?.plan || "").toUpperCase() === "DEV"
          ? "DEV"
          : "PRO";
    const interval = normalizeInterval(pendingPayment?.interval || String(subscriptionEntity?.notes?.interval || ""));
    const organizationId =
      typeof pendingPayment?.organizationId === "string"
        ? pendingPayment.organizationId
        : typeof subscriptionEntity?.notes?.organizationId === "string" && subscriptionEntity.notes.organizationId
          ? String(subscriptionEntity.notes.organizationId)
          : null;
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, proPricingTier: true }
    });
    const existingOrganization = organizationId
      ? await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { plan: true, planExpiresAt: true }
        })
      : null;
    const baseExpiry =
      plan === "TEAM"
        ? existingOrganization?.plan === "TEAM" &&
          existingOrganization.planExpiresAt &&
          existingOrganization.planExpiresAt.getTime() > now.getTime()
          ? existingOrganization.planExpiresAt
          : now
        : existingUser?.plan === plan &&
            existingUser.planExpiresAt &&
            existingUser.planExpiresAt.getTime() > now.getTime()
          ? existingUser.planExpiresAt
          : now;
    const expiresAt = subscriptionEntity
      ? subscriptionExpiryFromEntity(subscriptionEntity, baseExpiry, interval)
      : addInterval(baseExpiry, interval);

    await prisma.$transaction(async (tx) => {
      const pending = razorpay_subscription_id
        ? await tx.payment.findFirst({
            where: {
              userId,
              razorpaySubscriptionId: razorpay_subscription_id,
              razorpayPaymentId: null
            },
            orderBy: { createdAt: "desc" }
          })
        : null;

      if (pending) {
        await tx.payment.update({
          where: { id: pending.id },
          data: {
            status: "captured",
            razorpayPaymentId: razorpay_payment_id,
            capturedAt: now,
            expiresAt,
            payload: payment as unknown as Prisma.InputJsonValue
          }
        });
      } else {
        await tx.payment.create({
          data: {
            userId,
            organizationId,
            provider: PROVIDER,
            plan,
            interval,
            amount: payment.amount,
            currency: payment.currency,
            status: "captured",
            razorpayOrderId: razorpay_order_id,
            razorpaySubscriptionId: razorpay_subscription_id,
            razorpayPaymentId: razorpay_payment_id,
            capturedAt: now,
            expiresAt,
            payload: payment as unknown as Prisma.InputJsonValue
          }
        });
      }

      if (plan === "TEAM" && organizationId) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            plan: "TEAM",
            planInterval: interval,
            subscriptionStatus: "active",
            planExpiresAt: expiresAt,
            lastPaymentProvider: PROVIDER,
            lastPaymentId: razorpay_payment_id,
            razorpaySubscriptionId: razorpay_subscription_id ?? undefined
          }
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: {
            plan,
            planInterval: interval,
            subscriptionStatus: "active",
            planExpiresAt: expiresAt,
            lastPaymentProvider: PROVIDER,
            lastPaymentId: razorpay_payment_id,
            razorpaySubscriptionId: razorpay_subscription_id ?? undefined,
            proPricingTier:
              plan === "PRO"
                ? existingUser?.proPricingTier ??
                  (pendingPayment?.payload &&
                  typeof (pendingPayment.payload as Record<string, unknown>)?.pricingTier === "string"
                    ? ((pendingPayment.payload as Record<string, unknown>).pricingTier as "LAUNCH" | "STANDARD")
                    : subscriptionEntity?.notes?.pricingTier === "STANDARD"
                      ? "STANDARD"
                      : subscriptionEntity?.notes?.pricingTier === "LAUNCH"
                        ? "LAUNCH"
                        : undefined)
                : null
          }
        });
      }
    });

    return res.json({
      ok: true,
      plan: plan.toLowerCase(),
      interval: interval.toLowerCase(),
      expiresAt: expiresAt.toISOString(),
      organizationId
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.get("/history", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const organizationId =
    typeof req.query.organizationId === "string" && req.query.organizationId.trim()
      ? req.query.organizationId.trim()
      : null;

  if (organizationId) {
    const isOwner = await assertOwnerForOrganization(organizationId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: "Only organization owners can view Team billing history" });
    }
  }

  const payments = await prisma.payment.findMany({
    where: organizationId ? { organizationId } : { userId, organizationId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
      razorpaySubscriptionId: true,
      capturedAt: true,
      expiresAt: true,
      createdAt: true,
      payload: true
    }
  });

  return res.json({ payments });
});

paymentRouter.get("/invoices", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const organizationId =
    typeof req.query.organizationId === "string" && req.query.organizationId.trim()
      ? req.query.organizationId.trim()
      : null;

  if (organizationId) {
    const isOwner = await assertOwnerForOrganization(organizationId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: "Only organization owners can view Team invoices" });
    }
  }

  const subscriptionHolder = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { razorpaySubscriptionId: true }
      })
    : await prisma.user.findUnique({
        where: { id: userId },
        select: { razorpaySubscriptionId: true }
      });

  const paymentRecords = await prisma.payment.findMany({
    where: organizationId
      ? { organizationId }
      : {
          userId,
          organizationId: null
        },
    select: { razorpaySubscriptionId: true },
    orderBy: { createdAt: "desc" }
  });

  const subscriptionIds = Array.from(
    new Set(
      [
        subscriptionHolder?.razorpaySubscriptionId || null,
        ...paymentRecords.map((payment) => payment.razorpaySubscriptionId || null)
      ].filter((value): value is string => Boolean(value))
    )
  );

  if (!subscriptionIds.length) {
    return res.json({ invoices: [] });
  }

  try {
    const invoiceResponses = await Promise.allSettled(
      subscriptionIds.map((subscriptionId) =>
        razorpayRequest<{
          items: Array<{
            id: string;
            status: string;
            amount: number;
            currency: string;
            short_url?: string | null;
            invoice_number?: string | null;
            created_at?: number;
            paid_at?: number | null;
          }>;
        }>("GET", `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=20`)
      )
    );

    const invoices = invoiceResponses.flatMap((response) =>
      response.status === "fulfilled" ? response.value.items : []
    );
    const uniqueInvoices = Array.from(
      new Map(invoices.map((invoice) => [invoice.id, invoice])).values()
    ).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (!uniqueInvoices.length) {
      const rejectedCount = invoiceResponses.filter(
        (response) => response.status === "rejected"
      ).length;
      if (rejectedCount > 0) {
        console.warn(
          `[billing] returning empty invoices list after ${rejectedCount} Razorpay invoice lookup failure(s) for ${organizationId ? `organization ${organizationId}` : `user ${userId}`}`
        );
      }
    }

    return res.json({
      invoices: uniqueInvoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        shortUrl: invoice.short_url || null,
        invoiceNumber: invoice.invoice_number || null,
        createdAt: invoice.created_at ? new Date(invoice.created_at * 1000).toISOString() : null,
        paidAt: invoice.paid_at ? new Date(invoice.paid_at * 1000).toISOString() : null
      }))
    });
  } catch (err) {
    console.warn(
      `[billing] unexpected invoice lookup failure for ${organizationId ? `organization ${organizationId}` : `user ${userId}`}:`,
      err
    );
    return res.json({ invoices: [] });
  }
});

paymentRouter.post("/cancel", requireAuth, paymentMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { atCycleEnd, organizationId } = (req.body || {}) as {
    atCycleEnd?: boolean;
    organizationId?: string;
  };
  const cancelAtCycleEnd = atCycleEnd !== undefined ? Boolean(atCycleEnd) : false;
  const normalizedOrganizationId = organizationId?.trim() || null;

  if (normalizedOrganizationId) {
    const isOwner = await assertOwnerForOrganization(normalizedOrganizationId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: "Only organization owners can cancel Team billing" });
    }
  }

  const subscriptionHolder = normalizedOrganizationId
    ? await prisma.organization.findUnique({
        where: { id: normalizedOrganizationId },
        select: { razorpaySubscriptionId: true, plan: true }
      })
    : await prisma.user.findUnique({
        where: { id: userId },
        select: { razorpaySubscriptionId: true, plan: true }
      });

  if (!subscriptionHolder?.razorpaySubscriptionId) {
    return res.status(400).json({ error: "No active subscription found" });
  }

  try {
    const cancelled = await razorpayRequest<{ id: string; status: string }>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionHolder.razorpaySubscriptionId)}/cancel`,
      { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }
    );

    const subscriptionEntity = await fetchSubscription(subscriptionHolder.razorpaySubscriptionId).catch(() => null);
    const expiresAt =
      cancelAtCycleEnd && subscriptionEntity
        ? subscriptionExpiryFromEntity(
            subscriptionEntity,
            new Date(),
            normalizeInterval(String(subscriptionEntity.notes?.interval || "MONTHLY"))
          )
        : null;

    if (normalizedOrganizationId) {
      await prisma.organization.update({
        where: { id: normalizedOrganizationId },
        data: {
          plan: cancelAtCycleEnd ? "TEAM" : "FREE",
          planInterval: cancelAtCycleEnd ? undefined : null,
          subscriptionStatus: cancelAtCycleEnd ? "cancel_at_cycle_end" : cancelled.status || "cancelled",
          planExpiresAt: expiresAt || null
        }
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan:
            cancelAtCycleEnd && subscriptionHolder?.plan === "DEV"
              ? "DEV"
              : cancelAtCycleEnd
                ? "PRO"
                : "FREE",
          planInterval: cancelAtCycleEnd ? undefined : null,
          subscriptionStatus: cancelAtCycleEnd ? "cancel_at_cycle_end" : cancelled.status || "cancelled",
          planExpiresAt: expiresAt || null,
          proPricingTier:
            cancelAtCycleEnd && subscriptionHolder?.plan === "PRO" ? undefined : null
        }
      });
    }

    return res.json({
      ok: true,
      subscriptionId: cancelled.id,
      status: cancelled.status,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      organizationId: normalizedOrganizationId
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/downgrade", requireAuth, paymentMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { razorpaySubscriptionId: true }
  });

  if (!user?.razorpaySubscriptionId) {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: "FREE", subscriptionStatus: null, planExpiresAt: null }
    });
    return res.json({ ok: true, plan: "free" });
  }

  try {
    const paused = await razorpayRequest<{ id: string; status: string }>(
      "POST",
      `/subscriptions/${encodeURIComponent(user.razorpaySubscriptionId)}/pause`,
      { pause_at: "now" }
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "FREE",
        subscriptionStatus: paused.status || "paused",
        planExpiresAt: null
      }
    });

    return res.json({ ok: true, plan: "free", subscriptionId: paused.id, status: paused.status });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/upgrade", requireAuth, paymentMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planInterval: true,
      planExpiresAt: true,
      razorpaySubscriptionId: true,
      proPricingTier: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = new Date();
  const proActive =
    user.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt.getTime() > now.getTime());
  if (proActive) {
    return res.json({ ok: true, alreadyPro: true, plan: "pro" });
  }

  if (!user.razorpaySubscriptionId) {
    return res.json({ ok: false, requiresPayment: true });
  }

  try {
    const subscription = await fetchSubscription(user.razorpaySubscriptionId);
    const status = subscription.status?.toLowerCase() || "";

    if (status !== "active" && status !== "paused") {
      return res.json({ ok: false, requiresPayment: true, status });
    }

    const resumed =
      status === "paused"
        ? await razorpayRequest<RazorpaySubscription>(
            "POST",
            `/subscriptions/${encodeURIComponent(user.razorpaySubscriptionId)}/resume`,
            { resume_at: "now" }
          )
        : subscription;

    const resumedStatus = resumed.status || "active";
    const interval = normalizeInterval(String(resumed.notes?.interval || user.planInterval || "MONTHLY"));
    const expiresAt = subscriptionExpiryFromEntity(resumed, now, interval);

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "PRO",
        planInterval: interval,
        subscriptionStatus: resumedStatus,
        planExpiresAt: expiresAt,
        lastPaymentProvider: PROVIDER,
        razorpaySubscriptionId: user.razorpaySubscriptionId,
        proPricingTier:
          user.proPricingTier ??
          (subscription.notes?.pricingTier === "STANDARD"
            ? "STANDARD"
            : "LAUNCH")
      }
    });

    return res.json({ ok: true, plan: "pro", expiresAt: expiresAt.toISOString(), status: resumedStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    // If we can't resume/fetch the subscription, fall back to a fresh checkout.
    if (message.toLowerCase().includes("not found")) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          razorpaySubscriptionId: null,
          subscriptionStatus: null,
          plan: "FREE",
          planInterval: null,
          planExpiresAt: null
        }
      });
      return res.json({ ok: false, requiresPayment: true });
    }

    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: message });
  }
});

paymentRouter.post("/webhook", webhookRateLimit, async (req, res) => {
  const { webhookSecret } = getRazorpayKeys();
  if (!webhookSecret) {
    return res.status(501).json({ error: "Webhook is not configured" });
  }

  const signature = req.header("x-razorpay-signature") || "";
  const rawBody = (req as RawBodyRequest).rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: "Missing raw body for webhook verification" });
  }

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  if (expected !== signature) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const event = req.body as {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string | null;
          subscription_id?: string | null;
          status?: string;
          amount?: number;
          currency?: string;
        };
      };
    };
  };

  const eventType = event.event || "";
  const entity = event.payload?.payment?.entity;
  const paymentId = entity?.id || null;
  const orderId = entity?.order_id || null;
  const subscriptionId = entity?.subscription_id || null;
  const status = entity?.status || null;

  try {
    if (paymentId) {
      const exists = await prisma.payment.findUnique({
        where: { razorpayPaymentId: paymentId },
        select: { id: true }
      });
      if (exists) {
        return res.json({ received: true });
      }
    }

    const record = orderId
      ? await prisma.payment.findFirst({
          where: { razorpayOrderId: orderId },
          select: { id: true, userId: true, organizationId: true, plan: true, interval: true }
        })
      : subscriptionId
      ? await prisma.payment.findFirst({
          where: { razorpaySubscriptionId: subscriptionId },
          select: { id: true, userId: true, organizationId: true, plan: true, interval: true }
        })
      : null;

    const ownerId =
      record?.userId ||
      (subscriptionId
        ? (
            await prisma.user.findFirst({
              where: { razorpaySubscriptionId: subscriptionId },
              select: { id: true }
            })
          )?.id
        : null);

    if (!ownerId) {
      return res.json({ received: true });
    }

    if (eventType === "payment.captured") {
      const now = new Date();
      const subscriptionEntity = subscriptionId ? await fetchSubscription(subscriptionId).catch(() => null) : null;
      const plan =
        record?.plan === "TEAM"
          ? "TEAM"
          : record?.plan === "DEV" ||
              String(subscriptionEntity?.notes?.plan || "").toUpperCase() === "DEV"
            ? "DEV"
            : "PRO";
      const interval = normalizeInterval(
        String(record?.interval || subscriptionEntity?.notes?.interval || "MONTHLY")
      );
      const pricingTier =
        subscriptionEntity?.notes?.pricingTier === "STANDARD"
          ? "STANDARD"
          : subscriptionEntity?.notes?.pricingTier === "LAUNCH"
            ? "LAUNCH"
            : null;
      const organizationId =
        record?.organizationId ||
        (typeof subscriptionEntity?.notes?.organizationId === "string"
          ? String(subscriptionEntity.notes.organizationId)
          : null);
      const existingUser = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { plan: true, planExpiresAt: true, proPricingTier: true }
      });
      const existingOrganization = organizationId
        ? await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { plan: true, planExpiresAt: true }
          })
        : null;
      const baseExpiry =
        plan === "TEAM"
          ? existingOrganization?.plan === "TEAM" &&
            existingOrganization.planExpiresAt &&
            existingOrganization.planExpiresAt.getTime() > now.getTime()
            ? existingOrganization.planExpiresAt
            : now
          : existingUser?.plan === plan &&
              existingUser.planExpiresAt &&
              existingUser.planExpiresAt.getTime() > now.getTime()
            ? existingUser.planExpiresAt
          : now;
      const expiresAt = subscriptionEntity
        ? subscriptionExpiryFromEntity(subscriptionEntity, baseExpiry, interval)
        : addInterval(baseExpiry, interval);

      await prisma.$transaction(async (tx) => {
        const pending = subscriptionId
          ? await tx.payment.findFirst({
              where: {
                userId: ownerId,
                razorpaySubscriptionId: subscriptionId,
                razorpayPaymentId: null
              },
              orderBy: { createdAt: "desc" }
            })
          : record;

        if (pending) {
          await tx.payment.update({
            where: { id: pending.id },
            data: {
              status: "captured",
              razorpayPaymentId: paymentId,
              capturedAt: now,
              expiresAt,
              payload: event as unknown as Prisma.InputJsonValue
            }
          });
        } else {
          await tx.payment.create({
            data: {
              userId: ownerId,
              organizationId,
              provider: PROVIDER,
              plan,
              interval,
              amount: entity?.amount ?? getPlanAmount({ plan, interval, pricingTier }),
              currency: entity?.currency ?? "INR",
              status: "captured",
              razorpayOrderId: orderId,
              razorpaySubscriptionId: subscriptionId,
              razorpayPaymentId: paymentId,
              capturedAt: now,
              expiresAt,
              payload: event as unknown as Prisma.InputJsonValue
            }
          });
        }

        if (plan === "TEAM" && organizationId) {
          await tx.organization.update({
            where: { id: organizationId },
            data: {
              plan: "TEAM",
              planInterval: interval,
              subscriptionStatus: "active",
              planExpiresAt: expiresAt,
              lastPaymentProvider: PROVIDER,
              lastPaymentId: paymentId || undefined,
              razorpaySubscriptionId: subscriptionId || undefined
            }
          });
        } else {
          await tx.user.update({
            where: { id: ownerId },
            data: {
              plan,
              planInterval: interval,
              subscriptionStatus: "active",
              planExpiresAt: expiresAt,
              lastPaymentProvider: PROVIDER,
              lastPaymentId: paymentId || undefined,
              razorpaySubscriptionId: subscriptionId || undefined,
              proPricingTier:
                plan === "PRO"
                  ? existingUser?.proPricingTier ??
                    (pricingTier === "STANDARD" ? "STANDARD" : "LAUNCH")
                  : null
            }
          });
        }
      });
    } else if (eventType === "payment.failed") {
      const subscriptionEntity = subscriptionId ? await fetchSubscription(subscriptionId).catch(() => null) : null;
      const plan =
        record?.plan === "TEAM"
          ? "TEAM"
          : record?.plan === "DEV" ||
              String(subscriptionEntity?.notes?.plan || "").toUpperCase() === "DEV"
            ? "DEV"
            : "PRO";
      const interval = normalizeInterval(
        String(record?.interval || subscriptionEntity?.notes?.interval || "MONTHLY")
      );
      const pricingTier =
        subscriptionEntity?.notes?.pricingTier === "STANDARD"
          ? "STANDARD"
          : subscriptionEntity?.notes?.pricingTier === "LAUNCH"
            ? "LAUNCH"
            : null;
      const organizationId =
        record?.organizationId ||
        (typeof subscriptionEntity?.notes?.organizationId === "string"
          ? String(subscriptionEntity.notes.organizationId)
          : null);
      if (record) {
        await prisma.payment.update({
          where: { id: record.id },
          data: {
            status: status || "failed",
            razorpayPaymentId: paymentId,
            payload: event as unknown as Prisma.InputJsonValue
          }
        });
      } else {
        await prisma.payment.create({
          data: {
            userId: ownerId,
            organizationId,
            provider: PROVIDER,
            plan,
            interval,
            amount: entity?.amount ?? getPlanAmount({ plan, interval, pricingTier }),
            currency: entity?.currency ?? "INR",
            status: status || "failed",
            razorpayOrderId: orderId,
            razorpaySubscriptionId: subscriptionId,
            razorpayPaymentId: paymentId,
            payload: event as unknown as Prisma.InputJsonValue
          }
        });
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook error", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});
