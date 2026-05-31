import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Help Center",
  description: "Find answers and support for using TraceForge.",
  path: "/help",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
