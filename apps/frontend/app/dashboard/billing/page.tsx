"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPagination } from "../components/DashboardPagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => { open: () => void; on: (evt: string, cb: (data: any) => void) => void };
  }
}

type Toast = {
  message: string;
  tone: "success" | "error";
};

type User = {
  id: string;
  fullName: string | null;
  email: string;
  plan: "FREE" | "PRO";
  proPricingTier?: "LAUNCH" | "STANDARD" | null;
  planExpiresAt: string | null;
  subscriptionStatus: string | null;
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

type CreateOrderResponse =
  | {
      alreadyPro: true;
      plan: "pro";
      expiresAt: string | null;
    }
  | {
      keyId: string;
      subscriptionId: string;
      amount: number;
      currency: string;
      receipt: string;
    };

type VerifyResponse = {
  ok: boolean;
  plan: "pro";
  expiresAt: string;
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

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(5);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(5);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void refreshUser();
  }, []);

  const refreshUser = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load account");
      }

      const nextUser = data.user as User;
      setUser({
        id: nextUser.id,
        fullName: nextUser.fullName ?? null,
        email: nextUser.email,
        plan: nextUser.plan,
        proPricingTier: nextUser.proPricingTier ?? null,
        planExpiresAt: nextUser.planExpiresAt ?? null,
        subscriptionStatus: nextUser.subscriptionStatus ?? null
      });

      void refreshBillingData();
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const refreshBillingData = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setBillingLoading(true);
    try {
      const [invoiceRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/payment/invoices`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/payment/history`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const invoiceData = (await invoiceRes.json()) as { invoices?: Invoice[]; error?: string };
      if (invoiceRes.ok) {
        setInvoices(Array.isArray(invoiceData.invoices) ? invoiceData.invoices : []);
      }

      const historyData = (await historyRes.json()) as { payments?: PaymentRow[]; error?: string };
      if (historyRes.ok) {
        setPayments(Array.isArray(historyData.payments) ? historyData.payments : []);
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const isProActive = useMemo(() => {
    if (!user) return false;
    if (user.plan !== "PRO") return false;
    if (!user.planExpiresAt) return true;
    return new Date(user.planExpiresAt).getTime() > Date.now();
  }, [user]);

  const invoicesTotalPages = Math.max(1, Math.ceil(invoices.length / invoicesPageSize));
  const paymentsTotalPages = Math.max(1, Math.ceil(payments.length / paymentsPageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicesPage - 1) * invoicesPageSize;
    return invoices.slice(start, start + invoicesPageSize);
  }, [invoices, invoicesPage, invoicesPageSize]);
  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * paymentsPageSize;
    return payments.slice(start, start + paymentsPageSize);
  }, [payments, paymentsPage, paymentsPageSize]);

  useEffect(() => {
    setInvoicesPage((current) => Math.min(current, invoicesTotalPages));
  }, [invoicesTotalPages]);

  useEffect(() => {
    setPaymentsPage((current) => Math.min(current, paymentsTotalPages));
  }, [paymentsTotalPages]);

  const startCheckout = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setLoading(true);
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
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      if (typeof data === "object" && data && "alreadyPro" in (data as Record<string, unknown>)) {
        showToast("You already have Pro active.", "success");
        await refreshUser();
        return;
      }
      const subscription = data as CreateOrderResponse & {
        subscriptionId: string;
        amount: number;
        currency: string;
        keyId: string;
        receipt: string;
      };

      const options = {
        key: subscription.keyId,
        name: "TraceForge",
        description: "Pro Plan (₹299/month)",
        subscription_id: subscription.subscriptionId,
        method: {
          card: true,
          upi: false,
          netbanking: false,
          wallet: false,
          emi: false
        },
        prefill: {
          email: user?.email
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id?: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                ...response,
                razorpay_subscription_id:
                  response.razorpay_subscription_id || subscription.subscriptionId
              })
            });
            const verifyData = (await verifyRes.json()) as VerifyResponse & { error?: string };
            if (!verifyRes.ok || !verifyData.ok) {
              throw new Error(verifyData.error || "Payment verification failed");
            }
            showToast("Upgraded to Pro", "success");
            await refreshUser();
            void refreshBillingData();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error");
            showToast("Payment verification failed", "error");
          }
        },
        modal: {
          ondismiss: () => {
            showToast("Payment cancelled", "error");
          }
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
      showToast("Failed to start payment", "error");
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/payment/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ atCycleEnd: false })
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; expiresAt?: string | null };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      showToast("Subscription cancelled. Switched to Free.", "success");
      await refreshUser();
      void refreshBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      showToast("Failed to cancel subscription", "error");
    } finally {
      setLoading(false);
    }
  };

  const upgradeToPro = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/payment/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      const data = (await res.json()) as
        | { ok: true; alreadyPro?: boolean; plan?: "pro"; expiresAt?: string | null }
        | { ok?: boolean; requiresPayment?: boolean; error?: string };

      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to upgrade");
      }

      if (typeof data === "object" && data && "requiresPayment" in data && data.requiresPayment) {
        await startCheckout();
        return;
      }

      showToast("Pro enabled.", "success");
      await refreshUser();
      void refreshBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      showToast("Failed to upgrade", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page">
      <div className="tf-dashboard">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tf-kicker">Billing</p>
            <h1 className="tf-title mt-3 text-3xl">Plan and usage</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Manage your subscription, review usage against plan limits, and keep billing
              details organized for your workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="tf-button px-4 py-2 text-sm"
              onClick={() => {
                if (isProActive) {
                  showToast("Pro is already active.", "success");
                  return;
                }
                void upgradeToPro();
              }}
              disabled={loading}
            >
              Upgrade to Pro
            </button>
          </div>
        </header>

        {error && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Current plan
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-text-primary">
                  {isProActive ? "Pro" : "Free"}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {isProActive
                    ? "Unlimited projects, errors, and AI analysis."
                    : "Upgrade to Pro to unlock unlimited projects, errors, and AI analysis."}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-accent-soft px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Expires
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Monthly price
                </p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">
                  {isProActive ? (user?.proPricingTier === "STANDARD" ? "₹499" : "₹299") : "-"}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {isProActive ? "per month" : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Projects
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {isProActive ? "Unlimited" : "3"}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {isProActive ? "Create as many projects as you need." : "Upgrade to remove limits."}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Errors / month
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {isProActive ? "Unlimited" : "1000"}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {isProActive ? "No monthly cap." : "Upgrade to remove caps."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">Billing summary</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Subscription status
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {isProActive ? user?.subscriptionStatus || "active" : "free"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  AI analyses / month
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {isProActive ? "Unlimited" : "20"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Provider
                </p>
                <p className="mt-2 text-sm font-semibold text-text-primary">Razorpay</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => void refreshUser()}
              >
                Refresh
              </button>
              {isProActive ? (
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                  onClick={() => void cancelSubscription()}
                  disabled={loading}
                >
                  Cancel subscription
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => void startCheckout()}
                disabled={loading || isProActive}
              >
                Retry payment
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-primary">Invoices</h2>
              <button
                type="button"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => void refreshBillingData()}
                disabled={billingLoading || loading}
              >
                Refresh
              </button>
            </div>

            {!isProActive ? (
              <p className="mt-3 text-sm text-text-secondary">
                Upgrade to Pro to generate invoices for monthly renewals.
              </p>
            ) : invoices.length === 0 && !billingLoading ? (
              <p className="mt-3 text-sm text-text-secondary">
                No invoices yet. Your first invoice appears after the payment is captured.
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
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-text-primary">
                        {row ? `₹${(row.amount / 100).toFixed(0)}` : "—"}
                      </p>
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
                  </div>
                );
              })}
            </div>

            {invoices.length > 5 && !billingLoading && (
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
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-primary">Payments</h2>
              <button
                type="button"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                onClick={() => void refreshBillingData()}
                disabled={billingLoading || loading}
              >
                Refresh
              </button>
            </div>

            {payments.length === 0 && !billingLoading ? (
              <p className="mt-3 text-sm text-text-secondary">
                No payments recorded yet.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {(billingLoading ? Array.from({ length: 3 }) : paginatedPayments).map((payment, idx) => {
                const row = payment as PaymentRow | undefined;
                const primaryId = row?.razorpayPaymentId || row?.razorpaySubscriptionId || row?.razorpayOrderId;
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
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-text-primary">
                        {row ? `₹${(row.amount / 100).toFixed(0)}` : "—"}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {row?.expiresAt ? `Renews: ${new Date(row.expiresAt).toLocaleDateString()}` : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {payments.length > 5 && !billingLoading && (
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
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">How it works</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Secure verification",
                detail: "Backend verifies Razorpay signature and fetches payment status before upgrading."
              },
              {
                title: "No frontend trust",
                detail: "Pro is only activated after server-side verification or webhook capture."
              },
              {
                title: "Auto-debit subscription",
                detail: "Pro renews monthly via Razorpay subscription until you downgrade."
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

      {toast && (
        <div
          className={`tf-dashboard-toast ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
