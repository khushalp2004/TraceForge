import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Solutions",
  description: "See how TraceForge solves complex monitoring challenges for your tech stack.",
  path: "/solutions",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
