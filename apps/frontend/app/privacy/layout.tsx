import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description: "TraceForge Privacy Policy.",
  path: "/privacy",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
