import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Reset Password",
  description: "Create a new password to get back into your TraceForge workspace.",
  path: "/reset",
  noIndex: true
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
