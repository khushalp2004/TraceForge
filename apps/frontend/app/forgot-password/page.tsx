"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setStatus(null);

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

      setStatus("If the email exists, a reset link was sent. Check server logs.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="tf-page pb-20 pt-16">
      <div className="tf-container max-w-md">
        <div className="tf-card p-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Enter your account email to receive a reset link.
          </p>
          <div className="mt-6 space-y-4">
            <input
              className="tf-input w-full"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              className="tf-button w-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            {status && <p className="text-sm text-text-secondary">{status}</p>}
            <Link className="tf-link" href="/dashboard">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
