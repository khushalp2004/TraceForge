import { Request, Router } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const PROVIDER = "razorpay";

const getRazorpayKeys = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  const proLaunchPlanId = process.env.RAZORPAY_PLAN_PRO_MONTHLY_ID?.trim() || "";
  const proStandardPlanId = process.env.RAZORPAY_PLAN_PRO_MONTHLY_STANDARD_ID?.trim() || "";
  const launchSlots = Number(process.env.PRO_LAUNCH_SLOTS || "20");
  return { keyId, keySecret, webhookSecret, proLaunchPlanId, proStandardPlanId, launchSlots };
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

  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!res.ok) {
    const message = data?.error?.description || `Razorpay request failed (${res.status})`;
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

const subscriptionExpiryFromEntity = (sub: RazorpaySubscription | null, fallbackFrom: Date) => {
  const currentEnd = sub?.current_end ?? null;
  if (typeof currentEnd === "number" && Number.isFinite(currentEnd) && currentEnd > 0) {
    return new Date(currentEnd * 1000);
  }
  return addOneMonth(fallbackFrom);
};

const fetchSubscription = async (subscriptionId: string) =>
  razorpayRequest<RazorpaySubscription>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);

const getEffectivePlan = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planExpiresAt: true
    }
  });

  if (!user) return { plan: "FREE" as const, expiresAt: null as Date | null };

  if (user.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now())) {
    return { plan: "PRO" as const, expiresAt: user.planExpiresAt || null };
  }

  return { plan: "FREE" as const, expiresAt: null };
};

const getLaunchSlotsRemaining = async () => {
  const { launchSlots } = getRazorpayKeys();
  const total = Number.isFinite(launchSlots) && launchSlots > 0 ? Math.floor(launchSlots) : 20;
  const used = await prisma.user.count({ where: { proPricingTier: "LAUNCH" } });
  return {
    total,
    used,
    remaining: Math.max(0, total - used)
  };
};

type RawBodyRequest = Request & { rawBody?: Buffer };

export const paymentRouter = Router();

paymentRouter.post("/create-order", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const email = req.user?.email;
  if (!userId || !email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const planState = await getEffectivePlan(userId);
    if (planState.plan === "PRO") {
      return res.json({
        alreadyPro: true,
        plan: "pro",
        expiresAt: planState.expiresAt?.toISOString() || null
      });
    }

    const { proLaunchPlanId, proStandardPlanId } = getRazorpayKeys();
    if (!proLaunchPlanId) {
      return res.status(501).json({ error: "Missing RAZORPAY_PLAN_PRO_MONTHLY_ID" });
    }
    if (!proStandardPlanId) {
      return res.status(501).json({ error: "Missing RAZORPAY_PLAN_PRO_MONTHLY_STANDARD_ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { proPricingTier: true }
    });

    const slots = await getLaunchSlotsRemaining();
    const wantsLaunch =
      user?.proPricingTier === "LAUNCH" || (!user?.proPricingTier && slots.remaining > 0);
    const planId = wantsLaunch ? proLaunchPlanId : proStandardPlanId;

    const amount = wantsLaunch ? 29900 : 49900;
    const currency = "INR";
    const receipt = `tfpro_${Date.now().toString(36)}_${userId.slice(-6)}`.slice(0, 40);

    const subscription = await razorpayRequest<{
      id: string;
      status: string;
    }>("POST", "/subscriptions", {
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId,
        plan: "pro",
        pricingTier: wantsLaunch ? "LAUNCH" : "STANDARD"
      }
    });

    await prisma.payment.create({
      data: {
        userId,
        provider: PROVIDER,
        plan: "PRO",
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
      receipt
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/verify", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { keySecret } = assertConfigured();
  const { proLaunchPlanId, proStandardPlanId } = getRazorpayKeys();
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
    if (subscriptionEntity) {
      const notesUserId = (subscriptionEntity.notes as Record<string, unknown> | null)?.userId;
      if (!notesUserId || String(notesUserId) !== userId) {
        return res.status(400).json({ error: "Subscription does not belong to this user" });
      }
      const allowedPlanIds = [proLaunchPlanId, proStandardPlanId].filter(Boolean);
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

    if (payment.currency !== "INR" || (payment.amount !== 29900 && payment.amount !== 49900)) {
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
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, proPricingTier: true }
    });
    const baseExpiry =
      existingUser?.plan === "PRO" && existingUser.planExpiresAt && existingUser.planExpiresAt.getTime() > now.getTime()
        ? existingUser.planExpiresAt
        : now;
    const expiresAt = subscriptionEntity
      ? subscriptionExpiryFromEntity(subscriptionEntity, baseExpiry)
      : addOneMonth(baseExpiry);

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
            provider: PROVIDER,
            plan: "PRO",
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

      await tx.user.update({
        where: { id: userId },
        data: {
          plan: "PRO",
          subscriptionStatus: "active",
          planExpiresAt: expiresAt,
          lastPaymentProvider: PROVIDER,
          lastPaymentId: razorpay_payment_id,
          razorpaySubscriptionId: razorpay_subscription_id ?? undefined,
          proPricingTier:
            existingUser?.proPricingTier ??
            (subscriptionEntity?.plan_id && subscriptionEntity.plan_id === proStandardPlanId
              ? "STANDARD"
              : subscriptionEntity
              ? "LAUNCH"
              : undefined)
        }
      });
    });

    return res.json({ ok: true, plan: "pro", expiresAt: expiresAt.toISOString() });
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

  const payments = await prisma.payment.findMany({
    where: { userId },
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { razorpaySubscriptionId: true }
  });

  if (!user?.razorpaySubscriptionId) {
    return res.json({ invoices: [] });
  }

  try {
    const invoices = await razorpayRequest<{
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
    }>(
      "GET",
      `/invoices?subscription_id=${encodeURIComponent(user.razorpaySubscriptionId)}&count=20`
    );

    return res.json({
      invoices: invoices.items.map((invoice) => ({
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
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/cancel", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { atCycleEnd } = (req.body || {}) as { atCycleEnd?: boolean };
  const cancelAtCycleEnd = atCycleEnd !== undefined ? Boolean(atCycleEnd) : false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { razorpaySubscriptionId: true }
  });

  if (!user?.razorpaySubscriptionId) {
    return res.status(400).json({ error: "No active subscription found" });
  }

  try {
    const cancelled = await razorpayRequest<{ id: string; status: string }>(
      "POST",
      `/subscriptions/${encodeURIComponent(user.razorpaySubscriptionId)}/cancel`,
      { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }
    );

    const subscriptionEntity = await fetchSubscription(user.razorpaySubscriptionId).catch(() => null);
    const expiresAt =
      cancelAtCycleEnd && subscriptionEntity
        ? subscriptionExpiryFromEntity(subscriptionEntity, new Date())
        : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: cancelAtCycleEnd ? "PRO" : "FREE",
        subscriptionStatus: cancelAtCycleEnd ? "cancel_at_cycle_end" : cancelled.status || "cancelled",
        planExpiresAt: expiresAt || null
      }
    });

    return res.json({
      ok: true,
      subscriptionId: cancelled.id,
      status: cancelled.status,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Unexpected error" });
  }
});

paymentRouter.post("/downgrade", requireAuth, async (req, res) => {
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

paymentRouter.post("/upgrade", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
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
    const { proStandardPlanId } = getRazorpayKeys();
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
    const expiresAt = subscriptionExpiryFromEntity(resumed, now);

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "PRO",
        subscriptionStatus: resumedStatus,
        planExpiresAt: expiresAt,
        lastPaymentProvider: PROVIDER,
        razorpaySubscriptionId: user.razorpaySubscriptionId,
        proPricingTier:
          user.proPricingTier ??
          (subscription.plan_id && proStandardPlanId && subscription.plan_id === proStandardPlanId
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
        data: { razorpaySubscriptionId: null, subscriptionStatus: null, plan: "FREE", planExpiresAt: null }
      });
      return res.json({ ok: false, requiresPayment: true });
    }

    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: message });
  }
});

paymentRouter.post("/webhook", async (req, res) => {
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
          select: { id: true, userId: true }
        })
      : subscriptionId
      ? await prisma.payment.findFirst({
          where: { razorpaySubscriptionId: subscriptionId },
          select: { id: true, userId: true }
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
      const { proStandardPlanId } = getRazorpayKeys();
      const existingUser = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { plan: true, planExpiresAt: true, proPricingTier: true }
      });
      const baseExpiry =
        existingUser?.plan === "PRO" &&
        existingUser.planExpiresAt &&
        existingUser.planExpiresAt.getTime() > now.getTime()
          ? existingUser.planExpiresAt
          : now;
      const expiresAt = subscriptionEntity
        ? subscriptionExpiryFromEntity(subscriptionEntity, baseExpiry)
        : addOneMonth(baseExpiry);

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
              provider: PROVIDER,
              plan: "PRO",
              amount: entity?.amount ?? 29900,
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

        await tx.user.update({
          where: { id: ownerId },
          data: {
            plan: "PRO",
            subscriptionStatus: "active",
            planExpiresAt: expiresAt,
            lastPaymentProvider: PROVIDER,
            lastPaymentId: paymentId || undefined,
            razorpaySubscriptionId: subscriptionId || undefined,
            proPricingTier:
              existingUser?.proPricingTier ??
              (subscriptionEntity?.plan_id && proStandardPlanId && subscriptionEntity.plan_id === proStandardPlanId
                ? "STANDARD"
                : subscriptionEntity
                ? "LAUNCH"
                : undefined)
          }
        });
      });
    } else if (eventType === "payment.failed") {
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
            provider: PROVIDER,
            plan: "PRO",
            amount: entity?.amount ?? 29900,
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
