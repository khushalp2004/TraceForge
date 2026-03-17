"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setStatus(null);

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

      setStatus("Password reset successful. You can log in now.");
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
            Set a new password
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Use the link you received to continue.
          </p>
          <div className="mt-6 space-y-4">
            <input
              className="tf-input w-full"
              placeholder="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              className="tf-button w-full"
              onClick={handleSubmit}
              disabled={loading || !token}
            >
              {loading ? "Resetting..." : "Reset password"}
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
