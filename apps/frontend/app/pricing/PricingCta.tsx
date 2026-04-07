"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const tokenKey = "traceforge_token";

type User = {
  plan: "FREE" | "DEV" | "PRO";
  planExpiresAt: string | null;
};

export function PricingCta({ intent }: { intent: "free" | "dev" | "pro" | "team" }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = typeof window === "undefined" ? null : localStorage.getItem(tokenKey);
    if (!token) return;

    void (async () => {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { user?: User };
      if (!res.ok || !data.user) return;
      setUser({ plan: data.user.plan, planExpiresAt: data.user.planExpiresAt ?? null });
    })();
  }, []);

  const isProActive = useMemo(() => {
    if (!user) return false;
    if (user.plan !== "PRO") return false;
    if (!user.planExpiresAt) return true;
    return new Date(user.planExpiresAt).getTime() > Date.now();
  }, [user]);

  if (intent === "free") {
    return (
      <Link className="tf-button mt-6 inline-flex px-4 py-2 text-xs" href={user ? "/dashboard" : "/signup"}>
        {user ? "Go to dashboard" : "Start free"}
      </Link>
    );
  }

  if (intent === "team") {
    return (
      <Link
        className="tf-button mt-6 inline-flex px-4 py-2 text-xs"
        href={user ? "/dashboard/billing?intent=team" : "/signup"}
      >
        {user ? "Choose Team" : "Start with Team"}
      </Link>
    );
  }

  if (intent === "dev") {
    return (
      <Link className="tf-button mt-6 inline-flex px-4 py-2 text-xs" href={user ? "/dashboard/billing" : "/signup"}>
        {user?.plan === "DEV" ? "Manage Dev plan" : user ? "Choose Dev" : "Start with Dev"}
      </Link>
    );
  }

  if (isProActive) {
    return (
      <Link className="tf-button mt-6 inline-flex px-4 py-2 text-xs" href="/dashboard/billing">
        Manage billing
      </Link>
    );
  }

  return (
    <Link className="tf-button mt-6 inline-flex px-4 py-2 text-xs" href={user ? "/dashboard/billing" : "/signup"}>
      {user ? "Upgrade to Pro" : "Start with Pro"}
    </Link>
  );
}
