import prisma from "../db/prisma.js";
import { razorpayRequest } from "../utils/razorpay.js";
import { sendWithResend } from "../utils/mailer.js";

export const processBillingReconciliation = async () => {
  console.info("[BillingReconciliation] Starting reconciliation job...");
  const now = Math.floor(Date.now() / 1000);
  const from = now - (72 * 60 * 60);

  try {
    const res = await razorpayRequest<{ items: any[] }>(
      "GET",
      `/subscriptions?from=${from}&to=${now}&count=100`
    );

    const subscriptions = res.items || [];
    console.info(`[BillingReconciliation] Found ${subscriptions.length} subscriptions in the last 72h`);

    for (const sub of subscriptions) {
      if (sub.status !== "active" && sub.status !== "authenticated") {
        continue;
      }

      const notes = sub.notes || {};
      const userId = notes.userId;
      const organizationId = notes.organizationId;
      const intendedPlan = String(notes.plan || "").toUpperCase();
      const intendedInterval = String(notes.interval || "").toUpperCase();

      if (!userId || !intendedPlan) continue;

      if (intendedPlan === "TEAM" && organizationId) {
        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (org && org.plan !== "TEAM") {
          console.info(`[BillingReconciliation] Recovering TEAM subscription for org ${organizationId}`);
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: "TEAM",
              planInterval: intendedInterval as any,
              subscriptionStatus: "active",
              lastPaymentProvider: "razorpay",
              razorpaySubscriptionId: sub.id
            }
          });
          
          await logPaymentRecovery(userId, organizationId, intendedPlan, intendedInterval, sub);
          await notifyUser(userId);
        }
      } else {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.plan === "FREE") {
          console.info(`[BillingReconciliation] Recovering ${intendedPlan} subscription for user ${userId}`);
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: intendedPlan as any,
              planInterval: intendedInterval as any,
              subscriptionStatus: "active",
              lastPaymentProvider: "razorpay",
              razorpaySubscriptionId: sub.id
            }
          });

          await logPaymentRecovery(userId, null, intendedPlan, intendedInterval, sub);
          await notifyUser(userId);
        }
      }
    }
    
    console.info("[BillingReconciliation] Reconciliation job finished.");
  } catch (error) {
    console.error("[BillingReconciliation] Failed to run job", error);
  }
};

const logPaymentRecovery = async (userId: string, orgId: string | null, plan: string, interval: string, sub: any) => {
  await prisma.payment.create({
    data: {
      userId,
      organizationId: orgId,
      provider: "razorpay",
      plan: plan as any,
      interval: interval as any,
      amount: 0,
      currency: "INR",
      status: "recovered_via_cron",
      razorpaySubscriptionId: sub.id,
      payload: sub as any
    }
  });
};

const notifyUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.email) return;

  await sendWithResend({
    to: user.email,
    subject: "Your TraceForge Upgrade (Apologies for the delay!)",
    text: "Hi there, we noticed a slight delay in syncing your recent payment due to heavy load. We have successfully upgraded your account! We are incredibly sorry for the inconvenience and appreciate your patience.",
    html: "<p>Hi there,</p><p>We noticed a slight delay in syncing your recent payment due to heavy load. We have successfully upgraded your account!</p><p>We are incredibly sorry for the inconvenience and appreciate your patience.</p><p>- TraceForge Team</p>"
  }).catch((err) => console.error("Failed to send apology email", err));
};
