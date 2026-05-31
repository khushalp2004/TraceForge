import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Contact",
  description: "Get in touch with the TraceForge team.",
  path: "/contact",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
