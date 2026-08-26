"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LoadingButtonContent } from "../../components/ui/loading-button-content";
import AuthToast from "../components/AuthToast";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const postAuthToastKey = "traceforge_post_auth_toast";



export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen bg-background items-center justify-center"><div className="h-6 w-28 animate-pulse rounded-full bg-secondary/70" /></div>}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, isReady, token } = useAuth();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const next = searchParams.get("next") || "/dashboard";
  const sent = searchParams.get("sent") === "1";

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      router.replace(next);
    }
  }, [isReady, token, next, router]);

  useEffect(() => {
    if (!sent) return;
    setToast({
      message: `Verification code sent to ${initialEmail || "your email address"}.`,
      tone: "success"
    });
  }, [sent, initialEmail]);

  const maskedEmail = useMemo(() => {
    const trimmed = email.trim();
    const [localPart, domain] = trimmed.split("@");
    if (!localPart || !domain) return trimmed;
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.length > 4 ? localPart.slice(-1) : "";
    return `${visibleStart}${"*".repeat(Math.max(localPart.length - 3, 1))}${visibleEnd}@${domain}`;
  }, [email]);

  const otpSlots = useMemo(() => Array.from({ length: 6 }, (_, index) => code[index] ?? ""), [code]);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) {
      setToast({ message: "Email and verification code are required.", tone: "error" });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          postAuthToastKey,
          JSON.stringify({
            message: "Email verified successfully.",
            tone: "success"
          })
        );
      }

      login(data.token, data.user);
      router.replace(next);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setToast({ message: "Enter your email before requesting a new code.", tone: "error" });
      return;
    }

    setResending(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error?.includes("1 minute")) {
           setResendCountdown(60);
        }
        throw new Error(data.error || "Could not resend verification code");
      }

      setResendCountdown(60);
      setToast({
        message: `A new verification code was sent to ${email.trim()}.`,
        tone: "success"
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setResending(false);
    }
  };

  if (!isReady) {
    return (
      <main className="flex h-screen w-screen bg-background items-center justify-center overflow-hidden">
        <div className="h-6 w-28 animate-pulse rounded-full bg-secondary/70" />
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen w-screen bg-background text-text-primary font-sans overflow-hidden selection:bg-orange-500/30 selection:text-orange-100">
      <AuthToast toast={toast} />
      
      {/* HEADER */}
      <div className="flex-none">
        <SiteHeader />
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Form */}
        <div className="relative z-10 flex h-full w-full flex-col items-center px-6 md:w-1/2 md:px-12 xl:px-24 py-8 md:py-12 overflow-y-auto tf-scroll-rail">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[380px] my-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-[3.25rem] font-serif leading-[1.1] tracking-[-0.02em] text-text-primary font-light mb-3">
                Verify your<br/>email
              </h1>
              <p className="text-[16px] text-text-primary/80 font-serif">
                Check your inbox for the six-digit code.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/40 p-5 sm:p-6 bg-card/40 shadow-sm">
              <div className="space-y-4">
                
                <div>
                  <input
                    className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                    placeholder="Email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div
                    className="relative cursor-text rounded-[12px] border border-border/60 bg-secondary/20 p-3 mt-1 hover:border-border/80 transition-colors"
                    onClick={() => codeInputRef.current?.focus()}
                  >
                    <input
                      ref={codeInputRef}
                      className="absolute inset-0 z-10 opacity-0"
                      placeholder="000000"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="Verification code"
                    />
                    <div className="grid grid-cols-6 gap-2 sm:gap-3 relative">
                      {otpSlots.map((digit, index) => {
                        const isActive = index === Math.min(code.length, 5);
                        const isFilled = Boolean(digit);

                        return (
                          <div
                            key={`otp-slot-${index}`}
                            className={`relative flex h-14 items-center justify-center rounded-[12px] border text-xl font-medium transition-all duration-300 sm:h-16 sm:text-2xl ${
                              isActive
                                ? "border-primary/60 bg-card/60 shadow-[0_0_15px_hsl(var(--primary)/0.2)] scale-105 z-10"
                                : isFilled
                                ? "border-border/60 bg-secondary/30 text-text-primary"
                                : "border-border/40 bg-secondary/10 text-text-secondary/40"
                            }`}
                          >
                            {digit && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                              >
                                {digit}
                              </motion.span>
                            )}
                            {isActive && !isFilled && (
                              <motion.div
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="absolute h-6 w-[2px] bg-primary rounded-full"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary/80">
                    Expires in 10 minutes. Code sent to {maskedEmail || "your email address"}.
                  </p>
                </div>

                <button
                  className="flex h-[44px] w-full items-center justify-center rounded-[8px] bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-50 mt-2"
                  onClick={handleVerify}
                  disabled={loading}
                >
                  <LoadingButtonContent
                    loading={loading}
                    loadingLabel="Verifying..."
                    idleLabel="Verify email"
                  />
                </button>

                <div className="flex items-center justify-between gap-3 pt-3 text-[13px]">
                  <button
                    type="button"
                    className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                    onClick={handleResend}
                    disabled={resending || resendCountdown > 0}
                  >
                    {resending ? "Sending..." : resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend code"}
                  </button>
                  <Link className="text-text-secondary hover:text-text-primary transition-colors" href="/signin">
                    Back to login
                  </Link>
                </div>

              </div>
            </div>
          </motion.div>
        </div>

        {/* RIGHT PANEL: Video Demo Container */}
        <div className="hidden md:flex w-1/2 h-auto mr-4 -mb-10 rounded-t-[2rem] bg-card/40 border border-border/40 overflow-hidden items-center justify-center shadow-2xl relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[85%] aspect-video rounded-[12px] overflow-hidden border border-border/30 bg-black/50 shadow-2xl relative mb-12"
          >
            <iframe
              src="https://player.cloudinary.com/embed/?cloud_name=dyv5wyxuz&public_id=xazri9ab0zo7z2ae6znd&player[autoplay]=true&player[loop]=true&player[muted]=true&player[controls]=false&player[show_logo]=false"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              frameBorder="0"
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 w-full h-full pointer-events-none select-none scale-[1.08]"
            ></iframe>
          </motion.div>
        </div>

      </div>
    </main>
  );
}
