"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught error:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-text-primary p-4">
      <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong!</h2>
      <div className="bg-card/50 border border-border p-6 rounded-xl max-w-2xl overflow-auto text-sm text-left">
        <p className="font-mono text-red-400 mb-2">{error.name}: {error.message}</p>
        <pre className="text-text-secondary whitespace-pre-wrap">{error.stack}</pre>
      </div>
      <button
        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
