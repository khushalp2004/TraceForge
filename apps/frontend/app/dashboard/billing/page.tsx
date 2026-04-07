"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
      on: (evt: string, cb: (data: any) => void) => void;
    };
  }
}

type Plan = "FREE" | "DEV" | "PRO" | "TEAM";
type BillingInterval = "MONTHLY" | "YEARLY";
type Toast = { message: string; tone: "success" | "error" };

type User = {
  id: string;
  fullName: string | null;
  email: string;
  plan: "FREE" | "DEV" | "PRO";
  isSuperAdmin?: boolean;
  planInterval?: BillingInterval | null;
  proPricingTier?: "LAUNCH" | "STANDARD" | null;
  planExpiresAt: string | null;
  subscriptionStatus: string | null;
};

type Organization = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  plan: Plan;
  planInterval?: BillingInterval | null;
  planExpiresAt: string | null;
  subscriptionStatus: string | null;
  memberCount: number;
  createdAt: string;
};

type Invoice = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  shortUrl: string | null;
  invoiceNumber: string | null;
  createdAt: string | null;
  paidAt: string | null;
};

type PaymentRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  razorpaySubscriptionId: string | null;
  capturedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type PricingData = {
  free?: { aiLimitMonthly?: number; orgMemberLimit?: number };
  dev?: { monthlyPriceInr?: number; aiLimitMonthly?: number };
  pro?: {
    launch?: {
      monthlyPriceInr?: number;
      yearlyPriceInr?: number;
      slotsTotal?: number;
      slotsRemaining?: number;
    };
    standard?: {
      monthlyPriceInr?: number;
      yearlyPriceInr?: number;
    };
  };
  team?: {
    monthlyPriceInr?: number;
    yearlyPriceInr?: number;
    aiLimitMonthly?: number;
  };
};

type CancelSubscriptionTarget =
  | {
      plan: "DEV";
      organizationId?: undefined;
      label: string;
    }
  | {
      plan: "PRO";
      organizationId?: undefined;
      label: string;
    }
  | {
      plan: "TEAM";
      organizationId: string;
      label: string;
    };

const BILLING_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 / page" },
  { value: 10, label: "10 / page" },
  { value: 15, label: "15 / page" }
];

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const formatPrice = (value?: number | null) => (typeof value === "number" ? `₹${value}` : "—");

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [personalInterval, setPersonalInterval] = useState<BillingInterval>("MONTHLY");
  const [teamInterval, setTeamInterval] = useState<BillingInterval>("MONTHLY");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [historyScope, setHistoryScope] = useState<"USER" | "ORGANIZATION">("USER");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(5);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(5);
  const [cancelTarget, setCancelTarget] = useState<CancelSubscriptionTarget | null>(null);
  const [cancelConfirmationInput, setCancelConfirmationInput] = useState("");

  const ownerOrgs = useMemo(() => orgs.filter((org) => org.role === "OWNER"), [orgs]);
  const selectedOrg = useMemo(
    () => ownerOrgs.find((org) => org.id === selectedOrgId) || null,
    [ownerOrgs, selectedOrgId]
  );

  const isUserProActive = useMemo(() => {
    if (!user || user.plan !== "PRO") return false;
    if (!user.planExpiresAt) return true;
    return new Date(user.planExpiresAt).getTime() > Date.now();
  }, [user]);

  const isUserDevActive = useMemo(() => {
    if (!user || user.plan !== "DEV") return false;
    if (!user.planExpiresAt) return true;
    return new Date(user.planExpiresAt).getTime() > Date.now();
  }, [user]);
  const canManageDevPlan = Boolean(user?.isSuperAdmin);

  const isTeamActive = useMemo(() => {
    if (!selectedOrg || selectedOrg.plan !== "TEAM") return false;
    if (!selectedOrg.planExpiresAt) return true;
    return new Date(selectedOrg.planExpiresAt).getTime() > Date.now();
  }, [selectedOrg]);

  const userKeepsLaunchPricing = user?.proPricingTier === "LAUNCH";
  const proLaunchAvailable = (pricing?.pro?.launch?.slotsRemaining ?? 0) > 0;
  const proUsesLaunchPricing = userKeepsLaunchPricing || proLaunchAvailable;
  const proMonthlyPrice = proUsesLaunchPricing
    ? pricing?.pro?.launch?.monthlyPriceInr
    : pricing?.pro?.standard?.monthlyPriceInr;
  const proYearlyPrice = proUsesLaunchPricing
    ? pricing?.pro?.launch?.yearlyPriceInr
    : pricing?.pro?.standard?.yearlyPriceInr;
  const proYearlySavings =
    typeof proMonthlyPrice === "number" && typeof proYearlyPrice === "number"
      ? proMonthlyPrice * 12 - proYearlyPrice
      : null;
  const teamYearlySavings =
    typeof pricing?.team?.monthlyPriceInr === "number" && typeof pricing?.team?.yearlyPriceInr === "number"
      ? pricing.team.monthlyPriceInr * 12 - pricing.team.yearlyPriceInr
      : null;
  const devMonthlyPrice = pricing?.dev?.monthlyPriceInr ?? 1;
  const devAiLimit = pricing?.dev?.aiLimitMonthly ?? 100;

  const activeHistoryOrgId = historyScope === "ORGANIZATION" ? selectedOrg?.id || null : null;
  const visibleInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status.toLowerCase() !== "cancelled"),
    [invoices]
  );
  const hiddenCancelledInvoiceCount = invoices.length - visibleInvoices.length;
  const invoicesTotalPages = Math.max(1, Math.ceil(visibleInvoices.length / invoicesPageSize));
  const paymentsTotalPages = Math.max(1, Math.ceil(payments.length / paymentsPageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicesPage - 1) * invoicesPageSize;
    return visibleInvoices.slice(start, start + invoicesPageSize);
  }, [visibleInvoices, invoicesPage, invoicesPageSize]);
  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * paymentsPageSize;
    return payments.slice(start, start + paymentsPageSize);
  }, [payments, paymentsPage, paymentsPageSize]);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  const closeCancelModal = () => {
    setCancelTarget(null);
    setCancelConfirmationInput("");
  };

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error]);

  const refreshBillingData = async (organizationId?: string | null) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setBillingLoading(true);
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
      const [invoiceRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/payment/invoices${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/payment/history${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const invoiceData = (await invoiceRes.json()) as { invoices?: Invoice[] };
      const historyData = (await historyRes.json()) as { payments?: PaymentRow[] };
      setInvoices(Array.isArray(invoiceData.invoices) ? invoiceData.invoices : []);
      setPayments(Array.isArray(historyData.payments) ? historyData.payments : []);
    } finally {
      setBillingLoading(false);
    }
  };

  const refreshAll = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const [userRes, orgRes, pricingRes] = await Promise.all([
        fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/orgs`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/public/billing/pricing`)
      ]);

      const userData = await userRes.json();
      const orgData = await orgRes.json();
      const pricingData = (await pricingRes.json()) as PricingData;

      if (!userRes.ok) {
        throw new Error(userData.error || "Failed to load billing data");
      }
      if (!orgRes.ok) {
        throw new Error(orgData.error || "Failed to load organizations");
      }

      setUser(userData.user as User);
      setOrgs(Array.isArray(orgData.orgs) ? (orgData.orgs as Organization[]) : []);
      setPricing(pricingData);

      const nextOwnerOrgs = Array.isArray(orgData.orgs)
        ? (orgData.orgs as Organization[]).filter((org) => org.role === "OWNER")
        : [];
      if (!selectedOrgId && nextOwnerOrgs[0]) {
        setSelectedOrgId(nextOwnerOrgs[0].id);
      }

      const intent = searchParams.get("intent");
      if (intent === "team" && nextOwnerOrgs[0]) {
        setHistoryScope("ORGANIZATION");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scopeOrgId = historyScope === "ORGANIZATION" ? selectedOrg?.id || null : null;
    void refreshBillingData(scopeOrgId);
  }, [historyScope, selectedOrg?.id]);

  useEffect(() => {
    setInvoicesPage((current) => Math.min(current, invoicesTotalPages));
  }, [invoicesTotalPages]);

  useEffect(() => {
    setPaymentsPage((current) => Math.min(current, paymentsTotalPages));
  }, [paymentsTotalPages]);

  const startCheckout = async ({
    plan,
    interval,
    organizationId
  }: {
    plan: "DEV" | "PRO" | "TEAM";
    interval: BillingInterval;
    organizationId?: string;
  }) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setActionLoading(true);
    setError(null);

    try {
      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) {
        throw new Error("Failed to load Razorpay checkout");
      }

      const res = await fetch(`${API_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          plan,
          interval,
          organizationId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      if (data?.alreadyActive) {
        showToast(
          plan === "TEAM" ? "Team is already active." : plan === "DEV" ? "Dev is already active." : "Pro is already active.",
          "success"
        );
        await refreshAll();
        return;
      }

      const options = {
        key: data.keyId,
        name: "TraceForge",
        description:
          plan === "TEAM"
            ? `Team Plan (${interval === "YEARLY" ? "yearly" : "monthly"})`
            : plan === "DEV"
              ? "Dev Plan (monthly)"
            : `Pro Plan (${interval === "YEARLY" ? "yearly" : "monthly"})`,
        subscription_id: data.subscriptionId,
        prefill: {
          email: user?.email
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id?: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              ...response,
              razorpay_subscription_id:
                response.razorpay_subscription_id || data.subscriptionId
            })
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.ok) {
            throw new Error(verifyData.error || "Payment verification failed");
          }
          showToast(
            plan === "TEAM"
              ? "Team plan activated."
              : plan === "DEV"
                ? "Dev activated successfully."
                : "Pro activated successfully.",
            "success"
          );
          await refreshAll();
          await refreshBillingData(historyScope === "ORGANIZATION" ? organizationId : null);
        },
        modal: {
          ondismiss: () => showToast("Payment cancelled", "error")
        },
        theme: {
          color: "#6d28d9"
        }
      };

      const instance = new window.Razorpay(options);
      instance.on("payment.failed", () => {
        showToast("Payment failed. Please try again.", "error");
      });
      instance.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelSubscription = async (organizationId?: string) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return false;

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/payment/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          atCycleEnd: false,
          organizationId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      showToast(
        organizationId ? "Team plan cancelled." : cancelTarget?.plan === "DEV" ? "Dev cancelled." : "Pro cancelled.",
        "success"
      );
      await refreshAll();
      await refreshBillingData(historyScope === "ORGANIZATION" ? organizationId || null : null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancelSubscription = async () => {
    if (!cancelTarget) return;
    const cancelled = await cancelSubscription(
      cancelTarget.plan === "TEAM" ? cancelTarget.organizationId : undefined
    );
    if (cancelled) {
      closeCancelModal();
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Billing</p>
            <h1 className="tf-title mt-3 text-3xl">Personal and team plans</h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Dev and Pro stay user-level. Dev keeps Free-style access with a bigger AI allowance,
              Pro removes the AI cap for that person everywhere, and Team stays organization-level
              with shared AI capacity for the selected organization.
            </p>
          </div>
          <button
            type="button"
            className="tf-button-ghost px-4 py-2 text-sm"
            onClick={() => void refreshAll()}
            disabled={loading || actionLoading}
          >
            Refresh
          </button>
        </header>

        <section
          className={`mt-6 grid gap-6 ${
            canManageDevPlan ? "2xl:grid-cols-3" : "xl:grid-cols-2"
          }`}
        >
          {canManageDevPlan ? (
            <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Personal Dev
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-text-primary">
                  {isUserDevActive ? "Dev active" : "Enable Dev"}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Free-style product access with a paid testing subscription and a larger monthly AI allowance.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Status
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {isUserDevActive ? "Active" : "Not active"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {user?.plan === "DEV" && user?.planExpiresAt
                    ? `Expires ${new Date(user.planExpiresAt).toLocaleDateString()}`
                    : "Monthly testing plan"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Price
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">₹{devMonthlyPrice}</p>
                <p className="mt-1 text-xs text-text-secondary">Monthly only</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  AI analyses
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">{devAiLimit} / month</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Product access
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Same as Free</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={() => void startCheckout({ plan: "DEV", interval: "MONTHLY" })}
                disabled={actionLoading}
              >
                <LoadingButtonContent
                  loading={actionLoading}
                  loadingLabel="Processing..."
                  idleLabel={isUserDevActive ? "Renew Dev" : "Choose Dev"}
                />
              </button>
              {isUserDevActive ? (
                <button
                  type="button"
                  className="tf-button-ghost px-4 py-2 text-sm"
                  onClick={() =>
                    setCancelTarget({
                      plan: "DEV",
                      label: "Dev subscription"
                    })
                  }
                  disabled={actionLoading}
                >
                  <LoadingButtonContent
                    loading={actionLoading}
                    loadingLabel="Cancelling..."
                    idleLabel="Cancel Dev"
                  />
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Dev is meant for payment testing and controlled evaluation. It only increases the user AI allowance.
            </p>
            </div>
          ) : null}

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Personal Pro
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-text-primary">
                  {isUserProActive ? "Pro active" : "Upgrade to Pro"}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Unlimited AI analyses for you, even inside Free or Team organizations.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Status
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {isUserProActive ? "Active" : "Not active"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {user?.planExpiresAt ? `Expires ${new Date(user.planExpiresAt).toLocaleDateString()}` : "No active renewal"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-secondary/15 p-1 text-xs font-semibold text-text-secondary">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${personalInterval === "MONTHLY" ? "bg-card text-text-primary" : ""}`}
                onClick={() => setPersonalInterval("MONTHLY")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${personalInterval === "YEARLY" ? "bg-card text-text-primary" : ""}`}
                onClick={() => setPersonalInterval("YEARLY")}
              >
                Yearly
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Price
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {formatPrice(
                    personalInterval === "YEARLY" ? proYearlyPrice : proMonthlyPrice
                  )}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {personalInterval === "YEARLY" && proYearlySavings
                    ? `Save ₹${proYearlySavings.toLocaleString("en-IN")} with yearly billing`
                    : "Billed per user"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  AI analyses
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Unlimited</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Member cap
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">None for Pro owners</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={() =>
                  void startCheckout({ plan: "PRO", interval: personalInterval })
                }
                disabled={actionLoading}
              >
                <LoadingButtonContent
                  loading={actionLoading}
                  loadingLabel="Processing..."
                  idleLabel={isUserProActive ? "Renew Pro" : "Upgrade to Pro"}
                />
              </button>
              {isUserProActive ? (
                <button
                  type="button"
                  className="tf-button-ghost px-4 py-2 text-sm"
                  onClick={() =>
                    setCancelTarget({
                      plan: "PRO",
                      label: "Pro subscription"
                    })
                  }
                  disabled={actionLoading}
                >
                  <LoadingButtonContent
                    loading={actionLoading}
                    loadingLabel="Cancelling..."
                    idleLabel="Cancel Pro"
                  />
                </button>
              ) : null}
            </div>
            {proUsesLaunchPricing ? (
              <p className="mt-3 text-xs text-text-secondary">
                {userKeepsLaunchPricing
                  ? "Your Pro subscription keeps launch pricing on renewals."
                  : `First ${pricing?.pro?.launch?.slotsTotal ?? 20} Pro customers get launch pricing. ${pricing?.pro?.launch?.slotsRemaining ?? 0} slots left.`}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Team organization
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-text-primary">
                  {isTeamActive ? "Team active" : "Upgrade an organization"}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Shared {pricing?.team?.aiLimitMonthly ?? 200} AI analyses per month for the selected
                  organization. Personal Pro still stays unlimited for Pro users.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Status
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {isTeamActive ? "Active" : "Not active"}
                </p>
                <p className="mt-1 whitespace-nowrap text-xs text-text-secondary">
                  {selectedOrg?.planExpiresAt
                    ? `Expires ${new Date(selectedOrg.planExpiresAt).toLocaleDateString()}`
                    : "No active renewal"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-secondary/15 p-1 text-xs font-semibold text-text-secondary">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 ${teamInterval === "MONTHLY" ? "bg-card text-text-primary" : ""}`}
                  onClick={() => setTeamInterval("MONTHLY")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 ${teamInterval === "YEARLY" ? "bg-card text-text-primary" : ""}`}
                  onClick={() => setTeamInterval("YEARLY")}
                >
                  Yearly
                </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Price
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {formatPrice(
                    teamInterval === "YEARLY"
                      ? pricing?.team?.yearlyPriceInr
                      : pricing?.team?.monthlyPriceInr
                  )}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {teamInterval === "YEARLY" && teamYearlySavings
                    ? `Save ₹${teamYearlySavings.toLocaleString("en-IN")} with yearly billing`
                    : "Billed to the organization"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Shared AI
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {pricing?.team?.aiLimitMonthly ?? 200} / month
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Organization
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {selectedOrg?.name || "Select one"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {selectedOrg ? `${selectedOrg.memberCount} active members` : "Choose the billing organization"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="tf-filter-field">
                <span className="tf-filter-label">Team organization</span>
                <select
                  className="tf-select tf-filter-control w-full"
                  value={selectedOrgId}
                  onChange={(event) => setSelectedOrgId(event.target.value)}
                >
                  <option value="">Select organization</option>
                  {ownerOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="tf-button px-4 py-2 text-sm"
                onClick={() =>
                  selectedOrgId
                    ? void startCheckout({
                        plan: "TEAM",
                        interval: teamInterval,
                        organizationId: selectedOrgId
                      })
                    : showToast("Select an organization first.", "error")
                }
                disabled={actionLoading}
              >
                <LoadingButtonContent
                  loading={actionLoading}
                  loadingLabel="Processing..."
                  idleLabel={isTeamActive ? "Renew Team" : "Upgrade to Team"}
                />
              </button>
              {isTeamActive && selectedOrgId ? (
                <button
                  type="button"
                  className="tf-button-ghost px-4 py-2 text-sm"
                  onClick={() =>
                    setCancelTarget({
                      plan: "TEAM",
                      organizationId: selectedOrgId,
                      label: selectedOrg?.name ? `${selectedOrg.name} Team subscription` : "Team subscription"
                    })
                  }
                  disabled={actionLoading}
                >
                  <LoadingButtonContent
                    loading={actionLoading}
                    loadingLabel="Cancelling..."
                    idleLabel="Cancel Team"
                  />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Invoices and payments</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Switch between your personal billing history and the selected Team organization.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/15 p-1 text-xs font-semibold text-text-secondary">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${historyScope === "USER" ? "bg-card text-text-primary" : ""}`}
                onClick={() => setHistoryScope("USER")}
              >
                Personal
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${historyScope === "ORGANIZATION" ? "bg-card text-text-primary" : ""}`}
                onClick={() => setHistoryScope("ORGANIZATION")}
                disabled={!selectedOrg}
              >
                Team
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Invoices</h3>
              {hiddenCancelledInvoiceCount > 0 ? (
                <p className="mt-1 text-xs text-text-secondary">
                  {hiddenCancelledInvoiceCount} cancelled invoice{hiddenCancelledInvoiceCount === 1 ? "" : "s"} hidden from this page.
                </p>
              ) : null}
              <div className="mt-4 space-y-3">
                {(billingLoading ? Array.from({ length: 3 }) : paginatedInvoices).map((invoice, idx) => {
                  const row = invoice as Invoice | undefined;
                  return (
                    <div
                      key={row?.id || idx}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/15 px-4 py-3"
                    >
                      <div className="min-w-[220px]">
                        <p className="text-sm font-semibold text-text-primary">
                          {row?.invoiceNumber || row?.id || "Loading…"}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {row?.createdAt ? new Date(row.createdAt).toLocaleString() : "—"} •{" "}
                          {row?.status || "—"}
                        </p>
                      </div>
                      {row?.shortUrl ? (
                        <a
                          className="tf-button-ghost inline-flex px-3 py-1.5 text-xs"
                          href={row.shortUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary">
                          —
                        </span>
                      )}
                    </div>
                  );
                })}
                {!billingLoading && visibleInvoices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/10 px-4 py-5 text-sm text-text-secondary">
                    No invoices
                  </div>
                ) : null}
              </div>

              {visibleInvoices.length > 5 && !billingLoading ? (
                <DashboardPagination
                  page={invoicesPage}
                  totalPages={invoicesTotalPages}
                  pageSize={invoicesPageSize}
                  pageSizeOptions={BILLING_PAGE_SIZE_OPTIONS}
                  onPageChange={setInvoicesPage}
                  onPageSizeChange={(nextSize) => {
                    setInvoicesPage(1);
                    setInvoicesPageSize(nextSize);
                  }}
                />
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-text-primary">Payments</h3>
              <div className="mt-4 space-y-3">
                {(billingLoading ? Array.from({ length: 3 }) : paginatedPayments).map((payment, idx) => {
                  const row = payment as PaymentRow | undefined;
                  const primaryId =
                    row?.razorpayPaymentId || row?.razorpaySubscriptionId || row?.razorpayOrderId;
                  return (
                    <div
                      key={row?.id || idx}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/15 px-4 py-3"
                    >
                      <div className="min-w-[220px]">
                        <p className="text-sm font-semibold text-text-primary">
                          {primaryId ? primaryId.slice(0, 18) : "Loading…"}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {row?.createdAt ? new Date(row.createdAt).toLocaleString() : "—"} •{" "}
                          {row?.status || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text-primary">
                          {row ? `₹${(row.amount / 100).toFixed(0)}` : "—"}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {row?.expiresAt
                            ? `Renews: ${new Date(row.expiresAt).toLocaleDateString()}`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {payments.length > 5 && !billingLoading ? (
                <DashboardPagination
                  page={paymentsPage}
                  totalPages={paymentsTotalPages}
                  pageSize={paymentsPageSize}
                  pageSizeOptions={BILLING_PAGE_SIZE_OPTIONS}
                  onPageChange={setPaymentsPage}
                  onPageSizeChange={(nextSize) => {
                    setPaymentsPage(1);
                    setPaymentsPageSize(nextSize);
                  }}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">How plan logic works</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Free",
                detail: "50 AI analyses each month and up to 5 members in every Free organization."
              },
              {
                title: "Pro",
                detail: "Unlimited AI belongs to the user account and follows that user everywhere."
              },
              {
                title: "Dev",
                detail: "Dev keeps Free-level product access and raises the user AI allowance to 100 each month."
              },
              {
                title: "Team",
                detail: "200 shared AI analyses each month for the selected organization."
              },
              {
                title: "Mixed access",
                detail: "A Pro user inside a Team organization still keeps unlimited AI personally."
              }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Cancel subscription
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              You are about to cancel <span className="font-semibold">{cancelTarget.label}</span>.
              Type <span className="font-semibold">Cancel your subscription</span> to confirm.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Cancelling stops future billing. Payments already made are non-refundable.
            </div>
            <input
              className="tf-input mt-4 w-full"
              placeholder="Cancel your subscription"
              value={cancelConfirmationInput}
              onChange={(event) => setCancelConfirmationInput(event.target.value)}
              disabled={actionLoading}
            />
            <div className="mt-5 flex w-full flex-nowrap items-center justify-end gap-3">
              <button
                type="button"
                className="tf-button-ghost inline-flex min-w-0 flex-1 items-center justify-center px-3 py-2 text-sm sm:flex-none sm:px-4"
                onClick={closeCancelModal}
                disabled={actionLoading}
              >
                Keep plan
              </button>
              <button
                type="button"
                className="tf-danger-solid inline-flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 sm:flex-none sm:px-4"
                onClick={() => void confirmCancelSubscription()}
                disabled={actionLoading || cancelConfirmationInput.trim() !== "Cancel your subscription"}
              >
                <LoadingButtonContent
                  loading={actionLoading}
                  loadingLabel="Cancelling..."
                  idleLabel="Cancel subscription"
                />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`tf-dashboard-toast ${toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
