"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { LoadingButtonContent } from "../../components/ui/loading-button-content";
import AuthToast from "../components/AuthToast";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Use 10-64 characters with uppercase, lowercase, number, and special character.";

import { createPageMetadata } from "../seo";
export const metadata = createPageMetadata({
  title: "Reset Password",
  description: "Create a new password to get back into your TraceForge workspace.",
  path: "/reset",
  noIndex: true
});

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen bg-background items-center justify-center"><div className="h-6 w-28 animate-pulse rounded-full bg-secondary/70" /></div>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { isReady, token: authToken } = useAuth();
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubmit = async () => {
    if (!passwordPolicy.test(password)) {
      setToast({
        message: passwordPolicyMessage,
        tone: "error"
      });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reset failed");
      }

      setToast({
        message: "Password reset successful. You can log in now.",
        tone: "success"
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unexpected error.",
        tone: "error"
      });
    } finally {
      setLoading(false);
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
            className="w-full max-w-[360px] my-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-[3.25rem] font-serif leading-[1.1] tracking-[-0.02em] text-text-primary font-light mb-3">
                New password
              </h1>
              <p className="text-[16px] text-text-primary/80 font-serif">
                Create a new password to get back into your workspace.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/40 p-5 sm:p-6 bg-card/40 shadow-sm">
              <div className="space-y-4">
                
                <div>
                  <div className="relative">
                    <input
                      className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 pr-10 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                      placeholder="New password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
                    {passwordPolicyMessage}
                  </p>
                </div>

                <button
                  className="flex h-[44px] w-full items-center justify-center rounded-[8px] bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-50 mt-2"
                  onClick={handleSubmit}
                  disabled={loading || !token}
                >
                  <LoadingButtonContent
                    loading={loading}
                    loadingLabel="Resetting..."
                    idleLabel="Reset password"
                  />
                </button>

                <div className="flex items-center justify-between gap-3 pt-3 text-[13px]">
                  <Link className="text-text-secondary hover:text-text-primary transition-colors" href="/signin">
                    Back to login
                  </Link>
                  <Link className="text-text-secondary hover:text-text-primary transition-colors" href="/signup">
                    Need an account?
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
