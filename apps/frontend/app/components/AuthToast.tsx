"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type AuthToastProps = {
  toast: {
    message: string;
    tone: "error" | "success" | "info";
  } | null;
};

export default function AuthToast({ toast }: AuthToastProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6 flex flex-col gap-2">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-start gap-3.5 rounded-[20px] border shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl px-4 py-3.5 ${
              toast.tone === "error"
                ? "bg-red-500/10 border-red-500/20 text-red-500"
                : toast.tone === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-blue-500/10 border-blue-500/20 text-blue-500"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.tone === "error" && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            {toast.tone === "success" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
            {toast.tone === "info" && <Info className="mt-0.5 h-5 w-5 shrink-0" />}
            <p className="text-[14px] font-medium leading-relaxed text-text-primary">
              {toast.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
