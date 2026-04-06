"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type AuthToastProps = {
  toast: {
    message: string;
    tone: "error" | "success" | "info";
  } | null;
};

export default function AuthToast({ toast }: AuthToastProps) {
  if (!toast) return null;

  const toneStyles =
    toast.tone === "error"
      ? {
          Icon: AlertCircle,
          className: "tf-danger-toast"
        }
      : toast.tone === "success"
        ? {
            Icon: CheckCircle2,
            className: "tf-success-toast"
          }
        : {
            Icon: Info,
            className: "tf-info-toast"
          };

  const Icon = toneStyles.Icon;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
      <div
        className={`flex items-start gap-3 rounded-[22px] border px-4 py-3.5 backdrop-blur ${toneStyles.className}`}
        role="status"
        aria-live="polite"
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-medium leading-6">{toast.message}</p>
      </div>
    </div>
  );
}
