import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({
  title: "Pricing",
  description: "Simple, transparent pricing for engineering teams of all sizes.",
  path: "/pricing",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
