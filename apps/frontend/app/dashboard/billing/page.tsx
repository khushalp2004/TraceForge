"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X, Sparkles, ChevronDown } from "lucide-react";
import { LoadingButtonContent } from "../../../components/ui/loading-button-content";
import { DashboardPagination } from "../components/DashboardPagination";
import { AnimatedPrice } from "../../components/AnimatedPrice";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("traceforge_billing_updated"));
      }
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
            <div className="mt-3 flex items-center">
              <h1 className="tf-title text-3xl">Personal and team plans</h1>
              <PageDescriptionPopover>
                Pro stays user-level and removes the AI cap for that person everywhere, and Team stays organization-level
                with shared AI capacity for the selected organization.
              </PageDescriptionPopover>
            </div>
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
          } items-stretch`}
        >
          {canManageDevPlan ? (
            <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm h-full flex flex-col">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">
                    Personal Dev
                  </p>
                  {isUserDevActive ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Active</span>
                  ) : (
                    <span className="rounded-full bg-secondary/20 border border-border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Not active</span>
                  )}
                </div>
                <h2 className="mt-2 text-2xl font-bold text-text-primary">
                  {isUserDevActive ? "Dev Plan" : "Enable Dev"}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Free-style product access with a paid testing subscription and a larger monthly AI allowance.
                </p>
                {user?.plan === "DEV" && user?.planExpiresAt && (
                  <p className="mt-2 text-xs font-medium text-text-secondary bg-secondary/20 inline-flex w-fit px-2 py-1 rounded-md border border-border/50">
                    Expires {new Date(user.planExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-col rounded-xl border border-border bg-secondary/10 overflow-hidden">
                <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/50 p-5 gap-4 sm:gap-0">
                  <div className="sm:pr-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Price</p>
                    <p className="mt-1 text-2xl font-bold text-text-primary">₹{devMonthlyPrice}<span className="text-sm font-normal text-text-secondary">/mo</span></p>
                  </div>
                  <div className="sm:px-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">AI analyses</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{devAiLimit} / month</p>
                  </div>
                  <div className="sm:pl-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Access</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">Same as Free</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-5 border-t border-border/50 flex flex-col gap-4">
                <p className="text-xs text-text-secondary">
                  Payment testing & evaluation.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
                  {isUserDevActive ? (
                    <button
                      type="button"
                      className="tf-button-ghost w-full sm:w-auto px-4 py-2 text-sm"
                      onClick={() => setCancelTarget({ plan: "DEV", label: "Dev subscription" })}
                      disabled={actionLoading}
                    >
                      <LoadingButtonContent loading={actionLoading} loadingLabel="Cancelling..." idleLabel="Cancel" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="tf-button w-full sm:w-auto px-4 py-2 text-sm"
                    onClick={() => void startCheckout({ plan: "DEV", interval: "MONTHLY" })}
                    disabled={actionLoading}
                  >
                    <LoadingButtonContent loading={actionLoading} loadingLabel="Processing..." idleLabel={isUserDevActive ? "Renew Dev" : "Choose Dev"} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-border/40 bg-gradient-to-b from-card to-card/90 p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] h-full flex flex-col">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">
                  Personal Pro
                </p>
                {isUserProActive ? (
                  <span className="rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Active</span>
                ) : (
                  <span className="rounded-[4px] bg-secondary/20 border border-border/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Not active</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-text-primary">
                  {isUserProActive ? "Pro Plan" : "Upgrade to Pro"}
                </h2>
                {user?.planExpiresAt && (
                  <p className="text-xs font-semibold text-text-secondary bg-secondary/30 px-3 py-1.5 rounded-sm border border-border/40 whitespace-nowrap">
                    Expires {new Date(user.planExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                Unlimited AI analyses for you, even inside Free or Team organizations.
              </p>
            </div>

            <div className="mt-8 flex flex-col rounded-[16px] border border-border/40 bg-background/50 overflow-hidden shadow-inner">
              <div className="border-b border-border/40 bg-secondary/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-semibold text-text-secondary">Billing cycle</p>
                <div className="flex items-center gap-1">
                  <SegmentedControl
                    name="personal-billing-interval"
                    options={[
                      { label: "Monthly", value: "MONTHLY" },
                      { label: "Yearly", value: "YEARLY" }
                    ]}
                    value={personalInterval}
                    onChange={(val) => setPersonalInterval(val as BillingInterval)}
                    size="sm"
                    shape="rounded"
                    className="bg-card shadow-sm border-border/40 text-xs"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40 p-6 gap-6 sm:gap-0">
                <div className="sm:pr-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Price</p>
                  <p className="text-3xl font-bold text-text-primary tracking-tight">
                    <AnimatedPrice
                      value={personalInterval === "YEARLY" ? proYearlyPrice : proMonthlyPrice}
                      format={formatPrice}
                    />
                    <span className="text-[15px] font-semibold text-text-secondary/70">/{personalInterval === "YEARLY" ? "yr" : "mo"}</span>
                  </p>
                  <p className={`mt-1.5 text-[11px] font-bold tracking-wide uppercase text-emerald-500 ${personalInterval === "YEARLY" && proYearlySavings ? "visible" : "invisible"}`}>
                    Save ₹{(proYearlySavings || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="sm:px-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">AI analyses</p>
                  <p className="text-[15px] font-semibold text-text-primary">Unlimited</p>
                </div>
                <div className="sm:pl-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Member cap</p>
                  <p className="text-[15px] font-semibold text-text-primary">None</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-8 flex flex-col gap-5">
              {proUsesLaunchPricing ? (
                <div className="flex items-center gap-2 text-[13px] text-text-secondary">
                  <Sparkles className="w-4 h-4 text-brand-primary" />
                  <span>
                    {userKeepsLaunchPricing
                      ? "Keeps launch pricing on renewals."
                      : `Launch pricing. ${pricing?.pro?.launch?.slotsRemaining ?? 0} slots left.`}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
                {isUserProActive ? (
                  <button
                    type="button"
                    className="rounded-sm bg-secondary/30 hover:bg-secondary/50 w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors shadow-sm"
                    onClick={() => setCancelTarget({ plan: "PRO", label: "Pro subscription" })}
                    disabled={actionLoading}
                  >
                    <LoadingButtonContent loading={actionLoading} loadingLabel="Cancelling..." idleLabel="Cancel" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-sm bg-primary hover:bg-primary-hover w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors shadow-sm"
                  onClick={() => void startCheckout({ plan: "PRO", interval: personalInterval })}
                  disabled={actionLoading}
                >
                  <LoadingButtonContent loading={actionLoading} loadingLabel="Processing..." idleLabel={isUserProActive ? "Renew Pro" : "Upgrade"} />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/40 bg-gradient-to-b from-card to-card/90 p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] h-full flex flex-col">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">
                  Team Organization
                </p>
                {isTeamActive ? (
                  <span className="rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Active</span>
                ) : (
                  <span className="rounded-[4px] bg-secondary/20 border border-border/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Not active</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-text-primary">
                  {isTeamActive ? "Team Plan" : "Upgrade Organization"}
                </h2>
                {selectedOrg?.planExpiresAt && (
                  <p className="text-xs font-semibold text-text-secondary bg-secondary/30 px-3 py-1.5 rounded-sm border border-border/40 whitespace-nowrap">
                    Expires {new Date(selectedOrg.planExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                Shared {pricing?.team?.aiLimitMonthly ?? 200} AI analyses per month for the selected organization.
              </p>
            </div>

            <div className="mt-8 flex flex-col rounded-[16px] border border-border/40 bg-background/50 overflow-hidden shadow-inner">
              <div className="border-b border-border/40 bg-secondary/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-semibold text-text-secondary">Billing cycle</p>
                <div className="flex items-center gap-1">
                  <SegmentedControl
                    name="team-billing-interval"
                    options={[
                      { label: "Monthly", value: "MONTHLY" },
                      { label: "Yearly", value: "YEARLY" }
                    ]}
                    value={teamInterval}
                    onChange={(val) => setTeamInterval(val as BillingInterval)}
                    size="sm"
                    shape="rounded"
                    className="bg-card shadow-sm border-border/40 text-xs"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40 p-6 gap-6 sm:gap-0">
                <div className="sm:pr-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Price</p>
                  <p className="text-3xl font-bold text-text-primary tracking-tight">
                    <AnimatedPrice
                      value={teamInterval === "YEARLY" ? pricing?.team?.yearlyPriceInr : pricing?.team?.monthlyPriceInr}
                      format={formatPrice}
                    />
                    <span className="text-[15px] font-semibold text-text-secondary/70">/{teamInterval === "YEARLY" ? "yr" : "mo"}</span>
                  </p>
                  <p className={`mt-1.5 text-[11px] font-bold tracking-wide uppercase text-emerald-500 ${teamInterval === "YEARLY" && teamYearlySavings ? "visible" : "invisible"}`}>
                    Save ₹{(teamYearlySavings || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="sm:px-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Shared AI</p>
                  <p className="text-[15px] font-semibold text-text-primary">{pricing?.team?.aiLimitMonthly ?? 200} / month</p>
                </div>
                <div className="sm:pl-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Members</p>
                  <p className="text-[15px] font-semibold text-text-primary">{selectedOrg ? `${selectedOrg.memberCount} active` : "—"}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-6 pt-8">
              <label className="tf-filter-field w-full flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary pl-1">Apply to organization</span>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all cursor-pointer"
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
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </label>

              <div className="flex sm:items-center sm:justify-end">
                <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                  {isTeamActive && selectedOrgId ? (
                    <button
                      type="button"
                      className="rounded-sm bg-secondary/30 hover:bg-secondary/50 w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors shadow-sm"
                      onClick={() => setCancelTarget({ plan: "TEAM", organizationId: selectedOrgId, label: selectedOrg?.name ? `${selectedOrg.name} Team subscription` : "Team subscription" })}
                      disabled={actionLoading}
                    >
                      <LoadingButtonContent loading={actionLoading} loadingLabel="Cancelling..." idleLabel="Cancel" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-sm bg-primary hover:bg-primary-hover w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors shadow-sm"
                    onClick={() => selectedOrgId ? void startCheckout({ plan: "TEAM", interval: teamInterval, organizationId: selectedOrgId }) : showToast("Select an organization first.", "error")}
                    disabled={actionLoading}
                  >
                    <LoadingButtonContent loading={actionLoading} loadingLabel="Processing..." idleLabel={isTeamActive ? "Renew Team" : "Upgrade"} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[24px] border border-border/40 bg-card p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Invoices and payments</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Switch between your personal billing history and the selected Team organization.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-[6px] border border-border/40 bg-secondary/20 p-1 text-[13px] font-semibold text-text-secondary shadow-inner">
              <button
                type="button"
                className={`rounded-sm px-4 py-2 transition-colors ${historyScope === "USER" ? "bg-card text-text-primary shadow-sm border border-border/40" : "hover:text-text-primary"}`}
                onClick={() => setHistoryScope("USER")}
              >
                Personal
              </button>
              <button
                type="button"
                className={`rounded-sm px-4 py-2 transition-colors ${historyScope === "ORGANIZATION" ? "bg-card text-text-primary shadow-sm border border-border/40" : "hover:text-text-primary"} disabled:opacity-50`}
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border/40 bg-background/50 px-5 py-4 hover:border-border/80 transition-colors shadow-sm"
                    >
                      <div className="min-w-[220px]">
                        <p className="text-[15px] font-semibold text-text-primary">
                          {row?.invoiceNumber || row?.id || "Loading…"}
                        </p>
                        <p className="mt-1.5 text-[13px] text-text-secondary">
                          {row?.createdAt ? new Date(row.createdAt).toLocaleString() : "—"} •{" "}
                          <span className="font-medium text-text-primary">{row?.status || "—"}</span>
                        </p>
                      </div>
                      {row?.shortUrl ? (
                        <a
                          className="rounded-sm bg-secondary/30 hover:bg-secondary/50 px-4 py-2 text-[13px] font-semibold text-text-primary transition-colors shadow-sm inline-flex"
                          href={row.shortUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="rounded-sm border border-border/40 bg-card px-4 py-2 text-[13px] font-semibold text-text-secondary">
                          —
                        </span>
                      )}
                    </div>
                  );
                })}
                {!billingLoading && visibleInvoices.length === 0 ? (
                  <div className="py-10 text-center animate-fade-up">
                    <p className="text-[15px] font-semibold text-text-primary">No invoices found</p>
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border/40 bg-background/50 px-5 py-4 hover:border-border/80 transition-colors shadow-sm"
                    >
                      <div className="min-w-[220px]">
                        <p className="text-[15px] font-semibold text-text-primary">
                          {primaryId ? primaryId.slice(0, 18) : "Loading…"}
                        </p>
                        <p className="mt-1.5 text-[13px] text-text-secondary">
                          {row?.createdAt ? new Date(row.createdAt).toLocaleString() : "—"} •{" "}
                          <span className="font-medium text-text-primary">{row?.status || "—"}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-semibold text-text-primary">
                          {row ? `₹${(row.amount / 100).toFixed(0)}` : "—"}
                        </p>
                        <p className="mt-1.5 text-[13px] text-text-secondary">
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

        <section className="mt-8 rounded-[24px] border border-border/40 bg-card p-8 shadow-sm">
          <h2 className="text-xl font-bold text-text-primary">How plan logic works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                title: "Team",
                detail: "200 shared AI analyses each month for the selected organization."
              },
              {
                title: "Mixed access",
                detail: "A Pro user inside a Team organization still keeps unlimited AI personally."
              }
            ].map((item) => (
              <div key={item.title} className="rounded-[16px] border border-border/40 bg-secondary/10 px-5 py-5 hover:bg-secondary/20 transition-colors shadow-inner">
                <p className="text-[15px] font-bold text-text-primary">{item.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {cancelTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-[24px] border border-border/40 bg-card/90 backdrop-blur-xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border/40 bg-background/50">
              <h3 className="text-[15px] font-bold text-text-primary">Cancel subscription</h3>
              <button onClick={closeCancelModal} className="text-text-secondary hover:text-text-primary transition-colors bg-secondary/30 hover:bg-secondary/50 rounded-full p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
               <h4 className="text-xl font-bold text-text-primary mb-2">Are you sure you want to cancel?</h4>
               <p className="text-[14px] leading-relaxed text-text-secondary">
                 You are about to cancel <span className="font-semibold text-text-primary">{cancelTarget.label}</span>. 
                 Type <span className="font-semibold text-text-primary">Cancel your subscription</span> to confirm.
               </p>
               <div className="mt-4 rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 font-medium">
                 Cancelling stops future billing. Payments already made are non-refundable.
               </div>
               <input
                 className="mt-6 w-full rounded-sm border border-border/50 bg-background px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-inner"
                 placeholder="Cancel your subscription"
                 value={cancelConfirmationInput}
                 onChange={(event) => setCancelConfirmationInput(event.target.value)}
                 disabled={actionLoading}
               />
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row-reverse gap-3 p-6 pt-0">
               <button 
                 onClick={() => void confirmCancelSubscription()} 
                 disabled={actionLoading || cancelConfirmationInput.trim() !== "Cancel your subscription"}
                 className="flex-1 w-full whitespace-nowrap bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-md disabled:opacity-50 font-semibold py-2.5 px-4 rounded-sm transition-all duration-300 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Cancel subscription
               </button>
               <button 
                 onClick={closeCancelModal} 
                 disabled={actionLoading}
                 className="flex-1 w-full whitespace-nowrap bg-secondary/30 hover:bg-secondary/50 text-text-primary font-semibold py-2.5 px-4 rounded-sm transition-colors flex items-center justify-center shadow-sm"
               >
                 Keep plan
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
