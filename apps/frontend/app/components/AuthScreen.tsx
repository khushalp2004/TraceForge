"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Github,
} from "lucide-react";
import { motion } from "framer-motion";
import { LoadingButtonContent } from "../../components/ui/loading-button-content";
import { useAuth } from "../../context/AuthContext";
import AuthToast from "./AuthToast";
import SiteHeader from "./SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const postAuthToastKey = "traceforge_post_auth_toast";
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Use 10-64 characters with uppercase, lowercase, number, and special character.";
const buildGoogleStartUrl = (mode: "login" | "signup", next: string) =>
  `${API_URL}/auth/google/start?mode=${encodeURIComponent(mode)}&next=${encodeURIComponent(next)}`;
const buildGithubStartUrl = (mode: "login" | "signup", next: string) =>
  `${API_URL}/auth/github/start?mode=${encodeURIComponent(mode)}&next=${encodeURIComponent(next)}`;

type AuthScreenProps = {
  mode: "login" | "signup";
};

export default function AuthScreen({ mode }: AuthScreenProps) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <AuthScreenInner mode={mode} />
    </Suspense>
  );
}

function AuthScreenInner({ mode }: AuthScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isReady, token } = useAuth();
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const next = searchParams.get("next") || "/dashboard";
  const oauthError = searchParams.get("oauthError") || "";
  const oauthEmail = searchParams.get("email") || "";
  const socialSignupToken = searchParams.get("socialSignupToken") || "";
  const socialProviderParam = searchParams.get("socialProvider") || "";
  const socialPrefillName = searchParams.get("fullName") || "";
  const socialProvider =
    socialProviderParam === "github"
      ? "GitHub"
      : socialProviderParam === "google"
      ? "Google"
      : "";
  const isSocialSignupContinuation = mode === "signup" && Boolean(socialSignupToken);

  useEffect(() => {
    if (!isReady) return;
    if (token) {
      router.replace(next);
    }
  }, [isReady, token, next, router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!oauthError) return;
    const message =
      oauthError === "google_no_account"
        ? "No TraceForge account exists for this Google email yet. Please continue from sign up."
        : oauthError === "google_email_unverified"
        ? "Google did not return a verified email for this account."
        : oauthError === "google_not_configured"
        ? "Google sign-in is not configured yet."
        : oauthError === "github_no_account"
        ? "No TraceForge account exists for this GitHub email yet. Please continue from sign up."
        : oauthError === "github_not_configured"
        ? "GitHub sign-in is not configured yet."
        : oauthError === "github_auth_failed"
        ? "GitHub authentication failed. Please try again."
        : "Google authentication failed. Please try again.";

    setToast({ message, tone: "error" });
  }, [oauthError]);

  useEffect(() => {
    if (!isSocialSignupContinuation) return;
    if (oauthEmail) setEmail(oauthEmail);
    if (socialPrefillName) setFullName((current) => current || socialPrefillName);
  }, [isSocialSignupContinuation, oauthEmail, socialPrefillName]);

  const handleOauth = (provider: "Google" | "GitHub") => {
    setToast(null);
    if (provider === "Google") {
      window.location.href = buildGoogleStartUrl(mode, next);
      return;
    }
    window.location.href = buildGithubStartUrl(mode, next);
  };

  const handleSubmit = async () => {
    setToast(null);

    if (mode === "signup") {
      if (!fullName.trim() || !address.trim()) {
        setToast({ message: "Full name and address are required.", tone: "error" });
        return;
      }
      if (!agreedToTerms) {
        setToast({ message: "You must agree to the terms.", tone: "error" });
        return;
      }
      if (!passwordPolicy.test(password)) {
        setToast({ message: passwordPolicyMessage, tone: "error" });
        return;
      }
      if (!password || password !== confirmPassword) {
        setToast({ message: "Passwords do not match.", tone: "error" });
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "signup"
          ? isSocialSignupContinuation
            ? `${API_URL}/auth/oauth/complete-signup`
            : `${API_URL}/auth/register`
          : `${API_URL}/auth/login`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: mode === "signup" ? fullName : undefined,
          address: mode === "signup" ? address : undefined,
          signupToken: isSocialSignupContinuation ? socialSignupToken : undefined,
          email,
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.verificationRequired && data?.email) {
          router.push(
            `/verify?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(next)}`
          );
          return;
        }
        throw new Error(data.error || "Authentication failed");
      }

      if (mode === "signup" && data?.status === "verification_required" && data?.email) {
        router.push(
          `/verify?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(next)}&sent=1`
        );
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          postAuthToastKey,
          JSON.stringify({
              message:
                mode === "login"
                  ? "Signed in successfully."
                : isSocialSignupContinuation
                ? `${socialProvider || "Social"} account connected successfully.`
                : "Account created successfully.",
            tone: "success"
          })
        );
      }

      login(data.token, data.user);
      router.replace(data.next || next);
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
      
      {/* HEADER (Imported directly from SiteHeader to match homepage perfectly) */}
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
                {mode === "login" ? "Think fast,\nresolve faster" : "Start resolving\nissues faster"}
              </h1>
              <p className="text-[16px] text-text-primary/80 font-serif">
                {mode === "login" 
                  ? "Capture in production, debug in TraceForge" 
                  : "Create an account to unify your monitoring"}
              </p>
            </div>

            <div className="rounded-[24px] border border-border/40 p-5 sm:p-6 bg-card/40 shadow-sm">
              {!isSocialSignupContinuation && (
                <>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    className="group relative flex flex-1 items-center justify-center rounded-[8px] border border-border/60 bg-secondary/30 px-4 py-3 transition-all hover:bg-secondary/60"
                    onClick={() => handleOauth("Google")}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                      <path fill="#EA4335" d="M12 10.2v3.95h5.49c-.24 1.27-.97 2.34-2.06 3.07l3.33 2.58c1.94-1.79 3.06-4.42 3.06-7.54 0-.73-.07-1.43-.19-2.08H12z"/>
                      <path fill="#34A853" d="M12 21.9c2.77 0 5.1-.92 6.8-2.49l-3.33-2.58c-.92.62-2.1.99-3.47.99-2.67 0-4.94-1.8-5.75-4.23l-3.44 2.65c1.69 3.36 5.17 5.66 9.19 5.66z"/>
                      <path fill="#4285F4" d="M6.25 13.59c-.2-.62-.32-1.28-.32-1.97s.12-1.35.32-1.97L2.81 7c-.69 1.37-1.08 2.91-1.08 4.62s.39 3.25 1.08 4.62l3.44-2.65z"/>
                      <path fill="#FBBC05" d="M12 5.43c1.5 0 2.84.52 3.89 1.53l2.91-2.91C17.09 2.45 14.77 1.35 12 1.35 7.98 1.35 4.5 3.65 2.81 7l3.44 2.65C7.06 7.23 9.33 5.43 12 5.43z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="group relative flex flex-1 items-center justify-center rounded-[8px] border border-border/60 bg-secondary/30 px-4 py-3 transition-all hover:bg-secondary/60"
                    onClick={() => handleOauth("GitHub")}
                  >
                    <Github className="h-[18px] w-[18px]" />
                  </button>
                </div>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                      <span className="bg-background px-3 text-text-secondary/70">OR</span>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-3">
                {isSocialSignupContinuation && (
                  <div className="rounded-[8px] border border-border bg-card/50 px-4 py-3 mb-4">
                    <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                      {socialProvider || "Social"} Connected
                    </p>
                    <p className="mt-1 text-[13px] text-text-primary">{email}</p>
                  </div>
                )}

                {mode === "signup" && (
                  <>
                    <input
                      className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                      placeholder="Full name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                    <input
                      className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                      placeholder="Company address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  </>
                )}

                <input
                  className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  readOnly={isSocialSignupContinuation}
                />

                {mode === "signup" ? (
                  <>
                    <div className="relative">
                      <input
                        className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 pr-10 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                        placeholder="Create a password"
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
                    <div className="relative">
                      <input
                        className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 pr-10 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                        placeholder="Confirm password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    
                    <label className="flex items-start gap-3 p-1 mt-2">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(event) => setAgreedToTerms(event.target.checked)}
                        className="mt-1 flex-shrink-0 h-[14px] w-[14px] rounded border-border/80 bg-card text-primary focus:ring-primary focus:ring-offset-0 focus:ring-offset-transparent"
                      />
                      <span className="text-[12px] text-text-secondary leading-snug">
                        I agree to the{" "}
                        <Link className="text-text-primary hover:underline" href="/terms">Terms</Link>
                        {" "}and{" "}
                        <Link className="text-text-primary hover:underline" href="/privacy">Privacy Policy</Link>.
                      </span>
                    </label>
                  </>
                ) : (
                  <div className="relative">
                    <input
                      className="flex h-[44px] w-full rounded-[8px] border border-border/60 bg-secondary/30 px-4 pr-10 text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:border-text-primary focus:bg-card focus:outline-none transition-colors"
                      placeholder="Enter your password"
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
                )}

                {mode === "login" && (
                  <div className="flex justify-end pt-0.5 mb-1">
                    <Link className="text-[12px] text-text-secondary hover:text-text-primary transition-colors" href="/forgot">
                      Forgot password?
                    </Link>
                  </div>
                )}

                <button
                  className="flex h-[44px] w-full items-center justify-center rounded-[8px] bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-50 mt-2"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  <LoadingButtonContent
                    loading={loading}
                    loadingLabel={
                      mode === "login"
                        ? "Signing in..."
                        : isSocialSignupContinuation
                        ? "Completing account..."
                        : "Creating account..."
                    }
                    idleLabel={
                      mode === "login"
                        ? "Continue with email"
                        : isSocialSignupContinuation
                        ? "Complete account"
                        : "Continue with email"
                    }
                  />
                </button>
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
