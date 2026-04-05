"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { PricingCta } from "./PricingCta";

type Currency = "INR" | "USD";
type BillingInterval = "MONTHLY" | "YEARLY";

type FeatureItem = {
  label: string;
  included: boolean;
};

type PlanCardProps = {
  name: string;
  description: string;
  price: string;
  periodLabel: string;
  comparePrice?: string | null;
  note: string;
  footnote?: string;
  badge?: string;
  featured?: boolean;
  ctaIntent: "free" | "pro" | "team";
  features: FeatureItem[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DEFAULT_INR_PER_USD = 83;

const formatMoney = (currency: Currency, inr: number, inrPerUsd: number) => {
  if (currency === "INR") {
    return `₹${inr.toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(inr) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(inr) ? 0 : 2
    })}`;
  }

  return `$${(inr / Math.max(1, inrPerUsd)).toFixed(2)}`;
};

function FeatureList({ features }: { features: FeatureItem[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {features.map((feature) => (
        <li
          key={feature.label}
          className={`flex items-start gap-3 text-sm leading-6 ${
            feature.included ? "text-text-primary" : "text-text-secondary/70"
          }`}
        >
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/80">
            {feature.included ? (
              <Check className="h-3.5 w-3.5 text-text-primary" />
            ) : (
              <X className="h-3.5 w-3.5 text-text-secondary" />
            )}
          </span>
          <span className={feature.included ? "" : "line-through"}>{feature.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  name,
  description,
  price,
  periodLabel,
  comparePrice,
  note,
  footnote,
  badge,
  featured = false,
  ctaIntent,
  features
}: PlanCardProps) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-[34px] border p-6 sm:p-8 ${
        featured
          ? "border-primary/25 bg-card shadow-[0_20px_50px_hsl(var(--primary)/0.08)]"
          : "border-border bg-card/95 shadow-sm"
      }`}
    >
      {badge ? (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm">
          {badge}
        </div>
      ) : null}

      <div className="min-h-[148px]">
        <h3 className="text-[2rem] font-semibold tracking-tight text-text-primary">{name}</h3>
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <span className="text-6xl font-semibold leading-none tracking-tight text-text-primary">
            {price}
          </span>
          <span className="pb-2 text-sm font-medium uppercase tracking-[0.08em] text-text-secondary">
            {periodLabel}
          </span>
          {comparePrice ? (
            <span className="pb-2 text-base font-medium text-text-secondary line-through">
              {comparePrice}
            </span>
          ) : null}
        </div>
        <p className="mt-5 max-w-md text-base leading-8 text-text-secondary">{description}</p>
      </div>

      <div className="mt-6 rounded-2xl bg-background/55 px-4 py-3 text-sm font-medium text-text-secondary">
        {note}
      </div>

      <FeatureList features={features} />

      {footnote ? (
        <p className="mt-6 border-t border-border/70 pt-5 text-xs leading-6 text-text-secondary">
          {footnote}
        </p>
      ) : null}

      <div className="mt-auto pt-6">
        <PricingCta intent={ctaIntent} />
      </div>
    </article>
  );
}

export function PricingPlans() {
  const [currency, setCurrency] = useState<Currency>("INR");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [inrPerUsd, setInrPerUsd] = useState(DEFAULT_INR_PER_USD);
  const [rateMeta, setRateMeta] = useState<{ provider: string; asOf: string } | null>(null);
  const [pricing, setPricing] = useState<{
    free?: { aiLimitMonthly?: number; orgMemberLimit?: number; orgCreationLimit?: number };
    pro?: {
      launch?: {
        monthlyPriceInr?: number;
        yearlyPriceInr?: number;
        slotsTotal?: number;
        slotsRemaining?: number;
        orgCreationLimit?: null;
      };
      standard?: {
        monthlyPriceInr?: number;
        yearlyPriceInr?: number;
        orgCreationLimit?: null;
      };
    };
    team?: {
      monthlyPriceInr?: number;
      yearlyPriceInr?: number;
      aiLimitMonthly?: number;
    };
  } | null>(null);

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
        // keep fallback
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/public/billing/pricing`);
        const data = (await res.json()) as typeof pricing;
        if (!res.ok) return;
        setPricing(data);
      } catch {
        // ignore
      }
    })();
  }, []);

  const launchTotal = pricing?.pro?.launch?.slotsTotal ?? 20;
  const launchRemaining = pricing?.pro?.launch?.slotsRemaining ?? 20;
  const launchAvailable = launchRemaining > 0;

  const freeAi = pricing?.free?.aiLimitMonthly ?? 50;
  const freeMembers = pricing?.free?.orgMemberLimit ?? 5;
  const freeOrganizations = pricing?.free?.orgCreationLimit ?? 3;
  const teamAi = pricing?.team?.aiLimitMonthly ?? 200;

  const proLaunchMonthly = pricing?.pro?.launch?.monthlyPriceInr ?? 399;
  const proLaunchYearly = pricing?.pro?.launch?.yearlyPriceInr ?? 3588;
  const proStandardMonthly = pricing?.pro?.standard?.monthlyPriceInr ?? 599;
  const proStandardYearly = pricing?.pro?.standard?.yearlyPriceInr ?? 5988;
  const teamMonthly = pricing?.team?.monthlyPriceInr ?? 799;
  const teamYearly = pricing?.team?.yearlyPriceInr ?? 8388;

  const proPriceInr =
    billingInterval === "YEARLY"
      ? launchAvailable
        ? proLaunchYearly
        : proStandardYearly
      : launchAvailable
        ? proLaunchMonthly
        : proStandardMonthly;

  const proCompareInr =
    launchAvailable
      ? billingInterval === "YEARLY"
        ? proStandardYearly
        : proStandardMonthly
      : null;

  const proPrice = formatMoney(currency, proPriceInr, inrPerUsd);
  const proComparePrice =
    typeof proCompareInr === "number" ? formatMoney(currency, proCompareInr, inrPerUsd) : null;
  const teamPrice = formatMoney(
    currency,
    billingInterval === "YEARLY" ? teamYearly : teamMonthly,
    inrPerUsd
  );

  const proMonthlyEffective = formatMoney(
    currency,
    (launchAvailable ? proLaunchYearly : proStandardYearly) / 12,
    inrPerUsd
  );
  const teamMonthlyEffective = formatMoney(currency, teamYearly / 12, inrPerUsd);

  const freeFeatures: FeatureItem[] = [
    { label: "3 personal projects", included: true },
    { label: "1k errors / mo", included: true },
    { label: `${freeAi} AI / mo`, included: true },
    { label: `${freeOrganizations} organizations`, included: true },
    { label: `${freeMembers} org members`, included: true },
    { label: "Unlimited AI", included: false },
    { label: "Unlimited organizations", included: false }
  ];

  const proFeatures: FeatureItem[] = [
    { label: "Unlimited projects", included: true },
    { label: "Unlimited errors", included: true },
    { label: "Unlimited AI", included: true },
    { label: "Unlimited organizations", included: true },
    { label: "No limit to add member by you", included: true },
    { label: "Works in every org", included: true },
    { label: "Launch pricing", included: true }
  ];

  const teamFeatures: FeatureItem[] = [
    { label: "Org-wide billing", included: true },
    { label: "Unlimited org scale", included: true },
    { label: `${teamAi} shared AI / mo`, included: true },
    { label: "No limit to add member", included: true },
    { label: "Shared workflows", included: true },
    { label: "Unlimited organizations", included: false },
    { label: "Unlimited personal AI", included: false }
  ];

  return (
    <>
      <section className="mt-8 overflow-hidden rounded-[40px] border border-border bg-card/80 p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Pricing
            </p>
            <h2 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">
              Choose the plan that works for you.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">
              Start free, unlock unlimited personal AI with Pro, or move your organization onto a
              shared Team plan.
            </p>
          </div>

          <div className="flex items-center rounded-full border border-border bg-background/70 p-1.5 text-sm font-semibold text-text-secondary shadow-sm">
            <button
              type="button"
              onClick={() => setBillingInterval("YEARLY")}
              className={`rounded-full px-4 py-2 transition ${
                billingInterval === "YEARLY"
                  ? "bg-card text-text-primary shadow-sm"
                  : "hover:bg-secondary/40"
              }`}
            >
              Annually
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("MONTHLY")}
              className={`rounded-full px-4 py-2 transition ${
                billingInterval === "MONTHLY"
                  ? "bg-card text-text-primary shadow-sm"
                  : "hover:bg-secondary/40"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-medium text-text-primary">
            First {launchTotal} Pro customers get {formatMoney(currency, proLaunchMonthly, inrPerUsd)}/month instead of{" "}
            {formatMoney(currency, proStandardMonthly, inrPerUsd)}/month.
          </div>
          <div className="rounded-full border border-border bg-background/60 px-3 py-1.5">
            {currency === "INR" ? "INR pricing" : "USD display"}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-background/70 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`rounded-full px-3 py-1.5 transition ${
                currency === "INR" ? "bg-card text-text-primary shadow-sm" : "hover:bg-secondary/40"
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`rounded-full px-3 py-1.5 transition ${
                currency === "USD" ? "bg-card text-text-primary shadow-sm" : "hover:bg-secondary/40"
              }`}
            >
              $ USD
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <PlanCard
          name="Free"
          description="Core monitoring for early builds and smaller teams."
          price={currency === "INR" ? "₹0" : "$0"}
          periodLabel="per month"
          note="Start without a card"
          footnote="Good for validating TraceForge in a live project before your usage grows."
          features={freeFeatures}
          ctaIntent="free"
        />

        <PlanCard
          name="Pro"
          description="Unlimited personal AI for solo power users."
          price={proPrice}
          periodLabel={billingInterval === "YEARLY" ? "per year" : "per month"}
          comparePrice={proComparePrice}
          note={
            launchAvailable
              ? billingInterval === "YEARLY"
                ? `Launch offer: ${formatMoney(currency, proLaunchYearly, inrPerUsd)}/year instead of ${formatMoney(currency, proStandardYearly, inrPerUsd)}/year`
                : `Launch offer: ${formatMoney(currency, proLaunchMonthly, inrPerUsd)}/month instead of ${formatMoney(currency, proStandardMonthly, inrPerUsd)}/month`
              : billingInterval === "YEARLY"
                ? `${proMonthlyEffective} per month when billed yearly`
                : "Billed monthly"
          }
          footnote={
            billingInterval === "YEARLY"
              ? `Save ₹${(
                  (launchAvailable ? proLaunchMonthly : proStandardMonthly) * 12 -
                  (launchAvailable ? proLaunchYearly : proStandardYearly)
                ).toLocaleString("en-IN")} vs monthly billing.`
              : launchAvailable
                ? `${launchRemaining} of ${launchTotal} launch slots left.`
                : "Standard Pro pricing is active."
          }
          badge={launchAvailable ? "Launch offer" : "Popular"}
          featured
          features={proFeatures}
          ctaIntent="pro"
        />

        <PlanCard
          name="Team"
          description="Shared AI and centralized billing for one organization."
          price={teamPrice}
          periodLabel={billingInterval === "YEARLY" ? "per year" : "per month"}
          note={
            billingInterval === "YEARLY"
              ? `${teamMonthlyEffective} per month when billed yearly`
              : "Billed monthly"
          }
          footnote={
            billingInterval === "YEARLY"
              ? `Save ₹${(teamMonthly * 12 - teamYearly).toLocaleString("en-IN")} vs monthly billing.`
              : "Best for growing engineering teams that need shared capacity."
          }
          features={teamFeatures}
          ctaIntent="team"
        />
      </section>

      <p className="mt-6 text-xs text-text-secondary">
        USD prices use live USD/INR conversion for display only. Billing is charged in INR via Razorpay.
        {rateMeta
          ? ` Source: ${rateMeta.provider} • as of ${new Date(rateMeta.asOf).toLocaleString()}.`
          : null}
      </p>
    </>
  );
}
