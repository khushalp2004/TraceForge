import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Documentation",
  description: "Read the TraceForge documentation to learn how to integrate and use the platform.",
  path: "/docs",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
