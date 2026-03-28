"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";

const marketingRoots = [
  "/",
  "/product",
  "/pricing",
  "/solutions",
  "/docs",
  "/about",
  "/blog"
];

const isMarketingRoute = (pathname: string) => {
  if (pathname === "/") return true;
  return marketingRoots.some((root) => root !== "/" && pathname.startsWith(root));
};

export default function MarketingShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const showMarketing = isMarketingRoute(pathname);

  return (
    <>
      {showMarketing ? <SiteHeader /> : null}
      {children}
      {showMarketing ? (
        <footer className="border-t border-border bg-card">
          <div className="tf-container flex flex-wrap items-center justify-between gap-3 px-[30px] py-6 text-xs text-text-secondary">
            <p>
              <Link href="/" className="transition hover:text-text-primary">
                TraceForge
              </Link>{" "}
              · <span className="font-semibold text-text-secondary">Forged for calm production.</span>
            </p>
            <div className="flex items-center gap-4">
              <a className="tf-navlink" href="/docs">
                Documentation
              </a>
              <a className="tf-navlink" href="/signin">
                Status
              </a>
              <a className="tf-navlink" href="/forgot">
                Support
              </a>
            </div>
          </div>
        </footer>
      ) : null}
    </>
  );
}
