import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "About Us",
  description: "Learn more about the team building TraceForge.",
  path: "/about",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
