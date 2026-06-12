import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Verify Email",
  description: "Verify your email address to access your TraceForge workspace.",
  path: "/verify",
  noIndex: true
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
