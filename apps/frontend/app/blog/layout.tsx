import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Blog",
  description: "Read the latest updates, engineering insights, and news from TraceForge.",
  path: "/blog",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
