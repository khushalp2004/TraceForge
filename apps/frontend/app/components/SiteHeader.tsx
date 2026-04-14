"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useGlobalSearch } from "./GlobalSearchProvider";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useAuth();
  const { openSearch } = useGlobalSearch();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (target && !headerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const activePath = useMemo(() => {
    if (!pathname) return "/";
    if (pathname.startsWith("/product")) return "/product";
    if (pathname.startsWith("/pricing")) return "/pricing";
    if (pathname.startsWith("/solutions")) return "/solutions";
    if (pathname.startsWith("/docs")) return "/docs";
    if (pathname.startsWith("/about")) return "/about";
    if (pathname.startsWith("/blog")) return "/blog";
    return "/";
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-[60] border-b border-border/60 bg-background/75 backdrop-blur"
    >
      <div className="tf-container flex items-center justify-between gap-4 px-[30px] py-3">
        <Link href="/" className="flex items-center gap-1">
          <Image
            src="/traceforge-logo.svg"
            alt="TraceForge logo"
            width={44}
            height={44}
            className="h-14 w-14 object-contain"
          />
          <div>
            <p className="text-lg font-semibold leading-none text-text-primary">TraceForge</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          <Link
            className={`tf-navlink ${activePath === "/product" ? "text-text-primary" : ""}`}
            href="/product"
          >
            Product
          </Link>
          <Link
            className={`tf-navlink ${activePath === "/pricing" ? "text-text-primary" : ""}`}
            href="/pricing"
          >
            Pricing
          </Link>
          <Link
            className={`tf-navlink ${activePath === "/solutions" ? "text-text-primary" : ""}`}
            href="/solutions"
          >
            Solutions
          </Link>
          <Link
            className={`tf-navlink ${activePath === "/docs" ? "text-text-primary" : ""}`}
            href="/docs"
          >
            Docs
          </Link>
          <Link
            className={`tf-navlink ${activePath === "/about" ? "text-text-primary" : ""}`}
            href="/about"
          >
            About
          </Link>
          <Link
            className={`tf-navlink ${activePath === "/blog" ? "text-text-primary" : ""}`}
            href="/blog"
          >
            Blog
          </Link>
        </nav>

        <div className="hidden items-center gap-3 text-sm font-semibold text-text-secondary lg:flex">
          <button
            type="button"
            onClick={() => openSearch()}
            className="relative hidden max-w-sm flex-1 xl:block"
            aria-label="Open global search"
          >
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <span className="flex h-10 w-full items-center rounded-2xl border border-border/70 bg-card/70 pl-11 pr-4 text-left text-sm text-text-secondary shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-card">
              Search TraceForge
              <span className="ml-auto rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                /
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => openSearch()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text-secondary shadow-sm transition-all duration-200 hover:border-primary/30 hover:text-text-primary xl:hidden"
            aria-label="Open global search"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          {isLoggedIn ? (
            <Link className="tf-button inline-flex items-center px-4 py-1.5 text-sm" href="/dashboard">
              Dashboard
              <svg className="ml-2 h-3 w-3" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M3 2 L8 5 L3 8 Z" fill="currentColor" />
              </svg>
            </Link>
          ) : (
            <>
              <Link className="tf-navlink" href="/signin">
                Login
              </Link>
              <Link className="tf-button px-4 py-1.5 text-sm" href="/signup">
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => openSearch()}
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-3 py-2 text-text-secondary shadow-sm transition-all duration-200 hover:text-text-primary"
            aria-label="Open global search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-3 py-2 text-text-secondary shadow-sm transition-all duration-200 hover:text-text-primary"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-full z-[61] rounded-b-[32px] border-t border-border/60 bg-background/95 shadow-[0_20px_48px_hsl(var(--foreground)/0.08)] backdrop-blur-md lg:hidden">
          <div className="tf-container px-[30px] pb-5 pt-3">
            <div className="overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-xl">
              {[
                { label: "Product", href: "/product" },
                { label: "Pricing", href: "/pricing" },
                { label: "Solutions", href: "/solutions" },
                { label: "Docs", href: "/docs" },
                { label: "About", href: "/about" },
                { label: "Blog", href: "/blog" }
              ].map((item, idx, arr) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between px-4 py-3.5 text-sm font-semibold ${
                    activePath === item.href ? "bg-secondary/70 text-text-primary" : "text-text-primary"
                  } ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}
                >
                  {item.label}
                  <span className="text-text-secondary">›</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              {isLoggedIn ? (
                <Link
                  className="tf-button inline-flex w-full items-center justify-center px-4 py-2 text-sm"
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                >
                  Dashboard
                  <svg className="ml-2 h-3 w-3" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M3 2 L8 5 L3 8 Z" fill="currentColor" />
                  </svg>
                </Link>
              ) : (
                <>
                  <Link
                    className="tf-button w-full justify-center px-6 py-2 text-sm"
                    href="/signup"
                    onClick={() => setOpen(false)}
                  >
                    Get Started
                  </Link>
                  <Link
                    className="tf-button-ghost w-full justify-center px-6 py-2 text-sm"
                    href="/signin"
                    onClick={() => setOpen(false)}
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
