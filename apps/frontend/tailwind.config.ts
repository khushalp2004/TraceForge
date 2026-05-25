import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Premium TraceForge Light Theme
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        "text-primary": "hsl(var(--text-primary) / <alpha-value>)",
        "text-secondary": "hsl(var(--text-secondary) / <alpha-value>)",
        "primary-hover": "hsl(var(--primary-hover) / <alpha-value>)",
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          soft: "hsl(var(--accent-soft) / <alpha-value>)",
        },
        sidebar: "hsl(var(--sidebar) / <alpha-value>)",
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          soft: "hsl(var(--destructive-soft) / <alpha-value>)",
          border: "hsl(var(--destructive-border) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Custom TraceForge
        "trace-gold": "#F59E0B",
        "trace-gold-light": "#FFF7ED",
        "trace-gold-gradient": "linear-gradient(135deg, #F59E0B 0%, #FFF7ED 100%)",
        error: "#EF4444",
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
          border: "hsl(var(--warning-border) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
          border: "hsl(var(--success-border) / <alpha-value>)",
        },
        ink: "#1F2937",
      },
      borderRadius: {
        none: "0px",
        sm: "0.75rem",
        DEFAULT: "1rem",
        md: "1rem",
        lg: "1.25rem",
        xl: "1.5rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
        full: "9999px",
      },
      borderWidth: {
        DEFAULT: "0px",
        "0": "0px",
        "1": "1px",
        "2": "2px",
        "3": "3px",
        "4": "4px",
      },
      boxShadow: {
        premium:
          "0 1px 2px hsl(var(--foreground) / 0.04), 0 4px 12px hsl(var(--foreground) / 0.06), 0 16px 40px hsl(var(--foreground) / 0.06)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.08), 0 8px 24px hsl(var(--primary) / 0.10), 0 2px 6px hsl(var(--foreground) / 0.04)",
        lifted:
          "0 2px 4px hsl(var(--foreground) / 0.03), 0 12px 28px hsl(var(--foreground) / 0.07)",
      },
      backdropBlur: {
        premium: "20px",
      },
      animation: {
        "glow-pulse": "glowPulse 2s ease-in-out infinite alternate",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        "stagger-fade-up": "staggerFadeUp 0.5s ease-out both",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
