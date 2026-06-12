"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LoadingButtonContent } from "../../components/ui/loading-button-content";
import AuthToast from "../components/AuthToast";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";



export default function ForgotPasswordPage() {
  const { isReady } = useAuth();
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubmit = async () => {
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      setToast({
        message:
          "If the email exists, a reset link was sent. Check your inbox",
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
                Recover your<br/>account
              </h1>
              <p className="text-[16px] text-text-primary/80 font-serif">
                We&apos;ll email you instructions to reset your password.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/40 p-5 sm:p-6 bg-card/40 shadow-sm">
              <div className="space-y-3">
                <input
                  className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <button
                  className="flex h-[44px] w-full items-center justify-center rounded-[8px] bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-50 mt-2"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  <LoadingButtonContent
                    loading={loading}
                    loadingLabel="Sending link..."
                    idleLabel="Send reset link"
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
