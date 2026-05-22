"use client";

import { motion, AnimatePresence } from "framer-motion";

export function AnimatedPrice({
  value,
  format,
}: {
  value?: number | null;
  format: (val: number) => string;
}) {
  if (typeof value !== "number") {
    return <span>—</span>;
  }

  const formattedValue = format(value);

  return (
    <span className="inline-flex overflow-hidden tabular-nums align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={formattedValue}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="inline-block"
        >
          {formattedValue}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
