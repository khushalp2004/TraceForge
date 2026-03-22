import type { Metadata } from "next";
import DashboardShell from "./components/DashboardShell";
import { createPageMetadata } from "../seo";

export const metadata: Metadata = createPageMetadata({
  title: "Dashboard",
  description: "Private TraceForge workspace for monitoring projects, issues, alerts, and releases.",
  path: "/dashboard",
  noIndex: true
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
