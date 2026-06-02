"use client";

import { Mail, Sparkles, ArrowRight, Github, Linkedin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AuthToast from "./AuthToast";
import SiteHeader from "./SiteHeader";

const marketingRoots = [
  "/",
  "/product",
  "/pricing",
  "/solutions",
  "/docs",
  "/about",
  "/blog",
  "/terms",
  "/privacy",
  "/security",
  "/help",
  "/contact"
];

const isMarketingRoute = (pathname: string) => {
  if (pathname === "/") return true;
  return marketingRoots.some((root) => root !== "/" && pathname.startsWith(root));
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function MarketingShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const showMarketing = isMarketingRoute(pathname);
  const year = new Date().getFullYear();
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() || "https://www.linkedin.com/company/traceforge";
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscribeState, setSubscribeState] = useState<"idle" | "loading">("idle");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const normalizedPath = useMemo(() => pathname || "/", [pathname]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = subscriberEmail.trim().toLowerCase();

    if (!email) {
      setToast({ message: "Enter your email to get TraceForge updates.", tone: "error" });
      return;
    }

    setSubscribeState("loading");
    setToast(null);

    try {
      const response = await fetch(`${API_URL}/marketing/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          sourcePath: normalizedPath
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to subscribe right now");
      }

      setSubscriberEmail("");
      setToast({
        message: "You’re on the list. We’ll send product updates and launch offers here.",
        tone: "success"
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Unable to subscribe right now",
        tone: "error"
      });
    } finally {
      setSubscribeState("idle");
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {showMarketing ? <SiteHeader /> : null}
      {children}
      <AuthToast toast={toast} />
      {showMarketing ? (
        <footer className="border-t border-border bg-card relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.15),transparent_50%)] pointer-events-none"></div>
          <div className="tf-container px-[24px] py-16 sm:px-[30px] sm:py-20 relative z-10">
            {/* CTA Banner */}
            <div className="relative mb-20 overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,hsl(var(--foreground)/0.03),hsl(var(--foreground)/0.01))] border border-border p-8 sm:p-12 shadow-[0_0_80px_hsl(var(--primary)/0.1)] backdrop-blur-xl">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 animate-pulse-slow"></div>
              
              <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-6">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Stay in the loop</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl leading-tight">
                    Ship faster with <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">confidence.</span>
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-text-secondary max-w-lg">
                    Join thousands of developers getting TraceForge updates, early access to new features, and practical workflow tips.
                  </p>
                </div>

                <div className="relative z-10 w-full max-w-md lg:ml-auto">
                  <div className="rounded-3xl border border-border bg-background/50 p-2 backdrop-blur-md shadow-xl">
                    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubscribe}>
                      <div className="relative flex-1">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                        <input
                          type="email"
                          value={subscriberEmail}
                          onChange={(e) => {
                            setSubscriberEmail(e.target.value);
                            if (toast) setToast(null);
                          }}
                          placeholder="Enter your work email"
                          className="w-full h-12 bg-transparent pl-12 pr-4 text-sm text-text-primary placeholder:text-text-secondary outline-none rounded-2xl transition-all focus:bg-foreground/5"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={subscribeState === "loading"}
                        className="h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover hover:scale-[1.02] disabled:opacity-70 sm:w-auto"
                      >
                        {subscribeState === "loading" ? "Joining..." : "Subscribe"}
                        {!subscribeState || subscribeState === "idle" ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    </form>
                  </div>
                  <p className="mt-4 text-center text-xs text-text-secondary font-medium">
                    No spam. Unsubscribe anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Grid */}
            <div className="grid gap-12 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.8fr]">
              <div className="max-w-sm">
                <Link href="/" className="inline-flex items-center gap-2 group">
                  <Image 
                    src="https://res.cloudinary.com/drri6ut0i/image/upload/v1779566028/traceforge/traceforge-logo.png" 
                    alt="TraceForge logo" 
                    width={32} 
                    height={32} 
                    className="w-8 h-8 transition-transform group-hover:scale-110 pointer-events-none select-none"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                  />
                  <span className="text-xl font-bold tracking-tight text-text-primary">TraceForge</span>
                </Link>
                <p className="mt-5 text-sm leading-relaxed text-text-secondary">
                  Intelligent error monitoring that groups noise, routes alerts smartly, and carries full incident context into your workflow.
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-text-primary">Product</p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/product">Product</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/solutions">Solutions</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/pricing">Pricing</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/docs">Docs</Link>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-text-primary">Company</p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/about">About</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/blog">Blog</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/signin">Sign in</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/signup">Create account</Link>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-text-primary">Support</p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/terms">Terms</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/privacy">Privacy</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/security">Security</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/contact">Contact us</Link>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-text-primary">Start here</p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/docs">Quickstart</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/pricing">Compare plans</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/solutions">See workflows</Link>
                  <Link className="block transition-all hover:text-primary hover:translate-x-1" href="/blog/repo-analysis-for-faster-onboarding">Repo analysis</Link>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-16 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-text-secondary">
                © {year} TraceForge. Built for calmer production.
              </p>
              
              <div className="flex items-center gap-4 text-text-secondary">
                <a href="https://github.com/khushalp2004/TraceForge" target="_blank" rel="noreferrer" className="transition-colors hover:text-text-primary">
                  <span className="sr-only">GitHub</span>
                  <Github className="h-4 w-4" />
                </a>
                <a href={linkedinUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-text-primary">
                  <span className="sr-only">LinkedIn</span>
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </>
  );
}
