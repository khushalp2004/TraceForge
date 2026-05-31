import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Security",
  description: "Learn how we protect your data at TraceForge.",
  path: "/security",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
