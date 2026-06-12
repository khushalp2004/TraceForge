import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Forgot Password",
  description: "Reset your TraceForge workspace password.",
  path: "/forgot",
  noIndex: true
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
