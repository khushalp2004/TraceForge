"use client";

import { motion } from "framer-motion";

export type SegmentedControlOption<T> = {
  label: string;
  value: T;
};

export type SegmentedControlProps<T extends string> = {
  name: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  shape?: "pill" | "rounded";
};

export function SegmentedControl<T extends string>({
  name,
  options,
  value,
  onChange,
  className = "",
  size = "md",
  shape = "pill"
}: SegmentedControlProps<T>) {
  const containerShape = shape === "pill" ? "rounded-full" : "rounded-lg";
  const buttonShape = shape === "pill" ? "rounded-full" : "rounded-md";
  const buttonSize = size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs";

  return (
    <div className={`relative inline-flex items-center ${containerShape} border border-border bg-secondary/40 p-1 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`relative ${buttonShape} ${buttonSize} font-semibold transition-colors duration-300 outline-none flex-1 ${
              isActive ? "text-primary-foreground" : "text-text-secondary hover:bg-secondary/80 hover:text-text-primary"
            }`}
            onClick={() => onChange(option.value)}
          >
            {isActive && (
              <motion.div
                layoutId={`segmented-control-bg-${name}`}
                className={`absolute inset-0 z-0 ${buttonShape} bg-primary shadow-sm`}
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
