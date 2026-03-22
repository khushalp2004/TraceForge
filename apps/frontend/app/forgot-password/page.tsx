import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Forgot Password",
  description: "Legacy password recovery route for TraceForge.",
  path: "/forgot-password",
  noIndex: true
});

export default function LegacyForgotPasswordPage() {
  redirect("/forgot");
}
