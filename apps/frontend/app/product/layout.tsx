import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Product",
  description: "Explore the core features of TraceForge's AI-powered error monitoring platform.",
  path: "/product",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
