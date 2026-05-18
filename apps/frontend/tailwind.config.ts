import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Premium TraceForge Light Theme
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "primary-hover": "hsl(var(--primary-hover))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
        },
        sidebar: "hsl(var(--sidebar))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
          border: "hsl(var(--destructive-border))",
        },
        border: "hsl(var(--foreground) / 0.06)",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Custom TraceForge
        "trace-gold": "#F59E0B",
        "trace-gold-light": "#FFF7ED",
        "trace-gold-gradient": "linear-gradient(135deg, #F59E0B 0%, #FFF7ED 100%)",
        error: "#EF4444",
        warning: {
          DEFAULT: "hsl(var(--warning))",
          soft: "hsl(var(--warning-soft))",
          border: "hsl(var(--warning-border))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
          border: "hsl(var(--success-border))",
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
      animation: {
        "glow-pulse": "glowPulse 2s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
