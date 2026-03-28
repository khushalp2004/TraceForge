"use client";

import { useEffect, useMemo, useState } from "react";
import { PricingCta } from "./PricingCta";

type Currency = "INR" | "USD";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DEFAULT_INR_PER_USD = 83;

const formatMoney = (currency: Currency, inr: number, inrPerUsd: number) => {
  if (currency === "INR") return `₹${inr}`;
  const usd = inr / Math.max(1, inrPerUsd);
  return `$${usd.toFixed(2)}`;
};

export function PricingPlans() {
  const [currency, setCurrency] = useState<Currency>("INR");
  const [inrPerUsd, setInrPerUsd] = useState(DEFAULT_INR_PER_USD);
  const [rateMeta, setRateMeta] = useState<{ provider: string; asOf: string } | null>(null);
  const [launchSlots, setLaunchSlots] = useState<{ total: number; remaining: number } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/public/fx/usd-inr`);
        const data = (await res.json()) as { rate?: number; provider?: string; asOf?: string };
        if (!res.ok || !data.rate || !Number.isFinite(data.rate)) return;
        setInrPerUsd(data.rate);
        if (data.provider && data.asOf) {
          setRateMeta({ provider: data.provider, asOf: data.asOf });
        }
      } catch {
        // ignore: keep fallback
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/public/billing/pricing`);
        const data = (await res.json()) as {
          pro?: { launch?: { slotsTotal?: number; slotsRemaining?: number } };
        };
        const total = data?.pro?.launch?.slotsTotal;
        const remaining = data?.pro?.launch?.slotsRemaining;
        if (!res.ok || typeof total !== "number" || typeof remaining !== "number") return;
        setLaunchSlots({ total, remaining });
      } catch {
        // ignore
      }
    })();
  }, []);

  const proLaunch = useMemo(() => formatMoney(currency, 299, inrPerUsd), [currency, inrPerUsd]);
  const proStandard = useMemo(() => formatMoney(currency, 499, inrPerUsd), [currency, inrPerUsd]);
  const launchAvailable = launchSlots ? launchSlots.remaining > 0 : true;

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Early-adopter pricing</p>
          <p className="mt-1 text-sm text-text-secondary">
            First {launchSlots?.total ?? 20} customers get the launch price. After that, Pro is the standard price.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 p-1 text-xs font-semibold text-text-secondary">
          <button
            type="button"
            onClick={() => setCurrency("INR")}
            className={`rounded-full px-3 py-1.5 transition ${
              currency === "INR" ? "bg-secondary/80 text-text-primary" : "hover:bg-secondary/40"
            }`}
          >
            ₹ INR
          </button>
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            className={`rounded-full px-3 py-1.5 transition ${
              currency === "USD" ? "bg-secondary/80 text-text-primary" : "hover:bg-secondary/40"
            }`}
          >
            $ USD
          </button>
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="tf-card p-6">
          <p className="text-xs font-semibold text-text-secondary">Free</p>
          <p className="mt-3 text-3xl font-semibold text-text-primary">
            {currency === "INR" ? "₹0" : "$0"}
          </p>
          <p className="mt-2 text-sm text-text-secondary">For builders validating a product.</p>
          <ul className="mt-4 space-y-2 text-sm text-text-secondary">
            {["3 projects", "1000 errors / month", "20 AI analyses / month"].map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
          <PricingCta intent="free" />
        </div>

        <div className="tf-card relative overflow-hidden p-6">
          <div className="absolute right-4 top-4 rounded-full border border-primary/30 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-text-primary">
            {launchAvailable ? "Launch offer" : "Standard price"}
          </div>

          <p className="text-xs font-semibold text-text-secondary">Pro</p>
          {launchAvailable ? (
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-3xl font-semibold text-text-primary">
                {proLaunch}
                <span className="ml-2 text-sm text-text-secondary">/ month</span>
              </p>
              <p className="pb-1 text-sm font-semibold text-text-secondary line-through">{proStandard}</p>
            </div>
          ) : (
            <p className="mt-3 text-3xl font-semibold text-text-primary">
              {proStandard}
              <span className="ml-2 text-sm text-text-secondary">/ month</span>
            </p>
          )}
          <p className="mt-2 text-sm text-text-secondary">
            {launchAvailable ? (
              <>
                Limited to the first {launchSlots?.total ?? 20} customers. Then{" "}
                <span className="font-semibold text-text-primary">{proStandard}/month</span>.
              </>
            ) : (
              <>
                Standard pricing is{" "}
                <span className="font-semibold text-text-primary">{proStandard}/month</span>.
              </>
            )}
          </p>
          {launchSlots ? (
            <p className="mt-2 text-xs text-text-secondary">
              {launchAvailable ? `${launchSlots.remaining} launch slots left.` : "Launch slots filled."}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm text-text-secondary">
            {["Unlimited projects", "Unlimited errors", "Unlimited AI analysis"].map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
          <PricingCta intent="pro" />
        </div>
      </section>

      <p className="mt-6 text-xs text-text-secondary">
        USD prices use live USD/INR conversion (display only). Billing is charged in INR via Razorpay.
        {rateMeta ? ` Source: ${rateMeta.provider} • as of ${new Date(rateMeta.asOf).toLocaleString()}.` : null}
      </p>
    </>
  );
}
