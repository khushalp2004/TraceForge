import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Terms of Service",
  description: "TraceForge Terms of Service.",
  path: "/terms",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
