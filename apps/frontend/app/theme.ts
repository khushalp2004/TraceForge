export const THEME_STORAGE_KEY = "traceforge_theme";

export const THEMES = [
  {
    id: "trace-light",
    name: "Trace Light",
    mode: "Light",
    description: "Warm sandstone surfaces with the current amber TraceForge feel.",
    accentClass: "bg-[#F59E0B]",
    swatches: ["#FFF8F1", "#FFF1D8", "#F59E0B", "#1F2937"]
  },
  {
    id: "linen-light",
    name: "Mist Light",
    mode: "Light",
    description: "Cool porcelain surfaces with a calmer teal signal color for long review sessions.",
    accentClass: "bg-[#0F8AA8]",
    swatches: ["#F5FAFC", "#E7F0F4", "#0F8AA8", "#243447"]
  },
  {
    id: "sage-light",
    name: "Sage Light",
    mode: "Light",
    description: "Soft mineral greens with a calmer editorial feel and lower visual fatigue.",
    accentClass: "bg-[#4F8A5B]",
    swatches: ["#F6F8F3", "#E8EEE3", "#4F8A5B", "#22302A"]
  },
  {
    id: "graphite-dark",
    name: "Graphite Dark",
    mode: "Dark",
    description: "Refined charcoal surfaces with burnished ember highlights for focused night triage.",
    accentClass: "bg-[#F59E0B]",
    swatches: ["#12161C", "#1E232C", "#F59E0B", "#E8ECF1"]
  },
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    mode: "Dark",
    description: "Deep navy command center with crisp cyan highlights and cooler contrast.",
    accentClass: "bg-[#22C7E8]",
    swatches: ["#0B1220", "#13243F", "#22C7E8", "#E2E8F0"]
  },
  {
    id: "plum-dark",
    name: "Plum Dark",
    mode: "Dark",
    description: "Inky plum surfaces with magenta-violet accents for a richer night palette.",
    accentClass: "bg-[#C084FC]",
    swatches: ["#15111C", "#23192E", "#C084FC", "#F3E8FF"]
  }
] as const;

export type AppTheme = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: AppTheme = "graphite-dark";

export const isDarkTheme = (theme: AppTheme) =>
  theme === "graphite-dark" || theme === "midnight-dark" || theme === "plum-dark";
