"use client";

import { useMemo, useState } from "react";
import { LoadingButtonContent } from "../../components/ui/loading-button-content";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ToastState = {
  message: string;
  tone: "success" | "error";
};

export default function HelpForm() {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const remainingHint = useMemo(() => {
    const remaining = Math.max(0, 20 - problem.trim().length);
    return remaining > 0 ? `Add ${remaining} more characters for enough detail.` : "Looks detailed enough.";
  }, [problem]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const replyEmail = email.trim();
    setSubmitting(true);
    setToast(null);

    try {
      const res = await fetch(`${API_URL}/support/help`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: replyEmail,
          problem
        })
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to send your request right now");
      }

      setEmail("");
      setProblem("");
      setToast({
        message: `Your help request was sent. We will reply to your ${replyEmail}.`,
        tone: "success"
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Unable to send your request right now",
        tone: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="rounded-3xl border border-border bg-card/95 p-8 shadow-sm">
        <p className="tf-kicker">Help</p>
        <h1 className="tf-title mt-4 text-3xl">Tell us what’s blocking you</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
          Share the email we should reply to and describe the problem clearly. For now, help
          requests are routed directly to the TraceForge company inbox.
        </p>

        <form className="mt-8 grid gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="help-email">
              Your email
            </label>
            <input
              id="help-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-2xl border border-border bg-card px-4 text-sm text-text-primary outline-none transition focus:border-primary/40"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="help-problem">
              What problem are you facing?
            </label>
            <textarea
              id="help-problem"
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              className="min-h-[180px] rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-primary/40"
              placeholder="Describe the issue, what you expected, what happened instead, and any page or workflow involved."
              required
            />
            <p className="text-xs text-text-secondary">{remainingHint}</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/25 px-4 py-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <p>
              Submit your issue and we’ll reply on the email you enter above.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="tf-button justify-center px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LoadingButtonContent
                loading={submitting}
                idleLabel="Submit request"
                loadingLabel="Submitting..."
              />
            </button>
          </div>
        </form>
      </section>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-xl ${
              toast.tone === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}
