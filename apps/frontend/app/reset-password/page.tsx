import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createPageMetadata } from "../seo";

type LegacyPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const buildQueryString = (params?: Record<string, string | string[] | undefined>) => {
  const query = new URLSearchParams();

  if (!params) {
    return "";
  }

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    if (typeof value === "string") {
      query.set(key, value);
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

export const metadata: Metadata = createPageMetadata({
  title: "Reset Password",
  description: "Legacy password reset route for TraceForge.",
  path: "/reset-password",
  noIndex: true
});

export default function LegacyResetPasswordPage({ searchParams }: LegacyPageProps) {
  redirect(`/reset${buildQueryString(searchParams)}`);
}
