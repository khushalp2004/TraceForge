"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const postAuthToastKey = "traceforge_post_auth_toast";

export default function OauthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token") || "";
    const next = searchParams.get("next") || "/dashboard";
    const mode = searchParams.get("mode") === "signup" ? "signup" : "login";

    if (!token) {
      setError("OAuth session is missing. Please try again.");
      return;
    }

    const completeLogin = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();
        if (!res.ok || !data.user) {
          throw new Error(data.error || "Failed to finish sign in");
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            postAuthToastKey,
            JSON.stringify({
              message:
                mode === "signup"
                  ? "Google account connected successfully."
                  : "Signed in with Google.",
              tone: "success"
            })
          );
        }

        login(token, data.user);
        router.replace(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to finish sign in");
      }
    };

    void completeLogin();
  }, [login, router, searchParams]);

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-xl">
        <section className="tf-card p-8">
          <p className="tf-kicker">Google OAuth</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">
            {error ? "We could not complete sign in" : "Finishing your sign in"}
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            {error
              ? error
              : "Please wait while we connect your Google account to TraceForge."}
          </p>

          {error ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="tf-button px-4 py-2 text-sm" href="/signin">
                Back to sign in
              </Link>
              <Link className="tf-button-ghost px-4 py-2 text-sm" href="/signup">
                Go to sign up
              </Link>
            </div>
          ) : (
            <div className="mt-6 h-11 animate-pulse rounded-full bg-secondary/70" />
          )}
        </section>
      </div>
    </main>
  );
}
